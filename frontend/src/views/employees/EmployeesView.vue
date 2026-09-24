<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { useEmployeesStore } from '@/stores/employees'
import type { ContractType, CreateEmployeeRequest, EmployeeType, ExtraRole, Position } from '@/types'

const { t } = useI18n()
const employeesStore = useEmployeesStore()
const { employees, loading } = storeToRefs(employeesStore)
const confirmDialog = useConfirmDialog()

const formVisible = ref(false)
const editingId = ref<string | null>(null)
const form = ref<CreateEmployeeRequest>({ name: '', contractType: 'uop', position: 'cashier', extraRoles: [] })

const contractTypeOptions: ContractType[] = ['uop', 'zlecenie']
const positionOptions: Position[] = ['manager', 'cashier']

const canHaveExtraRoles = computed(() => form.value.position === 'cashier' || form.value.position === 'manager')
const extraRoleOptionsForPosition = computed<ExtraRole[]>(() =>
  form.value.position === 'cashier' ? ['managerShift1', 'managerShift2'] : ['cashierEligible']
)

function handlePositionChange() {
  form.value.extraRoles = []
}

function openCreateForm() {
  editingId.value = null
  form.value = { name: '', contractType: 'uop', position: 'cashier', extraRoles: [] }
  formVisible.value = true
}

function openEditForm(employee: EmployeeType) {
  editingId.value = employee.id
  form.value = {
    name: employee.name,
    contractType: employee.contractType,
    position: employee.position,
    extraRoles: employee.extraRoles,
  }
  formVisible.value = true
}

async function submitForm() {
  const success = editingId.value
    ? await employeesStore.update(editingId.value, form.value)
    : await employeesStore.add(form.value)
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
          <div class="row items-center q-gutter-x-xs">
            <q-btn flat round icon="edit" @click="openEditForm(employee)" />
            <q-btn flat round icon="delete" @click="handleDelete(employee.id)" />
          </div>
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
            <q-select
              v-model="form.position"
              :options="positionOptions"
              :label="t('employees.form.position')"
              @update:model-value="handlePositionChange"
            />
            <q-select
              v-if="canHaveExtraRoles"
              v-model="form.extraRoles"
              multiple
              :options="extraRoleOptionsForPosition"
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
