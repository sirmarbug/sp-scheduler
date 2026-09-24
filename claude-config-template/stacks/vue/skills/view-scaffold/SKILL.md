---
name: view-scaffold
description: Użyj, gdy trzeba dodać nowy widok/stronę z trasą routingu w tym projekcie (np. użytkownik prosi "dodaj stronę ustawień konta" albo "stwórz widok listy zamówień") — generuje widok i wpis routingu zgodny z konwencjami projektu.
---

# View scaffold (Vue Router)

1. Utwórz plik `src/views/<feature>/<Nazwa>View.vue` — widoki grupujemy w podfoldery wg funkcji/domeny (np. `views/dashboard/orders/OrdersView.vue`), nazwa pliku zawsze kończy się na `View.vue`.
2. Zbuduj komponent widoku zgodnie z konwencją `component-scaffold` (script setup, stała kolejność sekcji). Owiń treść w odpowiedni layout (`AppLayout` dla widoków wymagających zalogowania, `AuthLayout` dla ekranów logowania/rejestracji/błędu), jeśli projekt takie layouty ma.
3. Dodaj trasę w `src/router/index.ts`, zawsze z `name` i lazy-loadingiem:
   ```ts
   {
     path: '/orders',
     name: 'orders',
     component: () => import('../views/dashboard/orders/OrdersView.vue'),
   }
   ```
4. Jeśli widok wymaga autoryzacji lub ma być niedostępny dla zalogowanych, dodaj `beforeEnter: isAuth` lub `beforeEnter: isNotAuth` z `src/router/guards.ts` — guardy są per-trasowe, nie globalne.
5. Nawigację do nowej trasy z innych miejsc w kodzie rób zawsze przez nazwę: `router.push({ name: 'orders' })`, nigdy przez hardcodowaną ścieżkę.
6. Dla operacji asynchronicznych w widoku (fetch danych, submit formularza) trzymaj się triady `data/loading/isFailed` z warstwy API (patrz `api-resource-scaffold`) oraz wzorca powiadomień: sukces/błąd operacji zgłaszaj przez `useNotification()` (`positive(tytuł, opis)` / `negative(tytuł, opis)`).
7. Tytuł widoku (np. przekazywany do `AppLayout`) oraz tytuł/opis w `positive()`/`negative()` nie mogą być zapisane na sztywno — pobierz je przez `t('feature.klucz')` z `useI18n()`, zgodnie z konwencją i18n z `CLAUDE.md`.
