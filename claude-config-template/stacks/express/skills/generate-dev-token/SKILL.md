---
name: generate-dev-token
description: Użyj, gdy programista chce lokalnie przetestować chroniony endpoint API bez przechodzenia przez pełny flow logowania (np. "daj mi token admina do Swaggera" albo "wygeneruj token dla roli user") — generuje podpisany kluczem developerskim Access Token dla podanej roli. Wyłącznie do środowiska lokalnego/development.
---

# Generate dev token (Express)

Ułatwia lokalne testowanie chronionych endpointów: generuje poprawnie
podpisany Access Token (tym samym sekretem i algorytmem co produkcyjny
`authMiddleware`/`JwtStrategy`, patrz `CLAUDE.md`), gotowy do wklejenia w
polu "Authorize" Swaggera.

1. **Nigdy w produkcji** — skrypt uruchamia się wyłącznie lokalnie, z sekretem
   z `.env.development` (`JWT_ACCESS_SECRET`). Jeśli `NODE_ENV=production`,
   odmów wygenerowania tokenu i wypisz ostrzeżenie.
2. Jeśli w projekcie nie istnieje jeszcze plik narzędziowy, utwórz go jako
   skrypt CLI, np. `scripts/generate-dev-token.ts`, uruchamiany przez
   `npm run generate-dev-token -- <role>` (dopisz komendę do `package.json`).
3. Skrypt przyjmuje jeden argument — rolę (np. `user`, `admin`) — i buduje
   payload analogiczny do tego, co produkuje `AuthService.issueTokens` (patrz
   skill `scaffold-auth`): przykładowe `userId`/`id` (losowe/stałe testowe
   UUID), `email` (np. `dev+<role>@local.test`), `role`.
4. Podpisuje payload tym samym sekretem i tym samym czasem życia co realny
   Access Token (`JWT_ACCESS_SECRET`, np. `15m`) — token musi przejść dokładnie
   tę samą weryfikację co token wydany przez `/auth/login`, żeby test miał
   sens.
5. Wypisuje na stdout gotowy do skopiowania token (bez prefiksu `Bearer ` —
   pole "Authorize" w Swagger UI zwykle dokleja prefiks samo, w zależności od
   konfiguracji `securityScheme` dopisz odpowiednią instrukcję w komunikacie
   wyjściowym skryptu).
6. Jeśli rola podana przez użytkownika nie istnieje w systemie ról projektu
   (np. nie ma jej w `roleMiddleware`/modelu `User.role`), zwróć błąd zamiast
   generować token z nieprawidłową rolą.
