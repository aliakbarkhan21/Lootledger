import { useCallback, useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '../api/client'
import {
  useActivateChat, useBotStatus, useChat, useChats, useClearChat, useCreateChat, useDeleteChat,
  useInvalidateBoard, useRenameChat,
} from '../api/hooks'
import { useUi } from '../state/ui'

// Two rotating starter prompts; clicking one sends it and refills only that
// slot from further down the pool, so the other one does not move under the
// cursor. Opens on the second and third of the pool.
const STARTER_POOL = [
  'What did I spend most on this period?',
  'How does this month compare with last month?',
  'Who still owes me money?',
  'Where could I realistically cut back?',
  'What is my biggest recurring cost?',
  'Am I on track to close this month positive?',
  'Which category is closest to its budget?',
  'How much did I actually keep this month?',
  'What changed most since last month?',
  'How much have I lent out that is still unpaid?',
  'Summarise this month in three lines.',
  'What was my most expensive single day?',
]
const STARTER_OPENING = [1, 2]
const CHAT_NAME_MAX = 40
// Matches rail-out in board.css: the rail stays mounted while it slides away.
const RAIL_CLOSE_MS = 300
const ACCEPT = '.csv,.png,.jpg,.jpeg'

interface Pending {
  user: string
  reply: string
  status: string | null
  streamId: string | null
}

function Markdown({ text }: { text: string }) {
  return (
    <div className="md">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  )
}

function Thinking({ note }: { note: string }) {
  return (
    <div className="thinking">
      <span className="dot" /><span className="dot" /><span className="dot" />
      {note}
    </div>
  )
}

/** Reads the server's SSE stream (a POST, so not EventSource) and hands each
 * `data:` event to `onEvent` as it arrives. */
async function readEvents(res: Response, onEvent: (e: Record<string, unknown>) => void) {
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let cut
    while ((cut = buffer.indexOf('\n\n')) !== -1) {
      const block = buffer.slice(0, cut)
      buffer = buffer.slice(cut + 2)
      const line = block.split('\n').find((l) => l.startsWith('data: '))
      if (line) onEvent(JSON.parse(line.slice(6)))
    }
  }
}

