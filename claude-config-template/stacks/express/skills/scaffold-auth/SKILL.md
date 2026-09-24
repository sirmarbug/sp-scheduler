---
name: scaffold-auth
description: Jednorazowy skill uruchamiany raz na początku projektu (lub gdy w projekcie jeszcze nie ma systemu uwierzytelniania) — generuje kompletny boilerplate Auth (AuthService, tokeny, Passport.js, middleware'y JWT, model User) zgodny z konwencjami projektu. Użyj, gdy użytkownik prosi "dodaj logowanie/rejestrację" albo "skonfiguruj auth" w projekcie, który tego jeszcze nie ma.
---

# Scaffold auth (Express)

Generuje pełny system uwierzytelniania opisany w `CLAUDE.md` (sekcja
"Uwierzytelnianie (Auth)"): Argon2 + podwójny token JWT (Access w nagłówku,
Refresh w ciasteczku `HttpOnly`) + Passport.js (Local, JWT).
Zanim zaczniesz, sprawdź czy `AuthService`/`authMiddleware` już istnieją w
projekcie — jeśli tak, nie nadpisuj, tylko zgłoś użytkownikowi konflikt.

1. **Model User** — dopisz do `prisma/schema.prisma`:
   ```prisma
   model User {
     id        String   @id @default(auto()) @map("_id") @db.ObjectId
     email     String   @unique
     password  String?
     role      String   @default("user")
     createdAt DateTime @default(now())
   }
   ```
   `password` opcjonalne (użytkownicy zalogowani wyłącznie przez Google OAuth2
   go nie mają). Przypomnij o `npx prisma migrate dev --name add_user`.
2. **Konfiguracja Passport** — utwórz `src/config/passport.ts` rejestrujący
   trzy strategie:
   - `LocalStrategy` — email + hasło, weryfikacja przez `argon2.verify`.
   - `JwtStrategy` (`passport-jwt`) — weryfikacja Access Tokenu z nagłówka
     `Authorization`, sekret z `process.env.JWT_ACCESS_SECRET`.
3. **AuthService** — utwórz `src/services/auth.service.ts` z metodami:
   - `register(email, password)` — hashuje hasło Argon2 (`argon2.hash`) przed
     zapisem, tworzy użytkownika, zwraca DTO bez pola `password`. Loguje
     (`logger.info`, patrz `CLAUDE.md` sekcja "Logowanie zdarzeń (Pino)")
     udaną rejestrację — bez hasła w logu.
   - `login(email, password)` — weryfikuje hasło, generuje parę tokenów.
     Loguje udane logowanie (`logger.info`) i nieudaną próbę (`logger.warn`,
     bez logowania samego hasła).
   - `issueTokens(user)` — Access Token (`JWT_ACCESS_SECRET`, np. `15m`) +
     Refresh Token (`JWT_REFRESH_SECRET`, np. `7d`); żaden token nie trafia do
     modelu/bazy w postaci jawnej, jeśli projekt przechowuje refresh tokeny
     (rotacja) — trzymaj wyłącznie hash.
   - `refresh(refreshToken)` — weryfikuje Refresh Token, wydaje nowy Access
     Token.
4. **Middleware JWT** — utwórz `src/middlewares/authMiddleware.ts`
   (`passport.authenticate('jwt', { session: false })`) i
   `src/middlewares/roleMiddleware.ts` (`roleMiddleware(...roles: string[])`
   sprawdzający `req.user.role`).
5. **Routes/Controller** — `src/routes/auth.routes.ts` +
   `src/controllers/auth.controller.ts` z endpointami `POST /auth/register`,
   `POST /auth/login`, `POST /auth/refresh`. `POST /auth/login` i
   `POST /auth/register` dostają dodatkowo `authLimiter`
   (`express-rate-limit`, patrz `CLAUDE.md` sekcja "Bezpieczeństwo HTTP") jako
   pierwszy middleware trasy, przed walidacją Zod — ochrona przed
   brute-force na najbardziej atakowane endpointy. Kontroler ustawia Refresh
   Token w ciasteczku `HttpOnly` (`res.cookie('refreshToken', token, {
   httpOnly: true, secure: isProduction, sameSite: 'lax' })`) i zwraca w JSON
   wyłącznie Access Token + DTO użytkownika (bez `password`/refresh tokenu).
6. **Zmienne środowiskowe** — dopisz jako pola `cleanEnv` w `src/config/env.ts`
   (envalid, patrz `CLAUDE.md` sekcja "Zarządzanie środowiskiem") wymagane
   klucze: `JWT_ACCESS_SECRET: str()`, `JWT_REFRESH_SECRET: str()` — brak
   któregokolwiek ma uniemożliwić start aplikacji, nie dawać wartości
   domyślnej.
7. **Dokumentacja Swagger** — zarejestruj schemat bezpieczeństwa `BearerAuth`
   w konfiguracji OpenAPI (`src/docs`), tak by `scaffold-module --protected`
   mogło się do niego odwoływać przez `security: [{ BearerAuth: [] }]`.
8. **Testy** — testy integracyjne dla `register`/`login`/`refresh` (happy-path
   + błędne dane), testy jednostkowe `AuthService` z mockowanym Prisma.
