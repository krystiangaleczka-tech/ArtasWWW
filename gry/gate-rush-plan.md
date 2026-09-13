# GATE RUSH — plan gry (a'la Re-Volt × FAAC D600)

RC samochodzik ściga się po podjeździe garażowym, a głównym rywalem nie jest zegar, tylko
segmentowa brama garażowa napędzana automatycznym napędem, która cyklicznie się otwiera
i zamyka. Wjechanie w "okno czasowe" bramy to sedno gry.

Źródło faktów o bramie: instrukcja montażowa FAAC D600/D1000 (fartprodukt).

---

## 1. High Concept

- **Gatunek:** arcade racer / time-attack z jedną, ale bardzo głęboką mechaniką przeszkody.
- **Kamera:** 3D chase-cam (pełne 3D) LUB izometryczne 2.5D — obie opcje opisane, bo koszt
  jest ten sam (OrthographicCamera vs PerspectiveCamera).
- **Platforma:** sekcja na stronie (Three.js, WebGL), desktop + mobile (dotyk).
- **Sesja:** 60–120 sekund na próbę (idealne do leaderboardów i "jeszcze raz").
- **Fantazja gracza:** "jestem szybszy niż automat bramy" — czyli ten sam dreszczyk, co
  wyprzedzanie zamykających się drzwi w prawdziwym garażu, tylko bez konsekwencji.

## 2. Dlaczego Re-Volt to dobry punkt odniesienia

- Małe, zwrotne autko = przeusterowność i poślizgi są zabawne same w sobie (prosta fizyka
  arcade, nie symulacja).
- Kamera nisko przy ziemi eksponuje skalę: brama segmentowa jest wtedy jak brama kopalni.
- Prędkości gracza są małe w metrach, więc rytm bramy (metodycznie zamykającej się w
  ~7 m/min wg instrukcji — w grze skalujemy ×20) daje czytelne, wyuczalne okna czasowe.

## 3. Model bramy — rdzeń gry (GateSystem)

Brama to zamknięta maszyna stanów, wierna układowi logicznemu sterowania z instrukcji:
stany ZAMKNIĘTA / OTWIERANIE / OTWARTE-W-PRZERWIE / ZAMYKANIE / ZABLOKOWANA.

### 3.1 Cykl pracy (tryb automatyczny, logika A)

```
ZAMKNIĘTA ──impuls──▶ OTWIERANIE ──▶ OTWARTE (przerwa ~20 s w grze) ──▶ ZAMYKANIE ──▶ ZAMKNIĘTA
```

- **Lampa ostrzegawcza = telegraf dla gracza.** Zgodnie z instrukcją lampka błyskowa może
  sygnalizować 5 s PRZED rozpoczęciem ruchu bramy. To nasz "read the tell" — widzisz błysk,
  wiesz, że za 5 s brama rusza.
- **Krzywa prędkości bramy z instrukcji:** normalna 6,6 m/min → przy krańcach 1,3 m/min.
  W grze: brama zwalnia przy pełnym otwarciu i tuż przed domknięciem → to daje graczowi
  "miękkie" ostatnie centymetry i dramaturgię (domknięcie wolne, ale nieubłagane).
- **Failsafe fotokomórek:** przed każdym ruchem brama "testuje" fotokomórki (w instrukcji:
  przełącznik FailSafe DS1). W grze: 1-s ekranowa wibracja wiązki przed startem cyklu.

### 3.2 Anty-przygniecenie (mechanika kary i nagrody)

Z instrukcji: system wykrywa przeszkodę 50 mm i zatrzymuje się przy obciążeniu 20 kg,
a przy zamykaniu — odwraca ruch i otwiera bramę. W grze:

- Samochodzik ma 50 mm prześwitu, więc jest "wykrywalną przeszkodą".
- **Jeśli brama cię dotknie podczas zamykania → NIE game over.** Bramą wstrząsa,
  cofa ją i otwiera (rewers jak w instrukcji) — ALE tracisz czas + combo.
- **Game over / respawn tylko, gdy stoisz w strefie podczas 3. kolizji pod rząd**
  (instrukcja: po 3 detekcjach przeszkody w tym samym punkcie system "zapamiętuje" nowy
  punkt zamknięcia — u nas: brama "uczy się" i zamyka się na tobie na stałe → respawn).

