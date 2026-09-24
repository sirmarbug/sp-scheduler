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
