import { OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi'
import { registry } from './registry.js'

export function buildOpenApiDocument() {
  const generator = new OpenApiGeneratorV3(registry.definitions)

  return generator.generateDocument({
    openapi: '3.0.0',
    info: {
      title: 'SP Scheduler API',
      version: '0.1.0',
      description: 'API do zarządzania grafikiem zmian sklepu (pracownicy, kalendarz, wnioski, generowanie grafiku przez AI).',
    },
    servers: [{ url: '/' }],
  })
}
