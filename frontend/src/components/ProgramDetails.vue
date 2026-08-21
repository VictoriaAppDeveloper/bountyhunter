<script setup lang="ts">
import { summarizeProgram } from '@/api/client'
import { useAutoTranslateGroup, type TranslateGroup } from '@/composables/useAutoTranslate'
import { useProgramsStore } from '@/stores/programs'
import type { ChangeEvent, Program } from '@/types/program'

const SCOPE_PREVIEW_COUNT = 8
const IMPACTS_PREVIEW_COUNT = 8

const props = defineProps<{
  program: Program
  history: ChangeEvent[]
  historyLoading?: boolean
}>()

const { t, locale } = useI18n()
const programsStore = useProgramsStore()
const showAllScope = ref(false)
const showAllImpacts = ref(false)
const activeTab = ref('ai')

const tabs = computed(() => [
  { key: 'ai', label: t('detail.tabAiSummary') },
  { key: 'overview', label: t('detail.tabOverview') },
  { key: 'find', label: t('detail.tabWhatToFind') },
  { key: 'scope', label: t('detail.tabScope') },
  { key: 'rewards', label: t('detail.tabRewards') },
  { key: 'rules', label: t('detail.tabRules') },
  { key: 'resources', label: t('detail.tabResources') },
  { key: 'history', label: t('detail.tabHistory') },
])

// Set only when THIS instance's own generateSummary() call resolves --
// needed because on the standalone program page `program` isn't backed by
// the shared store, so there's nothing else to react to.
const localSummary = ref<string | null>(null)

// Everywhere `program` IS store-backed (the dashboard card), this reacts to
// `programsStore.updateProgramSummary` on its own -- including when the
// request was started by a now-destroyed instance of this component (the
// card was scrolled out of the virtualized list's range and remounted
// fresh, e.g. via "return to" on the generation-progress banner) and this
// mount never called generateSummary() itself.
const summary = computed(() => {
  if (localSummary.value !== null) return localSummary.value
  return props.program.summary !== null && props.program.summaryLocale === locale.value ? props.program.summary : null
})
// Tracked in the store, not a local ref -- this component can unmount mid
// request (virtualized card scrolled out of range) and a freshly remounted
// instance still needs to know generation for this program is in flight.
const summaryLoading = computed(() => programsStore.summaryTasks.get(props.program.id)?.status === 'generating')
const summaryError = ref<string | null>(null)

async function generateSummary() {
  summaryError.value = null
  programsStore.startSummaryGeneration(props.program.id, props.program.name)
  try {
    const result = await summarizeProgram(props.program.id, locale.value)
    localSummary.value = result
    programsStore.updateProgramSummary(props.program.id, result, locale.value)
    programsStore.finishSummaryGeneration(props.program.id)
  } catch (e) {
    summaryError.value = e instanceof Error ? e.message : String(e)
    programsStore.dismissSummaryTask(props.program.id)
  }
}

const visibleImpacts = computed(() => {
  const impacts = props.program.impacts
  return showAllImpacts.value ? impacts : impacts.slice(0, IMPACTS_PREVIEW_COUNT)
})

// "Where to look": in-scope assets. Only translate visible, described assets --
// large programs can have dozens of scope entries.
const visibleScope = computed(() => {
  const scope = props.program.scope
  return showAllScope.value ? scope : scope.slice(0, SCOPE_PREVIEW_COUNT)
})
const describedAssets = computed(() => visibleScope.value.filter((a) => a.description))

// Everything translatable for this card, batched into a single request.
const translateSource = computed<TranslateGroup>(() => ({
  description: props.program.description,
  programOverview: props.program.programOverview,
  rewardsBody: props.program.rewardsBody,
  prohibitedActivities: props.program.prohibitedActivities,
  feasibilityLimitations: props.program.feasibilityLimitations,
  documentation: props.program.documentation,
  taskTags: props.program.taskTags,
  impactTitles: visibleImpacts.value.map((i) => i.title),
  scopeDescriptions: describedAssets.value.map((a) => a.description as string),
}))
const { display: translated } = useAutoTranslateGroup(translateSource)

const translatedScopeDescriptionByUrl = computed(() => {
  const map = new Map<string, string>()
  describedAssets.value.forEach((a, i) => {
    map.set(a.url, translated.value.scopeDescriptions[i] ?? (a.description as string))
  })
  return map
})

function fieldLabel(field: string | null): string {
  return field ? t(`field.${field}`) : ''
}

const LIST_FIELDS = new Set(['chains', 'taskTags'])
const TRUNCATE_AT = 80

