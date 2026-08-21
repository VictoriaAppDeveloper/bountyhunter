<script setup lang="ts">
import { useProgramsStore } from '@/stores/programs'
import type { SummaryTask } from '@/stores/programs'

const store = useProgramsStore()

const tasks = computed(() => [...store.summaryTasks.values()])

// Visiting a finished summary is the natural point where the notification
// has done its job -- drop it. A still-generating task stays put so the
// user can jump back and watch it (or jump elsewhere and come back again).
function goTo(task: SummaryTask) {
  store.requestReturnTo(task.id)
  if (task.status === 'done') store.dismissSummaryTask(task.id)
}
</script>

<template>
  <div v-if="tasks.length" class="stack">
    <TransitionGroup name="pop">
      <div v-for="task in tasks" :key="task.id" class="item" :class="task.status">
        <button type="button" class="main" @click="goTo(task)">
          <span v-if="task.status === 'generating'" class="spinner" aria-hidden="true" />
          <span v-else class="check" aria-hidden="true">✓</span>
          <span class="label">{{
            task.status === 'generating'
              ? $t('summaryProgress.generating', { name: task.name })
              : $t('summaryProgress.done', { name: task.name })
          }}</span>
          <span class="cta">{{ $t('summaryProgress.goTo') }}</span>
        </button>
        <button
          type="button"
          class="dismiss"
          :aria-label="$t('summaryProgress.dismiss')"
          @click="store.dismissSummaryTask(task.id)"
        >
          ×
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.stack {
  position: fixed;
  right: 1.5rem;
  bottom: 1.5rem;
  z-index: 50;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.5rem;
}
.item {
  display: flex;
  align-items: center;
  max-width: min(90vw, 24rem);
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-background-soft);
  box-shadow: var(--shadow-card);
}
.item.done {
  border-color: var(--color-success);
}
.main {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.6rem 0.4rem 0.6rem 1rem;
  border: none;
  background: none;
  color: var(--color-text);
  font: inherit;
  font-size: 0.85rem;
  text-align: left;
  cursor: pointer;
}
.main:hover .cta {
  text-decoration: underline;
}
.spinner {
  flex: 0 0 auto;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid var(--color-accent-soft);
  border-top-color: var(--color-accent);
  animation: spin 0.7s linear infinite;
}
.check {
  flex: 0 0 auto;
  color: var(--color-success);
  font-weight: 700;
}
.label {
  overflow: hidden;
  color: var(--color-text-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cta {
  flex: 0 0 auto;
  color: var(--color-accent-strong);
  font-weight: 600;
  white-space: nowrap;
}
.dismiss {
  flex: 0 0 auto;
  padding: 0.3rem 0.7rem 0.3rem 0.2rem;
  border: none;
  background: none;
  color: var(--color-text-muted);
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
}
.dismiss:hover {
  color: var(--color-danger);
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.pop-enter-active,
.pop-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}
.pop-enter-from,
.pop-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
