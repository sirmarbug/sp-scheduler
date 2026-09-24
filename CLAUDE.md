# sp-scheduler

Ten plik jest głównym źródłem kontekstu dla Claude Code w tym projekcie.

## Opis projektu

SP Scheduler tworzy miesięczny grafik zmian dla jednej lokalizacji (sklep) z
dwoma rolami: kierownik i kasjer. Planista konfiguruje kalendarz miesiąca,
wprowadza wnioski dostępności pracowników (`avoid`/`prefer`), generuje grafik
automatycznie przez AI (OpenRouter.ai), koryguje go ręcznie w pojedynczych
komórkach i sprawdza alerty walidacyjne przed zatwierdzeniem. Pełna
specyfikacja domenowa (model danych, reguły twarde/miękkie, cykl życia
grafiku) jest w [BUSINESS-REQUIREMENTS.md](BUSINESS-REQUIREMENTS.md) — to
źródło prawdy dla logiki biznesowej, niezależnie od stacku. Architektura
techniczna (moduły, przepływ danych, znane ograniczenia) jest w
[docs/architecture.md](docs/architecture.md).

Monorepo: `frontend/` (Vue 3 + Quasar) + `backend/` (Express + Prisma/MongoDB).
Logowanie działa jako bramka dostępu (Local, e-mail+hasło) — dane domenowe są
wspólne dla wszystkich zalogowanych kont, to nie jest aplikacja multi-tenant.

## Komendy

Uruchamiane z katalogu głównego repo (npm workspaces) albo z `frontend`/`backend` bezpośrednio.

- Dev (oba serwery naraz): `npm run dev`
- Build: `npm run build`
- Test: `npm run test` (Vitest — backend ma pełne pokrycie walidatora i testy integracyjne generowania grafiku z zamockowanym OpenRouter; frontend ma skonfigurowane środowisko testowe, ale bez napisanych jeszcze testów)
- Lint: `npm run lint`
- Prisma (z `backend/`): `npm run prisma:generate`, `npm run prisma:push`

Backend wymaga lokalnie MongoDB jako replica set (Prisma Mongo używa
transakcji) oraz pliku `.env` (patrz `backend/.env.example`) z m.in.
`OPENROUTER_API_KEY`. Frontend wymaga `frontend/.env` (patrz
`frontend/.env.example`) z `VITE_API_BASE_URL`.

## Zasady ogólne

<!-- TODO: uzupełnij — git flow (branching, nazewnictwo branchy), styl commitów, zasady code review -->

## Struktura projektu

```
frontend/src/
  stores/        Pinia setup stores per domena (auth, employees, month-config, requests, schedule, validation)
  composables/    useHttp (klient Axios), useCellOptions, useConfirmDialog, useNotification
  api/            cienkie wrappery per zasób nad useHttp
  views/          strony routingu (auth, employees, month-config, requests, schedule)
  components/     komponenty złożone (schedule/ScheduleGrid, ScheduleCellEditor, ValidationPanel)
  locales/        tłumaczenia pl/en (vue-i18n)

backend/src/
  routes/ controllers/ services/   trójwarstwowa architektura per zasób (auth, employee, month-config, request, schedule)
  services/schedule-validator.service.ts   deterministyczny walidator reguł hard/końcowych — jedyne źródło prawdy o regułach z BUSINESS-REQUIREMENTS.md sekcje 4/7
  services/ai-scheduler.service.ts         integracja OpenRouter.ai (prompt, retry z feedbackiem)
  schemas/        Zod per zasób, źródło typów (z.infer) i dokumentacji OpenAPI
  prisma/schema.prisma   jedyne źródło prawdy o modelu danych (MongoDB)
```

## Konwencje Vue

