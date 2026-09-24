## Konwencje Express

Stack referencyjny: Node.js + Express + TypeScript (strict) + Prisma (MongoDB) +
Zod (walidacja + OpenAPI) + Passport.js (Local, Google OAuth2, JWT) + Argon2
(hashowanie haseł) + Swagger/OpenAPI generowany dynamicznie przez
`@asteasolutions/zod-to-openapi`. Poniższe zasady są globalnymi ramami
architektury — agent nie może ich pominąć przy tworzeniu kolejnych endpointów,
niezależnie od tego, o co dokładnie poprosi użytkownik.

### Architektura warstwowa

Trzy warstwy, zawsze w tej kolejności odpowiedzialności — **zakaz mieszania
warstw** (np. zapytań Prisma w kontrolerze, walidacji w routerze, budowania
odpowiedzi HTTP w serwisie):

1. **`routes`** — wyłącznie definicja ścieżek i rejestracja łańcucha
   middleware'ów (walidacja Zod → `authMiddleware` → `roleMiddleware` →
   kontroler). Żadnej logiki.
2. **`controllers`** — wyciąga dane z `req` (już zwalidowane przez middleware
   Zod), wywołuje dokładnie jedną metodę warstwy `services`, mapuje wynik na
   odpowiedź HTTP (status + JSON). Brak logiki biznesowej, brak bezpośrednich
   zapytań do bazy.
3. **`services`** — czysta logika biznesowa (np. `AuthService`, `UserService`).
   Jedyne miejsce, które wywołuje Prisma i inne zależności zewnętrzne.

**Dependency Injection**: serwisy przyjmują zależności (klienta Prisma, inne
serwisy, konfigurację) jako argumenty konstruktora, nie importują ich jako
globalne singletony wewnątrz metod — dzięki temu serwis da się przetestować
jednostkowo z podstawionym mockiem/fake, bez realnej bazy:

```ts
// src/services/user.service.ts
export class UserService {
  constructor(private readonly prisma: PrismaClient) {}

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } })
  }
}
```

### Struktura katalogów

- `/src/config` — konfiguracja bazy (`db.ts`, inicjalizuje i eksportuje
  `PrismaClient` raz), Passport.js (`passport.ts`), zmiennych środowiskowych
  (`env.ts`, walidacja `process.env` przez envalid przy starcie aplikacji —
  patrz sekcja "Zarządzanie środowiskiem").
- `/src/routes` — definicje ścieżek HTTP, po jednym pliku na zasób
  (`user.routes.ts`), rejestrowane w głównym routerze `routes/index.ts`.
- `/src/controllers` — po jednym pliku na zasób (`user.controller.ts`).
- `/src/services` — czysta logika biznesowa, po jednym pliku na domenę
  (`user.service.ts`, `auth.service.ts`).
- `/src/middlewares` — `validate.ts` (walidacja Zod), `authMiddleware.ts`
  (weryfikacja JWT przez Passport), `roleMiddleware.ts` (weryfikacja ról),
  centralny error handler.
- `/src/schemas` — schematy Zod per zasób, będące jednocześnie źródłem typów
  TS (`z.infer`) i dokumentacji OpenAPI.
- `/src/docs` — konfiguracja Swagger/OpenAPI (`zod-to-openapi` registry,
  serwowanie `/api-docs`).
- `/src/utils` — bezstanowe funkcje pomocnicze i stałe (`constants.ts`), np.
  formatowanie, mapowanie DTO — nigdy logika biznesowa (to należy do
  `services`) ani zależności od `req`/`res` (to należy do `controllers`).
- `/src/types` — globalne, współdzielone definicje TypeScript (np. `Express.
  Request.user`, typy DTO używane w więcej niż jednej warstwie) — typy
  lokalne dla jednego pliku (np. request/response konkretnego endpointu)
  zostają przy `z.infer` w `src/schemas`, nie trafiają tutaj.
- **`src/models` celowo nie istnieje** — przy wybranym Prisma jedynym źródłem
  prawdy o modelach danych jest `prisma/schema.prisma` (patrz niżej); osobne
  pliki modeli per zasób w `src/` byłyby duplikacją tego samego schematu i
  nie są tworzone.
- `prisma/schema.prisma` — pojedyncze źródło prawdy o modelach danych (zgodnie
  z konwencją Prisma; brak osobnych plików modeli w `src/`, w przeciwieństwie
  do klasycznego podziału Mongoose).
