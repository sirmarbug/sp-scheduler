---
name: store-scaffold
description: Użyj, gdy trzeba dodać nowy Pinia store w tym projekcie (np. użytkownik prosi "dodaj store do zarządzania koszykiem" albo "stwórz store dla ustawień użytkownika") — generuje setup store zgodny z konwencjami projektu.
---

# Store scaffold (Vue / Pinia)

1. Utwórz plik `src/stores/<domena>.ts` (jedna domena = jeden store, np. `cart.ts`, `settings.ts`).
2. Zdefiniuj store wyłącznie w stylu **Setup Store** — funkcja przekazana do `defineStore`, nigdy obiekt `{ state, getters, actions }`:
   ```ts
   export const use<Domena>Store = defineStore('<domena>', () => {
     // stan
     const items = ref<ItemType[]>([])

     // gettery
     const itemsCount = computed<number>(() => items.value.length)

     // akcje — wywołują warstwę API i mutują stan lokalnie
     async function fetchItems() {
       const { data, request, isFailed } = allItems()
       await request()
       if (isFailed.value || data.value === null) return
       items.value = data.value
     }

     return { items, itemsCount, fetchItems }
   })
   ```
3. Stan: `ref<T>()` z jawnym typem (nigdy `reactive()` dla całości stanu store'u). Gettery: `computed<T>()`. Akcje: zwykłe funkcje mutujące `.value` wewnątrz store'u — nigdy nie eksponuj surowego stanu do mutacji z zewnątrz.
4. Jeśli akcja woła API, korzystaj z odpowiedniej funkcji z `src/api/<resource>.ts` (patrz skill `api-resource-scaffold`), w idiomie `await request(); if (isFailed.value) return; ...`.
5. Dodaj store do barrela `src/stores/index.ts`: `export * from './<domena>'`. Rób to za każdym razem — nie pomijaj żadnego store'u, żeby import zawsze mógł iść przez `@/stores`.
6. W komponencie konsumującym store: stan i gettery **zawsze** przez `storeToRefs(store)`, akcje można destrukturyzować bezpośrednio:
   ```ts
   const store = use<Domena>Store()
   const { items, itemsCount } = storeToRefs(store)
   const { fetchItems } = store
   ```
