<script setup lang="ts">
import { fetchProgram, fetchProgramHistory } from '@/api/client'
import type { ChangeEvent, Program } from '@/types/program'

const route = useRoute()
const { t } = useI18n()
const program = ref<Program | null>(null)
const history = ref<ChangeEvent[]>([])
const loading = ref(true)

async function load() {
  loading.value = true
  const id = Number(route.params.id)
  const [p, h] = await Promise.all([fetchProgram(id), fetchProgramHistory(id)])
  program.value = p
  history.value = h
  loading.value = false
}

onMounted(load)
watch(() => route.params.id, load)
</script>

<template>
  <div v-if="loading">{{ t('table.loading') }}</div>
  <div v-else-if="program" class="detail">
    <RouterLink to="/">{{ t('detail.back') }}</RouterLink>
    <h2>{{ program.name }}</h2>
    <p class="meta">
      {{ program.platform }} · {{ t(`category.${program.category}`) }} · {{ t(`status.${program.status}`) }}
    </p>
    <p v-if="program.rewardMax !== null">
      {{ t('detail.maxReward') }} {{ program.rewardMax }} {{ program.rewardCurrency }}
    </p>
    <p>{{ t('detail.chains') }} {{ program.chains.join(', ') || '—' }}</p>
    <p v-if="program.kycRequired !== null">
      {{ t('detail.kyc') }}
      <strong>{{ program.kycRequired ? t('detail.kycRequired') : t('detail.kycNotRequired') }}</strong>
    </p>

    <ProgramDetails :program="program" :history="history" />
  </div>
</template>

<style scoped>
.detail {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.meta {
  color: var(--color-text-muted);
}
</style>
