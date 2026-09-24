import { cleanEnv, str, port, url, num } from 'envalid'

export const env = cleanEnv(process.env, {
  NODE_ENV: str({ choices: ['development', 'production', 'test'], default: 'development' }),
  PORT: port({ default: 3000 }),
  DATABASE_URL: url(),
  CORS_ORIGIN: str(),
  JWT_ACCESS_SECRET: str(),
  JWT_REFRESH_SECRET: str(),
  OPENROUTER_API_KEY: str(),
  OPENROUTER_MODEL: str(),
  OPENROUTER_MAX_RETRIES: num({ default: 3 }),
  OPENROUTER_TEMPERATURE: num({ default: 0.2 }),
})