### 3.3 Interakcje gracza z systemem bramy

| Mechanika | Źródło w instrukcji | Gameplay |
|---|---|---|
| **Wiązka fotokomórek** | fotokomórki FSW blokują zamknięcie | Przetnij wiązkę = zatrzymaj zamykanie. Taktyka: poświęć szybką linię, przejedź przez wiązkę, zablokuj bramę — albo przeskocz pod nią, nie dotykając (więcej punktów combo) |
| **Pilot (power-up ×1 na próbę)** | impuls radiowy OPEN A/B, OMNIDEC | Jednorazowy "klucz": otwiera bramę natychmiast. W logice B impuls w trakcie ZAMYKANIA odwraca ruch — w trybie hardcore nie działa w trakcie OTWIERANIA (jak w instrukcji: sygnał w otwieraniu nie daje efektu) |
| **Ciągno zwalniające** | awaryjne otwarcie ręczne (max 180 cm nad podłogą) | Fizyczna dźwignia na ścianie: musisz podjechać i "pociągnąć" — tylko w trybie awaryjnym (patrz poziomy) |
| **Zestaw akumulatorów** | backup przy zaniku zasilania | Poziom "Blackout": brama działa wolniej, lampa miga (z instrukcji: migająca lampa = usterka/system w spoczynku) |
| **Wstępna sygnalizacja lampy** | opcja z rozdz. 11.3 | Włączalna/wyłączalna "fairness" opcja: łatwiej = lampa ostrzega, hardcore = bez ostrzeżenia |

## 4. Poziomy / tryby

1. **Podjazd (tutorial):** jedna brama, długa prostsza, cykl z ostrzeżeniami lampy.
2. **Garaż wewnętrzny:** krótsze okna, filary, kamera bliżej.
3. **Frenzy / Slalom bram:** 3–5 bram szeregowo z przesuniętymi fazami (jak slalom
   czasowy). Faza bramy N rozpoczyna się z opóźnieniem — gracz sam wybiera, którą "falę"
   łapie.
4. **Blackout:** tryb z akumulatora — wolniejsza brama, ale też wolniejsze otwieranie
   po kolizji; pilota brak (brak zasilania odbiornika? nie — XF działa, ale dla balansu:
   pilot tylko 1× na próbę).
5. **Hardcore / Logika B:** impuls pilota w trakcie zamykania odwraca bramę, a w trakcie
   otwierania nic nie robi (wiernie jak w tablicy logiki B z instrukcji) — wymusza naukę
   timingsów zamiast spamowania.

Scoring: czas × mnożnik combo (nieprzerwane okna bram), bonus za "perfect thread"
(przejazd w ostatnich 25% szczeliny), leaderboard (nick + czas + tryb).

## 5. Fizyka samochodzika (arcade, własna)

- Model trójkołowy / uproszczony bicycle model:
  `heading`, `speed`, `steer`, `grip` — poślizg = gdy `lateralForce > grip`, stan driftu.
- Napęd zawsze na tylną oś, ograniczona prędkość maks. (Re-Volt-like: ~6–9 m/s w skali
  autka). Turbo po "perfect thread" (2 s).
- Kolizje:
  - z bramą: brama to seria AABB (segmenty), samochodzik jako kula/sfera → przy kontakcie
    zamykającej się krawędzi odpalamy event `onGateContact` (rewers bramy), przy kontakcie
    z bokiem segmentu = odbicie z tłumieniem.
  - ze ścianami/filarami: proste OBB/AABB push-out, odbicie z utratą 40% prędkości.
- **Bez zewnętrznego silnika fizyki.** Dla tej skali wystarczy własna kinematyka
  (cannon-es to overkill i zjada czas na strojenie).

## 6. Architektura Three.js

