import { useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStatus } from '../api/hooks'
import { api, ApiError } from '../api/client'

export default function AuthGate({ children }: { children: ReactNode }) {
  const { data, isLoading } = useAuthStatus()
  const qc = useQueryClient()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (isLoading || !data) {
    return <div className="auth-loading">Opening the ledger…</div>
  }

  if (data.unlocked) return <>{children}</>

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.post('/auth/login', { password })
      await qc.invalidateQueries({ queryKey: ['auth-status'] })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not sign in.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-gate">
      <div className="auth-card">
        <div className="auth-word">Loot&nbsp;<span className="auth-dot">&bull;</span>&nbsp;Ledger</div>
        <p className="auth-body">This board holds real financial records. Enter the password to open it.</p>
        <form onSubmit={submit}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoFocus
          />
          <button type="submit" disabled={busy}>{busy ? 'Opening…' : 'Open board'}</button>
        </form>
        {error && <p className="auth-error">{error}</p>}
      </div>
    </div>
  )
}
