export class AppError extends Error {
  status: number
  code: string

  constructor(code: string, status: number, message: string) {
    super(message)
    this.code = code
    this.status = status
  }
}

export interface AuthenticatedUser {
  id: string
  email: string
}

declare global {
  namespace Express {
    interface User extends AuthenticatedUser {}
  }
}