Stack referencyjny: Vue 3 (Composition API) + TypeScript + Pinia + Vue Router + Axios + vue-i18n + DayJS. Jeśli projekt korzysta z biblioteki komponentów UI (np. Quasar), preferuj jej gotowe klasy/komponenty zamiast pisania własnych od zera — poniższe konwencje zakładają taki wariant, ale nazwa konkretnej biblioteki jest wymienna.

### Architektura komponentów

- Wyłącznie Composition API z `<script setup lang="ts">`. Nigdy Options API, nigdy `<script>` bez `setup`.
- Stała kolejność wewnątrz `<script setup>` — dzięki temu każdy komponent wygląda podobnie i łatwo znaleźć dowolny fragment:
  1. `defineProps` / `defineEmits`
  2. stałe używane dalej (`useRouter()`, `useRoute()`, `useI18n()`, store, `defineSlots`/`useSlots`, `useAttrs`)
  3. kolejne bloki pogrupowane wg funkcjonalności (stan + funkcje go obsługujące razem, nie osobno wszystkie `ref`-y i osobno wszystkie funkcje)
  4. hooki cyklu życia, w naturalnej kolejności występowania: `onBeforeMount`, `onMounted`, `onBeforeUpdate`, `onUpdated`, `onBeforeUnmount`, `onUnmounted`
  5. `defineExpose`
- Propsy: lokalny interfejs `<NazwaKomponentu>Props` w tym samym pliku + `defineProps<...>()` (typowanie generyczne, nie runtime object). Domyślne wartości przez `withDefaults`:
  ```ts
  interface UserProfileProps {
    firstName: string
    lastName: string
    phone?: number
  }
  const props = withDefaults(defineProps<UserProfileProps>(), { phone: 123123123 })
  ```
- Emits: typowanie generyczne przez sygnatury wywołań, nie runtime array:
  ```ts
  const emit = defineEmits<{
    (e: 'changeColor', color: string): void
  }>()
  ```
- Dwukierunkowe bindowanie: `defineModel()` zamiast ręcznej pary `modelValue` prop + `update:modelValue` emit.
- Żadnej logiki/funkcji inline w `<template>` poza pojedynczym wywołaniem (np. `@click.stop.prevent="scope.cancel"`). Wszystkie handlery definiowane w `<script>` i podpinane po nazwie.
- Stała kolejność atrybutów/dyrektyw na tagach i komponentach: `ref` → dyrektywy (`v-model`, `v-if`, `v-show`, `v-for`) → zwykłe atrybuty (`type`, `disabled`, `class`) → bindowane atrybuty (`:class`, `:foo`) → eventy (`@click`, ...):
  ```vue
  <MyComponent ref="myComponent" v-if="loading" disabled :class="computedClass" @click="hello" />
  ```
- Nazewnictwo plików: PascalCase. Strony routingu — sufiks `*View.vue` (np. `LoginView.vue`), pogrupowane w podfoldery wg funkcji (`views/<feature>/`). Layouty — sufiks `*Layout.vue`.
- Reaktywny stan zawsze przez `ref()`, nigdy `reactive()` dla całego stanu komponentu (dotyczy też obiektów/tablic — `ref<User[]>([])`, nie `reactive([])`).
- `computed()` dla każdej wartości wyliczanej/zależnej od stanu (w tym klas warunkowych), np. `computed(() => ({ info: props.type === 'info' }))`.
- `watch()` zamiast `watchEffect()` — jawne źródła i dostęp do starej/nowej wartości są ważniejsze niż wygoda automatycznego trackingu. Watcherów używamy oszczędnie, tylko gdy naprawdę potrzebne.

### Composables (reużywalna logika)

