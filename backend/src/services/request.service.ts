import type { PrismaClient } from '@prisma/client'
import { AppError } from '../types/index.js'
import type { CreateRequestRequest, ListRequestsQuery } from '../schemas/request.schema.js'

export class AvailabilityRequestService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(filters: ListRequestsQuery) {
    return this.prisma.request.findMany({
      where: {
        employeeId: filters.employeeId,
        date: filters.date,
      },
      orderBy: { date: 'asc' },
    })
  }

  async create(data: CreateRequestRequest) {
    const employee = await this.prisma.employee.findUnique({ where: { id: data.employeeId } })
    if (!employee) {
      throw new AppError('requests.employeeNotFound', 404, 'Pracownik nie istnieje')
    }
    return this.prisma.request.create({ data })
  }

  async remove(id: string) {
    const request = await this.prisma.request.findUnique({ where: { id } })
    if (!request) {
      throw new AppError('requests.notFound', 404, 'Wniosek nie istnieje')
    }
    await this.prisma.request.delete({ where: { id } })
  }
}
