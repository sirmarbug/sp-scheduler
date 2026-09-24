<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import ScheduleCellEditor from '@/components/schedule/ScheduleCellEditor.vue'
import ScheduleGrid from '@/components/schedule/ScheduleGrid.vue'
import ValidationPanel from '@/components/schedule/ValidationPanel.vue'
import { useCellOptions } from '@/composables/useCellOptions'
import dayjs from '@/plugins/dayjs'
import { useEmployeesStore } from '@/stores/employees'
import { useMonthConfigStore } from '@/stores/month-config'
import { useScheduleStore } from '@/stores/schedule'
import { useValidationStore } from '@/stores/validation'
import type { CellOptionType } from '@/types'

const { t } = useI18n()
const employeesStore = useEmployeesStore()
const monthConfigStore = useMonthConfigStore()
const scheduleStore = useScheduleStore()
const validationStore = useValidationStore()

const { employees } = storeToRefs(employeesStore)
const { current: monthConfig } = storeToRefs(monthConfigStore)
const { current: schedule, generating } = storeToRefs(scheduleStore)
const { result: validationResult } = storeToRefs(validationStore)

const cellOptions = useCellOptions()
const monthValue = ref(dayjs().format('YYYY-MM'))

const hasCurrentAssignment = computed(() =>
  !!schedule.value?.assignments.some((a) => a.employeeId === cellOptions.employeeId.value && a.date === cellOptions.date.value)
)

async function loadAll() {
  await Promise.all([
    employeesStore.fetchAll(),
    monthConfigStore.fetchByMonthValue(monthValue.value),
    scheduleStore.fetchByMonthValue(monthValue.value),
  ])
  await validationStore.refresh(monthValue.value)
}

async function handleGenerate() {
  await scheduleStore.generate(monthValue.value)
}

async function handleApprove() {
  await scheduleStore.approve(monthValue.value)
}

function handleCellClick(employeeId: string, date: string) {
  cellOptions.open(monthValue.value, employeeId, date)
}

async function handleSelectOption(option: CellOptionType) {
  await scheduleStore.updateAssignment(monthValue.value, cellOptions.employeeId.value, cellOptions.date.value, option)
  cellOptions.close()
}

async function handleUnassign() {
  await scheduleStore.updateAssignment(monthValue.value, cellOptions.employeeId.value, cellOptions.date.value, null)
  cellOptions.close()
}

onMounted(loadAll)
</script>

<template>
  <div class="schedule-view">
    <div class="schedule-view__header">
      <div class="text-h6">{{ t('schedule.title') }}</div>
      <input v-model="monthValue" type="month" @change="loadAll" />
      <q-btn color="primary" :loading="generating" :label="t('schedule.generate')" @click="handleGenerate" />
      <q-btn color="secondary" :label="t('schedule.approve')" @click="handleApprove" />
    </div>

    <div v-if="generating">{{ t('schedule.generating') }}</div>

    <ScheduleGrid
      v-if="monthConfig"
      :employees="employees"
      :days="monthConfig.days"
      :assignments="schedule?.assignments ?? []"
      @cell-click="handleCellClick"
    />

    <ValidationPanel :result="validationResult" />

    <ScheduleCellEditor
      v-model="cellOptions.visible.value"
      :loading="cellOptions.loading.value"
      :options="cellOptions.options.value"
      :has-current-assignment="hasCurrentAssignment"
      @select="handleSelectOption"
      @unassign="handleUnassign"
    />
  </div>
</template>

<style scoped lang="scss">
.schedule-view {
  padding: 1rem;

  &__header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }
}
</style>
