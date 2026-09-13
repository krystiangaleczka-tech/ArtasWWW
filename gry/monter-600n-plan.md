# MONTER: 600 N — plan gry (puzzle montażowy FAAC D600)

Gra logiczno-fizyczna, w której gracz składa napęd do bramy garażowej na suficie garażu.
Sedno: **każdy warunek z instrukcji montażowej jest mechanicznym constraintem** — nie ma
quizów, jest przeciąganie, wiercenie, dokręcanie i realne konsekwencje błędów.
Nazwa bierze się od siły uciągu napędu D600 (600 N) — to też "limit zdrowia" gracza:
zużywasz siłę mechaniczną na błędy.

Źródło faktów: instrukcja montażowa FAAC D600/D1000 (fartprodukt).

---

## 1. High Concept

- **Gatunek:** puzzle / assembly sim z fizycznymi ograniczeniami (a'la "Overcooked z
  elektronarzędziami" albo puzzle-room z częściami maszyn).
- **Widok:** izometryczne 2.5D z możliwością obrotu kamery (OrbitControls w ograniczonym
  zakresie — pełna dowolność obrotu pozwalałaby "oszukać" perspektywę i pominąć pomiar).
- **Platforma:** sekcja na stronie (Three.js), desktop + tablet.
- **Sesja:** 5–10 minut na poziom; 5 poziomów = jeden pełny montaż od pudełka do bramy,
  która przejeżdża test bezpieczeństwa.
- **Fantazja gracza:** "składam prawdziwą maszynę i ona działa" — satysfakcja z
  watchdogowej pętli: montujesz → uruchamiasz → test 50 mm przechodzi.
- **Grupa docelowa strony:** monterzy-instalatorzy (edukacja produktu) + klienci końcowi
  (szacunek dla rzemiosła = sprzedaż premium).

## 2. Zasada projektowa: constraint, nie quiz

Zamiast "czy odległość jest OK? TAK/NIE" — gracz fizycznie przesuwa prowadnicę i widzi,
że żaden snap-point się nie podświetla, dopóki warunki nie są spełnione. Instrukcja jest
"wpisana w geometrię". Gracz uczy się przez ciało, nie przez czytanie.

## 3. Poziomy = rozdziały instrukcji

### Poziom 1 — Wymiary i przygotowanie (rozdz. 5 + 7.1)
- Kamera: wejście do garażu, zamknięta brama segmentowa (montaż wykonuje się przy
  zamkniętej bramie — zgodnie z instrukcją).
- Zadania: zaznaczenie na nadprożu pionowej kreski (środek szerokości bramy) i poziomej
  kreski (maks. wysokość elementów ruchomych) — mini-gra "poziomica": klikasz
  punkt startowy i końcowy, gra mierzy, czy linia jest wystarczająco pozioma/pionowa.
- Weryfikacja bramy (wstępne testy): przesuń bramę ręcznie (przytrzymaj i przeciągnij) —
  "opór" jest symulowany; jeśli za duży, dostajesz komunikat wyczyść/podmaluj prowadnice
  (klik w punkty smarowania).

### Poziom 2 — Wspornik przedni (rozdz. 7.1)
- Nakładasz wspornik przedniego mocowania na nadproże na pionowej kresce.
- **Constraint A:** dolna krawędź wspornika min. 5 mm ponad punktem przecięcia kresek.
- **Constraint B:** centralnie na pionowej kresce (tolerancja ±10 mm).
- Wiercenie: mini-gra wiertarki — przytrzymujesz przycisk, słupek postępu rośnie,
  przekroczenie siły nacisku = "skaleczenie"/uszkodzenie ściany (utrata punktów
  precyzji, instrukcja: chroń twarz i ręce przy wierceniu).
- Wkręty/kotwy **nie ma w komplecie** (dosłownie z instrukcji) — gracz wybiera z pudełka
  odpowiedni typ kotwy do podłoża (beton vs cegła) — błędny wybór = wizualne pęknięcie.

### Poziom 3 — Prowadnica i tylne mocowanie (rozdz. 6.1, 6.2, 7.1)
- Składasz dwuczęściową prowadnicę przez łącznik środkowy (push-fit: przysuwasz,
  zaczepia się na metalowych występach; użycie młotka = zniekształcenie łącznika
  i powrót etapu — dosłownie z instrukcji: nie używać narzędzi).
- Montaż: przednia część łączy się ze wspornikiem (śruba + nakrętka), tylną podnosisz
  **równolegle do prowadnic bramy** lub na wysokości wspornika przy bramie.
- **Constraint C:** prowadnica prostopadła do bramy (kątomierz na ekranie).
- Zginanie wsporników tylnych: mierzysz odległość osi śrub od sufitu, potem zaginasz
  wspornik dokładnie w odmierzonej pozycji (miejsce zgięcia odmierzane od środka
  pierwszego otworu) — mini-gra "zaginacz": ustawiasz punkt zgięcia na suwakiem,
  akceptujesz; błąd = wspornik do kosza, nowy z pudełka (limit części!).
- **Constraint D (serce poziomu): odstęp min. 35 mm między sufitem a najwyższym punktem
  ruchomej bramy.** Prowadnica jest na suficie — gracz musi sprawdzić, czy brama
  segmentowa ma prześwit (mały overlay "cross-section view" pokazujący strzałkę 35 mm;
  gdy < 35 mm — snap prowadnicy blokuje się z czerwonym pingiem).

### Poziom 4 — Montaż na bramie + napęd (rozdz. 7.2, 7.3)
- Przykręcasz łącznik do pręta prowadnicy — **element przelotowy linki zwalniającej po
  LEWEJ stronie** (gracz fizycznie obraca łącznik; strona ma znaczenie, sprawdza to
  końcowy test).
- **Constraint E:** mocowanie do bramy max 20 cm od osi otworów do dolnej krawędzi
  przedniego wspornika; przy bramie segmentowej — jak najniżej, ale nie więcej niż
  40 cm od dolnej krawędzi wspornika.
- **Constraint F:** kąt między ramieniem (pręt) a prowadnicą ≤ 30°.
- Montaż napędu — sekwencja ruchów jak w instrukcji: nachyl moduł **15–20°**, włóż
  wałek napędowy w sprzęgło, obróć, włóż kołek w otwór tylnego mocowania. To sekwencja
  "quick-time" na uchwytach (przytrzymaj i przeciągnij w strzałkę).

### Poziom 5 — PEARL: napinacz łańcucha (rozdz. 6.1) + uruchomienie
- **Mini-gra napinacza:** kręcisz wirtualną nakrętką napinacza (przytrzymujesz i
  obracasz dragiem kołowym). Wskaźnik: środkowa część górnej pętli łańcucha musi znaleźć
  się **mniej więcej pośrodku przekroju prowadnicy**. Celownik w przekroju poprzecznym
  prowadnicy (widok inset 2D jak z rysunku instrukcji). Zbyt luźno = łańcuch "wisi"
  (widoczny ugięty highlight), zbyt mocno = **uszkodzenie sprzęgła i układu
  przeniesienia napędu** — odgłos pęknięcia, powrót etapu napinacza (to prawdziwa
  konsekwencja z instrukcji!).
- Przeciągnij sanki do przodu do sprzęgła napędu (fizyczne przesunięcie po prowadnicy).
- Uruchomienie: test końcowy z instrukcji — system musi wykryć leżący przedmiot
  50 mm i zatrzymać się przy obciążeniu 20 kg. Na podjeździe pojawiają się obiekty
  testowe (klocek 50 mm, worek 20 kg) — gracz kładzie je pod bramę i klika "TEST".
  **Wynik testu zależy od jakości montażu:** zła strona linki zwalniającej, zły kąt
  30°+ , za mały prześwit = test nie przechodzi + raport "usterka" wskazujący, który
  constraint naruszono (edukacyjna pętla zwrotna).

### Epilog — tryb nauki (bonus, jeśli czas pozwoli)
Wciśnięcie SET UP i przejście procedury nauki z rozdz. 11.2 — linkuje się z pomysłem
gry nr 3 z pierwszej rozmowy ("Tryb nauki").

## 4. Mechaniki systemowe

| Mechanika | Źródło (instrukcja) | Design |
|---|---|---|
| **Budżet 600 N** | siła uciągu D600 | "Zdrowie": każdy błąd (pęknięty łącznik, zły punkt zgięcia) zjada budżet siły; 0 N = restart poziomu. Motywuje grę "na precyzję" |
| **Pudełko części** | "wkrętów/kotew NIE MA w komplecie" | Limit części jednorazowych (wsporniki, kotwy) — narzuca myślenie przed działaniem |
| **Wiertarka udarowa** | narzędzia i materiały | Mini-gra z paskiem postępu i "sweet spot" nacisku; overshoot = uszkodzenie |
| **Widok przekroju** | rys. 4, rys. 8 (35 mm, łańcuch) | Inset 2D z rysunków technicznych — spójność wizualna z PDF (klimat "dokumentacji") |
| **Raport usterki** | rozdz. 18 rozwiązywanie problemów | Ekran błędu wygląda jak tabela "Problem → Możliwe przyczyny → Rozwiązanie" z instrukcji — gracz czyta diagonale, uczy się diagnozy |
| **Test 50 mm / 20 kg** | rozdz. 13 uruchomienie | Finałowy "boss fight" każdego poziomu montażu na bramie |

## 5. Architektura Three.js

```
src/
  main.ts
  core/
    GameLoop.ts
    InputManager.ts        // drag & drop, orbit, hold-to-drill
    AudioManager.ts        // wiertarka, klik zaczepu, pęknięcie sprzęgła, szuranie bramy
  workshop/
    WorkshopScene.ts       // garaż: podłoga, ściany, nadproże, brama segmentowa
    PartPalette.ts         // HUD z częściami (docking do sceny)
    DragSystem.ts          // raycasting na płaszczyznach montażu, ghost preview
    SnapSystem.ts          // definicje snap-pointów w JSON + walidacja constraintów
    ConstraintSolver.ts     // reguły: 35 mm, ≤30°, ≤20 cm, ≤40 cm, ≥5 mm, środek łańcucha
    ToolsSystem.ts          // wiertarka, zaginacz, napinacz (narzędzia kontekstowe)
    DrillMinigame.ts
    BenderMinigame.ts
    ChainTensionMinigame.ts
  garage/
    GateAssembly.ts        // model bramy segmentowej + prowadnica + napęd (shared!)
    GateTestRunner.ts      // symulacja testu 50 mm / 20 kg
  ui/
    Hud.ts, CrossSectionView.ts, FailureReport.ts, ScoreScreen.ts
  data/
    constraints.json       // wszystkie tolerancje — łatwe strojenie bez zmian w kodzie
```

Kluczowe decyzje techniczne:

- **Constrainty w JSON, nie w kodzie** (`constraints.json`) — każdy warunek
  (35 mm, 30°, 20/40 cm) to wpis {id, opis, wartość, tolerancja, referencje geometrii}.
  Możliwość: tryb "easy" poszerza tolerancje, tryb "monter-instalator" zwęża do
  wartości nominalnych z instrukcji.
- **Snap + walidacja dwuetapowa:** snap-point "łapie" z grubsza (magnes), ale potwierdza
  dopiero ConstraintSolver (zielony ping = OK, czerwony = zbyt blisko/za wysoko).
- **Reuse modelu bramy i prowadnicy** z pozostałych gier (Gate Assembly z "Gate Rush")
  — jeden zestaw assetów, trzy gry na stronie.
- **Renderer:** MeshStandardMaterial, matowе plastiki (obudowa napędu), metal prowadnicy
  (metalness 0.9, roughness 0.35), DirectionalLight + Ambient. Outline efekty przez
  OutlinePass (postprocessing) dla snap-pointów. **Bez bloom** (naturalistyczny klimat
  warsztatu, kontrast z "Gate Rush").
- **Widok przekroju (CrossSectionView):** osobna scena renderowana do RenderTarget /
  drugi viewport w rogu — wizualnie stylizowana na rysunek z instrukcji (linie, kreskowanie).
- **Mobile/tablet:** drag działa natywnie (pointer events), orbit ograniczony do
  "rorbit" w osi Y + zoom.
- **Deterministyczność montażu** → ghost-replay najlepszego montera (widok przy
  leaderboardzie, jak w "Gate Rush").

## 6. Roadmapa

### Faza 0 — pion (2–3 dni)
Jeden snap-point: prowadnica "przyciąga się" do sufitu tylko przy spełnieniu
warunku 35 mm (prześwit bramy). Uproszczona brama jako box. Test: czy "aha!" moment
działa po 30 sekundach gry?

### Faza 1 — MVP (ok. 1,5 tygodnia)
- pełny poziom 2 i 3 (wspornik, prowadnica, wiercenie, zaginacz)
- DragSystem + SnapSystem + ConstraintSolver (3 constrainty)
- Raport usterki, budżet 600 N, pudełko części

### Faza 2 — pełny montaż (tydzień)
- poziomy 4 i 5 (montaż na bramie, napęd, napinacz, test 50 mm / 20 kg)
- widok przekroju, dźwięki narzędzi
- scoring: czas × precyzja × wykorzystane części

### Faza 3 — szlif
- poziom 1 (wstępne testy bramy), epilog z trybem nauki
- leaderboard, tryb "instalator" (wąskie tolerancje), mobile QA

## 7. Parametry do strojenia (startowe wartości)

| Parametr | Start | Uwagi |
|---|---|---|
| Tolerancja snap-pointów | ±25 mm (easy), ±8 mm (normal), ±2 mm (pro) | wszystkie w constraints.json |
| 35 mm prześwitu | tolerancja 0 (twardy warunek) | wartość z instrukcji — nie do negocjacji, to卖点 edukacyjne |
| Kąt ramienia | ≤ 30°, tolerancja 0 | jak wyżej |
| Mocowanie na bramie | ≤ 20 cm (góra) / ≤ 40 cm (dół) | dwa constrainty w jednym punkcie |
| Strefa łańcucha (napinacz) | środkowe ±20% przekroju | okno "sweet spot" |
| Budżet 600 N | 600 N, błąd = −50 do −200 N | skalowanie trudności przez koszt błędów |
| Limit części (wsporniki/kotwy) | 2 nadmiarowe szt. | karze spam-klikanie wierceniem |
| Czas poziomu (par) | L2: 3 min, L3: 5 min, L5: 8 min | par time z leaderboardu |

## 8. Metryki sukcesu (dla sekcji na stronie)

- ukończenie tutoriala (poziom 2) > 60% graczy,
- średni czas sesji > 4 min,
- CTA po ukończeniu: "Pobierz instrukcję PDF" / "Znajdź instalatora" — naturalny
  moment konwersji po satysfakcji z testu 50 mm.
