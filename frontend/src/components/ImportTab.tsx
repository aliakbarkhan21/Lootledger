import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, ApiError } from '../api/client'
import type { Currency } from '../api/types'
import { useInvalidateBoard } from '../api/hooks'
import { formatMoney } from '../lib/money'

const AUTO = '__auto__'

interface Schemas {
  none_label: string
  upload_types: string[]
  schemas: Record<string, { label: string; fields: Record<string, { required: boolean }> }>
}

interface Section {
  mapping: Record<string, string>
  problems: string[]
  row_count: number
  total: number
  preview: Record<string, unknown>[]
}

interface Parsed {
  uploadId: string
  columns: string[]
  rowCount: number
}

function message(e: unknown): string {
  return e instanceof ApiError || e instanceof Error ? e.message : 'Something went wrong.'
}

function PreviewTable({ rows, order }: { rows: Record<string, unknown>[]; order: string[] }) {
  if (rows.length === 0) return null
  // Schema field order first (date, detail, amount…), anything extra after.
  const present = Object.keys(rows[0])
  const cols = [...order.filter((c) => present.includes(c)), ...present.filter((c) => !order.includes(c))]
  return (
    <div className="grid-scroll">
      <table className="ledger grid">
        <thead><tr>{cols.map((c) => <th key={c} className={c === 'amount' ? 'num' : ''}>{c}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{cols.map((c) => <td key={c} className={c === 'amount' ? 'amt' : ''}>{String(r[c] ?? '')}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function ImportTab({ currency }: { currency: Currency }) {
  const invalidate = useInvalidateBoard()
  const { data: schemas } = useQuery({ queryKey: ['import-schemas'], queryFn: () => api.get<Schemas>('/import/schemas') })

  const [target, setTarget] = useState<string>(AUTO)
  const [uploadId, setUploadId] = useState<string | null>(null)
  const [sheets, setSheets] = useState<string[]>([])
  const [sheet, setSheet] = useState<string | null>(null)
  const [parsed, setParsed] = useState<Parsed | null>(null)
  const [sections, setSections] = useState<Record<string, Section> | null>(null)
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [manual, setManual] = useState<Section | null>(null)
  const [replace, setReplace] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const auto = target === AUTO
  const ledger = auto ? 'expenses' : target
  const labelOf = (k: string) => schemas?.schemas[k]?.label ?? k

  function reset(clearInput = true) {
    if (uploadId) api.del(`/import/${uploadId}`).catch(() => {})
    setUploadId(null); setSheets([]); setSheet(null); setParsed(null)
    setSections(null); setManual(null); setMapping({}); setReplace(false)
    if (clearInput && fileRef.current) fileRef.current.value = ''
  }

  async function onFile(file: File | undefined) {
    setError(null); setDone(null)
    reset(false)
    if (!file) return
    setBusy(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await api.postForm<{ upload_id: string; is_excel: boolean; sheets: string[] }>('/import/upload', form)
      setUploadId(res.upload_id)
      setSheets(res.sheets)
      // A workbook can hold several sheets and only one is the ledger — ask
      // which, but only when there is actually a choice to make.
      setSheet(res.sheets[0] ?? null)
    } catch (e) {
      setError(message(e))
    } finally {
      setBusy(false)
    }
  }

  // Parse whenever the upload or chosen sheet changes.
  useEffect(() => {
    if (!uploadId) return
    let cancelled = false
    setBusy(true)
    setParsed(null); setSections(null); setManual(null)
    const q = new URLSearchParams({ upload_id: uploadId })
    if (sheet) q.set('sheet', sheet)
    api.post<{ columns: string[]; row_count: number }>(`/import/parse?${q}`)
      .then((res) => { if (!cancelled) setParsed({ uploadId, columns: res.columns, rowCount: res.row_count }) })
      .catch((e) => { if (!cancelled) setError(message(e)) })
      .finally(() => { if (!cancelled) setBusy(false) })
    return () => { cancelled = true }
  }, [uploadId, sheet])

  // Detect sections (and, for a single ledger, the suggested mapping) once
  // parsed, and again whenever the target ledger changes.
  useEffect(() => {
    if (!parsed) return
    let cancelled = false
    const q = new URLSearchParams({ upload_id: parsed.uploadId })
    if (!auto) q.set('prefer', target)
    setManual(null)
    setMapping({})
    api.post<Record<string, Section>>(`/import/detect?${q}`)
      .then(async (found) => {
        if (cancelled) return
        setSections(found)
        if (!auto) {
          const guess = await api.post<Record<string, string>>(
            `/import/mapping/suggest?${new URLSearchParams({ upload_id: parsed.uploadId, ledger: target })}`,
          )
          if (!cancelled) setMapping(guess)
        }
      })
      .catch((e) => { if (!cancelled) setError(message(e)) })
    return () => { cancelled = true }
  }, [parsed, target, auto])

  // Rebuild the single-ledger rows every time a column mapping changes.
  useEffect(() => {
    if (!parsed || auto || !schemas || Object.keys(mapping).length === 0) return
    let cancelled = false
    const full: Record<string, string> = {}
    for (const f of Object.keys(schemas.schemas[target].fields)) full[f] = mapping[f] ?? schemas.none_label
    api.post<Section>(`/import/mapping?${new URLSearchParams({ upload_id: parsed.uploadId, ledger: target })}`, full)
      .then((res) => { if (!cancelled) setManual(res) })
      .catch((e) => { if (!cancelled) setError(message(e)) })
    return () => { cancelled = true }
  }, [parsed, auto, target, mapping, schemas])

  async function commit(ledgers: string[]) {
    if (!uploadId) return
    setBusy(true); setError(null)
    try {
      const counts: string[] = []
      for (const l of ledgers) {
        const res = await api.post<{ imported: number }>(
          `/import/commit/${uploadId}/${l}?replace=${replace ? 'true' : 'false'}`,
        )
        counts.push(`${res.imported} ${labelOf(l).toLowerCase()}`)
      }
      invalidate()
      setDone(`Imported ${counts.join(' · ')}.`)
      reset()
    } catch (e) {
      setError(message(e))
    } finally {
      setBusy(false)
    }
  }

  if (!schemas) return <p className="panel-empty">Loading…</p>

  const sectionKeys = Object.keys(sections || {})
  const ready = sectionKeys.reduce((n, k) => n + (sections![k].row_count || 0), 0)
  // The same padding/summary rows are skipped in every section, so warnings
  // would otherwise repeat once per ledger; blank-row notices are the file's
  // shape (side-by-side blocks padded to the longest) rather than anything lost.
  const autoProblems = Array.from(new Set(
    sectionKeys.flatMap((k) => sections![k].problems).filter((p) => !p.includes('empty row')),
  ))
  const extras = sectionKeys.filter((k) => k !== target)

  return (
    <div>
      <div className="tab-controls">
        <label>
          Import into{' '}
          <select value={target} onChange={(e) => { setTarget(e.target.value); setReplace(false) }}>
            <option value={AUTO}>Auto — send each section to its own ledger</option>
            {Object.entries(schemas.schemas).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
          </select>
        </label>
      </div>
      <p className="tab-caption">
        {auto
          ? 'Each block of columns goes to the ledger it belongs to — spending, income, lent and borrowed all land in the right place from one file. Nothing is written until you press import.'
          : `Only ${labelOf(ledger)} is touched. Nothing is written until you press import.`}
      </p>

      <div className="tab-controls">
        <label className="file-pick">
          CSV or Excel file{' '}
          <input
            ref={fileRef}
            type="file"
            accept={schemas.upload_types.map((t) => `.${t}`).join(',')}
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </label>
        {sheets.length > 1 && (
          <label>
            Sheet{' '}
            <select value={sheet ?? ''} onChange={(e) => setSheet(e.target.value)}>
              {sheets.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        )}
        {busy && <span className="tab-note">Working…</span>}
      </div>

      {error && <div className="notice warn">{error}</div>}
      {done && <div className="notice ok">{done}</div>}

      {parsed && (
        <p className="tab-caption">{parsed.rowCount} rows, {parsed.columns.length} columns detected.</p>
      )}

      {parsed && sections && auto && (
        sectionKeys.length === 0 ? (
          <div className="notice warn">
            No ledger section could be read from this file. Pick a ledger above and map the columns by hand.
          </div>
        ) : (
          <>
            <table className="ledger grid compact">
              <thead><tr><th>Section</th><th className="num">Rows</th><th className="num">Total</th></tr></thead>
              <tbody>
                {sectionKeys.map((k) => (
                  <tr key={k}>
                    <td>{labelOf(k)}</td>
                    <td className="amt">{sections[k].row_count}</td>
                    <td className="amt">{formatMoney(sections[k].total, currency, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {autoProblems.map((p) => <div className="notice warn" key={p}>{p}</div>)}
            <div className="tab-controls">
              <label className="check">
                <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
                Replace everything already in these ledgers
              </label>
              <button className="btn-primary" disabled={busy || ready === 0} onClick={() => commit(sectionKeys)}>
                Import {ready} rows into {sectionKeys.length} {sectionKeys.length === 1 ? 'ledger' : 'ledgers'}
              </button>
            </div>
          </>
        )
      )}

      {parsed && sections && !auto && (
        <>
          {extras.length > 0 && (
            <div className="notice">
              This file also holds{' '}
              {extras.map((k) => `${sections[k].row_count} ${labelOf(k).toLowerCase()}`).join(', ')}
              {' '}— switch to Auto above to bring those in too.
            </div>
          )}
          <div className="map-grid">
            {Object.entries(schemas.schemas[target].fields).map(([field, spec]) => (
              <label key={field}>
                <span>{field[0].toUpperCase() + field.slice(1)}{spec.required ? '' : ' (optional)'}</span>
                <select
                  value={mapping[field] ?? schemas.none_label}
                  onChange={(e) => setMapping({ ...mapping, [field]: e.target.value })}
                >
                  {[schemas.none_label, ...parsed.columns].map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
            ))}
          </div>
          {manual?.problems.map((p) => <div className="notice warn" key={p}>{p}</div>)}
          {manual && manual.row_count > 0 && (
            <>
              <p className="tab-caption"><strong>{manual.row_count} rows ready.</strong> First few:</p>
              <PreviewTable rows={manual.preview} order={Object.keys(schemas.schemas[target].fields)} />
              <div className="tab-controls">
                <label className="check">
                  <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
                  Replace everything already in {labelOf(target)}
                </label>
                <button className="btn-primary" disabled={busy} onClick={() => commit([target])}>
                  Import {manual.row_count} rows
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
