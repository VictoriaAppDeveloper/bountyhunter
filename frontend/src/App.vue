<template>
  <div class="app-shell">
    <header class="app-header">
      <div>
        <h1>Bounty Hunter</h1>
        <p class="tagline">{{ $t('app.tagline') }}</p>
      </div>
      <LocaleSwitch />
    </header>
    <RouterView />
  </div>
</template>

<style scoped>
.app-shell {
  max-width: 1280px;
  margin: 0 auto;
  padding: 1.5rem 2rem;
}
.app-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.5rem;
}
.app-header h1 {
  margin: 0;
  font-size: 1.5rem;
  color: var(--color-heading);
}
.tagline {
  margin: 0.25rem 0 0;
  color: var(--color-text-muted);
  font-size: 0.9rem;
}
</style>
