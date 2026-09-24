<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useEmployeesStore } from '@/stores/employees'
import { useRequestsStore } from '@/stores/requests'
import type { CreateRequestRequest, RequestType } from '@/types'

const { t } = useI18n()
const requestsStore = useRequestsStore()
const employeesStore = useEmployeesStore()
const { requests, loading } = storeToRefs(requestsStore)
const { employees } = storeToRefs(employeesStore)

const formVisible = ref(false)
const form = ref<CreateRequestRequest>({ employeeId: '', date: '', shiftId: 'all', type: 'avoid' })
const requestTypeOptions: RequestType[] = ['avoid', 'prefer']

function openCreateForm() {
  form.value = { employeeId: '', date: '', shiftId: 'all', type: 'avoid' }
  formVisible.value = true
}

async function submitForm() {
  const success = await requestsStore.add(form.value)
  if (success) formVisible.value = false
}

function employeeName(employeeId: string) {
  return employees.value.find((e) => e.id === employeeId)?.name ?? employeeId
}

onMounted(() => {
  requestsStore.fetchAll()
  employeesStore.fetchAll()
})
</script>

<template>
  <div class="requests-view">
    <div class="requests-view__header">
      <div class="text-h6">{{ t('requests.title') }}</div>
      <q-btn color="primary" :label="t('common.add')" @click="openCreateForm" />
    </div>

    <q-inner-loading :showing="loading" />

    <q-list bordered>
      <q-item v-for="req in requests" :key="req.id">
        <q-item-section>
          <q-item-label>{{ employeeName(req.employeeId) }} — {{ req.date }} ({{ req.shiftId }})</q-item-label>
          <q-item-label caption>{{ req.type }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-btn flat round icon="delete" @click="requestsStore.remove(req.id)" />
        </q-item-section>
      </q-item>
    </q-list>

    <q-dialog v-model="formVisible">
      <q-card class="requests-view__form-card">
        <q-card-section>
          <q-form @submit.prevent="submitForm">
            <q-select v-model="form.employeeId" emit-value map-options :options="employees.map((e) => ({ label: e.name, value: e.id }))" />
            <q-input v-model="form.date" type="date" />
            <q-input v-model="form.shiftId" />
            <q-select v-model="form.type" :options="requestTypeOptions" />
            <q-btn class="q-mt-md" type="submit" color="primary" :label="t('common.save')" />
          </q-form>
        </q-card-section>
      </q-card>
    </q-dialog>
  </div>
</template>

<style scoped lang="scss">
.requests-view {
  padding: 1rem;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
  }

  &__form-card {
    width: 100%;
    max-width: 28rem;
  }
}
</style>
