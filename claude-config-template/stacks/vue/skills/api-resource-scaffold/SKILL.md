---
name: api-resource-scaffold
description: Użyj, gdy trzeba dodać nową integrację z endpointem/zasobem API w tym projekcie (np. użytkownik prosi "dodaj wywołania API dla zasobu 'produkty'" albo "podłącz endpoint usuwania konta") — generuje warstwę API zgodną z konwencjami projektu.
---

# API resource scaffold (Vue)

1. Sprawdź, czy istnieje już współdzielony klient HTTP (`src/composables/useHttp.ts` lub `src/utils/http.ts`) — jedna instancja axios z `baseURL`, timeoutem i interceptorami request/response (token, logowanie, globalna obsługa błędów). Jeśli nie istnieje, a projekt tego wymaga, dopiero wtedy go utwórz; w przeciwnym razie zawsze reużywaj istniejącego.
2. Utwórz plik `src/api/<resource>.ts` (nazwa = nazwa zasobu, liczba mnoga jeśli zasób jest kolekcją, np. `products.ts`).
3. Wywołaj klienta raz na poziomie modułu i wyeksportuj po jednej funkcji na endpoint, z generycznym typem odpowiedzi (i ciała żądania, jeśli dotyczy):
   ```ts
   const { get, post, put, remove } = useHttp()

   export const allProducts = () => get<ProductType[]>('/products')
   export const detailsProduct = (id: string) => get<ProductType>(`/products/${id}`)
   export const createProduct = (body: ProductCreateRequest) => post<ProductType, ProductCreateRequest>('/products', body)
   export const updateProduct = (id: string, body: ProductUpdateRequest) => put<ProductType, ProductUpdateRequest>(`/products/${id}`, body)
   export const deleteProduct = (id: string) => remove<void>(`/products/${id}`)
   ```
4. Typy żądań/odpowiedzi (`ProductType`, `ProductCreateRequest`, ...) dodaj do płaskiego barrela `src/types/index.ts` jako `interface`, z sufiksami `...Type`/`...Request`/`...Response`.
5. W miejscu wywołania (store lub widok) trzymaj się stałego idiomu:
   ```ts
   const { data, request, isFailed } = detailsProduct(id)
   await request()
   if (isFailed.value || data.value === null) return
   // użyj data.value
   ```
6. Jeśli funkcje danego zasobu są używane w więcej niż jednym miejscu, upewnij się że `src/api/index.ts` (barrel) je re-eksportuje: `export * from './<resource>'`.
