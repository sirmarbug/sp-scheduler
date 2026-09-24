import type { PrismaClient } from '@prisma/client'
import { AppError } from '../types/index.js'
import type { CreateEmployeeRequest, UpdateEmployeeRequest } from '../schemas/employee.schema.js'

export class EmployeeService {
  constructor(private readonly prisma: PrismaClient) {}

  async list() {
    return this.prisma.employee.findMany({ orderBy: { name: 'asc' } })
  }

  async getById(id: string) {
    const employee = await this.prisma.employee.findUnique({ where: { id } })
    if (!employee) {
      throw new AppError('employees.notFound', 404, 'Pracownik nie istnieje')
    }
    return employee
  }

  async create(data: CreateEmployeeRequest) {
    return this.prisma.employee.create({ data })
  }

  async update(id: string, data: UpdateEmployeeRequest) {
    await this.getById(id)
    return this.prisma.employee.update({ where: { id }, data })
  }

  async remove(id: string) {
    await this.getById(id)

    const affectedSchedules = await this.prisma.schedule.findMany({
      where: { assignments: { some: { employeeId: id } } },
    })

    await this.prisma.$transaction([
      this.prisma.employee.delete({ where: { id } }),
      this.prisma.request.deleteMany({ where: { employeeId: id } }),
      ...affectedSchedules.map((schedule) =>
        this.prisma.schedule.update({
          where: { id: schedule.id },
          data: { assignments: { set: schedule.assignments.filter((a) => a.employeeId !== id) } },
        })
      ),
    ])
  }
}
