# Założenia biznesowe — SP Scheduler (grafik zmian)

> Dokument opisuje regułami biznesowymi to, co obecna aplikacja (vanilla JS + Vite + Tailwind, `localStorage`) robi w kodzie, tak aby można było zbudować nową wersję w innym stacku technologicznym i zastąpić ręcznie napisany algorytm przydziału zmian (`src/scheduler.js`) wywołaniem do AI API. Sekcja 9 jest **rekomendacją na implementację**, nie opisem istniejącego kodu.

## 1. Cel i kontekst biznesowy

Aplikacja tworzy **miesięczny grafik zmian** dla jednej lokalizacji (sklep) z dwoma rolami: **kierownik** i **kasjer**. Menedżer/planista co miesiąc:

1. konfiguruje kalendarz (które dni są zamknięte, jakie zmiany obowiązują każdego dnia),
2. wprowadza dostępność/preferencje pracowników,
3. generuje grafik automatycznie,
4. koryguje go ręcznie w pojedynczych komórkach,
5. sprawdza alerty walidacyjne przed zatwierdzeniem.

## 2. Słownik domenowy

| Termin | Znaczenie |
|---|---|
| **Pracownik** | Osoba z: imieniem, typem umowy, stanowiskiem, opcjonalnymi rolami dodatkowymi. |
| **Typ umowy** | `UoP` (umowa o pracę — ma sztywny miesięczny cel godzinowy) lub `zlecenie` (bez celu godzinowego, elastyczne). |
| **Stanowisko** | `manager` (kierownik) lub `cashier` (kasjer). |
| **Rola dodatkowa** | `managerShift1` / `managerShift2` — pozwala kasjerowi pełnić funkcję kierownika na konkretnej zmianie (odpowiednio: pierwszej/porannej lub drugiej/wieczornej). `cashierEligible` — pozwala managerowi pełnić funkcję kasjera na każdej zmianie, bez ograniczenia do konkretnego bucketu. |
| **Zmiana** | Blok czasowy w dniu z: godziną startu/końca, wymaganą liczbą osób per rola, "bucketem balansu", typem (`auto`/`manual`). |
| **Domyślne zmiany** | 1 zmiana (07:00–15:00, "first"), Środek dnia (12:00–20:00, "mid"), 2 zmiana (13:00–21:15, "second"). Konfigurowalne per dzień. |
| **Bucket balansu** | `first` / `mid` / `second` — używany do liczenia równowagi między zmianami wcześniejszymi i późniejszymi u danego pracownika. |
| **Dzień zamknięty** | Domyślnie niedziela; dzień bez żadnych zmian i przypisań. |
| **Zmiana manualna** | Zmiana wyłączona z automatycznego generowania — obsadzana wyłącznie ręcznie, ale wciąż podlega walidacji pokrycia. |
| **Wniosek dostępności** | `avoid` (blokada — pracownik nie może być przydzielony) lub `prefer` (preferencja — pracownik chciałby być przydzielony), dla konkretnego dnia i zmiany albo `shiftId: "all"` (cały dzień). |
| **Jednostka czasu** | "Quarter hour" (15 minut) — cały system liczy czas pracy w blokach 15-minutowych, żeby uniknąć błędów zmiennoprzecinkowych. |
| **Cel godzinowy (target hours)** | Miesięczny wymiar godzin dla pracownika UoP: 8h za każdy dzień roboczy (pon–pt), który nie jest zamknięty. |
| **Tydzień** | Tydzień ISO (poniedziałek–niedziela), używany do liczenia limitu dni pracy w tygodniu. |

## 3. Model danych (kontrakt niezależny od stacku)

**Employee**
```
id, name, contractType: "uop" | "zlecenie", position: "manager" | "cashier", extraRoles: string[]
```

**MonthConfig**
```
year, monthIndex, monthValue ("YYYY-MM"), days: Day[]
```

**Day**
```
date ("YYYY-MM-DD"), isClosed: boolean, shifts: Shift[]
```

**Shift**
```
id, label, start, end, shortLabel, durationQuarterHours, balanceBucket, type: "auto" | "manual",
enabled: boolean, requiredRoles: { manager: number, cashier: number }
```

