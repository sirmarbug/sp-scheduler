import { useHttp } from '@/composables/useHttp'
import type { CreateRequestRequest, RequestDtoType } from '@/types'

const { get, post, remove } = useHttp()

export const allRequests = () => get<RequestDtoType[]>('/requests')
export const createRequest = (body: CreateRequestRequest) => post<RequestDtoType, CreateRequestRequest>('/requests', body)
export const deleteRequest = (id: string) => remove<void>(`/requests/${id}`)
