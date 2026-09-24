---
name: lint-strict
description: Użyj przed zakończeniem zadania w tym projekcie Express/TypeScript (po napisaniu/zmodyfikowaniu kodu, przed zgłoszeniem pracy jako gotowej) — uruchamia ESLint oraz `tsc --noEmit`, żeby upewnić się, że kod jest zgodny ze standardami projektu i nie zawiera błędów typów.
---

# Lint strict (Express)

Weryfikuje zgodność kodu z konwencjami projektu (`CLAUDE.md`) na dwóch
poziomach: statyczna analiza (ESLint) i poprawność typów (TypeScript strict,
bez `any`).

1. Uruchom `npx tsc --noEmit` — sprawdza typy w całym projekcie bez emisji
   plików wyjściowych. Jeśli w `package.json` istnieje dedykowana komenda
   (np. `typecheck`), użyj jej zamiast wywoływać `tsc` bezpośrednio.
2. Uruchom `npx eslint . --max-warnings=0` (lub `npm run lint`, jeśli
   projekt ma taką komendę) — zero tolerancji dla warningów w trybie
   `--strict`, zgodnie z zasadą "zakaz `any`" i pozostałymi regułami
   nazewnictwa/typowania z `CLAUDE.md`.
3. Jeśli którykolwiek krok zwróci błędy:
   - dla błędów typów — popraw kod (nigdy nie obchodź przez `as any` albo
     `@ts-ignore`, chyba że użytkownik jawnie na to pozwoli i podasz powód w
     komentarzu),
   - dla błędów ESLint — napraw ręcznie te, których `--fix` nie rozwiązuje
     automatycznie.
4. Nie zgłaszaj zadania jako zakończonego, dopóki oba kroki nie przejdą bez
   błędów. Jeśli któreś narzędzie nie jest jeszcze skonfigurowane w projekcie
   (brak `tsconfig.json`/`.eslintrc.*`), zgłoś to użytkownikowi zamiast
   pomijać krok po cichu.
