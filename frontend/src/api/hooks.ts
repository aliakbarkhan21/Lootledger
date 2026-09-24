import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type {
  AuthStatus,
  BackupInfo,
  BoardResponse,
  Chat,
  ChatSummary,
  LedgerRow,
  PeriodsResponse,
  PersonDebt,
  SettingsResponse,
} from './types'

// ---------------------------------------------------------------- reads

export function useAuthStatus() {
  return useQuery({ queryKey: ['auth-status'], queryFn: () => api.get<AuthStatus>('/auth/status') })
}

export function usePeriods() {
  return useQuery({ queryKey: ['periods'], queryFn: () => api.get<PeriodsResponse>('/periods') })
}

export function useBoard(period: string) {
  return useQuery({
    queryKey: ['board', period],
    queryFn: () => api.get<BoardResponse>(`/board?period=${encodeURIComponent(period)}`),
  })
}

export function useSettings() {
  return useQuery({ queryKey: ['settings'], queryFn: () => api.get<SettingsResponse>('/settings') })
}

export function useLedger(ledger: string) {
  return useQuery({
    queryKey: ['ledger', ledger],
    queryFn: () => api.get<LedgerRow[]>(`/ledgers/${ledger}`),
  })
}

export function useCategories() {
  return useQuery({ queryKey: ['categories'], queryFn: () => api.get<string[]>('/categories') })
}

export function usePeople() {
  return useQuery({ queryKey: ['people'], queryFn: () => api.get<PersonDebt[]>('/debts/people') })
}

export function useBackups() {
  return useQuery({ queryKey: ['backups'], queryFn: () => api.get<BackupInfo[]>('/settings/backups') })
}

export function useChats() {
  return useQuery({
    queryKey: ['chats'],
    queryFn: () => api.get<{ chats: ChatSummary[]; active_id: string | null }>('/bot/chats'),
  })
}

export function useChat(id: string | null) {
  return useQuery({
    queryKey: ['chat', id],
    queryFn: () => api.get<Chat>(`/bot/chats/${id}`),
    enabled: !!id,
  })
}

export function useBotStatus() {
  return useQuery({
    queryKey: ['bot-status'],
    queryFn: () => api.get<{ has_api_key: boolean; model: string; active_model: string; requests_last_minute: number }>(
      '/bot/status',
    ),
  })
}

// ---------------------------------------------------------------- shared invalidation

/** Every write anywhere on the board affects the board response (arrivals
 * columns, figures, trends, calendar) — invalidate broadly rather than
 * tracking exactly which panel a given mutation could touch, mirroring
 * app.py's own _touch_data()+data_version, which bumped one counter for
 * every write regardless of which form fired it. */
export function useInvalidateBoard() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ['board'] })
    qc.invalidateQueries({ queryKey: ['periods'] })
    qc.invalidateQueries({ queryKey: ['settings'] })
    qc.invalidateQueries({ queryKey: ['people'] })
    qc.invalidateQueries({ queryKey: ['ledger'] })
    qc.invalidateQueries({ queryKey: ['backups'] })
    // Erase/restore/demo-clear rewrite the meta table the chats live in.
    qc.invalidateQueries({ queryKey: ['chats'] })
    qc.invalidateQueries({ queryKey: ['chat'] })
  }
}

// ---------------------------------------------------------------- entry mutations

type EntryKind = 'expense' | 'transport' | 'income' | 'lent' | 'borrowed' | 'owed'

export function useAddEntry() {
  const invalidate = useInvalidateBoard()
  return useMutation({
    mutationFn: async (payload: { kind: EntryKind; body: Record<string, unknown> }) => {
      const { kind, body } = payload
      if (kind === 'expense') return api.post('/expenses', body)
      if (kind === 'transport') return api.post('/transport', body)
      if (kind === 'income') return api.post('/income', body)
      if (kind === 'owed') return api.post('/lent', { ...body, kind: 'owed' })
      if (kind === 'lent') return api.post('/lent', body)
      return api.post('/borrowed', body)
    },
    onSuccess: invalidate,
  })
}

export function useUpdateRow() {
  const invalidate = useInvalidateBoard()
  return useMutation({
    mutationFn: (p: { ledger: string; id: number; fields: Record<string, unknown> }) =>
      api.patch(`/ledgers/${p.ledger}/${p.id}`, p.fields),
    onSuccess: invalidate,
  })
}

export function useDeleteRow() {
  const invalidate = useInvalidateBoard()
  return useMutation({
    mutationFn: (p: { ledger: string; id: number }) => api.del(`/ledgers/${p.ledger}/${p.id}`),
    onSuccess: invalidate,
  })
}

export function useRemoveBoardRow() {
  const invalidate = useInvalidateBoard()
  return useMutation({
    mutationFn: (p: { kind: string; id: number }) => api.post('/board-rows/remove', p),
    onSuccess: invalidate,
  })
}

export function useSettleDebt() {
  const invalidate = useInvalidateBoard()
  return useMutation({
    mutationFn: (p: { table: 'lent' | 'borrowed'; id: number; settled: boolean; date?: string }) =>
      api.post(`/debts/${p.table}/${p.id}/settle`, { settled: p.settled, date: p.date }),
    onSuccess: invalidate,
  })
}

