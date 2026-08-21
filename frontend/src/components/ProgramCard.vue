<script setup lang="ts">
import { fetchProgramHistory } from '@/api/client'
import { useProgramsStore } from '@/stores/programs'
import type { ChangeEvent, Program } from '@/types/program'

const props = defineProps<{ program: Program }>()
const store = useProgramsStore()

const expanded = ref(false)
// Once true, ProgramDetails stays mounted forever (toggled via v-show below)
// instead of being destroyed/recreated on every collapse. Recreating it meant
// each re-expand spun up a fresh useAutoTranslateGroup instance with its own
// blank in-flight guard, so rapid toggling could still fire several
// concurrent translate requests despite that guard.
const hasExpandedOnce = ref(false)
const history = ref<ChangeEvent[]>([])
const historyLoaded = ref(false)
const historyLoading = ref(false)

const highlighted = computed(() => store.isHighlighted(props.program.id))

const rewardLabel = computed(() => {
  const { rewardMin, rewardMax, rewardCurrency, rewardRaw } = props.program
  const currency = rewardCurrency ?? ''
  if (rewardMax !== null) {
    if (rewardMin !== null && rewardMin !== rewardMax) {
      return `${format(rewardMin)}–${format(rewardMax)} ${currency}`.trim()
    }
    return `${format(rewardMax)} ${currency}`.trim()
  }
  return rewardRaw ?? '—'
})

function format(n: number): string {
  return new Intl.NumberFormat('en-US').format(n)
}

async function loadHistory() {
  historyLoading.value = true
  try {
    history.value = await fetchProgramHistory(props.program.id)
    historyLoaded.value = true
  } finally {
    historyLoading.value = false
  }
}

function toggle() {
  expanded.value = !expanded.value
  if (expanded.value) {
    hasExpandedOnce.value = true
    if (!historyLoaded.value) void loadHistory()
  }
}

// Card stays expanded across live updates; refresh history so a new event
// (e.g. a reward change) shows up without the user having to re-toggle.
watch(
  () => props.program.lastChangedAt,
  () => {
    if (expanded.value) void loadHistory()
  },
)

// Landing spot for `store.requestReturnTo(id)` (e.g. "jump back to the card
// generating a summary"). Handled here, not in ProgramList, because whether
// this card was even mounted when the request came in is unknown -- it may
// have been scrolled out of the virtualizer's range entirely, in which case
// this runs on mount once scrolling brings it back instead.
function claimReturnRequest() {
  if (store.pendingReturnTo === props.program.id) {
    if (!expanded.value) toggle()
    store.clearReturnRequest()
  }
}
onMounted(claimReturnRequest)
watch(() => store.pendingReturnTo, claimReturnRequest)
</script>

<template>
  <div class="card" :class="{ highlighted }">
    <div
      class="card-header"
      :class="{ pinned: expanded }"
      role="button"
      tabindex="0"
      :aria-expanded="expanded"
      @click="toggle"
      @keydown.enter="toggle"
      @keydown.space.prevent="toggle"
    >
      <span class="platform">{{ program.platform }}</span>
      <span class="name">
        {{ program.name }}<ChangeBadge :show="highlighted" />
        <a
          v-if="program.repositoryUrl"
          class="repo-link"
          :href="program.repositoryUrl"
          target="_blank"
          rel="noopener"
          :title="$t('detail.repository')"
          @click.stop
          >&lt;/&gt;</a
        >
      </span>
      <!-- `display: contents` on desktop -- these stay direct grid items in
           `.card-header`'s fixed columns. Only the mobile breakpoint turns
           this into a real flex container so the badges can wrap onto their
           own line(s) as a group instead of forcing the whole row wider
           than the screen. -->
      <div class="card-header-meta">
        <span class="category">{{ $t(`category.${program.category}`) }}</span>
        <span class="chains">{{ program.chains.join(', ') || '—' }}</span>
        <span class="reward">{{ rewardLabel }}</span>
        <span class="kyc" :class="{ required: program.kycRequired }">
          {{ program.kycRequired === null ? '—' : program.kycRequired ? $t('table.kyc') : $t('filter.kycNo') }}
        </span>
        <span class="status" :class="program.status">{{ $t(`status.${program.status}`) }}</span>
      </div>
      <span class="chevron" :class="{ open: expanded }">⌄</span>
    </div>
    <Transition name="fade-expand">
      <div v-if="hasExpandedOnce" v-show="expanded" class="card-body">
        <ProgramDetails :program="program" :history="history" :history-loading="historyLoading" />
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.card {
  background: var(--color-background-soft);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}
