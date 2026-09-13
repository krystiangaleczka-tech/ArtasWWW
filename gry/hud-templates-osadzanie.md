# HUD-TEMPLATE — osadzanie gier w kontenerze (domek do monorepo)

Uzupełnienie dokumentu `monorepo-shared-core.md` (§6): kompletne szablony DOM dla
wszystkich trzech gier w wersji, która **nie polega na elementach strony** — gra
sama wstrzykuje swój HUD jako dzieci kontenera. Dzięki temu:

- każda gra działa solo (`index.html` z pustym kontenerem) i osadzona na stronie
  głównej (sekcja z `.game-slot`) bez zmiany jednej linijki kodu gry,
- nie ma kolizji identyfikatorów między grami na jednej stronie,
- CSS gier jest scopowany klasą kontenera (`.mt-*`, `tn-*`, `gr-*`),
- `stop()` czyści cały DOM gry jednym `container.innerHTML = ''`.

---

## 0. Zasady refaktoru (wspólne dla trzech gier)

**1. Kwerendy lokalne zamiast globalnych.** Każdy moduł UI przestaje używać
`document.getElementById` / `document.querySelector` i dostaje `root` (kontener):

```js
// przed (Monter, Hud.js)
this.el.title = document.getElementById('step-title');

// po
export class Hud {
  constructor(root, stepCount) {
    const $ = (s) => root.querySelector(s);     // kwerenda tylko wewnątrz gry
    this.el = { title: $('.mt-step-title'), /* … */ };
```

**2. ID → klasy z prefixem gry.** Na jednej stronie będą 3 gry; `id="big"`
wystąpiłoby trzykrotnie. Prefiksy: `gr-` (Gate Rush), `mt-` (Monter), `tn-`
(Tryb nauki).

**3. CSS wstrzykiwany raz, scopowany.** Zasada „style strony nie zloadują się
drugi raz":

```js
// shared/ui/injectStyle.js
const injected = new Set();
export function injectStyle(id, css) {
  if (injected.has(id)) return;
  const s = document.createElement('style');
  s.id = 'style-' + id;
  s.textContent = css;
  document.head.appendChild(s);
  injected.add(id);
}
```

**4. `start()` idempotentne, `stop()` totalne:**

```js
export function start(container) {
  if (container.dataset.started) return;    // podwójny start z loadera
  container.dataset.started = '1';
  // …
  return {
    stop() {
      container.innerHTML = '';             // cały DOM gry znika
      delete container.dataset.started;
    },
  };
}
```

---

## 1. Gate Rush — `games/gate-rush/js/HudTemplate.js`

Najmniejszy przypadek (HUD to dwa panele + overlay + panele dotykowe):

