import type { Request, Response } from 'express'
import { prisma } from '../config/db.js'
import { AvailabilityRequestService } from '../services/request.service.js'
import type { CreateRequestRequest, ListRequestsQuery } from '../schemas/request.schema.js'

const requestService = new AvailabilityRequestService(prisma)

export const requestController = {
  async list(req: Request<unknown, unknown, unknown, ListRequestsQuery>, res: Response) {
    const requests = await requestService.list(req.query)
    res.json(requests)
  },

  async create(req: Request<unknown, unknown, CreateRequestRequest>, res: Response) {
    const request = await requestService.create(req.body)
    res.status(201).json(request)
  },

  async remove(req: Request<{ id: string }>, res: Response) {
    await requestService.remove(req.params.id)
    res.status(204).send()
  },
}