**Request** (wniosek dostępności)
```
id, employeeId, date, shiftId ("all" lub konkretna zmiana), type: "avoid" | "prefer"
```

**Assignment** (wpis w grafiku)
```
employeeId, date, shiftId, role: "manager" | "cashier"
```

**Schedule**
```
assignments: Assignment[], diagnostics: { targetQuarterHours, totalSlots, filledCount, unfilledSlots, tier, totalShortfall }
```

**ValidationResult**
```
issues: string[] (błędy krytyczne), coverageIssues: string[] (niedobory obsady),
summaryList: EmployeeSummary[], status: string
```

## 4. Reguły twarde (hard constraints — muszą być spełnione zawsze)

Grafik jest **niepoprawny**, jeśli którakolwiek z poniższych reguł jest złamana:

1. **Jedna zmiana dziennie na pracownika.** Pracownik nie może mieć dwóch przypisań w tym samym dniu.
2. **Brak pracy w dniu zamkniętym.** Jeśli dzień jest oznaczony jako zamknięty, nie może mieć żadnych przypisań.
3. **Respektowanie blokad (`avoid`).** Pracownik z wnioskiem `avoid` na dany dzień/zmianę (lub `shiftId: "all"`) nigdy nie może zostać tam przydzielony.
4. **Uprawnienia do roli:**
   - rolę **kasjera** może pełnić pracownik ze stanowiskiem `cashier` (zawsze), **albo** manager z rolą dodatkową `cashierEligible` — na każdej zmianie, bez ograniczenia do bucketu. Manager bez tej roli dodatkowej nie może pełnić funkcji kasjera na żadnej zmianie;
   - rolę **kierownika** może pełnić: pracownik ze stanowiskiem `manager` (zawsze), **albo** kasjer z rolą dodatkową `managerShift1` — ale tylko na zmianie o buckecie `first` (lub zmianie o id `morning`), **albo** kasjer z rolą dodatkową `managerShift2` — tylko na zmianie o buckecie `second` (lub id `evening`). Kasjer bez odpowiedniej roli dodatkowej nie może pełnić funkcji kierownika na żadnej zmianie, w tym na zmianie "mid" (środek dnia).
5. **Maksymalnie 6 dni pracy w tygodniu ISO** (poniedziałek–niedziela) na pracownika.
6. **Limit godzin dla UoP.** Suma godzin przydzielonych pracownikowi z umową UoP w danym miesiącu **nie może przekroczyć** celu godzinowego (target hours). Docelowo (w idealnym grafiku) powinna być **równa** temu celowi — patrz reguły miękkie.
7. **Wymagana obsada roli na zmianę** (dotyczy zmian typu `auto`, ale liczona jest też dla `manual`): liczba przydzielonych osób w danej roli na danej zmianie nie może przekroczyć `requiredRoles[role]` (nadmiarowa obsada jest błędem, nie tylko niedoborem).

## 5. Reguły miękkie / priorytety optymalizacji

Kolejność ważności przy wyborze "najlepszego" grafiku (od najważniejszej):

1. **Maksymalne pokrycie slotów.** Priorytet nr 1 — obsadzić jak najwięcej wymaganych miejsc, nawet jeśli oznacza to gorszy wynik w pozostałych kryteriach.
2. **Dokładność godzin UoP.** Wśród grafików z takim samym pokryciem, preferowany jest ten, w którym każdy pracownik UoP ma godziny **równe** celowi miesięcznemu (nie mniej, nie więcej).
3. **Balans "first" vs "second".** Dla każdego pracownika: różnica między liczbą zmian w buckecie `first` a liczbą zmian w buckecie `second` powinna być jak najmniejsza (unikanie sytuacji, gdy ktoś pracuje wyłącznie rano albo wyłącznie wieczorem).
4. **Zgodność z preferencjami (`prefer`).** Przydzielenie pracownika na zmianę, o którą prosił, jest punktowane wyżej niż przydzielenie go na dowolną zmianę danego dnia, o którą prosił ("cały dzień" jako preferencja jest słabszym trafieniem niż konkretna zmiana).
5. **Preferowanie UoP nad zlecenie** przy wyborze, kogo przydzielić do slotu, gdy inne czynniki są zbliżone (umowa UoP ma z założenia mieć wypełniony etat, zlecenie jest elastyczne/dodatkowe).
6. **Równomierne rozłożenie godzin** pomiędzy pracowników — unikanie sytuacji, w której jeden pracownik zbiera nadmiarowo dużo godzin, a inny bardzo mało.
7. **Kara za nieobsadzony slot** — pozostawienie miejsca bez przydziału jest zawsze gorsze niż jakiekolwiek dopuszczalne przydzielenie kogoś (przy zachowaniu reguł twardych).

