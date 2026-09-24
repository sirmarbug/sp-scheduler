import type { Request, Response } from 'express'
import { prisma } from '../config/db.js'
import { EmployeeService } from '../services/employee.service.js'
import type { CreateEmployeeRequest, UpdateEmployeeRequest } from '../schemas/employee.schema.js'

const employeeService = new EmployeeService(prisma)

export const employeeController = {
  async list(_req: Request, res: Response) {
    const employees = await employeeService.list()
    res.json(employees)
  },

  async getById(req: Request<{ id: string }>, res: Response) {
    const employee = await employeeService.getById(req.params.id)
    res.json(employee)
  },

  async create(req: Request<unknown, unknown, CreateEmployeeRequest>, res: Response) {
    const employee = await employeeService.create(req.body)
    res.status(201).json(employee)
  },

  async update(req: Request<{ id: string }, unknown, UpdateEmployeeRequest>, res: Response) {
    const employee = await employeeService.update(req.params.id, req.body)
    res.json(employee)
  },

  async remove(req: Request<{ id: string }>, res: Response) {
    await employeeService.remove(req.params.id)
    res.status(204).send()
  },
}
