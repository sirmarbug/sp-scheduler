import type { NextFunction, Request, RequestHandler, Response } from 'express'

type AsyncRouteHandler<Req extends Request = Request, Res extends Response = Response> = (
  req: Req,
  res: Res,
  next: NextFunction
) => Promise<void>

export function asyncHandler<Req extends Request = Request, Res extends Response = Response>(
  handler: AsyncRouteHandler<Req, Res>
): RequestHandler {
  return (req, res, next) => {
    handler(req as Req, res as Res, next).catch(next)
  }
}
