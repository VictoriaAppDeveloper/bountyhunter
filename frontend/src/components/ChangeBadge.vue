<script setup lang="ts">
defineProps<{ show: boolean }>()
</script>

<template>
  <span v-if="show" class="change-badge">{{ $t('badge.updated') }}</span>
</template>

<style scoped>
.change-badge {
  display: inline-block;
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  background: var(--color-accent-soft);
  color: var(--color-accent-strong);
  margin-left: 0.5rem;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}
</style>
