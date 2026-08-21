<script setup lang="ts">
defineProps<{ tabs: { key: string; label: string }[]; modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [string] }>()
</script>

<template>
  <div class="tabs">
    <div class="tab-list" role="tablist">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        type="button"
        role="tab"
        class="tab"
        :class="{ active: tab.key === modelValue }"
        :aria-selected="tab.key === modelValue"
        @click.stop="emit('update:modelValue', tab.key)"
      >
        {{ tab.label }}
      </button>
    </div>
    <div class="tab-panels">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.tabs {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.tab-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 0.4rem;
}
.tab {
  padding: 0.35rem 0.75rem;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--color-text-muted);
  font: inherit;
  font-size: 0.82rem;
  cursor: pointer;
}
.tab:hover {
  background: var(--color-background-mute);
  color: var(--color-text);
}
.tab.active {
  background: var(--color-accent-soft);
  color: var(--color-accent-strong);
  font-weight: 600;
}
</style>
