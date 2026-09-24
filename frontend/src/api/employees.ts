import { useHttp } from '@/composables/useHttp'
import type { CreateEmployeeRequest, EmployeeType } from '@/types'

const { get, post, put, remove } = useHttp()

export const allEmployees = () => get<EmployeeType[]>('/employees')
export const createEmployee = (body: CreateEmployeeRequest) => post<EmployeeType, CreateEmployeeRequest>('/employees', body)
export const updateEmployee = (id: string, body: Partial<CreateEmployeeRequest>) =>
  put<EmployeeType, Partial<CreateEmployeeRequest>>(`/employees/${id}`, body)
export const deleteEmployee = (id: string) => remove<void>(`/employees/${id}`)
