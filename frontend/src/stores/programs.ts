import { fetchPrograms } from '@/api/client'
import { subscribeToProgramChanges } from '@/api/stream'
import type { Program, ProgramChangeEvent } from '@/types/program'

const HIGHLIGHT_MS = 6000

type SortMode = 'recentlyChanged' | 'rewardDesc' | 'rewardAsc' | 'name'

export interface SummaryTask {
  id: number
  name: string
  status: 'generating' | 'done'
}

interface Filters {
  platform: string
  category: string
  status: string
  chain: string
  minReward: string
  kyc: '' | 'true' | 'false'
  sort: SortMode
}

export const useProgramsStore = defineStore('programs', () => {
  const programs = ref<Map<number, Program>>(new Map())
  const highlighted = ref<Map<number, number>>(new Map())
  const loading = ref(false)
  const error = ref<string | null>(null)
  // AI-summary generation is triggered from a card that can be far below the
  // fold in the virtualized list -- tracked here (not as component-local
  // state) so a global stack of "jump back to it" notifications can show
  // regardless of which card is currently mounted, survives the card
  // unmounting mid request if the user scrolls it out of the virtualizer's
  // render range, and keeps a "done" entry around (instead of clearing it
  // the instant the request resolves) so the user can visit several
  // finished summaries one at a time, in any order, without racing to catch
  // each one before it disappears.
  const summaryTasks = ref<Map<number, SummaryTask>>(new Map())
  const pendingReturnTo = ref<number | null>(null)
  const filters = ref<Filters>({
    platform: '',
    category: '',
    status: '',
    chain: '',
    minReward: '',
    kyc: '',
    sort: 'recentlyChanged',
  })

  let unsubscribe: (() => void) | null = null

  const list = computed(() => Array.from(programs.value.values()))

  const platformOptions = computed(() => [...new Set(list.value.map((p) => p.platform))].sort())
  const categoryOptions = computed(() => [...new Set(list.value.map((p) => p.category))].sort())
  const chainOptions = computed(() => [...new Set(list.value.flatMap((p) => p.chains))].sort())
  const statusOptions = computed(() => [...new Set(list.value.map((p) => p.status))].sort())

  const filteredList = computed(() => {
    const f = filters.value
    let result = list.value
    if (f.platform) result = result.filter((p) => p.platform === f.platform)
    if (f.category) result = result.filter((p) => p.category === f.category)
    if (f.status) result = result.filter((p) => p.status === f.status)
    if (f.chain) result = result.filter((p) => p.chains.includes(f.chain))
    if (f.minReward) {
      const min = Number(f.minReward)
      result = result.filter((p) => (p.rewardMax ?? p.rewardMin ?? 0) >= min)
    }
    if (f.kyc) result = result.filter((p) => p.kycRequired === (f.kyc === 'true'))

    const sorted = [...result]
    switch (f.sort) {
      case 'rewardDesc':
        sorted.sort((a, b) => (b.rewardMax ?? 0) - (a.rewardMax ?? 0))
        break
      case 'rewardAsc':
        sorted.sort((a, b) => (a.rewardMax ?? 0) - (b.rewardMax ?? 0))
        break
      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name))
        break
      case 'recentlyChanged':
      default:
        sorted.sort((a, b) => new Date(b.lastChangedAt).getTime() - new Date(a.lastChangedAt).getTime())
    }
    return sorted
  })

  function upsert(program: Program) {
    programs.value.set(program.id, program)
    highlighted.value.set(program.id, Date.now() + HIGHLIGHT_MS)
    setTimeout(() => {
      highlighted.value.delete(program.id)
    }, HIGHLIGHT_MS)
  }

  function isHighlighted(id: number): boolean {
    const expiry = highlighted.value.get(id)
    return expiry !== undefined && expiry > Date.now()
  }

  function startSummaryGeneration(id: number, name: string) {
    summaryTasks.value.set(id, { id, name, status: 'generating' })
  }

  function finishSummaryGeneration(id: number) {
    const task = summaryTasks.value.get(id)
    if (task) summaryTasks.value.set(id, { ...task, status: 'done' })
  }

  function dismissSummaryTask(id: number) {
    summaryTasks.value.delete(id)
  }

  // Backend doesn't broadcast a `program-change` event for summarize
  // requests (it's a pull, not a diff-detected change), so the client has to
  // fold the result in itself -- otherwise a card that remounted while the
  // request was in flight would come back showing "not generated yet".
  function updateProgramSummary(id: number, summary: string, summaryLocale: string) {
    const program = programs.value.get(id)
    if (program) programs.value.set(id, { ...program, summary, summaryLocale })
  }

  function requestReturnTo(id: number) {
    pendingReturnTo.value = id
  }

  function clearReturnRequest() {
    pendingReturnTo.value = null
  }

  async function fetchInitial() {
    loading.value = true
    error.value = null
    try {
      const rows = await fetchPrograms()
      const map = new Map<number, Program>()
      for (const p of rows) map.set(p.id, p)
      programs.value = map
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      loading.value = false
    }
  }

  function subscribe() {
    if (unsubscribe) return
    unsubscribe = subscribeToProgramChanges(
      (event: ProgramChangeEvent) => upsert(event.program),
      () => void fetchInitial(),
    )
  }

  return {
    filters,
    list,
    filteredList,
    platformOptions,
    categoryOptions,
    chainOptions,
    statusOptions,
    loading,
    error,
    summaryTasks,
    pendingReturnTo,
    fetchInitial,
    subscribe,
    isHighlighted,
    startSummaryGeneration,
    finishSummaryGeneration,
    dismissSummaryTask,
    updateProgramSummary,
    requestReturnTo,
    clearReturnRequest,
  }
})
