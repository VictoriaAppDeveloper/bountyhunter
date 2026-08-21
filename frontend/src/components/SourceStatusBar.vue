<script setup lang="ts">
import { useSourcesStore } from '@/stores/sources'
import { useI18n } from 'vue-i18n'

const store = useSourcesStore()
const { t } = useI18n()

function relativeTime(iso: string | null): string {
  if (!iso) return t('sources.never')
  const diffMs = Date.now() - new Date(iso).getTime()
  const sec = Math.round(diffMs / 1000)
  if (sec < 60) return t('sources.secondsAgo', { n: sec })
  const min = Math.round(sec / 60)
  if (min < 60) return t('sources.minutesAgo', { n: min })
  const hr = Math.round(min / 60)
  return t('sources.hoursAgo', { n: hr })
}
</script>

<template>
  <div class="source-bar">
    <div v-for="s in store.sources" :key="s.platform" class="source-chip">
      <span class="dot" :class="{ error: s.lastError }" />
      <span class="platform">{{ s.platform }}</span>
      <span class="meta">{{ s.lastProgramCount ?? 0 }} · {{ relativeTime(s.lastSuccessAt) }}</span>
    </div>
    <p v-if="store.sources.length === 0" class="empty">{{ $t('sources.empty') }}</p>
  </div>
</template>

<style scoped>
.source-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
}
.source-chip {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.25rem 0.6rem;
  border-radius: 999px;
  background: var(--color-background-soft);
  border: 1px solid var(--color-border);
  font-size: 0.75rem;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-success);
}
.dot.error {
  background: var(--color-danger);
}
.platform {
  text-transform: capitalize;
}
.meta {
  color: var(--color-text-muted);
}
.empty {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}
</style>
