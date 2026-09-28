<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { computed } from 'vue'
import type { ValidationResultType } from '@/types'

interface ValidationPanelProps {
  result: ValidationResultType | null
}

const props = defineProps<ValidationPanelProps>()

const emit = defineEmits<{
  (e: 'update-target-hours', employeeId: string, hours: number): void
}>()

const { t } = useI18n()

const isConsistent = computed(() => !!props.result && props.result.issues.length === 0 && props.result.coverageIssues.length === 0)

function handleTargetHoursChange(employeeId: string, value: string | number | null) {
  const hours = Number(value)
  if (Number.isNaN(hours)) return
  emit('update-target-hours', employeeId, hours)
}
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
              {{ t('schedule.validation.summaryHours', { hours: summary.totalHours }) }}
              <q-input
                v-if="summary.targetHours !== null"
                dense
                borderless
                type="number"
                class="validation-panel__target-input"
                :model-value="summary.targetHours"
                @change="(value: string | number | null) => handleTargetHoursChange(summary.employeeId, value)"
              />
              <span v-else>{{ t('schedule.validation.targetNotApplicable') }}</span>
              {{ t('schedule.validation.summarySuffix', {
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

  &__target-input {
    display: inline-flex;
    width: 3.5rem;
    vertical-align: middle;
  }
}
</style>