## 6. Cykl życia grafiku

```
Wybór/utworzenie miesiąca
  → Konfiguracja kalendarza (zamknięcia dni, włączenie/wyłączenie zmian, liczba osób na rolę, zmiany niestandardowe)
  → Zbieranie wniosków dostępności pracowników (avoid / prefer)
  → Generowanie automatyczne grafiku (algorytm dziś, AI docelowo)
  → Ręczna korekta pojedynczych komórek (podgląd dopuszczalnych opcji dla danego pracownika/dnia)
  → Walidacja całościowa (błędy krytyczne + niedobory obsady + podsumowanie godzin per pracownik)
  → Zatwierdzenie / zapis
```

Domyślna konfiguracja nowego miesiąca: wszystkie dni robocze mają 3 zmiany (poranna, środkowa, wieczorna) z wymaganiami: poranna — 1 kierownik + 1 kasjer, środkowa — 0 kierowników + 1 kasjer, wieczorna — 1 kierownik + 1 kasjer; niedziele są domyślnie zamknięte.

## 7. Reguły walidacji końcowej

Niezależnie od tego, czy grafik powstał z algorytmu czy z AI, walidator **musi** wykryć i zgłosić:

- **Błędy krytyczne** (`issues`):
  - podwójne przypisanie tego samego pracownika w jednym dniu,
  - przypisanie w dniu zamkniętym,
  - przypisanie mimo aktywnej blokady (`avoid`),
  - przypisanie do roli, do której pracownik nie ma uprawnień,
  - nadmiarowa liczba osób w danej roli na zmianie (więcej niż `requiredRoles`),
  - więcej niż 6 dni pracy w jednym tygodniu ISO,
  - godziny pracownika UoP różne od celu miesięcznego (niedomiar **lub** przekroczenie).
- **Niedobory obsady** (`coverageIssues`): brakująca liczba osób w danej roli na danej zmianie (rozdzielone dla zmian `auto` vs `manual`, ale z tym samym mechanizmem liczenia).
- **Podsumowanie per pracownik**: suma godzin, cel godzinowy (jeśli UoP), liczba zmian "first"/"second" i różnica między nimi, liczba trafień w preferencje.
- Status ogólny: "Grafik jest spójny" tylko gdy zarówno `issues`, jak i `coverageIssues` są puste.

## 8. Zarządzanie zespołem i konfiguracją (funkcje pomocnicze wokół generowania)

- **CRUD pracowników**: dodanie (imię, typ umowy, stanowisko, role dodatkowe), usunięcie (kaskadowo usuwa też jego wnioski dostępności i przypisania w grafiku).
- **CRUD wniosków dostępności**: dodanie/usunięcie wniosku `avoid`/`prefer` dla pracownika, dnia i zmiany (lub całego dnia).
- **Konfiguracja dnia**:
  - zamknięcie/otwarcie dnia (zamknięcie usuwa wszystkie przypisania tego dnia i wyłącza wszystkie zmiany; otwarcie przywraca domyślne wymagania ról),
  - włączenie/wyłączenie konkretnej zmiany (wyłączenie usuwa przypisania tej zmiany),
  - edycja wymaganej liczby osób per rola, godzin startu/końca (co przelicza czas trwania), etykiety, bucketu balansu, typu (`auto`/`manual`),
  - dodanie zmiany niestandardowej (własne godziny, wymagania, typ),
  - usunięcie zmiany (usuwa też powiązane przypisania).
- **Edycja pojedynczej komórki grafiku**: dla wybranego pracownika i dnia system musi wyliczyć listę **dopuszczalnych** opcji zmiana+rola, biorąc pod uwagę: czy zmiana jest włączona, czy pracownik ma uprawnienia do roli, czy slot nie jest już w pełni obsadzony (z wyjątkiem obecnego przypisania tego pracownika), czy pracownik nie ma blokady na ten dzień/zmianę.
- **Persystencja**: cały stan (konfiguracja miesiąca, pracownicy, wnioski, grafik, wybrane ustawienia UI) zapisywany i odtwarzany między sesjami.