- `src/app.ts` — buduje i eksportuje instancję Express (middleware'y,
  routing) bez wywoływania `listen` — dzięki temu testy integracyjne
  (`supertest`) importują `app` bez uruchamiania realnego serwera/portu.
- `src/server.ts` — jedyne miejsce wywołujące `app.listen(env.PORT, ...)`;
  punkt wejścia uruchamiany przez `npm run dev`/`npm start`, importuje `app`
  z `app.ts`.

`PrismaClient` jest inicjalizowany raz w `/src/config/db.ts` i importowany
wyłącznie stamtąd — nigdy `new PrismaClient()` w innych plikach:

```ts
// src/config/db.ts
import { PrismaClient } from '@prisma/client'

export const prisma = new PrismaClient()
```

### Walidacja inputu (Zod)

- Każdy request (body/params/query) walidowany schematem Zod w dedykowanym
  middleware `validate(schema)` **przed** kontrolerem — kontroler nigdy nie
  sprawdza ręcznie `if (!field)`.
- Schemat jest jedynym źródłem prawdy: typ TS przez `z.infer<typeof schema>` i
  wpis do rejestru OpenAPI (`zod-to-openapi`) — zakaz ręcznego pisania
  równoległego interfejsu TS albo równoległego opisu Swaggera dla tego samego
  requestu.

```ts
// src/schemas/user.schema.ts
import { z } from 'zod'
import { registry } from '../docs/registry'

export const createUserSchema = registry.register(
  'CreateUserRequest',
  z.object({
    email: z.string().email(),
    password: z.string().min(8),
  })
)

export type CreateUserRequest = z.infer<typeof createUserSchema>
```

```ts
// użycie w routes/user.routes.ts
router.post('/', validate(createUserSchema), authMiddleware, userController.create)
```

### Uwierzytelnianie (Auth)

- Hasła **zawsze** hashowane Argon2 (`argon2.hash`) przed zapisem — hashowanie
  wykonuje warstwa `services` (np. `AuthService.register`), nigdy kontroler.
  Porównanie przy logowaniu przez `argon2.verify`, nigdy ręczne porównanie
  stringów.
- Hasło ani Refresh Token **nigdy** nie trafiają do odpowiedzi JSON — serwis
  zwraca DTO bez tych pól (np. przez jawny `select`/`omit` w zapytaniu Prisma
  albo mapowanie wyniku), nie poleganie na tym, że frontend je zignoruje.
- Podwójny token: Access Token krótki czas życia (np. `15m`), zwracany w
  ciele odpowiedzi i przesyłany klient→serwer w nagłówku `Authorization:
  Bearer <token>`. Refresh Token dłuższy czas życia, ustawiany w ciasteczku
  `HttpOnly` (+ `Secure` na produkcji, `SameSite=Strict`/`Lax`) — nigdy w ciele
  JSON.
- Passport.js z dwoma strategiami: `Local` (email+hasło, logowanie), `JWT` (weryfikacja Access
  Tokenu na chronionych endpointach — to jest `authMiddleware`).

### Autoryzacja (RBAC)

- Każdy chroniony route korzysta z `authMiddleware` (strategia Passport JWT),
  weryfikującego Access Token i ustawiającego `req.user`.
- Gdy endpoint wymaga konkretnej roli, dokładamy `roleMiddleware(...role)`
  **po** `authMiddleware` (bo potrzebuje już `req.user`), sprawdzający
  `req.user.role` względem dozwolonych ról:

```ts
router.delete(
  '/:id',
  authMiddleware,
  roleMiddleware('admin'),
  userController.remove
)
```

### Obsługa błędów

- Domenowy błąd jako klasa rozszerzająca `Error`, z polami `status` (kod
  HTTP) i `code` (identyfikator błędu do i18n/frontendowego mapowania), np.
  `AppError('users.notFound', 404, 'Użytkownik nie istnieje')` —
  analogiczny wzorzec do `ExtendError` w projekcie referencyjnym.
- Każdy `catch` w kontrolerze/serwisie kończy się `next(err)` — zakaz cichego
  połykania błędów (pusty `catch` albo `console.log` bez propagacji).