- Jeśli ten sam fragment logiki (stan + funkcje go obsługujące) pojawia się w więcej niż jednym komponencie — albo wiadomo z góry, że się powtórzy — wydzielamy go do composable w `src/composables/use<Nazwa>.ts`, zamiast kopiować kod między komponentami.
- Nazewnictwo: zawsze prefiks `use` + PascalCase reszta nazwy (`useConfirmDialog`, `useHttp`, `useNotification`), plik `useNazwa.ts`, funkcja eksportowana.
- Composable zwraca płaski obiekt z reaktywnym stanem (`ref<T>`/`computed<T>`) i funkcjami — ten sam kształt zwrotu co Pinia setup store:
  ```ts
  export function useConfirmDialog() {
    const visible = ref<boolean>(false)
    const title = ref<string>('')

    function open(dialogTitle: string) {
      title.value = dialogTitle
      visible.value = true
    }
    function confirm() { visible.value = false }
    function reject() { visible.value = false }

    return { visible, title, open, confirm, reject }
  }
  ```
- Composable nie zawiera template/JSX — czysta logika/stan. Jeśli potrzebny jest towarzyszący UI (np. sam dialog), UI zostaje komponentem, który konsumuje composable (nie odwrotnie).
- Composable jest kontekstowo neutralny — nie zna konkretnego miejsca użycia i nie przyjmuje referencji do konkretnego komponentu. Może korzystać z innych composables/store'ów (np. `useConfirmDialog` razem z `useNotification`).

### Funkcje pomocnicze (utils)

- Pojedyncza, bezstanowa funkcja pomocnicza (czysta funkcja input → output, nie korzysta z `ref`/`computed`/lifecycle hooks, nie jest specyficzna dla Vue) trafia do płaskiego barrela `src/utils/index.ts`, eksportowana jako nazwana funkcja — nie jako `useX`.
- Rozróżnienie od composable: composable (`useX`, `src/composables/`) zarządza reaktywnym stanem Vue i/lub cyklem życia; zwykła funkcja pomocnicza w `utils/index.ts` tego nie robi — to zwykły TS/JS.
  ```ts
  export function toPascalCase(value: string): string {
    return value
      .split(/[\s_-]+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('')
  }
  ```
- Import zawsze z `@/utils`, nie duplikować identycznej logiki lokalnie w kilku komponentach/store'ach.
- Jeśli liczba funkcji dotyczących jednej, wyraźnej domeny urośnie (np. wiele funkcji tekstowych), można wydzielić osobny plik `src/utils/<domena>.ts` re-eksportowany przez barrel `utils/index.ts` (`export * from './<domena>'`) — pojedyncze, nieskategoryzowane funkcje zostają bezpośrednio w `utils/index.ts`.
- Dedykowane pliki konfiguracyjne bibliotek (np. `plugins/dayjs.ts`) zostają osobno — `utils/index.ts` to miejsce na własne, projektowe funkcje pomocnicze, nie na inicjalizację zewnętrznych bibliotek.

### Zarządzanie stanem (Pinia)

- Wyłącznie **Setup Store** (funkcyjny styl Composition API), nigdy Options Store (`state`/`getters`/`actions` jako obiekt):
  ```ts
  export const useAuthStore = defineStore('auth', () => {
    const router = useRouter()
    const currentUser = ref<UserInfo>({ _id: '', email: '' })

    async function fetchUserInfo() {
      const { data, request, isFailed } = current()
      await request()
      if (isFailed.value || data.value === null) return
      currentUser.value = data.value
    }

    return { currentUser, fetchUserInfo }
  })
  ```
- Stan: `ref()`. Gettery: `computed()`. Akcje: zwykłe funkcje, które mutują stan wewnątrz store'u (nigdy przypisywanie do stanu store'u bezpośrednio z zewnątrz — cała logika mutacji ma jedno miejsce, ułatwia to debugowanie).
- W komponencie: stan i gettery **zawsze** przez `storeToRefs(store)`, bo bezpośrednia destrukturyzacja ze store'u zrywa reaktywność. Akcje można destrukturyzować bezpośrednio ze store'u (funkcje nie tracą nic przy destrukturyzacji):
  ```ts
  // źle — traci reaktywność
  const { currentUser } = store

  // dobrze
  const { currentUser } = storeToRefs(store)
  const { logout } = store
  ```