// History rows store raw field values (often JSON-encoded arrays or bare
// enum strings) -- render them the way the rest of the UI already does
// instead of dumping the wire format.
function formatHistoryValue(field: string | null, raw: string | null): string {
  if (raw === null) return '—'
  if (field && LIST_FIELDS.has(field)) {
    try {
      const items = JSON.parse(raw) as string[]
      return items.length ? items.join(', ') : '—'
    } catch {
      return raw
    }
  }
  if (field === 'scope') {
    try {
      const items = JSON.parse(raw) as unknown[]
      return t('detail.scopeCount', { n: items.length })
    } catch {
      return raw
    }
  }
  if (field === 'kycRequired') {
    if (raw === 'true') return t('detail.kycRequired')
    if (raw === 'false') return t('detail.kycNotRequired')
    return '—'
  }
  if (field === 'status') return t(`status.${raw}`)
  return raw.length > TRUNCATE_AT ? `${raw.slice(0, TRUNCATE_AT)}…` : raw
}
</script>

<template>
  <div class="details">
    <p class="url-line">
      <a :href="program.url" target="_blank" rel="noopener" @click.stop>{{ program.url }}</a>
    </p>

    <Tabs v-model="activeTab" :tabs="tabs">
      <div v-show="activeTab === 'ai'" class="tab-content">
        <p v-if="summaryError" class="summary-error">{{ summaryError }}</p>
        <MarkdownText v-else-if="summary" :text="summary" />
        <p v-else-if="!summaryLoading" class="empty">{{ t('detail.aiSummaryEmpty') }}</p>
        <button type="button" class="show-more" :disabled="summaryLoading" @click.stop="generateSummary">
          {{
            summaryLoading
              ? t('detail.aiSummaryLoading')
              : summary
                ? t('detail.aiSummaryRegenerate')
                : t('detail.aiSummaryGenerate')
          }}
        </button>
      </div>

      <div v-show="activeTab === 'overview'" class="tab-content">
        <p v-if="program.kycRequired !== null" class="meta-line">
          {{ t('detail.kyc') }}
          <strong>{{ program.kycRequired ? t('detail.kycRequired') : t('detail.kycNotRequired') }}</strong>
        </p>
        <MarkdownText v-if="translated.description" :text="translated.description" />
        <MarkdownText v-if="translated.programOverview" :text="translated.programOverview" />
        <p v-if="!translated.description && !translated.programOverview" class="empty">
          {{ t('detail.overviewEmpty') }}
        </p>
      </div>

      <div v-show="activeTab === 'find'" class="tab-content">
        <div v-if="program.taskTags.length" class="tags">
          <span v-for="(tag, i) in translated.taskTags" :key="i" class="tag">{{ tag }}</span>
        </div>
        <ul v-if="program.impacts.length" class="impacts">
          <li v-for="(impact, i) in visibleImpacts" :key="i">
            <span class="severity" :class="impact.severity">{{ t(`severity.${impact.severity}`) }}</span>
            <span>{{ translated.impactTitles[i] ?? impact.title }}</span>
          </li>
        </ul>
        <p v-else class="empty">{{ t('detail.whatToFindEmpty') }}</p>
        <button
          v-if="program.impacts.length > IMPACTS_PREVIEW_COUNT"
          type="button"
          class="show-more"
          @click.stop="showAllImpacts = !showAllImpacts"
        >
          {{ showAllImpacts ? t('detail.showLess') : t('detail.showAll', { n: program.impacts.length }) }}
        </button>
      </div>

      <div v-show="activeTab === 'scope'" class="tab-content">
        <ul v-if="program.scope.length" class="scope">
          <li v-for="asset in visibleScope" :key="asset.url">
            <a :href="asset.url" target="_blank" rel="noopener" @click.stop>{{ asset.url }}</a>
            <span class="asset-type">{{ asset.type }}</span>
            <p v-if="asset.description" class="asset-description">
              {{ translatedScopeDescriptionByUrl.get(asset.url) ?? asset.description }}
            </p>
          </li>
        </ul>
        <p v-else class="empty">{{ t('detail.scopeEmpty') }}</p>
        <button
          v-if="program.scope.length > SCOPE_PREVIEW_COUNT"
          type="button"
          class="show-more"
          @click.stop="showAllScope = !showAllScope"
        >
          {{ showAllScope ? t('detail.showLess') : t('detail.showAll', { n: program.scope.length }) }}
        </button>
      </div>

      <div v-show="activeTab === 'rewards'" class="tab-content">
        <MarkdownText v-if="translated.rewardsBody" :text="translated.rewardsBody" />
        <p v-else class="empty">{{ t('detail.rewardsEmpty') }}</p>
      </div>

      <div v-show="activeTab === 'rules'" class="tab-content">
        <div v-if="translated.prohibitedActivities" class="sub-section">
          <h4>{{ t('detail.prohibitedActivities') }}</h4>
          <MarkdownText :text="translated.prohibitedActivities" />
        </div>
        <div v-if="translated.feasibilityLimitations" class="sub-section">
          <h4>{{ t('detail.feasibilityLimitations') }}</h4>
          <MarkdownText :text="translated.feasibilityLimitations" />
        </div>
        <p v-if="!translated.prohibitedActivities && !translated.feasibilityLimitations" class="empty">
          {{ t('detail.rulesEmpty') }}
        </p>
      </div>

      <div v-show="activeTab === 'resources'" class="tab-content">
        <div v-if="program.repositoryUrl" class="sub-section">
          <h4>{{ t('detail.codebase') }}</h4>
          <a :href="program.repositoryUrl" target="_blank" rel="noopener" class="resource-link" @click.stop>{{
            program.repositoryUrl
          }}</a>
        </div>
        <div v-if="translated.documentation" class="sub-section">
          <h4>{{ t('detail.documentation') }}</h4>
          <MarkdownText :text="translated.documentation" />
        </div>
        <p v-if="!program.repositoryUrl && !translated.documentation" class="empty">
          {{ t('detail.resourcesEmpty') }}
        </p>
      </div>

      <div v-show="activeTab === 'history'" class="tab-content">
        <p v-if="historyLoading" class="empty">{{ t('table.loading') }}</p>
        <ul v-else-if="history.length" class="history">
          <li v-for="e in history" :key="e.id">
            <strong>{{ t(`changeType.${e.type}`) }}</strong>
            <span v-if="e.field"
              >{{ fieldLabel(e.field) }}: {{ formatHistoryValue(e.field, e.oldValue) }} →
              {{ formatHistoryValue(e.field, e.newValue) }}</span
            >
            <time>{{ new Date(e.createdAt).toLocaleString() }}</time>
          </li>
        </ul>
        <p v-else class="empty">{{ t('detail.historyEmpty') }}</p>
      </div>
    </Tabs>
  </div>