- Jeden centralny error handler (`middlewares/errorHandler.ts`) na końcu
  łańcucha middleware'ów w `app.ts`, mapujący `AppError` na `{ status, error:
  { code, message } }`; nieznane błędy (bez `status`) mapowane na `500` bez
  wycieku szczegółów (stack trace) do klienta w produkcji.
- Middleware `catchNotFound` na samym końcu routingu (przed error handlerem)
  dla nieobsłużonych ścieżek.

### Logowanie zdarzeń (Pino)

- Jeden współdzielony logger, inicjalizowany raz w `/src/config/logger.ts` i
  importowany wyłącznie stamtąd (analogicznie do `PrismaClient` w
  `/src/config/db.ts`) — zakaz `console.log`/`console.error`/`console.warn` w
  kodzie aplikacyjnym.
- `pino-http` zarejestrowany jako middleware w `app.ts`, wcześnie w łańcuchu
  (przed routingiem) — automatycznie loguje każde żądanie/odpowiedź (metoda,
  ścieżka, status, czas trwania, request id).
- Transport zależny od środowiska, skonfigurowany w jednym miejscu
  (`config/logger.ts`), nie rozrzucony po kodzie: development →
  `pino-pretty` (czytelny, kolorowany output), produkcja → surowy JSON bez
  transportu (wydajność + łatwa analiza przez agregatory logów).

  ```ts
  // src/config/logger.ts
  import pino from 'pino'

  const isProduction = process.env.NODE_ENV === 'production'

  export const logger = pino(
    isProduction
      ? {}
      : { transport: { target: 'pino-pretty', options: { colorize: true } } }
  )
  ```

- Centralny error handler (sekcja "Obsługa błędów") loguje każdy przechwycony
  błąd przez `logger.error({ err }, '<opis>')` przed zbudowaniem odpowiedzi —
  błędy 5xx nie mogą zniknąć bez śladu w logach.
- Poziomy: `error` dla wyjątków/błędów 5xx, `warn` dla błędów
  walidacji/4xx wartych uwagi (np. nieudane logowanie), `info` dla istotnych
  zdarzeń biznesowych (np. rejestracja/utworzenie zasobu), `debug` dla
  szczegółów przydatnych tylko lokalnie. **Nigdy** dane wrażliwe (hasła,
  tokeny, pełne payloady z PII) w żadnym poziomie logu.

### Zarządzanie środowiskiem (dotenv + envalid)

- `dotenv` wczytywany raz, jak najwcześniej — pierwszy import w punkcie
  wejścia aplikacji (`src/server.ts`, patrz "Struktura katalogów"), przed
  jakimkolwiek innym modułem, który odczytuje `process.env` (w tym przed
  `app.ts`, inicjalizacją loggera i Prisma).
- Cały zbiór wymaganych zmiennych środowiskowych zdefiniowany **raz**, jawnie,
  w `/src/config/env.ts` przez `envalid` (`cleanEnv` + walidatory
  `str`/`port`/`bool`/`url`/`num` per zmienna). Żaden inny plik nie czyta
  `process.env` bezpośrednio — wszędzie indziej importuje się wynikowy obiekt
  `env` z tego pliku (ten sam wzorzec co `logger`/`prisma`: jedno źródło
  prawdy, zaimportowane wszędzie indziej).
- **Fail-fast**: jeśli brakuje zmiennej albo ma zły typ, `envalid` rzuca błąd
  synchronicznie przy imporcie `env.ts` — aplikacja **nie ma prawa
  wystartować**. Zakaz wartości domyślnych "na wszelki wypadek" dla zmiennych
  krytycznych (sekrety JWT, connection string do bazy).
- Rozgraniczenie z Zod: Zod służy wyłącznie do walidacji requestów/response
  (sekcja "Walidacja inputu (Zod)") — envalid jest jedynym narzędziem
  walidacji `process.env`. Te dwie odpowiedzialności się nie mieszają.

```ts
// src/config/env.ts
import { cleanEnv, str, port, url } from 'envalid'