- Każdy store eksportowany z `stores/<domena>.ts` musi trafić do barrela `stores/index.ts` (`export * from './<domena>'`) — spójnie, dla każdego store'u, nie tylko wybranych.

### Warstwa HTTP / API

- Jeden współdzielony klient axios w `composables/useHttp.ts`, z `baseURL` z `import.meta.env`, timeoutem oraz interceptorami request/response: wstrzykiwanie tokena (`Authorization`), logowanie, globalna obsługa błędów (np. przy nieautoryzowanym dostępie — czyszczenie tokena i przekierowanie).
- Klient udostępnia generyczne metody (`get<D>`, `post<D, B>`, `put<D, B>`, `remove<D>`), z których każda zwraca reaktywną triadę: `{ data, loading, error, isSuccessed, isFailed, request }`.
- Per-zasobowe, cienkie pliki `api/<resource>.ts`:
  ```ts
  const { get, post } = useHttp()
  export const allFlashcards = () => get<FlashcardItemType[]>('/flashcards')
  export const createFlashcard = (body: FlashcardCreateRequest) => post<FlashcardItemType, FlashcardCreateRequest>('/flashcards', body)
  ```
- Stały idiom wywołania: `const { data, request, isFailed } = someApiCall(); await request(); if (isFailed.value) return; /* użyj data.value */`.

### Daty (DayJS)

- Wszystkie operacje na datach (formatowanie, parsowanie, porównania, dodawanie/odejmowanie, lokalizacja) przez `dayjs` — nigdy natywny `Date` do tych celów i nigdy Moment.js (brak tree-shakingu — jednoznacznie wykluczony).
- Pluginy DayJS rejestrowane centralnie w jednym miejscu, np. `src/plugins/dayjs.ts`, nie rozrzucone `dayjs.extend(...)` po różnych plikach:
  ```ts
  import dayjs from 'dayjs'
  import relativeTime from 'dayjs/plugin/relativeTime'
  import utc from 'dayjs/plugin/utc'
  import 'dayjs/locale/pl'

  dayjs.extend(relativeTime)
  dayjs.extend(utc)
  dayjs.locale('pl')

  export default dayjs
  ```
- W komponentach/composables/store'ach/api zawsze importować z tego pliku (`import dayjs from '@/plugins/dayjs'`), nie bezpośrednio z pakietu `dayjs` — dzięki temu pluginy są zawsze załadowane i nie ma niespójności między miejscami użycia.
- Dodawać tylko te pluginy, które są faktycznie potrzebne — zachowanie zasady tree-shakingu, która jest głównym powodem wyboru DayJS zamiast Moment.js.
- DayJS jest jedynym miejscem prezentacji dat użytkownikowi — również w wersjach "przyjaznych" (np. "2 dni temu", "wczoraj") i zależnych od locale, przez odpowiednie pluginy (`relativeTime` do względnego czasu, `localizedFormat` do formatów zależnych od języka). Nie surowe parsowanie/porównywanie, ale i cała prezentacja — nigdy przez `Intl.DateTimeFormat`/`Intl.RelativeTimeFormat` (patrz rozgraniczenie w sekcji „Formatowanie liczb i walut”).

### Formatowanie liczb i walut (Intl)

- Do formatowania liczb, walut, procentów i jednostek względem aktualnego języka używamy natywnego `Intl` (`Intl.NumberFormat`), nigdy ręcznego sklejania stringów ani osobnej biblioteki do tego celu.
- Centralna funkcja pomocnicza w `src/utils/index.ts` (zgodnie z sekcją „Funkcje pomocnicze”), przyjmująca `locale` jawnie jako argument:
  ```ts
  export function formatCurrency(value: number, locale: string, currency = 'PLN'): string {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value)
  }
  ```
