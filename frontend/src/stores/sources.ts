import { fetchSources } from '@/api/client'
import type { SourceStatusRow } from '@/types/program'

export const useSourcesStore = defineStore('sources', () => {
  const sources = ref<SourceStatusRow[]>([])

  async function fetchAll() {
    sources.value = await fetchSources()
  }

  return { sources, fetchAll }
})