```js
export const GR_CSS = `
.gr-root { position:absolute; inset:0; font-family:system-ui, sans-serif;
  color:#fff; touch-action:none; user-select:none; -webkit-user-select:none; }
.gr-root canvas { display:block; }

.gr-hud { position:absolute; top:12px; left:12px; right:12px;
  display:flex; justify-content:space-between; gap:8px; pointer-events:none;
  font-size:14px; text-shadow:0 1px 3px #000; }
.gr-panel { background:rgba(0,0,0,.5); padding:8px 14px; border-radius:10px;
  backdrop-filter:blur(4px); white-space:nowrap; }
.gr-panel b { font-variant-numeric:tabular-nums; }

.gr-big { position:absolute; top:38%; left:50%; transform:translate(-50%,-50%);
  font-size:min(9vw,56px); font-weight:800; letter-spacing:.05em; text-align:center;
  text-shadow:0 2px 12px #000; pointer-events:none; opacity:0;
  transition:opacity .25s; white-space:pre-line; }

.gr-reset { position:absolute; right:12px; top:64px; pointer-events:auto;
  background:rgba(0,0,0,.5); border:1px solid rgba(255,255,255,.25); color:#fff;
  padding:6px 10px; border-radius:8px; font-size:12px; }

.gr-touch { position:absolute; inset:0; display:none; pointer-events:none; }
.gr-touch .gr-btn { position:absolute; width:70px; height:70px; border-radius:50%;
  background:rgba(255,255,255,.10); border:1px solid rgba(255,255,255,.35);
  display:flex; align-items:center; justify-content:center; font-size:24px;
  pointer-events:auto; touch-action:none; }
.gr-touch .gr-btn:active { background:rgba(255,255,255,.28); }
.gr-left  { left:16px;  bottom:26px; }
.gr-right { left:100px; bottom:26px; }
.gr-gas   { right:16px; bottom:104px; }
.gr-brake { right:16px; bottom:26px; }
.gr-remote { right:16px; top:120px; width:auto; height:auto; padding:12px 16px;
  border-radius:12px; font-size:12px; font-weight:700; }
`;

export const GR_TEMPLATE = `
<div class="gr-root">
  <div class="gr-hud">
    <div class="gr-panel"><b class="gr-time">0.00</b> s &nbsp;·&nbsp; combo <b class="gr-combo">×1</b></div>
    <div class="gr-panel gr-status">ZAMKNIĘTA</div>
  </div>
  <div class="gr-big"></div>
  <button class="gr-reset">R — reset</button>
  <div class="gr-touch">
    <div class="gr-btn gr-left">◀</div>
    <div class="gr-btn gr-right">▶</div>
    <div class="gr-btn gr-gas">▲</div>
    <div class="gr-btn gr-brake">▼</div>
    <div class="gr-btn gr-remote">PILOT</div>
  </div>
</div>
`;
```

Użycie w `start()`:

```js
import { injectStyle } from 'shared/ui/injectStyle.js';
import { GR_CSS, GR_TEMPLATE } from './HudTemplate.js';

export function start(container) {
  if (container.dataset.started) return;
  container.dataset.started = '1';
  injectStyle('gate-rush', GR_CSS);
  container.innerHTML = GR_TEMPLATE;

  const root = container.querySelector('.gr-root');
  const canvasHost = root;                       // canvas doklejamy do .gr-root
  const renderer = makeRenderer();
  root.prepend(renderer.domElement);
  // …cała reszta bez zmian, tylko kwerendy przez root:
  //   root.querySelector('.gr-time') zamiast document.getElementById('time')
  //   InputManager dostaje root (panele .gr-touch)
}
```

W `InputManager.js` jedyna zmiana to konstruktor `constructor(root)` i kwerendy
`root.querySelector('.gr-left')` + warunek `if (this.isTouch)
root.querySelector('.gr-touch').style.display='block'`.

---

## 2. Monter — `games/monter/js/HudTemplate.js`

Najbardziej rozbudowany HUD (panele, kropki postępu, toolbar, przekrój, mini-gry):

```js
export const MT_CSS = `
.mt-root { position:absolute; inset:0; font-family:system-ui, sans-serif;
  color:#e8ecf1; touch-action:none; user-select:none; -webkit-user-select:none; }
.mt-root canvas { display:block; }

.mt-hud { position:absolute; top:10px; left:10px; right:10px;
  display:flex; gap:8px; flex-wrap:wrap; pointer-events:none; align-items:flex-start; }
.mt-panel { background:rgba(0,0,0,.55); padding:8px 12px; border-radius:10px;
  backdrop-filter:blur(4px); font-size:13px; max-width:330px; }
.mt-step-title { font-weight:700; }
.mt-step-hint { font-size:12px; opacity:.85; margin-top:3px; line-height:1.4; }
.mt-budget-bar { height:8px; background:#2a2f36; border-radius:4px;
  overflow:hidden; width:170px; margin-top:4px; }
.mt-budget-fill { height:100%; width:100%;
  background:linear-gradient(90deg,#2ecc71,#f1c40f,#e74c3c); }
.mt-parts { font-size:11px; opacity:.8; margin-top:3px; }

.mt-progress { position:absolute; top:12px; left:50%; transform:translateX(-50%);
  display:flex; gap:5px; pointer-events:none; }
.mt-dot { width:9px; height:9px; border-radius:50%; background:rgba(255,255,255,.18); }
.mt-dot.done { background:#2ecc71; }
.mt-dot.cur { background:#f1c40f; }

.mt-toolbar { position:absolute; left:10px; bottom:10px; display:flex;
  gap:8px; flex-wrap:wrap; }
.mt-tool { pointer-events:auto; background:rgba(0,0,0,.6);
  border:1px solid rgba(255,255,255,.28); color:#fff; padding:11px 14px;
  border-radius:10px; font-size:13px; touch-action:none; }
.mt-tool:active { background:rgba(255,255,255,.25); }
.mt-tool:disabled { opacity:.3; }

.mt-cross { position:absolute; right:10px; bottom:10px; background:rgba(0,0,0,.6);
  border:1px solid rgba(255,255,255,.15); border-radius:10px; padding:6px; }
.mt-cross canvas { display:block; width:min(240px,36vw); height:auto; border-radius:6px; }
.mt-cross .cap { font-size:10px; opacity:.7; text-align:center; margin-top:3px; }

.mt-minigame { position:absolute; left:50%; bottom:14px; transform:translateX(-50%);
  display:none; flex-direction:column; gap:8px; align-items:center;
  background:rgba(0,0,0,.7); padding:12px 16px; border-radius:12px;
  pointer-events:auto; max-width:92%; }
.mt-mg-info { font-size:12px; text-align:center; }
.mt-mg-bar { width:min(70vw,320px); height:18px; background:#1a1f26;
  border-radius:9px; position:relative; overflow:hidden; }
.mt-mg-fill { position:absolute; top:0; bottom:0; left:0; width:0; background:#3498db; }
.mt-mg-zone { position:absolute; top:0; bottom:0; background:rgba(46,204,113,.4); }
.mt-mg-controls { display:flex; gap:10px; }
.mt-tilt { width:min(60vw,240px); }

.mt-big { position:absolute; top:38%; left:50%; transform:translate(-50%,-50%);
  font-size:min(6.5vw,34px); font-weight:700; text-align:center; white-space:pre-line;
  text-shadow:0 2px 12px #000; opacity:0; transition:opacity .3s;
  pointer-events:none; line-height:1.5; }
`;

export const MT_TEMPLATE = `
<div class="mt-root">
  <div class="mt-hud">
    <div class="mt-panel">
      <div class="mt-step-title">—</div>
      <div class="mt-step-hint">—</div>
    </div>
    <div class="mt-panel">
      BUDŻET <b class="mt-budget-n">600</b> N
      <div class="mt-budget-bar"><div class="mt-budget-fill"></div></div>
      <div class="mt-parts">części zapasowe: 2</div>
    </div>
  </div>

  <div class="mt-progress"></div>

  <div class="mt-toolbar">
    <button class="mt-tool mt-rotate" disabled>OBRÓĆ ŁĄCZNIK</button>
    <button class="mt-tool mt-test" disabled>▶ TEST 50 mm</button>
    <button class="mt-tool mt-reset">R — KROK</button>
  </div>

  <div class="mt-cross">
    <canvas class="mt-cross-canvas" width="240" height="180"></canvas>
    <div class="cap">przekrój / pomiar</div>
  </div>

  <div class="mt-minigame">
    <div class="mt-mg-info">—</div>
    <div class="mt-mg-bar"><div class="mt-mg-zone"></div><div class="mt-mg-fill"></div></div>
    <input class="mt-tilt" type="range" min="0" max="45" value="0" step="1" style="display:none"/>
    <div class="mt-mg-controls">
      <button class="mt-tool mt-mg-left">◀</button>
      <button class="mt-tool mt-mg-right">▶</button>
      <button class="mt-tool mt-mg-done">GOTOWE</button>
    </div>
  </div>

  <div class="mt-big"></div>
</div>
`;
```

### Refaktor modułów Montera (nagłówki konstruktorów)

Wszystkie trzy moduły UI dostają `root`; logika w środku bez zmian:

```js
// Hud.js
export class Hud {
  constructor(root, stepCount) {
    const $ = (s) => root.querySelector(s);
    this.el = {
      title: $('.mt-step-title'), hint: $('.mt-step-hint'),
      budgetN: $('.mt-budget-n'), budgetFill: $('.mt-budget-fill'),
      parts: $('.mt-parts'), big: $('.mt-big'), progress: $('.mt-progress'),
    };
    // …reszta identyczna (kropki, budget, flash)
  }
}

// CrossSection.js
export class CrossSection {
  constructor(root) {
    this.c = root.querySelector('.mt-cross-canvas');
    this.ctx = this.c.getContext('2d');
    // …reszta bez zmian
  }
}

// Minigames.js
export class Minigame {
  constructor(root, audio) {
    const $ = (s) => root.querySelector(s);
    this.box = $('.mt-minigame'); this.info = $('.mt-mg-info');
    this.fill = $('.mt-mg-fill'); this.zone = $('.mt-mg-zone');
    this.left = $('.mt-mg-left'); this.right = $('.mt-mg-right');
    this.done = $('.mt-mg-done'); this.tilt = $('.mt-tilt');
    // …reszta bez zmian
  }
}
```

W `main.js` Montera zamiana sekcji „renderer/setup" na:

```js
export function start(container) {
  if (container.dataset.started) return;
  container.dataset.started = '1';
  injectStyle('monter', MT_CSS);
  container.innerHTML = MT_TEMPLATE;

  const root = container.querySelector('.mt-root');
  const renderer = makeRenderer();
  root.prepend(renderer.domElement);          // canvas pod HUD-em

  const hud = new Hud(root, STEPS.length);
  const cross = new CrossSection(root);
  const minigame = new Minigame(root, audio);
  // btnRotate/btnTest/btnReset:
  const btnRotate = root.querySelector('.mt-rotate');
  const btnTest = root.querySelector('.mt-test');
  const btnReset = root.querySelector('.mt-reset');

  // DragSystem i OrbitControls bez zmian — wiszą na renderer.domElement,
  // który jest dzieckiem root, więc eventy nie wyciekają poza grę.

  return {
    stop() {
      controls.dispose();
      renderer.dispose();
      container.innerHTML = '';
      delete container.dataset.started;
    },
  };
}
```

---

## 3. Tryb nauki — `games/tryb-nauki/js/HudTemplate.js`

Tu jest layout dwukolumnowy (scena + panel płyty), więc template obejmuje CAŁY
układ gry, nie tylko overlay:

```js
export const TN_CSS = `
.tn-root { position:absolute; inset:0; display:flex; background:#0d1420;
  font-family:system-ui, sans-serif; color:#e8ecf1; touch-action:none;
  user-select:none; -webkit-user-select:none; }
.tn-scene { position:relative; flex:1; min-width:0; }
.tn-scene canvas { display:block; }

.tn-card { position:absolute; top:12px; left:12px; max-width:min(420px,92vw);
  background:rgba(0,0,0,.65); border:1px solid rgba(255,255,255,.15);
  border-radius:12px; padding:12px 14px; backdrop-filter:blur(4px);
  font-size:13px; line-height:1.45; pointer-events:auto; }
.tn-card-title { font-weight:800; margin-bottom:6px; font-size:14px; }
.tn-card-text { white-space:pre-line; }
.tn-advance { margin-top:10px; width:100%; background:#2457a0; border:none;
  color:#fff; padding:10px; border-radius:8px; font-size:14px; font-weight:700;
  display:none; }

.tn-big { position:absolute; top:34%; left:50%; transform:translate(-50%,-50%);
  font-size:min(8vw,44px); font-weight:800; text-shadow:0 2px 12px #000;
  opacity:0; transition:opacity .25s; pointer-events:none; white-space:pre-line;
  text-align:center; }

.tn-board { width:330px; background:#151b24; border-left:1px solid
  rgba(255,255,255,.12); padding:12px; display:flex; flex-direction:column;
  gap:10px; overflow-y:auto; box-sizing:border-box; }
.tn-board h3 { margin:0; font-size:12px; letter-spacing:.08em; opacity:.7;
  font-weight:700; }

.tn-leds { display:flex; gap:6px; flex-wrap:wrap; }
.tn-led { display:flex; flex-direction:column; align-items:center; gap:3px;
  font-size:9px; width:46px; }
.tn-led i { width:14px; height:14px; border-radius:50%; background:#26120e;
  border:1px solid #000; box-shadow:inset 0 0 3px #000; }
.tn-led.on i { background:#ff4422; box-shadow:0 0 10px #ff4422; }
.tn-led.gr i { background:#2ecc71; box-shadow:0 0 10px #2ecc71; }

.tn-travel { position:relative; height:34px; background:#0a0e14; border-radius:8px;
  border:1px solid rgba(255,255,255,.12); overflow:hidden; }
.tn-zone { position:absolute; top:0; bottom:0; background:rgba(46,204,113,.35);
  border-left:2px solid #2ecc71; border-right:2px solid #2ecc71; display:none; }
.tn-marker { position:absolute; top:0; bottom:0; width:3px; background:#f1c40f; }
.tn-label { position:absolute; bottom:2px; left:8px; font-size:10px; opacity:.75; }
.tn-hint { font-size:10px; opacity:.65; text-align:center; }

.tn-btns { display:flex; gap:8px; }
.tn-btns button { flex:1; padding:14px 8px; border-radius:10px;
  border:1px solid rgba(255,255,255,.25); background:#1d2733; color:#fff;
  font-size:13px; font-weight:700; touch-action:none; position:relative;
  overflow:hidden; }
.tn-btns button:active { background:#2a3a4d; }
.tn-btns button:disabled { opacity:.3; }
.tn-hold-fill { position:absolute; left:0; top:0; bottom:0; width:0;
  background:rgba(46,204,113,.45); pointer-events:none; }

.tn-sw-row { display:flex; justify-content:space-between; align-items:center;
  gap:8px; font-size:11px; padding:4px 0; }
.tn-sw { min-width:74px; padding:8px 10px; border-radius:8px; font-size:12px;
  font-weight:700; background:#1d2733; color:#fff;
  border:1px solid rgba(255,255,255,.25); touch-action:manipulation; }
.tn-sw.on { background:#7a4f12; border-color:#f1c40f; }
.tn-sw:disabled { opacity:.35; }
.tn-note { font-size:10px; opacity:.55; line-height:1.4; }

@media (max-width: 720px) {
  .tn-root { flex-direction:column; }
  .tn-board { width:100%; border-left:none;
    border-top:1px solid rgba(255,255,255,.12); max-height:52%; }
}
`;

export const TN_TEMPLATE = `
<div class="tn-root">
  <div class="tn-scene">
    <div class="tn-card">
      <div class="tn-card-title">—</div>
      <div class="tn-card-text">—</div>
      <button class="tn-advance">DALEJ</button>
    </div>
    <div class="tn-big"></div>
  </div>

  <div class="tn-board">
    <h3>PŁYTA E600 / E1000</h3>
    <div class="tn-leds">
      <div class="tn-led" data-led="1"><i></i>LD1<br/>OTW.</div>
      <div class="tn-led" data-led="2"><i></i>LD2<br/>STOP</div>
      <div class="tn-led" data-led="3"><i></i>LD3<br/>FSW</div>
      <div class="tn-led" data-led="4"><i></i>LD4<br/>SET UP</div>
      <div class="tn-led" data-led="5"><i></i>LD5<br/>OPEN A</div>
      <div class="tn-led" data-led="6"><i></i>LD6<br/>OPEN B</div>
    </div>
    <div>
      <div class="tn-travel">
        <div class="tn-zone"></div>
        <div class="tn-marker"></div>
        <div class="tn-label">brama zamknięta ————— otwarta</div>
      </div>
      <div class="tn-hint">pasek podróży bramy · zielona strefa = okno naciśnięcia</div>
    </div>
    <div class="tn-btns">
      <button class="tn-setup">SETUP<i class="tn-hold-fill"></i></button>
      <button class="tn-open">OPEN</button>
    </div>
    <h3>PRZEŁĄCZNIKI DS1</h3>
    <div class="tn-sw-row"><span>1 · UKŁAD KONTROLNY</span><button class="tn-sw tn-control" disabled>WYŁ</button></div>
    <div class="tn-sw-row"><span>2 · CZUŁOŚĆ PRZYGNIECENIA</span><button class="tn-sw tn-sens" disabled>MAŁA</button></div>
    <div class="tn-sw-row"><span>4 · PRĘDKOŚĆ SANEK</span><button class="tn-sw tn-speed" disabled>DUŻA</button></div>
    <div class="tn-sw-row"><span>LOGIKA STEROWANIA</span><button class="tn-sw tn-logic" disabled>A</button></div>
    <div class="tn-note">A = automatyczny · B = półautomatyczny. Podczas nauki
      detekcja przeszkód nie działa (rozdz. 11.2).</div>
  </div>
</div>
`;
```

### Refaktor `BoardPanel` i `Hud` (nagłówki)

```js
// BoardPanel.js — kwerendy przez root; logika bez zmian
export class BoardPanel {
  constructor(root) {
    const $ = (s) => root.querySelector(s);
    this.leds = {};
    for (const n of [1, 2, 3, 4, 5, 6])
      this.leds[n] = root.querySelector(`.tn-led[data-led="${n}"]`);
    this.zone = $('.tn-zone'); this.marker = $('.tn-marker');
    this.hint = $('.tn-hint');
    this.btnSetup = $('.tn-setup'); this.btnOpen = $('.tn-open');
    this.holdFill = $('.tn-hold-fill');
    this.sw = { control: $('.tn-control'), sens: $('.tn-sens'),
                speed: $('.tn-speed'), logic: $('.tn-logic') };
    // …cała reszta (hold SETUP, toggle DS1, updateLEDs, setTravel) bez zmian
  }
}

// Hud.js
export class Hud {
  constructor(root) {
    this.card = root.querySelector('.tn-card');
    this.title = root.querySelector('.tn-card-title');
    this.text = root.querySelector('.tn-card-text');
    this.btn = root.querySelector('.tn-advance');
    this.big = root.querySelector('.tn-big');
    // …reszta bez zmian
  }
}
```

### `start()` Trybu nauki

```js
export function start(container) {
  if (container.dataset.started) return;
  container.dataset.started = '1';
  injectStyle('tryb-nauki', TN_CSS);
  container.innerHTML = TN_TEMPLATE;

  const root = container.querySelector('.tn-root');
  const sceneHost = root.querySelector('.tn-scene');
  const renderer = makeRenderer();
  sceneHost.prepend(renderer.domElement);     // canvas w kolumnie sceny

  const board = new BoardPanel(root);
  const hud = new Hud(root);

  function resize() {
    const w = sceneHost.clientWidth, h = sceneHost.clientHeight;   // ← rozmiar
    renderer.setSize(w, h);                                        //   kolumny,
    fitPerspective(camera, w / h);                                 //   nie okna
  }
  addEventListener('resize', resize);

  // …cała logika etapów bez zmian

  return {
    stop() {
      removeEventListener('resize', resize);
      removeEventListener('keydown', onKey);      // Space→OPEN było globalne
      renderer.dispose();
      container.innerHTML = '';
      delete container.dataset.started;
    },
  };
}
```

Dwie pułapki specyficzne dla tej gry:

1. **`resize` liczy na `sceneHost`**, nie `window` — na mobile panel płyty
   zajmuje połowę wysokości, więc scena nie ma pełnego viewportu.
2. **Skrót Space → OPEN** rejestrowany był globalnie w `addEventListener('keydown')`
   — przy trzech grach na stronie każda by łapała Space. Przenieś do zamknięcia
   `start()` i usuwaj w `stop()` (jak wyżej), a najlepiej aktywuj tylko wtedy,
   gdy kursor/dotyk był ostatnio wewnątrz kontenera gry.

---

## 4. Checklist domykający monorepo

1. Dodać `shared/ui/injectStyle.js` (§0).
2. Per gra: `HudTemplate.js` (CSS + template) + refaktor konstruktorów UI
   (`root` zamiast `document`).
3. `main.js`: `start(container)` z idempotencją + `stop()` z czyszczeniem
   globalnych listenerów (`resize`, `keydown`).
4. Samodzielne `index.html` gier: kontener `<div id="app" style="position:fixed;inset:0"></div>`
   + `start(document.getElementById('app'))` — zero HTML-owego HUD-u w pliku.
5. Test: strona główna — scroll przez 3 sekcje; każda gra startuje raz;
   Inspektor: brak zdublowanych ID; `getComputedStyle` — style gier nie
   przenikają się (prefiksy `gr-/mt-/tn-`).
6. Test regression solo: każda gra przez własny `index.html` — zachowanie
   identyczne z wersjami sprzed migracji (szczególnie hold SETUP i panele
   dotykowe, które zależą od `pointer events` na elementach wewnątrz root).
