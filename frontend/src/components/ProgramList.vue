<script setup lang="ts">
import { useProgramsStore } from '@/stores/programs'
import { useWindowVirtualizer } from '@tanstack/vue-virtual'

const store = useProgramsStore()

const parentRef = ref<HTMLElement | null>(null)
const parentOffsetTop = ref(0)

function updateOffsetTop() {
  parentOffsetTop.value = parentRef.value?.offsetTop ?? 0
}

// Re-measured on every layout shift, not just window resize -- the list
// itself only mounts once `store.loading` flips (parentRef is null before
// that), and content above it (source chips, wrapped filter bar) can also
// still shift its offset after the initial mount.
useResizeObserver(document.body, updateOffsetTop)

// Card rows have highly variable height (collapsed vs. expanded, markdown of
// varying length, loaded history) -- estimateSize is only a first guess,
// measureElement (bound as `ref` below) corrects it per-row via ResizeObserver.
// 53px is the real measured height of a single-line collapsed card (checked
// via getBoundingClientRect); keeping the guess close to reality means fewer
// rows need correcting as they scroll into view for the first time.
const COLLAPSED_CARD_HEIGHT = 53
const virtualizer = useWindowVirtualizer(
  computed(() => ({
    count: store.filteredList.length,
    estimateSize: () => COLLAPSED_CARD_HEIGHT,
    overscan: 6,
    gap: 12,
    scrollMargin: parentOffsetTop.value,
    getItemKey: (index: number) => store.filteredList[index]?.id ?? index,
  })),
)

function measureElement(el: Element | ComponentPublicInstance | null) {
  virtualizer.value.measureElement(el as Element | null)
}

// "Return to" a program (e.g. one generating an AI summary off-screen) --
// only handles scrolling; ProgramCard itself owns expanding/clearing the
// request once its instance for that id actually mounts.
watch(
  () => store.pendingReturnTo,
  (id) => {
    if (id === null) return
    const index = store.filteredList.findIndex((p) => p.id === id)
    if (index !== -1) virtualizer.value.scrollToIndex(index, { align: 'center', behavior: 'smooth' })
  },
)
</script>

<template>
  <div class="list">
    <p v-if="store.loading" class="state">{{ $t('table.loading') }}</p>
    <p v-else-if="store.error" class="state error">{{ store.error }}</p>
    <p v-else-if="store.filteredList.length === 0" class="state">{{ $t('table.empty') }}</p>
    <div v-else ref="parentRef" class="virtual-scroller" :style="{ height: `${virtualizer.getTotalSize()}px` }">
      <template v-for="item in virtualizer.getVirtualItems()" :key="item.key as number">
        <div
          v-if="store.filteredList[item.index]"
          :ref="measureElement"
          :data-index="item.index"
          class="virtual-item"
          :style="{ top: `${item.start - virtualizer.options.scrollMargin}px` }"
        >
          <ProgramCard :program="store.filteredList[item.index]!" />
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.state {
  padding: 2rem;
  text-align: center;
  color: var(--color-text-muted);
  background: var(--color-background-soft);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
}
.state.error {
  color: var(--color-danger);
}
.virtual-scroller {
  position: relative;
  width: 100%;
  /* Rows are absolutely positioned and repositioned by the virtualizer
     itself (via scrollMargin/measureElement) -- opt this subtree out of the
     browser's own scroll anchoring so it never second-guesses that. */
  overflow-anchor: none;
}
.virtual-item {
  position: absolute;
  left: 0;
  width: 100%;
  /* Positioned with `top`, not `transform: translateY()` -- a transform on
     this ancestor would establish a new containing block and break the
     card header's `position: sticky` (its "stuck" offset ends up computed
     against the wrong box, so it drifts by roughly a sibling's height
     instead of pinning to the card's own top). */
}
</style>
