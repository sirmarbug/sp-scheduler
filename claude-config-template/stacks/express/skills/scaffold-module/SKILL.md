---
name: scaffold-module
description: Użyj, gdy trzeba dodać nowy zasób/moduł API w tym projekcie Express (np. użytkownik prosi "dodaj zasób 'products'" albo "stwórz endpointy CRUD dla kategorii") — generuje route/controller/service/Zod schema zgodne z konwencjami projektu i rejestruje je w głównym routerze. Obsługuje flagę --protected dla zasobów wymagających uwierzytelnienia/roli.
---

# Scaffold module (Express)

Generuje kompletny, warstwowy szkielet zasobu (`<resource>`) zgodny z
architekturą 3-warstwową opisaną w `CLAUDE.md` (routes → controllers →
services). Zakładana nazwa zasobu w liczbie pojedynczej, kebab-case dla
wielowyrazowych (np. `order-item`).

1. **Zod schema** — utwórz `src/schemas/<resource>.schema.ts` ze schematami
   request/response potrzebnymi dla operacji CRUD (co najmniej `create<Resource>Schema`,
   `update<Resource>Schema`), zarejestrowanymi w rejestrze OpenAPI
   (`registry.register('...')`) tak, by mogły trafić do dokumentacji Swagger.
   Wyeksportuj też typy przez `z.infer`.
2. **Service** — utwórz `src/services/<resource>.service.ts` jako klasę
   przyjmującą `PrismaClient` przez konstruktor (Dependency Injection, patrz
   `CLAUDE.md`). Metody CRUD (`findAll`, `findById`, `create`, `update`,
   `remove`) wywołują wyłącznie Prisma — żadnej logiki HTTP. Istotne zdarzenia
   biznesowe (np. utworzenie/usunięcie zasobu) logowane przez współdzielony
   `logger` z `config/logger.ts` (poziom `info`), patrz `CLAUDE.md` sekcja
   "Logowanie zdarzeń (Pino)".
3. **Controller** — utwórz `src/controllers/<resource>.controller.ts`.
   Każda metoda: wyciąga dane z `req` (już zwalidowane), wywołuje odpowiednią
   metodę serwisu, mapuje wynik na odpowiedź (`res.status(...).json(...)`),
   każdy `catch` kończy się `next(err)` — sam `catch` nie loguje, błąd loguje
   centralny error handler.
4. **Routes** — utwórz `src/routes/<resource>.routes.ts`. Dla każdej trasy
   dokładaj middleware w kolejności: `validate(<schema>)` → (jeśli
   `--protected`) `authMiddleware` → (jeśli podano rolę) `roleMiddleware(role)`
   → metoda kontrolera.
   - **Bez `--protected`**: trasy publiczne, bez middleware'ów auth.
   - **Z `--protected`**: każda trasa dostaje `authMiddleware`; jeśli
     użytkownik podał też rolę (np. `--protected=admin`), dodaj
     `roleMiddleware('admin')` zaraz po `authMiddleware`.
5. **Rejestracja w głównym routerze** — dopisz w `src/routes/index.ts`
   `router.use('/<resource-plural>', <resource>Routes)`, zachowując
   alfabetyczną/istniejącą kolejność rejestracji innych zasobów w pliku.
6. **Dokumentacja Swagger** — upewnij się, że trasy chronione mają w rejestracji
   OpenAPI jawne `security: [{ BearerAuth: [] }]` (patrz `CLAUDE.md`, sekcja
   "Dokumentacja Swagger/OpenAPI").
7. **Model danych** — jeśli zasób nie ma jeszcze odpowiadającego modelu w
   `prisma/schema.prisma`, dopisz blok `model <Resource> { ... }` z polami
   wynikającymi ze schematu Zod, po czym przypomnij użytkownikowi o
   uruchomieniu `npx prisma migrate dev --name add_<resource>` (nie uruchamiaj
   migracji automatycznie bez potwierdzenia — zmienia stan bazy).
8. **Testy** — dodaj testy integracyjne endpointów (`supertest`) pokrywające
   ścieżkę happy-path oraz walidację/autoryzację, jeśli zasób jest
   `--protected`.
