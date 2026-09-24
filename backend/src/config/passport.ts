import passport from 'passport'
import { ExtractJwt, Strategy as JwtStrategy } from 'passport-jwt'
import { env } from './env.js'
import { prisma } from './db.js'

passport.use(
  new JwtStrategy(
    {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: env.JWT_ACCESS_SECRET,
    },
    async (payload: { sub: string; email: string }, done) => {
      const user = await prisma.user.findUnique({ where: { id: payload.sub } })
      if (!user) {
        return done(null, false)
      }
      return done(null, { id: user.id, email: user.email })
    }
  )
)

export { passport }