// ---------------------------------------------------------------- budgets / recurring / settings

export function useSetBudget() {
  const invalidate = useInvalidateBoard()
  return useMutation({
    mutationFn: (p: { category: string; monthly_cap: number }) => api.post('/budgets', p),
    onSuccess: invalidate,
  })
}

export function useDeleteBudget() {
  const invalidate = useInvalidateBoard()
  return useMutation({
    mutationFn: (category: string) => api.del(`/budgets/${encodeURIComponent(category)}`),
    onSuccess: invalidate,
  })
}

export function useMergeCategory() {
  const invalidate = useInvalidateBoard()
  return useMutation({
    mutationFn: (p: { from_category: string; to_category: string }) => api.post('/categories/merge', p),
    onSuccess: invalidate,
  })
}

export function useAddRecurring() {
  const invalidate = useInvalidateBoard()
  return useMutation({
    mutationFn: (p: { label: string; kind: 'expense' | 'income'; category: string | null; amount: number; day_of_month: number }) =>
      api.post('/recurring', p),
    onSuccess: invalidate,
  })
}

export function useDeleteRecurring() {
  const invalidate = useInvalidateBoard()
  return useMutation({
    mutationFn: (id: number) => api.del(`/recurring/${id}`),
    onSuccess: invalidate,
  })
}

export function useRecurringBulk() {
  const invalidate = useInvalidateBoard()
  return useMutation({
    mutationFn: (action: 'log-all' | 'skip-all') => api.post(`/recurring/${action}`),
    onSuccess: invalidate,
  })
}

export function useSetOpeningBalance() {
  const invalidate = useInvalidateBoard()
  return useMutation({
    mutationFn: (value: number) => api.post('/settings/opening-balance', { value }),
    onSuccess: invalidate,
  })
}

export function useSetNetSameMonthDebts() {
  const invalidate = useInvalidateBoard()
  return useMutation({
    mutationFn: (value: boolean) => api.post('/settings/net-same-month-debts', { value }),
    onSuccess: invalidate,
  })
}

export function useSetCurrency() {
  const invalidate = useInvalidateBoard()
  return useMutation({
    mutationFn: (code: string) => api.post('/settings/currency', { code }),
    onSuccess: invalidate,
  })
}

export function useRefreshRates() {
  const invalidate = useInvalidateBoard()
  return useMutation({
    mutationFn: () => api.post('/settings/currency/rates/refresh'),
    onSuccess: invalidate,
  })
}

export function useRestoreBackup() {
  const invalidate = useInvalidateBoard()
  return useMutation({
    mutationFn: (path: string) => api.post('/settings/backups/restore', { path }),
    onSuccess: invalidate,
  })
}

export function useSeedDemo() {
  const invalidate = useInvalidateBoard()
  return useMutation({ mutationFn: () => api.post('/settings/demo/seed'), onSuccess: invalidate })
}

export function useClearDemo() {
  const invalidate = useInvalidateBoard()
  return useMutation({ mutationFn: () => api.post('/settings/demo/clear'), onSuccess: invalidate })
}

export function useEraseEverything() {
  const invalidate = useInvalidateBoard()
  return useMutation({ mutationFn: () => api.post('/settings/reset/erase'), onSuccess: invalidate })
}

export function useDismissSetupHint() {
  const invalidate = useInvalidateBoard()
  return useMutation({ mutationFn: () => api.post('/banners/setup-hint/dismiss'), onSuccess: invalidate })
}

export function useDismissDigest() {
  const invalidate = useInvalidateBoard()
  return useMutation({ mutationFn: () => api.post('/banners/digest/dismiss'), onSuccess: invalidate })
}

// ---------------------------------------------------------------- chat CRUD (non-streaming)

function useInvalidateChats() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ['chats'] })
    qc.invalidateQueries({ queryKey: ['chat'] })
  }
}

export function useCreateChat() {
  const invalidate = useInvalidateChats()
  return useMutation({ mutationFn: () => api.post<Chat>('/bot/chats'), onSuccess: invalidate })
}

export function useActivateChat() {
  const invalidate = useInvalidateChats()
  return useMutation({ mutationFn: (id: string) => api.post(`/bot/chats/${id}/activate`), onSuccess: invalidate })
}

export function useRenameChat() {
  const invalidate = useInvalidateChats()
  return useMutation({
    mutationFn: (p: { id: string; title: string }) => api.patch(`/bot/chats/${p.id}`, { title: p.title }),
    onSuccess: invalidate,
  })
}

export function useDeleteChat() {
  const invalidate = useInvalidateChats()
  return useMutation({ mutationFn: (id: string) => api.del(`/bot/chats/${id}`), onSuccess: invalidate })
}

export function useClearChat() {
  const invalidate = useInvalidateChats()
  return useMutation({ mutationFn: (id: string) => api.post(`/bot/chats/${id}/clear`), onSuccess: invalidate })
}

export function useGenerateDigest() {
  const invalidate = useInvalidateBoard()
  return useMutation({ mutationFn: () => api.post('/bot/digest/generate'), onSuccess: invalidate, onError: invalidate })
}