- `locale` pobierany z aktualnego stanu i18n (`const { locale } = useI18n()`), nie hardcodowany — formatowanie ma podążać za bieżącym językiem użytkownika, spójnie z sekcją „Internacjonalizacja (i18n)”.
- Analogicznie dla innych przypadków lokalizowanego formatowania bez elementu czasowego: `Intl.NumberFormat` (liczby/procenty/jednostki), `Intl.ListFormat` (listy) — zamiast własnej logiki formatującej.
- Rozgraniczenie z DayJS: `Intl` nigdy nie służy do dat — żadne formatowanie związane z czasem/datami, w tym względne ("2 dni temu") i lokalizowane, nie przechodzi przez `Intl.DateTimeFormat`/`Intl.RelativeTimeFormat`. Cała odpowiedzialność za prezentację dat leży po stronie DayJS (sekcja „Daty (DayJS)”, wyżej) — `Intl` zostaje wyłącznie dla liczb/walut/jednostek/list.

### Stylowanie

- `<style scoped lang="scss">` w każdym komponencie z własnymi stylami.
- Zmienne SCSS zamiast surowych hexów w kolorach:
  ```scss
  // źle
  .icon:hover { background: #ff5622; }
  // dobrze
  .icon:hover { background: $giantsOrange; }
  ```
- `v-bind()` w `<style>` do wstrzykiwania wartości reaktywnych ze scriptu, zamiast inline `style`:
  ```vue
  <style scoped lang="scss">
  .content { background-color: v-bind(bg); }
  </style>
  ```
- `::v-deep(selector)` do celowego nadpisania stylów wewnętrznych komponentów biblioteki UI.
- Gdy dostępna jest biblioteka UI z gotowymi klasami utility (spacing, typografia, flex), używaj ich zamiast pisać odpowiedniki od zera.

### Walidacja formularzy

- Bez biblioteki schematów (zod/yup/vee-validate) — proste, współdzielone funkcje walidujące w `validations/index.ts`, zwracające `true` albo komunikat błędu jako string:
  ```ts
  export const required = (value: string) => !!value || 'Pole jest wymagane'
  export const email = (value: string) => EMAIL_REGEX.test(value) || 'Podaj adres e-mail'
  ```
- Podpinane bezpośrednio w atrybucie `:rules="[required, email]"` pola formularza; walidacje wymagające dodatkowego kontekstu (np. porównanie z innym polem) owijane w strzałkową funkcję: `:rules="[value => confirmPassword(form.password, value)]"`.

### Routing

- Jeden `createRouter({ history: createWebHistory(...), routes: [...] })` w `router/index.ts`.
- Wszystkie trasy lazy-loaded: `component: () => import('../views/.../XView.vue')`.
- Każda trasa ma `name`; nawigacja programistyczna zawsze przez nazwę (`router.push({ name: 'management' })`), nigdy przez hardcodowaną ścieżkę.
- Guardy dostępu jako per-trasowy `beforeEnter` w `router/guards.ts` (proste funkcje sprawdzające sesję i wywołujące `next()`/`next({ name: ... })`), nie globalny `router.beforeEach`.
- Catch-all (`/:catchAll(.*)`) kierowany na ten sam widok błędu co jawna trasa błędu.

### Typowanie

- TypeScript strict (bazując na `@vue/tsconfig`), bez lokalnego luzowania ustawień.
- Zawsze jawny typ generyczny dla reaktywnych API: `ref<User | null>(null)`, `computed<number>(...)`, `watch<number>(...)`.
- Typy domenowe (żądania/odpowiedzi/parametry) w płaskim barrelu `types/index.ts`, jako `interface` (nie `type` dla kształtów obiektów), z sufiksami wskazującymi rolę: `...Type`, `...Request`, `...Response`, `...Params`.
- Interfejsy propsów komponentów (`...Props`) deklarowane lokalnie w pliku komponentu, nie w `types/index.ts`.