## 9. Rekomendacja integracji z AI API (propozycja, nie stan istniejący)

Cel: zastąpić ręcznie pisany algorytm przydziału (backtracking + scoring, `src/scheduler.js`) wywołaniem do modelu AI, **zachowując** deterministyczną walidację (sekcja 7) jako niezależną, prostą warstwę kontrolną — bo to nie jest złożona logika, tylko sprawdzanie zgodności z regułami z sekcji 4 i 7.

**Podział odpowiedzialności:**

- **AI API** — odpowiada tylko za *decyzję optymalizacyjną*: który pracownik na który slot, biorąc pod uwagę reguły miękkie (sekcja 5) i twarde (sekcja 4) jako instrukcje w prompcie.
- **Kod deterministyczny** — odpowiada za: budowę danych wejściowych, walidację wyniku (sekcja 7), obsługę błędów/retry, zapis, UI.
- **Nigdy nie ufaj ślepo wynikowi AI** — każdy wygenerowany grafik musi przejść przez walidator z sekcji 7 przed zapisaniem/zaprezentowaniem jako finalny.

**Proponowana struktura wejścia do promptu (JSON):**
```json
{
  "month": "2026-09",
  "employees": [
    { "id": "emp-1", "name": "...", "contractType": "uop", "position": "manager", "extraRoles": [] }
  ],
  "days": [
    {
      "date": "2026-09-01",
      "isClosed": false,
      "shifts": [
        { "id": "morning", "start": "07:00", "end": "15:00", "balanceBucket": "first",
          "type": "auto", "requiredRoles": { "manager": 1, "cashier": 1 } }
      ]
    }
  ],
  "requests": [
    { "employeeId": "emp-1", "date": "2026-09-05", "shiftId": "all", "type": "avoid" }
  ],
  "targetHoursByEmployee": { "emp-1": 176 },
  "rules": { "hard": ["..."], "soft_priority_order": ["..."] }
}
```

**Proponowana struktura wyjścia:**
```json
{
  "assignments": [
    { "employeeId": "emp-1", "date": "2026-09-01", "shiftId": "morning", "role": "manager" }
  ],
  "unfilledSlots": [
    { "date": "2026-09-03", "shiftId": "evening", "role": "cashier", "reason": "brak dostępnych kasjerów" }
  ]
}
```

**Proponowana pętla wykonania:**
1. Zbuduj JSON wejściowy z aktualnego stanu (pracownicy, kalendarz, wnioski, cele godzinowe).
2. Wywołaj AI API z promptem zawierającym reguły z sekcji 4–5 i strukturę wejścia/wyjścia.
3. Sparsuj odpowiedź do `assignments`.
4. Przepuść przez deterministyczny walidator (sekcja 7).
5. Jeśli są błędy krytyczne (`issues`) — wywołaj AI ponownie, przekazując listę naruszeń jako feedback do poprawy (retry z ograniczoną liczbą powtórzeń, np. 2–3).
6. Jeśli po retry wciąż są błędy lub niedobory obsady — zaprezentuj grafik jako "wymagający korekty" i pozwól na edycję ręczną (mechanizm z sekcji 8 pozostaje niezmieniony).
7. Zapisz wynik + diagnostykę (pokrycie, niedobory) analogicznie do dzisiejszego `diagnostics`.

## 10. Otwarte pytania / decyzje do podjęcia przy implementacji

- Czy AI powinno móc proponować zmiany w konfiguracji dni/zmian (np. dodawanie zmian manualnych), czy tylko przydzielać ludzi do już zdefiniowanych slotów?
- Jak obsłużyć brak zbieżności AI do w pełni poprawnego grafiku po wszystkich retry (limit czasu, limit kosztów zapytań)?
- Czy historia wygenerowanych wersji grafiku (przed korektą ręczną) powinna być przechowywana do audytu/porównań?
- Czy reguły twarde/miękkie mają być konfigurowalne per lokalizacja (dziś są zakodowane globalnie), co wpłynęłoby na strukturę promptu?
