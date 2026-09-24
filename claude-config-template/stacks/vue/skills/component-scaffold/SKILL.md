---
name: component-scaffold
description: Użyj, gdy trzeba dodać nowy komponent Vue w tym projekcie (np. użytkownik prosi "dodaj komponent karty produktu" albo "stwórz komponent modala potwierdzenia") — generuje szkielet komponentu zgodny z konwencjami projektu.
---

# Component scaffold (Vue)

1. Ustal lokalizację i nazwę pliku: `src/components/<NazwaKomponentu>.vue` (PascalCase). Jeśli komponent to strona routingu, użyj `src/views/<feature>/<NazwaKomponentu>View.vue`; jeśli layout — `src/layout/<NazwaKomponentu>Layout.vue`.
2. Zacznij od `<script setup lang="ts">`. Jeśli komponent przyjmuje propsy, zdefiniuj lokalny interfejs `<NazwaKomponentu>Props` i użyj `defineProps<...>()` (generyczne typowanie, nie runtime object). Wartości domyślne opakuj w `withDefaults`:
   ```ts
   interface <NazwaKomponentu>Props {
     item: SomeType
     optionalFlag?: boolean
   }
   const props = withDefaults(defineProps<<NazwaKomponentu>Props>(), { optionalFlag: false })
   ```
3. Jeśli komponent emituje eventy, zdefiniuj je generycznie sygnaturami wywołań (nie jako tablicę runtime):
   ```ts
   const emit = defineEmits<{
     (e: 'confirm'): void
     (e: 'reject'): void
   }>()
   ```
   Dla dwukierunkowego bindowania użyj `defineModel()` zamiast ręcznej pary prop/emit.
4. Zanim napiszesz lokalną logikę/stan, sprawdź czy podobna logika już istnieje w `src/composables/` albo czy ta, którą piszesz, będzie potrzebna w innym komponencie/widoku — jeśli tak, użyj istniejącego composable albo wydziel nowy zamiast pisać go lokalnie w komponencie (patrz skill `composable-scaffold`). Logikę specyficzną tylko dla tego komponentu zostaw lokalnie.
5. Ułóż resztę scriptu w stałej kolejności: stałe (`useRouter`, store, composables, itd.) → bloki wg funkcjonalności (stan + obsługujące go funkcje razem) → hooki cyklu życia w naturalnej kolejności → `defineExpose` na końcu, jeśli potrzebny. Stan reaktywny zawsze przez `ref<T>()` (z jawnym typem), nigdy `reactive()`. Wartości wyliczane — `computed<T>()`.
6. W `<template>` zachowaj stałą kolejność atrybutów na tagach: `ref` → dyrektywy (`v-if`/`v-show`/`v-for`/`v-model`) → zwykłe atrybuty → bindowane atrybuty (`:x`) → eventy (`@x`). Żadnej logiki inline poza pojedynczym wywołaniem funkcji zdefiniowanej w scripcie.
7. Żaden tekst widoczny dla użytkownika nie może być wpisany na sztywno — ani w treści `<template>`, ani w atrybutach tekstowych (`placeholder`, `aria-label`, `title`). Dodaj `const { t } = useI18n()` (razem z innymi „stałymi” w kroku 5) i użyj `{{ t('feature.klucz') }}` / `:placeholder="t('feature.klucz')"`, dopisując brakujący klucz do właściwego `src/locales/langs/<lang>.json`.
8. Dodaj `<style scoped lang="scss">`. Kolory przez zmienne SCSS, nie surowe hexy. Jeśli trzeba wstrzyknąć wartość ze scriptu — `v-bind(nazwaZmiennej)`. Jeśli trzeba nadpisać style biblioteki UI — `::v-deep(selector)`. Jeśli projekt ma bibliotekę UI z gotowymi klasami utility (spacing, typografia) — użyj ich zamiast pisać własny CSS.