</template>

<style scoped>
.details {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.url-line a {
  font-size: 0.85rem;
  word-break: break-all;
}
.tab-content {
  min-height: 3rem;
}
.meta-line {
  margin: 0 0 0.75rem;
  font-size: 0.9rem;
}
.sub-section {
  margin-bottom: 1rem;
}
.sub-section:last-child {
  margin-bottom: 0;
}
.sub-section h4 {
  margin: 0 0 0.4rem;
  font-size: 0.85rem;
  color: var(--color-heading);
}
.resource-link {
  font-size: 0.85rem;
  word-break: break-all;
}
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 0.5rem;
}
.tag {
  padding: 0.15rem 0.6rem;
  border-radius: 999px;
  background: var(--color-background-mute);
  border: 1px solid var(--color-border);
  font-size: 0.75rem;
}
.impacts,
.scope,
.history {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.impacts li {
  display: flex;
  gap: 0.5rem;
  align-items: baseline;
  font-size: 0.85rem;
}
.severity {
  flex: 0 0 auto;
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  padding: 0.05rem 0.4rem;
  border-radius: 4px;
  background: var(--color-background-mute);
}
.severity.critical {
  color: var(--color-danger);
}
.severity.high {
  color: var(--color-warning);
}
.severity.medium {
  color: var(--color-warning);
}
.severity.low {
  color: var(--color-success);
}
.scope li {
  padding: 0.4rem 0;
  border-bottom: 1px solid var(--color-border);
  font-size: 0.85rem;
}
.scope li:last-child {
  border-bottom: none;
}
.asset-type {
  margin-left: 0.5rem;
  font-size: 0.68rem;
  color: var(--color-text-muted);
  text-transform: uppercase;
}
.asset-description {
  margin: 0.25rem 0 0;
  color: var(--color-text-muted);
}
.empty {
  color: var(--color-text-muted);
  font-size: 0.85rem;
  margin: 0;
}
.summary-error {
  color: var(--color-danger);
  font-size: 0.85rem;
  margin: 0 0 0.5rem;
}
.show-more {
  margin-top: 0.5rem;
  padding: 0.3rem 0.7rem;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  background: var(--color-background-soft);
  color: var(--color-text);
  font-size: 0.8rem;
  cursor: pointer;
}
.show-more:hover {
  border-color: var(--color-border-hover);
}
.history li {
  display: flex;
  gap: 0.5rem;
  padding: 0.4rem 0;
  border-bottom: 1px solid var(--color-border);
  font-size: 0.85rem;
}
.history li:last-child {
  border-bottom: none;
}
.history time {
  margin-left: auto;
  color: var(--color-text-muted);
  white-space: nowrap;
}
</style>