export const env = cleanEnv(process.env, {
  NODE_ENV: str({ choices: ['development', 'production', 'test'] }),
  PORT: port({ default: 3000 }),
  DATABASE_URL: url(),
  JWT_ACCESS_SECRET: str(),
  JWT_REFRESH_SECRET: str(),
})
```

### Bezpieczeństwo HTTP (Helmet, CORS, rate limiting)

- **Helmet** — jeden z pierwszych middleware'ów w `app.ts` (przed routingiem,
  obok `pino-http`), z domyślną konfiguracją jako punktem wyjścia.
  Niestandardowe wyłączenia poszczególnych nagłówków (np. CSP pod Swagger UI)
  tylko jawnie i z uzasadnieniem w komentarzu — nigdy blanket
  `helmet({ contentSecurityPolicy: false })` bez powodu.
- **CORS** — jedna centralna konfiguracja `cors()` w `app.ts` (nie per-route),
  z jawną listą dozwolonych originów czytaną z `env` (envalid, patrz sekcja
  "Zarządzanie środowiskiem") — zakaz `cors()` bez opcji (otwarte na
  wszystkie originy) na produkcji. `credentials: true`, gdy Refresh Token w
  ciasteczku wymaga cross-origin (spójne z sekcją "Uwierzytelnianie (Auth)").
- **express-rate-limit** — globalny limiter na całe API (rozsądny limit per
  IP/okno czasowe) + osobny, bardziej restrykcyjny limiter na endpointy
  logowania/rejestracji (`/auth/login`, `/auth/register`) — brute-force na
  hasła jest głównym zagrożeniem, które ten pakiet ma adresować. Limitery
  zdefiniowane raz w `src/middlewares/rateLimiter.ts`, importowane stamtąd
  (ten sam wzorzec co `logger`/`prisma`/`env`).
- Kolejność middleware'ów startowych w `app.ts`: `dotenv` (ładowany jako
  pierwszy import, patrz "Zarządzanie środowiskiem") → Helmet → CORS →
  `express.json()` → `pino-http` → globalny rate limiter → routing (gdzie
  dodatkowo `authMiddleware`/`roleMiddleware`/dedykowane limitery per route,
  np. `authLimiter` na trasach logowania).

```ts
// src/app.ts (fragment)
app.use(helmet())
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }))
app.use(express.json())
app.use(pinoHttp({ logger }))
app.use(globalRateLimiter)
```

```ts
// src/middlewares/rateLimiter.ts
import rateLimit from 'express-rate-limit'

export const globalRateLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 })
export const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 })
```

- Nowa zmienna środowiskowa `CORS_ORIGIN` dopisana do `cleanEnv` w
  `src/config/env.ts` (spójnie z sekcją "Zarządzanie środowiskiem" — żadna
  nowa zmienna nie omija envalid).

### Dokumentacja Swagger/OpenAPI

- Dokument OpenAPI budowany dynamicznie z rejestru Zod
  (`@asteasolutions/zod-to-openapi`) — schemat requestu/response definiowany
  raz (w `src/schemas`) i re-używany zarówno do walidacji, jak i dokumentacji;
  zakaz ręcznego, równoległego pliku `swagger.yaml`/JSDoc-owych adnotacji.
- Każdy endpoint chroniony (`authMiddleware`) musi mieć w rejestracji trasy
  jawnie zadeklarowane `security: [{ BearerAuth: [] }]` — bez tego wpis w
  dokumentacji jest błędny, niezależnie od realnego stanu middleware'ów.

### Typowanie i nazewnictwo

- TypeScript strict (`strict: true` w `tsconfig.json`), zakaz `any` — dla
  nieznanego typu `unknown` + zawężanie, nigdy `any` jako obejście.
- camelCase dla zmiennych, funkcji, metod; PascalCase dla klas, typów,
  interfejsów i nazw modeli Prisma (`model User { ... }`).
- Pliki warstwowe sufiksowane rolą: `<zasob>.routes.ts`,
  `<zasob>.controller.ts`, `<zasob>.service.ts`, `<zasob>.schema.ts` — ta sama
  nazwa zasobu (liczba pojedyncza, kebab-case dla wielowyrazowych) w każdej
  warstwie ułatwia nawigację.

### Testowanie

- Testy jednostkowe warstwy `services` z podstawionym (mockowanym) klientem
  Prisma — logika biznesowa testowana bez realnej bazy.
- Testy integracyjne endpointów przez `supertest`, uruchamiane na testowej
  bazie/kontenerze — pokrywają cały łańcuch middleware'ów (walidacja → auth →
  rola → kontroler → serwis).
- Nowy zasób dodany przez `scaffold-module` powinien dostać realne testy, nie
  zostać samym szkieletem bez pokrycia.
