import { defineStore } from 'pinia'
import { ref } from 'vue'
import { allEmployees, createEmployee, deleteEmployee, updateEmployee } from '@/api/employees'
import type { CreateEmployeeRequest, EmployeeType } from '@/types'

export const useEmployeesStore = defineStore('employees', () => {
  const employees = ref<EmployeeType[]>([])
  const loading = ref(false)

  async function fetchAll() {
    loading.value = true
    const { data, request, isFailed } = allEmployees()
    await request()
    loading.value = false
    if (isFailed.value || !data.value) return
    employees.value = data.value
  }

  async function add(payload: CreateEmployeeRequest) {
    const { data, request, isFailed } = createEmployee(payload)
    await request()
    if (isFailed.value || !data.value) return false
    employees.value.push(data.value)
    return true
  }

  async function update(id: string, payload: Partial<CreateEmployeeRequest>) {
    const { data, request, isFailed } = updateEmployee(id, payload)
    await request()
    if (isFailed.value || !data.value) return false
    const index = employees.value.findIndex((e) => e.id === id)
    if (index !== -1) employees.value[index] = data.value
    return true
  }

  async function remove(id: string) {
    const { request, isFailed } = deleteEmployee(id)
    await request()
    if (isFailed.value) return false
    employees.value = employees.value.filter((e) => e.id !== id)
    return true
  }

  return { employees, loading, fetchAll, add, update, remove }
})
