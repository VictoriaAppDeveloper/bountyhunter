<script setup lang="ts">
import { setLocale, SUPPORTED_LOCALES } from '@/i18n'

const { locale, t } = useI18n()
</script>

<template>
  <label class="locale-switch">
    <span class="sr-only">{{ t('lang.label') }}</span>
    <select :value="locale" @change="setLocale(($event.target as HTMLSelectElement).value as 'en' | 'ru')">
      <option v-for="l in SUPPORTED_LOCALES" :key="l" :value="l">{{ l.toUpperCase() }}</option>
    </select>
  </label>
</template>

<style scoped>
.locale-switch select {
  padding: 0.3rem 0.5rem;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  background: var(--color-background-soft);
  color: var(--color-text);
  font-size: 0.8rem;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
}
</style>
