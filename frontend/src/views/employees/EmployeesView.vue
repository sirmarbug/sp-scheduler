<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { useEmployeesStore } from '@/stores/employees'
import type { ContractType, CreateEmployeeRequest, ExtraRole, Position } from '@/types'

const { t } = useI18n()
const employeesStore = useEmployeesStore()
const { employees, loading } = storeToRefs(employeesStore)
const confirmDialog = useConfirmDialog()

const formVisible = ref(false)
const form = ref<CreateEmployeeRequest>({ name: '', contractType: 'uop', position: 'cashier', extraRoles: [] })

const contractTypeOptions: ContractType[] = ['uop', 'zlecenie']
const positionOptions: Position[] = ['manager', 'cashier']
const extraRoleOptions: ExtraRole[] = ['managerShift1', 'managerShift2']

const canHaveExtraRoles = computed(() => form.value.position === 'cashier')

function openCreateForm() {
  form.value = { name: '', contractType: 'uop', position: 'cashier', extraRoles: [] }
  formVisible.value = true
}

async function submitForm() {
  const success = await employeesStore.add(form.value)
  if (success) formVisible.value = false
}

async function handleDelete(id: string) {
  const confirmed = await confirmDialog.open(
    t('employees.confirmDelete.title'),
    t('employees.confirmDelete.message')
  )
  if (!confirmed) return
  await employeesStore.remove(id)
}

onMounted(() => {
  employeesStore.fetchAll()
})
</script>

<template>
  <div class="employees-view">
    <div class="employees-view__header">
      <div class="text-h6">{{ t('employees.title') }}</div>
      <q-btn color="primary" :label="t('common.add')" @click="openCreateForm" />
    </div>

    <q-list bordered>
      <q-item v-for="employee in employees" :key="employee.id">
        <q-item-section>
          <q-item-label>{{ employee.name }}</q-item-label>
          <q-item-label caption>{{ employee.contractType }} · {{ employee.position }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-btn flat round icon="delete" @click="handleDelete(employee.id)" />
        </q-item-section>
      </q-item>
    </q-list>

    <q-inner-loading :showing="loading" />

    <q-dialog v-model="formVisible">
      <q-card class="employees-view__form-card">
        <q-card-section>
          <q-form @submit.prevent="submitForm">
            <q-input v-model="form.name" :label="t('employees.form.name')" />
            <q-select v-model="form.contractType" :options="contractTypeOptions" :label="t('employees.form.contractType')" />
            <q-select v-model="form.position" :options="positionOptions" :label="t('employees.form.position')" />
            <q-select
              v-if="canHaveExtraRoles"
              v-model="form.extraRoles"
              multiple
              :options="extraRoleOptions"
              :label="t('employees.form.extraRoles')"
            />
            <q-btn class="q-mt-md" type="submit" color="primary" :label="t('common.save')" />
          </q-form>
        </q-card-section>
      </q-card>
    </q-dialog>

    <q-dialog v-model="confirmDialog.visible.value">
      <q-card>
        <q-card-section class="text-h6">{{ confirmDialog.title.value }}</q-card-section>
        <q-card-section>{{ confirmDialog.message.value }}</q-card-section>
        <q-card-actions align="right">
          <q-btn flat :label="t('common.cancel')" @click="confirmDialog.reject" />
          <q-btn flat color="negative" :label="t('common.delete')" @click="confirmDialog.confirm" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<style scoped lang="scss">
.employees-view {
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
