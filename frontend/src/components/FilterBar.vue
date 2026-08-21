<script setup lang="ts">
import { useProgramsStore } from '@/stores/programs'

const store = useProgramsStore()
const root = ref<HTMLElement | null>(null)
// Only affects mobile (see the media query below) -- desktop always shows
// the fields regardless of this.
const collapsed = ref(false)

const activeFilterCount = computed(() => {
  const f = store.filters
  return [f.platform, f.category, f.status, f.chain, f.minReward, f.kyc].filter(Boolean).length
})

// Exposes its own rendered height as a CSS var so sticky card headers can
// pin themselves directly below the filter bar instead of a guessed offset.
// `box: 'border-box'` matters -- ResizeObserver's default (content-box)
// excludes this element's own padding and border, which under-reported the
// height and let pinned card headers sit partly behind the filter bar.
const { height } = useElementSize(root, undefined, { box: 'border-box' })
watchEffect(() => {
  document.documentElement.style.setProperty('--filter-bar-height', `${height.value}px`)
})
</script>

<template>
  <div ref="root" class="filter-bar" :class="{ collapsed }">
    <button type="button" class="filter-toggle" :aria-expanded="!collapsed" @click="collapsed = !collapsed">
      <span>{{ $t('filter.title') }}</span>
      <span v-if="activeFilterCount" class="count">{{ activeFilterCount }}</span>
      <span class="chevron" :class="{ open: !collapsed }">⌄</span>
    </button>
    <div class="filter-fields">
      <select v-model="store.filters.platform">
        <option value="">{{ $t('filter.allPlatforms') }}</option>
        <option v-for="p in store.platformOptions" :key="p" :value="p">{{ p }}</option>
      </select>

      <select v-model="store.filters.category">
        <option value="">{{ $t('filter.allCategories') }}</option>
        <option v-for="c in store.categoryOptions" :key="c" :value="c">{{ $t(`category.${c}`) }}</option>
      </select>

      <select v-model="store.filters.status">
        <option value="">{{ $t('filter.allStatuses') }}</option>
        <option v-for="s in store.statusOptions" :key="s" :value="s">{{ $t(`status.${s}`) }}</option>
      </select>

      <select v-model="store.filters.chain">
        <option value="">{{ $t('filter.allChains') }}</option>
        <option v-for="c in store.chainOptions" :key="c" :value="c">{{ c }}</option>
      </select>

      <input v-model="store.filters.minReward" type="number" min="0" :placeholder="$t('filter.minReward')" />

      <select v-model="store.filters.kyc">
        <option value="">{{ $t('filter.kycAny') }}</option>
        <option value="false">{{ $t('filter.kycNo') }}</option>
        <option value="true">{{ $t('filter.kycRequired') }}</option>
      </select>

      <select v-model="store.filters.sort">
        <option value="recentlyChanged">{{ $t('filter.sortRecentlyChanged') }}</option>
        <option value="rewardDesc">{{ $t('filter.sortRewardDesc') }}</option>
        <option value="rewardAsc">{{ $t('filter.sortRewardAsc') }}</option>
        <option value="name">{{ $t('filter.sortName') }}</option>
      </select>
    </div>
  </div>
</template>

<style scoped>
.filter-bar {
  position: sticky;
  top: 0;
  z-index: 10;
  margin: 0 -2rem 1rem;
  padding: 0.85rem 2rem;
  background: var(--color-background);
  border-bottom: 1px solid var(--color-border);
}
.filter-toggle {
  /* Desktop always shows the fields -- this trigger only exists for the
     mobile layout below. */
  display: none;
}
.filter-fields {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.filter-bar select,
.filter-bar input {
  padding: 0.4rem 0.6rem;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background: var(--color-background-soft);
  color: var(--color-text);
  font-size: 0.85rem;
}
.filter-bar select:focus,
.filter-bar input:focus {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-soft);
}
.filter-bar input {
  width: 10rem;
}

@media (max-width: 640px) {
  .filter-bar {
    padding: 0.65rem 1rem;
  }
  .filter-toggle {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.3rem 0;
    border: none;
    background: none;
    color: var(--color-text);
    font: inherit;
    font-size: 0.9rem;
    font-weight: 600;
    text-align: left;
    cursor: pointer;
  }
  .filter-toggle .count {
    padding: 0.05rem 0.45rem;
    border-radius: 999px;
    background: var(--color-accent-soft);
    color: var(--color-accent-strong);
    font-size: 0.72rem;
    font-weight: 700;
  }
  .filter-toggle .chevron {
    margin-left: auto;
    color: var(--color-text-muted);
    transition: transform 0.2s;
  }
  .filter-toggle .chevron.open {
    transform: rotate(180deg);
  }
  .filter-fields {
    margin-top: 0.6rem;
  }
  .filter-bar.collapsed .filter-fields {
    display: none;
  }
}
</style>
