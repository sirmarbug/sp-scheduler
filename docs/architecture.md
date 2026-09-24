# Architektura

## Przegląd

SP Scheduler to monorepo (npm workspaces) złożone z dwóch niezależnie uruchamianych aplikacji:

- **`frontend/`** — Vue 3 (Composition API, `<script setup>`) + Quasar + Pinia + Vue Router + vue-i18n (pl/en) + DayJS. SPA komunikujące się z backendem wyłącznie przez REST/JSON.
- **`backend/`** — Node.js + Express + TypeScript (strict) + Prisma (MongoDB) + Zod (walidacja + OpenAPI) + Passport.js (Local + JWT) + Argon2. Warstwa API jest jedynym miejscem, które zna klucz API OpenRouter i rozmawia z bazą danych.

Aplikacja jest **single-tenant**: logowanie działa jako bramka dostępu (Local, e-mail+hasło), ale wszystkie dane domenowe (pracownicy, kalendarz, wnioski, grafik) są **wspólne dla wszystkich zalogowanych kont** — nie ma izolacji danych per użytkownik.

## Moduły i ich odpowiedzialność

**Backend** (`backend/src`):

- `config/` — pojedyncze źródła prawdy dla zależności zewnętrznych: `db.ts` (PrismaClient), `env.ts` (envalid), `logger.ts` (Pino), `passport.ts` (strategia JWT), `dayjs.ts` (plugin `isoWeek`).
- `routes` / `controllers` / `services` — trójwarstwowa architektura per zasób (`auth`, `employee`, `month-config`, `request`, `schedule`). Routing = walidacja Zod + middleware; kontroler = mapowanie request→service→response; serwis = logika biznesowa i jedyne miejsce wywołujące Prisma.
- `services/schedule-validator.service.ts` — **deterministyczny** walidator reguł hard/końcowych (sekcje 4 i 7 `BUSINESS-REQUIREMENTS.md`). Czysta funkcja, DI, bez zależności od AI ani od bazy — używana zarówno po generacji AI, jak i po każdej ręcznej korekcie komórki.
- `services/ai-scheduler.service.ts` — integracja z OpenRouter.ai: budowa promptu z reguł domenowych, wywołanie `/chat/completions`, parsowanie i walidacja structuralna odpowiedzi, pętla retry z feedbackiem o naruszeniach.
- `services/schedule.service.ts` — orkiestracja: łączy dane (pracownicy/kalendarz/wnioski) z `AiSchedulerService` i `ScheduleValidatorService`, zapisuje wynik + `generationAttempts` (log audytowy prób AI).
- `services/schedule-cell.service.ts` — logika ręcznej edycji pojedynczej komórki grafiku (dopuszczalne opcje, zapis).
- `utils/roleEligibility.ts` / `utils/requestMatching.ts` — wspólne, czyste funkcje reguł uprawnień/blokad, reużywane przez walidator i przez `schedule-cell.service.ts`, żeby uniknąć duplikacji reguł domenowych.

**Frontend** (`frontend/src`):

- `stores/` — Pinia setup stores per domena (`auth`, `employees`, `month-config`, `requests`, `schedule`, `validation`). Store `schedule` po każdej zmianie (generowanie, edycja komórki) odświeża store `validation`.
- `composables/useHttp.ts` — jedyny klient Axios, z interceptorem wstrzykującym token dostępu i globalną obsługą 401 (czyszczenie sesji + przekierowanie do logowania).
- `views/` — strony routingu odpowiadające cyklowi życia grafiku z sekcji 6 specyfikacji: konfiguracja miesiąca, pracownicy, wnioski, grafik.
- `components/schedule/` — `ScheduleGrid` (siatka pracownik×dzień), `ScheduleCellEditor` (dialog wyboru dopuszczalnej opcji dla komórki), `ValidationPanel` (błędy/niedobory/podsumowanie).

## Przepływ danych

1. Planista konfiguruje kalendarz miesiąca (`MonthConfigView` → `PATCH /month-config/:monthValue/...`).
2. Wprowadza wnioski dostępności (`RequestsView` → `POST /requests`).
3. Generuje grafik (`ScheduleView` → `POST /schedule/:monthValue/generate`):
   `ScheduleService.generate()` buduje input → `AiSchedulerService.generateWithRetry()` woła OpenRouter → każda próba przechodzi przez `ScheduleValidatorService.validate()` → przy naruszeniach reguł hard, feedback trafia do kolejnego promptu (do `OPENROUTER_MAX_RETRIES` prób) → wynik (wraz z logiem prób) zapisywany w kolekcji `Schedule`.
4. Planista koryguje pojedyncze komórki (`PATCH /schedule/:monthValue/cell`) — każda korekta jest ograniczona do opcji zwróconych przez `GET /schedule/:monthValue/cell-options` (te same reguły uprawnień co walidator).
5. Panel walidacji (`GET /schedule/:monthValue/validation`) jest odświeżany po generacji i po każdej korekcie, prezentując `issues`/`coverageIssues`/`summaryList`/`status`.
6. Zatwierdzenie (`POST /schedule/:monthValue/approve`) zmienia status na `approved`.

## Zależności zewnętrzne

- **MongoDB** (przez Prisma) — jedyna trwała persystencja. Wymaga uruchomienia jako replica set (nawet single-node) — Prisma Mongo używa transakcji (`$transaction`) przy kaskadowym usuwaniu pracownika.
- **OpenRouter.ai** (`OPENROUTER_API_KEY`, `OPENROUTER_MODEL` w `backend/.env`) — jedyny dostawca AI do generowania przydziałów. Wywoływany wyłącznie z backendu; wynik nigdy nie jest ufany bezpośrednio — zawsze przechodzi przez deterministyczny walidator przed zapisem.

## Znane ograniczenia

- **Brak izolacji danych per użytkownik** — to świadoma decyzja projektowa (logowanie jako bramka dostępu do wspólnych danych jednej lokalizacji), nie luka.
- **Reguły hard/soft są zakodowane globalnie** (`utils/constants.ts`) — sekcja 10 `BUSINESS-REQUIREMENTS.md` zostawia jako przyszłe rozszerzenie ich konfigurowalność per lokalizacja.
- **OpenAPI/Swagger** (`GET /api-docs`) rejestruje obecnie schematy DTO (`registry.register(...)`), ale **nie** pełne definicje ścieżek (`registry.registerPath(...)`) per endpoint z jawnym `security: [{ BearerAuth: [] }]` — zgodnie z konwencją backendu jest to do uzupełnienia przed uznaniem dokumentacji API za kompletną.
- **`DayConfigEditor.vue` / `ShiftEditor.vue`** (dedykowane komponenty do edycji pojedynczej zmiany — godziny, wymagana obsada, bucket balansu, dodawanie zmian niestandardowych) nie zostały jeszcze wydzielone jako osobne komponenty — `MonthConfigView.vue` obsługuje na razie tylko otwieranie/zamykanie dni. Pełna edycja zmian (endpointy backendowe już istnieją: `POST/PATCH/DELETE /month-config/:monthValue/days/:date/shifts/...`) wymaga dobudowania UI.
- **Brak testów jednostkowych/komponentowych frontendu** (Vitest + `jsdom` jest skonfigurowany w `package.json`, ale nie napisano jeszcze testów store'ów/komponentów) oraz brak testów e2e (Playwright) — zweryfikowano manualnie przez build + typecheck + smoke testy API.
- **Weryfikacja UI w przeglądarce nie została wykonana w tej sesji** (rozszerzenie Chrome było niedostępne) — potwierdzono jedynie, że strona się poprawnie serwuje i że build/typecheck przechodzą bez błędów.
