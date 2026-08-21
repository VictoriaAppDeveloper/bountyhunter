<script setup lang="ts">
import { useProgramsStore } from '@/stores/programs'
import { useSourcesStore } from '@/stores/sources'

const programsStore = useProgramsStore()
const sourcesStore = useSourcesStore()

const { resume: startSourcesPolling } = useIntervalFn(() => sourcesStore.fetchAll(), 15_000, { immediate: false })

onMounted(async () => {
  await programsStore.fetchInitial()
  programsStore.subscribe()
  await sourcesStore.fetchAll()
  startSourcesPolling()
})
</script>

<template>
  <div>
    <SourceStatusBar />
    <FilterBar />
    <ProgramList />
    <SummaryTaskStack />
  </div>
</template>