### Stałe projektowe

- Stałe globalne projektu — wartości niezmienne w czasie działania aplikacji, używane w wielu miejscach (nazwa aplikacji, domyślny język, lista dostępnych języków, limity, klucze localStorage itp.) — trafiają do płaskiego barrela `src/const/index.ts`, analogicznie do `types/index.ts`.
- Nazewnictwo: `UPPER_SNAKE_CASE`, z `as const` tam, gdzie ważne są typy literalne:
  ```ts
  export const APP_NAME = 'PocketFlashcards'
  export const DEFAULT_LOCALE = 'pl'
  export const AVAILABLE_LOCALES = ['pl', 'en'] as const
  ```
- Nigdy nie duplikować takich wartości lokalnie w komponentach/store'ach/composables — zawsze import z `@/const`.
- Rozróżnienie od sąsiednich miejsc: `types/index.ts` to kształty danych, `src/locales/langs/*.json` to przetłumaczone teksty (patrz sekcja i18n), `src/const/index.ts` to wartości konfiguracyjne używane w logice (np. warunek `locale === DEFAULT_LOCALE`, inicjalizacja `createI18n({ locale: DEFAULT_LOCALE, availableLocales: AVAILABLE_LOCALES })`) — nie mieszać tych trzech.

### Internacjonalizacja (i18n)

- `vue-i18n` jest obowiązkowy. Żaden tekst widoczny dla użytkownika nie może być zapisany na sztywno — dotyczy treści w `<template>`, atrybutów tekstowych (`placeholder`, `aria-label`, `title`), komunikatów walidacji, tytułów widoków/stron oraz treści toastów.
- Struktura plików: `src/locales/index.ts` (inicjalizacja `createI18n`) + `src/locales/langs/<lang>.json` (np. `pl.json`, `en.json`). Klucze zagnieżdżone hierarchicznie wg feature/widoku, nigdy płaska lista: `auth.login.title`, `validation.required`, `orders.list.emptyState`.
- W komponencie: `const { t } = useI18n()` jako jedna ze „stałych” w script setup (ta sama pozycja co `useRouter()`/store — patrz kolejność sekcji w „Architektura komponentów”). W template: `{{ t('auth.login.title') }}`, `$t('auth.login.title')`, `:placeholder="t('auth.login.emailPlaceholder')"`.
- Funkcje walidujące w `validations/index.ts` zwracają przetłumaczony string przez `t()`, nie zaszyty tekst:
  ```ts
  export const required = (value: string) => !!value || t('validation.required')
  ```
- Komunikaty `useNotification()` — tytuł i opis zawsze przez `t()`: `positive(t('orders.create.successTitle'), t('orders.create.successBody'))`.
- **Wymuszenie narzędziowe**: dodaj do `.eslintrc.cjs` projektu plugin `@intlify/eslint-plugin-vue-i18n` z regułą `'@intlify/vue-i18n/no-raw-text': 'error'` oraz `settings['vue-i18n'].localeDir: './src/locales/langs/*.json'`. Istniejący hook `format-and-lint.sh` uruchamia ESLint automatycznie przy każdym edicie/write, więc ta reguła realnie blokuje/wskazuje tekst na sztywno zamiast polegać wyłącznie na tym, że agent się nie pomyli.

### Testowanie

- Vitest (środowisko `jsdom`) do testów jednostkowych/komponentowych, Playwright do e2e.
- Nowa logika biznesowa (composables, store'y, funkcje walidujące, warstwa API) powinna dostawać realne testy jednostkowe — nie zostawiaj samego scaffoldu narzędzia bez pokrycia.
- Testy komponentów skupione na zachowaniu widocznym z zewnątrz (emitowane eventy, renderowany tekst/stan), nie na szczegółach implementacji.

---

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

## Ważne dokumenty

- [Architektura projektu](docs/architecture.md)