.card.highlighted {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-soft);
}
.card-header {
  display: grid;
  grid-template-columns: 110px 1fr 150px 160px 160px 90px 90px 24px;
  gap: 0.75rem;
  align-items: center;
  width: 100%;
  padding: 0.85rem 1.1rem;
  border: none;
  border-radius: var(--radius-card) var(--radius-card) 0 0;
  background: var(--color-background-soft);
  color: var(--color-text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.card-header-meta {
  display: contents;
}
.card-header:hover {
  background: var(--color-background-mute);
}
.card-header:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: -2px;
}
/* While expanded, keep the summary in view as the card's own details scroll
   underneath it -- released again once the card's bottom edge passes. */
.card-header.pinned {
  position: sticky;
  top: var(--filter-bar-height, 60px);
  z-index: 5;
  border-bottom: 1px solid var(--color-border);
}
.platform {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--color-accent-strong);
}
.name {
  font-weight: 500;
  color: var(--color-heading);
}
.repo-link {
  display: inline-block;
  margin-left: 0.4rem;
  padding: 0 0.3rem;
  border-radius: 4px;
  font-size: 0.7rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: var(--color-text-muted);
  background: var(--color-background-mute);
}
.repo-link:hover {
  color: var(--color-accent-strong);
  background: var(--color-accent-soft);
}
.category,
.chains {
  color: var(--color-text-muted);
  font-size: 0.85rem;
}
.reward {
  font-variant-numeric: tabular-nums;
}
.kyc {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}
.kyc.required {
  color: var(--color-warning);
  font-weight: 600;
}
.status {
  font-size: 0.75rem;
  font-weight: 600;
}
.status.closed {
  color: var(--color-danger);
}
.status.paused {
  color: var(--color-warning);
}
.status.active {
  color: var(--color-success);
}
.status.upcoming {
  color: var(--color-accent);
}
.chevron {
  justify-self: end;
  color: var(--color-text-muted);
  transition: transform 0.2s;
}
.chevron.open {
  transform: rotate(180deg);
}
.card-body {
  padding: 0 1.1rem 1.1rem;
}

.fade-expand-enter-active,
.fade-expand-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}
.fade-expand-enter-from,
.fade-expand-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* The desktop grid's fixed-width columns (110/150/160/160/90/90px) add up to
   more than a phone screen's whole width -- reflow onto a few lines instead
   of forcing the row (and the page) to scroll horizontally. */
@media (max-width: 640px) {
  .card-header {
    grid-template-columns: 1fr auto;
    grid-template-areas:
      'platform chevron'
      'name name'
      'meta meta';
    gap: 0.35rem 0.5rem;
    padding: 0.75rem 1rem;
  }
  .platform {
    grid-area: platform;
  }
  .name {
    grid-area: name;
  }
  .chevron {
    grid-area: chevron;
  }
  .card-header-meta {
    grid-area: meta;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.3rem 0.6rem;
  }
  .card-header-meta > * {
    /* flex items default to a min-width that fits their content on one
       line -- without this, a long chain list refuses to wrap and pushes
       the row wide again, right back to the bug this media query fixes. */
    min-width: 0;
  }
}
</style>