export default function FinanceBot({ periodKey, periodLabel }: { periodKey: string; periodLabel: string }) {
  const { botOpen, setBotOpen, botDraft, setBotDraft } = useUi()
  // Mounted from opening until the closing slide has finished, so the rail
  // leaves the way it came instead of vanishing.
  const [mounted, setMounted] = useState(botOpen)
  if (botOpen && !mounted) setMounted(true)
  const qc = useQueryClient()
  const invalidateBoard = useInvalidateBoard()
  const { data: status } = useBotStatus()
  const { data: chatList } = useChats()
  const [chatId, setChatId] = useState<string | null>(null)
  const currentId = chatId && chatList?.chats.some((c) => c.id === chatId) ? chatId : chatList?.active_id ?? null
  const { data: chat } = useChat(currentId)

  const createChat = useCreateChat()
  const activateChat = useActivateChat()
  const renameChat = useRenameChat()
  const deleteChat = useDeleteChat()
  const clearChat = useClearChat()

  const [pending, setPending] = useState<Pending | null>(null)
  const [draft, setDraft] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [slots, setSlots] = useState<number[]>(STARTER_OPENING)
  const cursor = useRef(Math.max(...STARTER_OPENING) + 1)
  const [menuOpen, setMenuOpen] = useState(false)
  const [rename, setRename] = useState('')
  const [menuNote, setMenuNote] = useState<string | null>(null)
  const logRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const messages = chat?.messages ?? []
  const chats = chatList?.chats ?? []

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [messages.length, pending?.reply, pending?.user])

  const send = useCallback(async (text: string, attach: File[] = []) => {
    if (!currentId || pending) return
    const trimmed = text.trim()
    if (!trimmed && attach.length === 0) return
    const shown = trimmed + (attach.length ? `${trimmed ? '\n\n' : ''}*Attached: ${attach.map((f) => f.name).join(', ')}*` : '')
    setPending({ user: shown, reply: '', status: 'Thinking…', streamId: null })
    const form = new FormData()
    form.append('text', trimmed)
    form.append('period', periodKey)
    attach.forEach((f) => form.append('files', f))
    try {
      const res = await fetch(`/api/bot/chats/${currentId}/messages`, { method: 'POST', body: form, credentials: 'include' })
      if (!res.ok) {
        let detail = res.statusText
        try { detail = (await res.json()).detail || detail } catch { /* not JSON */ }
        throw new ApiError(res.status, detail)
      }
      await readEvents(res, (e) => {
        if (e.type === 'start') setPending((p) => p && { ...p, streamId: String(e.stream_id) })
        else if (e.type === 'status') setPending((p) => p && { ...p, status: String(e.text) })
        else if (e.type === 'chunk') setPending((p) => p && { ...p, status: null, reply: p.reply + String(e.text) })
      })
    } catch (err) {
      setPending((p) => p && { ...p, status: null, reply: `_Something went wrong talking to the bot: ${err instanceof Error ? err.message : err}_` })
      await new Promise((r) => setTimeout(r, 1500))
    }
    // The bot may have written to the ledgers through its tools, and there is
    // no cheap way to know whether it did — every turn refreshes the board.
    invalidateBoard()
    await qc.invalidateQueries({ queryKey: ['chat', currentId] })
    await qc.invalidateQueries({ queryKey: ['chats'] })
    qc.invalidateQueries({ queryKey: ['bot-status'] })
    setPending(null)
  }, [currentId, pending, periodKey, invalidateBoard, qc])

  useEffect(() => {
    if (botOpen || !mounted) return
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const t = window.setTimeout(() => setMounted(false), reduced ? 0 : RAIL_CLOSE_MS)
    return () => window.clearTimeout(t)
  }, [botOpen, mounted])

  // "Draft reminder" on the Debts tab hands a message over and opens the rail.
  useEffect(() => {
    if (botOpen && botDraft && currentId && !pending) {
      setBotDraft(null)
      send(botDraft)
    }
  }, [botOpen, botDraft, currentId, pending, send, setBotDraft])

  function pickStarter(slot: number) {
    const prompt = STARTER_POOL[slots[slot]]
    const total = STARTER_POOL.length
    let next = cursor.current % total
    for (let step = 0; step < total; step++) {
      const candidate = (cursor.current + step) % total
      if (!slots.includes(candidate)) { next = candidate; cursor.current = candidate + 1; break }
    }
    setSlots(slots.map((v, i) => (i === slot ? next : v)))
    send(prompt)
  }

  function explain() {
    const what = periodKey === 'all' ? 'my whole history' : periodLabel
    send(
      `Give me a plain-language read-out of ${what}: what came in, what went out, where most of it went, ` +
        'what changed against the month before, and the one thing most worth acting on. Use the real figures.',
    )
  }

  function submit() {
    if (pending) return
    const text = draft
    const attach = files
    setDraft('')
    setFiles([])
    if (fileRef.current) fileRef.current.value = ''
    send(text, attach)
  }

  function switchTo(id: string) {
    setChatId(id)
    setMenuOpen(false)
    activateChat.mutate(id)
  }

  if (!mounted) return null
  const closing = !botOpen
  const current = chats.find((c) => c.id === currentId)
  const fallback = status && status.active_model !== status.model

  return (
    <aside className={`bot-rail ${closing ? 'closing' : ''}`} aria-label="Finance bot" inert={closing}>
      <div className="bot-head">
        <h2>Finance bot</h2>
        <button className="icon-btn" aria-label="Close the Finance Bot" onClick={() => setBotOpen(false)}>✕</button>
      </div>

      <div className="bot-switch">
        <select
          value={currentId ?? ''} aria-label="Chat" disabled={!!pending}
          onChange={(e) => switchTo(e.target.value)}
        >
          {chats.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
        <button
          className="icon-btn" title="Start a new chat" aria-label="Start a new chat" disabled={!!pending}
          onClick={() => createChat.mutate(undefined, { onSuccess: (c) => { setChatId(c.id); setMenuOpen(false) } })}
        >
          +
        </button>
        <button
          className={`icon-btn ${menuOpen ? 'active' : ''}`} title="Rename or delete this chat"
          aria-label="Rename or delete this chat" aria-expanded={menuOpen}
          onClick={() => { setMenuOpen(!menuOpen); setRename(current?.title ?? ''); setMenuNote(null) }}
        >
          ⋯
        </button>
      </div>

      {menuOpen && current && (
        <div className="bot-menu">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const label = rename.trim()
              if (!label) { setMenuNote('A chat needs a name.'); return }
              renameChat.mutate({ id: current.id, title: label }, { onSuccess: () => setMenuOpen(false) })
            }}
          >
            <input value={rename} maxLength={CHAT_NAME_MAX} onChange={(e) => setRename(e.target.value)} aria-label="Chat name" />
            <button className="btn-link" type="submit">Rename</button>
          </form>
          <button
            className="btn-link danger wide" disabled={chats.length === 1}
            onClick={() => deleteChat.mutate(current.id, { onSuccess: () => { setChatId(null); setMenuOpen(false) } })}
          >
            Delete this chat
          </button>
          {chats.length === 1 && (
            <p className="bot-note">This is your only chat, so it cannot be deleted. Clear chat empties it instead.</p>
          )}
          {menuNote && <p className="bot-note">{menuNote}</p>}
        </div>
      )}

      {fallback && (
        <p className="bot-note">Using {status!.active_model} — {status!.model} is out of free quota for today.</p>
      )}
      {status && !status.has_api_key && (
        <div className="bot-nokey">
          <strong>Bot not connected</strong>
          <p>
            Add <code>GEMINI_API_KEY</code> to <code>.streamlit/secrets.toml</code> and restart to turn the chat
            on. Every other panel on this board works without it and none of your records are affected.
          </p>
        </div>
      )}

      <div className="bot-log" ref={logRef}>
        {messages.length === 0 && !pending && (
          <div className="bot-empty">
            <div className="bot-empty-title">Tell it what happened</div>
            <div className="legend">
              <div className="legend-head">How the board reads</div>
              <div className="legend-row"><b>Brought forward</b><span>What last month closed at.</span></div>
              <div className="legend-row"><b>Arrivals</b><span>Every rupee in — earned, returned to you, or borrowed.</span></div>
              <div className="legend-row"><b>Departures</b><span>Every rupee out — spent, lent, or repaid.</span></div>
              <div className="legend-row"><b>On hand</b><span>What is actually left to spend.</span></div>
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            <Markdown text={m.content} />
          </div>
        ))}
        {pending && (
          <>
            <div className="msg user"><Markdown text={pending.user} /></div>
            <div className="msg assistant">
              {pending.status && !pending.reply ? <Thinking note={pending.status} /> : <Markdown text={pending.reply + '▌'} />}
            </div>
          </>
        )}
      </div>

      <div className="bot-actions">
        {pending ? (
          <button
            className="btn-link wide"
            onClick={() => pending.streamId && api.post(`/bot/stop/${pending.streamId}`)}
          >
            Stop generating
          </button>
        ) : (
          <>
            {slots.map((poolIndex, slot) => (
              <button key={slot} className="starter" onClick={() => pickStarter(slot)}>{STARTER_POOL[poolIndex]}</button>
            ))}
            <button className="starter" onClick={explain}>
              {periodKey === 'all' ? 'Explain all time' : `Explain ${periodLabel}`}
            </button>
            {messages.length > 0 && currentId && (
              <button className="btn-link wide" onClick={() => clearChat.mutate(currentId)}>Clear chat</button>
            )}
          </>
        )}
      </div>

      <form className="bot-composer" onSubmit={(e) => { e.preventDefault(); submit() }}>
        {files.length > 0 && (
          <div className="attach-chips">
            {files.map((f, i) => (
              <span className="chip" key={`${f.name}-${i}`}>
                {f.name}
                <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles(files.filter((_, j) => j !== i))}>✕</button>
              </span>
            ))}
          </div>
        )}
        <div className="composer-row">
          <label className="icon-btn attach" title="Attach a receipt photo or CSV" aria-label="Attach a receipt photo or CSV">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 11.5l-8.6 8.6a5.5 5.5 0 01-7.8-7.8l8.6-8.6a3.7 3.7 0 015.2 5.2l-8.6 8.6a1.8 1.8 0 01-2.6-2.6l7.9-7.9" />
            </svg>
            <input
              ref={fileRef} type="file" multiple accept={ACCEPT} className="visually-hidden"
              onChange={(e) => setFiles([...files, ...Array.from(e.target.files ?? [])])}
            />
          </label>
          <textarea
            rows={2} value={draft} placeholder="Message the bot" disabled={!!pending} aria-label="Message the bot"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
          />
          <button className="btn-primary" type="submit" disabled={!!pending || (!draft.trim() && files.length === 0)}>Send</button>
        </div>
      </form>
    </aside>
  )
}