```
src/
  main.ts                 // boot, canvas, resize, quality toggle
  core/
    GameLoop.ts           // fixed-step update (60 Hz) + render interpolacja
    InputManager.ts       // klawiatura + gamepad + dotyk (wirtualny joystick)
    AssetRegistry.ts      // preload, cache
    AudioManager.ts       // WebAudio: silnik (pitch od speed), brama, klik pilota
  vehicle/
    VehicleController.ts  // fizyka autka (sekcja 5)
    VehicleView.ts        // mesh, koła (rotacja od speed), skręcanie przednich
  gate/
    GateSystem.ts         // FSM: ZAMKNIĘTA/OTWIERANIE/PRZERWA/ZAMYKANIE/ZABLOKOWANA
    GatePhysics.ts        // fazy prędkości 6.6→1.3 (skalowane), rewers po kolizji
    GateView.ts           // segmenty na CatmullRomCurve3 prowadnicy, lampa, fotokomórki
    Photocell.ts          // raycast wiązki, stan beam interrupted
    RemoteController.ts   // pilot gracza (power-up), logika A/B
  level/
    LevelManager.ts       // definicje poziomów (JSON), spawn, checkpointy
    ChaseCamera.ts       // smooth follow + lookahead
  ui/
    Hud.ts                // DOM overlay (czas, combo, faza bramy)
    Countdown.ts, GameOver.ts, Leaderboard.ts
  state/                  // zustand/store: gameState, score, settings
```

Kluczowe decyzje techniczne:

- **Brama = jeden parametr `t` (0 zamknięta → 1 otwarta).** `GateView` rozkłada segmenty
  po krzywej prowadnicy dla danego `t`; `GateSystem` animuje `t` wg FSM. Dzięki temu
  ten sam model bramy działa w każdym poziomie i można go reuse'nąć w innych grach z
  poprzedniej rozmowy.
- **Fixed timestep** dla fizyki (deterministyczne ghost replaye!) + render niezależny.
- **Ghost replay:** nagrywamy `{t, x, z, heading}` co 3 klatkę — deterministyczna
  symulacja pozwala odtworzyć przejazd. Tańsze niż nagrywanie inputu.
- **Renderer:** MeshStandardMaterial, jedna directional light z cieniami (tylko autko +
  brama castShadow), UnrealBloomPass wyłącznie dla lampy ostrzegawczej i fotokomórek
  (emissive). ToneMapping ACES.
- **Mobile:** jakość niska = brak bloom/cieni, pixelRatio capped 1.5.
- **Bundle:** three jako ES module, lazy-load sekcji gry (IntersectionObserver na
  sekcji strony — ładujemy grę dopiero, gdy user zescrolluje do niej).

## 7. Roadmapa

### Faza 0 — pion (2–3 dni)
Płaska plansza, sterowalne autko (kamera chase), brama jako jeden przesuwany box
z cyklem otwierania/zamykania. Już w tym momencie można ocenić "feeling" rytmu.

### Faza 1 — MVP grywalne (ok. tygodnia)
- FSM bramy z fazami prędkości i lampą-ostrzeżeniem
- anty-przygniecenie (rewers po kontakcie, 3 kolizje = respawn)
- 1 poziom, timer, prosty HUD, reset klawiszem R
- kolizje z segmentami jako AABB

### Faza 2 — pełna pętla (kolejny tydzień)
- fotokomórki, pilot (logika A), combo/score, dźwięk
- segmenty bramy na prowadnicy (krzywa), lampa z bloomem, model autka low-poly
- leaderboard (localStorage → potem backend)

### Faza 3 — szlif
- poziomy 2–5, logika B, blackout, ghost replay, mobile controls
- screen shake przy rewersie bramy, particles (iskry przy tarciu o segment)

## 8. Parametry do strojenia (startowe wartości)

| Parametr | Start | Uwagi |
|---|---|---|
| Czas pełnego cyklu bramy | 12 s | skalowanie ×20 z realnych prędkości (6,6 m/min jest zbyt wolne dla gry) |
| Przerwa otwarcia | 20 s (tutorial), 8 s (poziom 3) | główny knob trudności |
| Faza ostrzeżenia lampy | 5 s | zgodne z instrukcją (rozdz. 11.3) |
| Prędkość autka max | 8 m/s (skala RC) | ~35 km/h odczuwalnie |
| Przyspieszenie | 12 m/s² | arcade snap |
| Grip / drift threshold | 0.6 | tuning na czucie |
| Okno "perfect thread" | ostatnie 25% wysokości szczeliny | ×2 combo |
