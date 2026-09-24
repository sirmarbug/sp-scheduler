---
name: composable-scaffold
description: Użyj, gdy trzeba wydzielić powtarzającą się logikę/stan do reużywalnego composable w tym projekcie (np. użytkownik prosi "wydziel logikę dialogu potwierdzenia do composable" albo "ta logika powtarza się w dwóch komponentach, zrób z tego hook") — generuje composable zgodny z konwencjami projektu.
---

# Composable scaffold (Vue)

1. Ustal lokalizację i nazwę pliku: `src/composables/use<Nazwa>.ts`, funkcja `use<Nazwa>` (prefiks `use` + PascalCase, np. `useConfirmDialog`) eksportowana z pliku.
2. Stan przez `ref<T>()` z jawnym typem (nigdy `reactive()`), wartości wyliczane przez `computed<T>()` — te same zasady typowania co w komponentach i store'ach.
3. Funkcje operujące na stanie zdefiniuj wewnątrz composable i zwróć je razem ze stanem jako płaski obiekt:
   ```ts
   export function use<Nazwa>() {
     const state = ref<StateType>(initialValue)

     function doSomething() {
       state.value = updatedValue
     }

     return { state, doSomething }
   }
   ```
4. Composable ma być kontekstowo neutralny — nie przyjmuje referencji do konkretnego komponentu ani nie zakłada jednego miejsca użycia, żeby dało się go reużyć w innych widokach/komponentach.
5. W miejscu użycia wywołaj composable bezpośrednio: `const { visible, open, confirm } = useConfirmDialog()`. W odróżnieniu od Pinia store, composable nie wymaga `storeToRefs` — każde wywołanie tworzy własny, izolowany stan (chyba że celowo implementujesz współdzielony singleton, np. przez moduł-level `ref` poza funkcją).
6. Jeśli composable dostarcza domyślne teksty widoczne dla użytkownika, użyj `t()` z `useI18n()` zamiast zaszytego stringa, zgodnie z konwencją i18n z `CLAUDE.md`.
