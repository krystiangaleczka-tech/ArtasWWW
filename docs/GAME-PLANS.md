# ARTAS — plany minigier

Strona główna zawiera trzy gry ładowane dopiero po wejściu ich sekcji w viewport.
Każda gra działa w ograniczonym kontenerze, sprząta własny renderer i zapisuje wyniki
wyłącznie w `localStorage`.

## Gate Rush — gra zręcznościowa

RC samochodzik przejeżdża przez automatyczną bramę segmentową. Gracz obserwuje lampę,
fotokomórkę i prześwit, aby przejechać w dobrym momencie.

- Poziomy: tutorial, garaż, slalom trzech bram, blackout i hardcore z logiką B.
- Mechaniki: FSM ostrzegania, otwierania i zamykania, pilot jednorazowy, blokada wiązką,
  rewers po kontakcie, combo, perfect thread, screen shake i iskry.
- Faza 3: ghost replay najlepszego przejazdu, sterowanie dotykowe i lokalny leaderboard.
- Sterowanie: WASD/strzałki, `Space` — pilot, `R` — reset; na telefonie przyciski ekranowe.

Implementacja: `components/artas/games/GateRushGame.tsx`, `lib/games/shared.ts`.

## Monter: 600 N — gra montażowa

Gracz składa poglądowy napęd bramy, pilnując zależności między pomiarem, prowadnicą,
napędem, łańcuchem i zabezpieczeniami.

- Siedem etapów: pomiary, wspornik, prowadnica, wiercenie, napęd, napinacz i czujniki.
- Każdy etap pokazuje wartość docelową oraz tolerancję; model 3D jest podglądem, nie ukrytą listą elementów do kliknięcia.
- Tryby prowadzony i precyzyjny zmieniają tolerancje.
- Finał: test otwarcia bramy, raport, ranking i animowany ślad najlepszego montera.
- Model nie zastępuje instrukcji montażu, regulacji sprężyn ani odbioru zabezpieczeń.

Implementacja: `components/artas/games/MonterGame.tsx`, `components/artas/ProductScene.tsx`.

## Diagnostyka bramy — ćwiczenie decyzyjne

Gracz ustawia trzy czytelne punkty ruchu, dobiera konfigurację do opisanej sytuacji i podejmuje decyzje w symulowanych zdarzeniach.

- Kalibracja wskazuje zieloną strefę dla punktu zamknięcia, zwolnienia i otwarcia.
- Konfiguracja obejmuje fotokomórkę, czułość, logikę A/B i prędkość, a karta sytuacji jawnie podaje cel.
- Cztery zdarzenia sprawdzają wybór bezpiecznej reakcji na fotokomórkę, nierówny ruch, pilot i zanik zasilania.
- Raport waży kalibrację, konfigurację oraz rozpoznane decyzje bezpieczeństwa; wynik trafia do rankingu lokalnego.

Implementacja: `components/artas/games/LearnModeGame.tsx`, `lib/games/shared.ts`.

Wszystkie modele i zachowania mają charakter demonstracyjno-edukacyjny. Nie są schematem
podłączania instalacji, dokumentacją wykonawczą ani instrukcją wykonywania montażu.
