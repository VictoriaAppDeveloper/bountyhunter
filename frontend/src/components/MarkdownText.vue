<script lang="ts">
import DOMPurify from 'dompurify'

// Registered once at module scope, not per-render. Immunefi source text is
// pulled from a third-party community mirror -- links get forced to a new
// tab so following one never navigates the SPA away.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer')
  }
})
</script>

<script setup lang="ts">
import { marked } from 'marked'

const props = defineProps<{ text: string }>()

const html = computed(() => DOMPurify.sanitize(marked.parse(props.text, { async: false, gfm: true, breaks: true })))
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -->
  <div class="markdown" v-html="html"></div>
</template>

<style scoped>
.markdown {
  line-height: 1.6;
}
.markdown :deep(p) {
  margin: 0 0 0.75em;
}
.markdown :deep(p:last-child) {
  margin-bottom: 0;
}
.markdown :deep(ul),
.markdown :deep(ol) {
  margin: 0 0 0.75em 1.25em;
  padding: 0;
}
.markdown :deep(li) {
  margin-bottom: 0.25em;
}
.markdown :deep(h1),
.markdown :deep(h2),
.markdown :deep(h3),
.markdown :deep(h4) {
  margin: 1em 0 0.4em;
  font-size: 0.95rem;
  color: var(--color-heading);
}
.markdown :deep(h1:first-child),
.markdown :deep(h2:first-child),
.markdown :deep(h3:first-child),
.markdown :deep(h4:first-child) {
  margin-top: 0;
}
.markdown :deep(a) {
  color: var(--color-accent);
  text-decoration: underline;
  word-break: break-word;
}
.markdown :deep(strong) {
  color: var(--color-heading);
}
.markdown :deep(code) {
  background: var(--color-background-soft);
  padding: 0.1em 0.35em;
  border-radius: 4px;
  font-size: 0.85em;
}
</style>
