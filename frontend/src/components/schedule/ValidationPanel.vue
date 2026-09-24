<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { computed } from 'vue'
import type { ValidationResultType } from '@/types'

interface ValidationPanelProps {
  result: ValidationResultType | null
}

const props = defineProps<ValidationPanelProps>()

const { t } = useI18n()

const isConsistent = computed(() => !!props.result && props.result.issues.length === 0 && props.result.coverageIssues.length === 0)
</script>

<template>
  <q-card v-if="result" class="validation-panel" flat bordered>
    <q-card-section>
      <q-banner :class="{ 'bg-positive': isConsistent, 'bg-negative': !isConsistent }" class="text-white">
        {{ result.status }}
      </q-banner>
    </q-card-section>

    <q-card-section v-if="result.issues.length">
      <div class="text-subtitle2">{{ t('schedule.validation.issues') }}</div>
      <ul>
        <li v-for="(issue, index) in result.issues" :key="index">{{ issue }}</li>
      </ul>
    </q-card-section>

    <q-card-section v-if="result.coverageIssues.length">
      <div class="text-subtitle2">{{ t('schedule.validation.coverageIssues') }}</div>
      <ul>
        <li v-for="(issue, index) in result.coverageIssues" :key="index">{{ issue }}</li>
      </ul>
    </q-card-section>

    <q-card-section>
      <div class="text-subtitle2">{{ t('schedule.validation.summary') }}</div>
      <q-list dense bordered>
        <q-item v-for="summary in result.summaryList" :key="summary.employeeId">
          <q-item-section>
            <q-item-label>{{ summary.name }}</q-item-label>
            <q-item-label caption>
              {{ t('schedule.validation.summaryLine', {
                hours: summary.totalHours,
                target: summary.targetHours ?? '—',
                diff: summary.firstSecondDiff,
                prefs: summary.preferenceHits,
              }) }}
            </q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
    </q-card-section>
  </q-card>
</template>

<style scoped lang="scss">
.validation-panel {
  margin-top: 1rem;
}
</style>
