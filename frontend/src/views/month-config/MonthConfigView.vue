<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import dayjs from '@/plugins/dayjs'
import { useMonthConfigStore } from '@/stores/month-config'

const { t } = useI18n()
const monthConfigStore = useMonthConfigStore()
const { current, loading } = storeToRefs(monthConfigStore)

const monthValue = ref(dayjs().format('YYYY-MM'))

async function loadOrCreate() {
  const [yearStr, monthStr] = monthValue.value.split('-')
  const year = Number(yearStr)
  const monthIndex = Number(monthStr) - 1
  const found = await monthConfigStore.fetchByMonthValue(monthValue.value)
  if (!found) {
    await monthConfigStore.createForMonth(year, monthIndex)
  }
}

function toggleDay(date: string, isClosed: boolean) {
  monthConfigStore.toggleDayClosed(date, !isClosed)
}

onMounted(loadOrCreate)
</script>

<template>
  <div class="month-config-view">
    <div class="month-config-view__header">
      <div class="text-h6">{{ t('monthConfig.title') }}</div>
      <input v-model="monthValue" type="month" @change="loadOrCreate" />
    </div>

    <q-inner-loading :showing="loading" />

    <q-list v-if="current" bordered>
      <q-item v-for="day in current.days" :key="day.date">
        <q-item-section>
          <q-item-label>{{ day.date }}</q-item-label>
          <q-item-label caption>
            {{ t('monthConfig.activeShifts', { active: day.shifts.filter((s) => s.enabled).length, total: day.shifts.length }) }}
          </q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle :model-value="!day.isClosed" @update:model-value="toggleDay(day.date, day.isClosed)" />
        </q-item-section>
      </q-item>
    </q-list>
  </div>
</template>

<style scoped lang="scss">
.month-config-view {
  padding: 1rem;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
  }
}
</style>
