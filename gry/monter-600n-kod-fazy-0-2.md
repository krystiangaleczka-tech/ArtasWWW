# MONTER: 600 N — kod Faz 0–2 (PC + mobile)

Kompletna, działająca implementacja trzech pierwszych faz z planu gry. Jedno spójne
codebase z komentarzami `// [F0]`, `// [F1]`, `// [F2]` — można budować etapami wg roadmapy.

**Wymagania:** dowolny serwer HTTP (moduły ES nie działają z `file://`):

```bash
npx serve .          # lub: python3 -m http.server 8000
```

Three.js z CDN przez import map (bez build-stepu). Migracja na Vite: `npm i three`
+ usuń `<script type="importmap">`.

---

## Co dowiązują fazy

| Faza | Zawartość | Pliki |
|---|---|---|
| **0 — pion** | warsztat 2.5D (ortograficzna kamera izometryczna + ograniczony orbit), drag & drop przez raycast na płaszczyznach, **constraint 35 mm prześwitu** przy wieszaniu prowadnicy, widok przekroju (canvas 2D), snap + walidacja, budżet 600 N | `GameLoop`, `WorkshopScene`, `DragSystem`, `CrossSection`, `Hud` |
| **1 — MVP** | pełna sekwencja kroków 1–4: wspornik przedni (środek ±10 mm, 5 mm nad przecięciem kresek), mini-gra wiertarki (sweet-spot ciśnienia), prowadnica pod sufit (35 mm), mini-gra zaginacza wsporników (zmierzony wymiar ±5 mm), limit części zapasowych, kary w N | `Minigames`, `data/constraints.js`, kroki w `main.js` |
| **2 — pełny montaż** | kroki 5–8: łącznik na bramie (strefa 20–40 cm, kąt ramienia ≤30°, obrót — linka zwalniająca po lewej), napęd z pochyleniem 15–20°, mini-gra napinacza łańcucha (sweet spot środka pętli, pęknięcie sprzęgła przy przekręceniu), finałowy test 50 mm / 20 kg z animacją, dźwięki, raport + najlepszy wynik | `GateTestRunner`, `AudioManager`, pozostałe kroki w `main.js` |

Wszystkie wartości constraintów pochodzą z instrukcji montażowej FAAC D600/D1000:
odstęp min. 35 mm sufit–brama, kąt ramienia ≤30°, 20/40 cm mocowania na bramie,
pochylenie modułu napędu 15–20°, środek pętli łańcucha pośrodku przekroju prowadnicy
(uszkodzenie sprzęgła przy przetęciu), element przelotowy linki zwalniającej po lewej
stronie, test przeszkody 50 mm i obciążenia 20 kg.

---

## Struktura

```
monter600n/
  index.html
  js/
    main.js
    core/
      GameLoop.js
      AudioManager.js
    data/
      constraints.js
    workshop/
      WorkshopScene.js
      DragSystem.js
      Minigames.js
    garage/
      GateTestRunner.js
    ui/
      Hud.js
      CrossSection.js
```

(Uwaga: `SnapSystem` z planu jest celowo zwinięty do `main.js` — walidacja + lerp-snap;
`ConstraintSolver` = `data/constraints.js` + walidatory w `main.js`.)

---

## index.html

```html
<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"/>
<title>MONTER: 600 N</title>
<style>
  html, body { margin:0; height:100%; overflow:hidden; background:#10151c;
    font-family:system-ui, sans-serif; color:#e8ecf1; touch-action:none;
    -webkit-user-select:none; user-select:none; }
  #app { position:fixed; inset:0; }
  canvas { display:block; }

  #hud { position:absolute; top:10px; left:10px; right:10px;
    display:flex; gap:8px; flex-wrap:wrap; pointer-events:none; align-items:flex-start; }
  .panel { background:rgba(0,0,0,.55); padding:8px 12px; border-radius:10px;
    backdrop-filter:blur(4px); font-size:13px; max-width:330px; }
  #step-title { font-weight:700; }
  #step-hint { font-size:12px; opacity:.85; margin-top:3px; line-height:1.4; }

  #budget-bar { height:8px; background:#2a2f36; border-radius:4px; overflow:hidden;
    width:170px; margin-top:4px; }
  #budget-fill { height:100%; width:100%; background:linear-gradient(90deg,#2ecc71,#f1c40f,#e74c3c); }
  #parts { font-size:11px; opacity:.8; margin-top:3px; }

  #progress { position:absolute; top:12px; left:50%; transform:translateX(-50%);
    display:flex; gap:5px; pointer-events:none; }
  .dot { width:9px; height:9px; border-radius:50%; background:rgba(255,255,255,.18); }
  .dot.done { background:#2ecc71; }
  .dot.cur { background:#f1c40f; }

  #toolbar { position:absolute; left:10px; bottom:10px; display:flex; gap:8px; flex-wrap:wrap; }
  button.tool { pointer-events:auto; background:rgba(0,0,0,.6);
    border:1px solid rgba(255,255,255,.28); color:#fff; padding:11px 14px;
    border-radius:10px; font-size:13px; touch-action:none; }
  button.tool:active { background:rgba(255,255,255,.25); }
  button.tool:disabled { opacity:.3; }

  #cross { position:absolute; right:10px; bottom:10px; background:rgba(0,0,0,.6);
    border:1px solid rgba(255,255,255,.15); border-radius:10px; padding:6px; }
  #cross canvas { display:block; width:min(240px, 36vw); height:auto; border-radius:6px; }
  #cross .cap { font-size:10px; opacity:.7; text-align:center; margin-top:3px; }

  #minigame { position:absolute; left:50%; bottom:14px; transform:translateX(-50%);
    display:none; flex-direction:column; gap:8px; align-items:center;
    background:rgba(0,0,0,.7); padding:12px 16px; border-radius:12px; pointer-events:auto;
    max-width:92vw; }
  #mg-info { font-size:12px; text-align:center; }
  #mg-bar { width:min(70vw, 320px); height:18px; background:#1a1f26; border-radius:9px;
    position:relative; overflow:hidden; }
  #mg-fill { position:absolute; top:0; bottom:0; left:0; width:0; background:#3498db; }
  #mg-zone { position:absolute; top:0; bottom:0; background:rgba(46,204,113,.4); }
  #mg-controls { display:flex; gap:10px; }
  #tilt { width:min(60vw, 240px); }

  #big { position:absolute; top:38%; left:50%; transform:translate(-50%,-50%);
    font-size:min(6.5vw, 34px); font-weight:700; text-align:center; white-space:pre-line;
    text-shadow:0 2px 12px #000; opacity:0; transition:opacity .3s; pointer-events:none;
    line-height:1.5; }
</style>
</head>
<body>
<div id="app"></div>

<div id="hud">
  <div class="panel">
    <div id="step-title">—</div>
    <div id="step-hint">—</div>
  </div>
  <div class="panel">
    BUDŻET <b id="budget-n">600</b> N
    <div id="budget-bar"><div id="budget-fill"></div></div>
    <div id="parts">części zapasowe: 2</div>
  </div>
</div>

<div id="progress"></div>

<div id="toolbar">
  <button class="tool" id="btn-rotate" disabled>OBRÓĆ ŁĄCZNIK</button>
  <button class="tool" id="btn-test" disabled>▶ TEST 50 mm</button>
  <button class="tool" id="btn-reset">R — KROK</button>
</div>

<div id="cross">
  <canvas id="cross-canvas" width="240" height="180"></canvas>
  <div class="cap">przekrój / pomiar</div>
</div>

<div id="minigame">
  <div id="mg-info">—</div>
  <div id="mg-bar"><div id="mg-zone"></div><div id="mg-fill"></div></div>
  <input id="tilt" type="range" min="0" max="45" value="0" step="1" style="display:none"/>
  <div id="mg-controls">
    <button class="tool" id="mg-left">◀</button>
    <button class="tool" id="mg-right">▶</button>
    <button class="tool" id="mg-done">GOTOWE</button>
  </div>
</div>

<div id="big"></div>

<script type="importmap">
{
  "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"
  }
}
</script>
<script type="module" src="./js/main.js"></script>
</body>
</html>
```

---

## js/core/GameLoop.js

```js
// [F0] fixed timestep 60 Hz (współdzielony z Gate Rush)
export class GameLoop {
  constructor(update, render) {
    this.update = update; this.render = render;
    this.step = 1 / 60; this.acc = 0; this.last = performance.now();
    const tick = (now) => {
      const dt = Math.min((now - this.last) / 1000, 0.1);
      this.last = now; this.acc += dt;
      while (this.acc >= this.step) { this.update(this.step); this.acc -= this.step; }
      this.render(dt);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}
```

---

## js/core/AudioManager.js

```js
// [F2] WebAudio; init po pierwszym geście użytkownika
export class Audio {
  constructor() { this.ctx = null; }

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.3;
    this.master.connect(this.ctx.destination);
    // szum silnika bramy (do testu końcowego)
    this.hum = this.ctx.createOscillator();
    this.hum.type = 'triangle'; this.hum.frequency.value = 55;
    this.humGain = this.ctx.createGain(); this.humGain.gain.value = 0;
    this.hum.connect(this.humGain).connect(this.master);
    this.hum.start();
  }

  motor(on) { if (this.ctx) this.humGain.gain.value = on ? 0.14 : 0; }
  click()  { this._blip(1100, 0.06, 0.25); }
  snap()   { this._blip(700, 0.1, 0.35); this._blip(1400, 0.08, 0.2); }
  ratchet(){ this._blip(1900, 0.03, 0.15, 'square'); }
  fail()   { this._blip(160, 0.35, 0.5, 'square'); }
  thud()   { this._blip(75, 0.3, 0.7, 'square'); }
  chime()  { this._blip(660, 0.2, 0.3); setTimeout(() => this._blip(990, 0.3, 0.3), 160); }

  crack() { // pęknięcie: szum z zanikiem
    if (!this.ctx) return;
    const dur = 0.3, sr = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, sr * dur, sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const g = this.ctx.createGain(); g.gain.value = 0.5;
    src.connect(g).connect(this.master); src.start();
  }

  _blip(freq, dur, vol, type = 'sine') {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    o.connect(g).connect(this.master);
    o.start(); o.stop(this.ctx.currentTime + dur);
  }
}
```

---

## js/data/constraints.js

```js
// [F1] wszystkie tolerancje z instrukcji FAAC D600/D1000 w jednym miejscu
// (odpowiednik constraints.json z planu — łatwe strojenie bez ruszania kodu)
export const CONSTRAINTS = {
  // krok 1: wspornik przedni
  centerTolerance: 0.010,   // ±10 mm od pionowej kreski (środek bramy)
  bracketAboveMark: 0.005, // min 5 mm nad przecięciem kresek
  markY: 2.45,              // pozioma kreska = maks. wysokość elementów ruchomych
  // krok 3: prowadnica
  minClearance: 0.035,      // 35 mm prześwitu sufit–brama
  railSnapLo: 2.63, railSnapHi: 2.69, // strefa dokręcenia do wsporników sufitowych
  // krok 5: łącznik na bramie
  bracketBottomY: 2.52,    // dolna krawędź przedniego wspornika
  bandTop: 0.20,            // max 20 cm (górna granica strefy)
  bandBottom: 0.40,         // max 40 cm (dolna granica strefy)
  armAngleMax: 30,          // kąt ramienia vs prowadnica ≤ 30°
  trolley: { y: 2.5, z: 0.6 },
  // krok 6: napęd
  tiltMin: 15, tiltMax: 20, // pochylenie modułu przy wkładaniu wałka
  driveSocketZ: -2.0,
  // krok 7: napinacz łańcucha
  sweetLo: 0.40, sweetHi: 0.60, // środek pętli — środek przekroju prowadnicy
  breakAt: 0.85,                // przetęcie = uszkodzenie sprzęgła
  // krok 8: test
  blockTop: 0.05,           // klocek testowy 50 mm
};
```

---

## js/workshop/WorkshopScene.js

```js
import * as THREE from 'three';

// [F0] garaż z zamkniętą bramą segmentową + wszystkie części montażowe.
// Geometria: otwór bramy w płaszczyźnie z=0, spód sufitu y=2.9,
// brama zamknięta ma wysokość 2.4 (najwyższy punkt ruchu — constraint 35 mm).
export class WorkshopScene {
  constructor(scene) {
    this.scene = scene;
    this.parts = {};
    this._build();
  }

  _build() {
    const S = this.scene;

    const wallMat = new THREE.MeshStandardMaterial({ color: 0x2c333d, roughness: 0.9 });
    const floor = new THREE.Mesh(new THREE.BoxGeometry(12, 0.1, 9),
      new THREE.MeshStandardMaterial({ color: 0x20252c, roughness: 0.95 }));
    floor.position.set(0, -0.05, -1);
    S.add(floor);
    const mk = (w, h, d, x, y, z, mat = wallMat) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z); S.add(m); return m;
    };
    mk(1, 3.6, 4.4, -3.5, 1.8, -1.2);       // ściana lewa
    mk(1, 3.6, 4.4, 3.5, 1.8, -1.2);        // ściana prawa
    mk(8, 0.2, 3.6, 0, 3.0, -1.6);          // sufit (spód y=2.9)
    mk(8, 0.5, 0.5, 0, 2.65, 0);            // nadproże (front z=0.25)
    mk(8, 3.4, 0.3, 0, 1.7, -3.25);         // ściana tylna garażu

    // [F1] kreski montażowe na nadprożu (z instrukcji, rozdz. 7.1)
    const markMat = new THREE.MeshBasicMaterial({ color: 0xf1c40f });
    const vline = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.5, 0.01), markMat);
    vline.position.set(0, 2.65, 0.256); S.add(vline);          // środek szerokości bramy
    const hline = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.02, 0.01), markMat);
    hline.position.set(0, 2.45, 0.256); S.add(hline);          // maks. wysokość ruchu

    // [F0] brama segmentowa (zamknięta) — grupa animowana w teście końcowym
    const gate = new THREE.Group();
    const segMat = new THREE.MeshStandardMaterial({ color: 0x8fa3b8, roughness: 0.55, metalness: 0.3 });
    for (let k = 0; k < 6; k++) {
      const seg = new THREE.Mesh(new THREE.BoxGeometry(6, 0.39, 0.1), segMat);
      seg.position.set(0, (k + 0.5) * 0.4, 0.05);
      gate.add(seg);
    }
    S.add(gate);
    this.parts.gate = gate;

    // [F1] wspornik przedni — startuje z boku na płaszczyźnie nadproża
    const bracket = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.2, 0.15),
      new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.5, metalness: 0.5 }));
    bracket.position.set(2.6, 2.62, 0.17);
    S.add(bracket);
    this.parts.bracket = bracket;

    // [F0] prowadnica — startuje na podłodze
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.14, 4.0),
      new THREE.MeshStandardMaterial({ color: 0x9aa4ad, roughness: 0.45, metalness: 0.6 }));
    rail.position.set(0, 0.2, -1.3);
    S.add(rail);
    this.parts.rail = rail;

    // [F1] śruby wspornika (widoczne po wierceniu)
    this.parts.screws = [];
    for (const dx of [-0.08, 0.08]) {
      const sc = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.06, 8),
        new THREE.MeshStandardMaterial({ color: 0xb0b6bd, metalness: 0.8, roughness: 0.3 }));
      sc.position.set(dx, 2.62, 0.19); sc.visible = false;
      S.add(sc); this.parts.screws.push(sc);
    }

    // [F1] tylne wsporniki (widoczne po zaginaniu)
    this.parts.rearBrackets = [];
    for (const x of [-0.09, 0.09]) {
      const rb = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.24, 0.05),
        new THREE.MeshStandardMaterial({ color: 0xc0392b, metalness: 0.5, roughness: 0.5 }));
      rb.position.set(x, 2.78, -3.0); rb.visible = false;
      S.add(rb); this.parts.rearBrackets.push(rb);
    }

    // [F2] sanki (trolley) na prowadnicy
    const trolley = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.15, 0.2),
      new THREE.MeshStandardMaterial({ color: 0x34495e, metalness: 0.6, roughness: 0.4 }));
    trolley.position.set(0, 2.5, 0.6); trolley.visible = false;
    S.add(trolley); this.parts.trolley = trolley;

    // [F2] łącznik do bramy + ucho linki zwalniającej (obracane)
    const connector = new THREE.Group();
    const cbody = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.15, 0.12),
      new THREE.MeshStandardMaterial({ color: 0xc0392b, metalness: 0.5, roughness: 0.5 }));
    connector.add(cbody);
    const ear = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.06),
      new THREE.MeshStandardMaterial({ color: 0xf1c40f }));
    ear.position.set(0.12, 0.06, 0);
    connector.add(ear);
    connector.position.set(0, 1.6, 0.16); connector.visible = false;
    S.add(connector);
    this.parts.connector = connector;
    this.parts.connectorEar = ear;

    // [F2] ramię (dynamiczne, łączy sanki z łącznikiem)
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 8),
      new THREE.MeshStandardMaterial({ color: 0x7f8c8d, metalness: 0.7, roughness: 0.35 }));
    arm.visible = false;
    S.add(arm);
    this.parts.arm = arm;

    // [F2] napęd (moduł na prowadnicy)
    const drive = new THREE.Group();
    const dbody = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.9),
      new THREE.MeshStandardMaterial({ color: 0xe8e4da, roughness: 0.6 }));
    drive.add(dbody);
    drive.position.set(0, 2.42, -0.2); drive.visible = false;
    S.add(drive);
    this.parts.drive = drive;

    // [F2] łańcuch + nakrętka napinacza
    const chain = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.03, 3.8),
      new THREE.MeshStandardMaterial({ color: 0x566573, metalness: 0.7, roughness: 0.4 }));
    chain.position.set(0, 2.585, -1.3); chain.visible = false;
    S.add(chain); this.parts.chain = chain;
    const nut = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.09),
      new THREE.MeshStandardMaterial({ color: 0xf1c40f, emissive: 0x554400 }));
    nut.position.set(0, 2.53, 0.45); nut.visible = false;
    S.add(nut); this.parts.nut = nut;

    // [F2] przybory testowe: klocek 50 mm + worek 20 kg
    const block = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x27ae60 }));
    block.position.set(0, 0.025, 0.35); block.visible = false;
    S.add(block); this.parts.block = block;
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.28, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x8e6e3a, roughness: 0.9 }));
    bag.position.set(1.8, 0.14, 0.6); bag.visible = false;
    S.add(bag); this.parts.bag = bag;
  }
}
```

---

## js/workshop/DragSystem.js

```js
import * as THREE from 'three';

// [F0] drag & drop: pointerdown na meszu → raycast na przypisaną płaszczyznę
// ruchu → pozycja co klatkę → drop z walidacją. Orbit blokowany podczas draga
// (kluczowe na mobile, gdzie jeden palec = drag części, a orbit zostaje na 2 palcach).
export class DragSystem {
  constructor(camera, canvas, controls) {
    this.camera = camera;
    this.controls = controls;
    this.raycaster = new THREE.Raycaster();
    this.items = [];        // { mesh, plane, handler, enabled }
    this.active = null;
    this.onDrop = null;

    canvas.addEventListener('pointerdown', (e) => this._down(e));
    window.addEventListener('pointermove', (e) => this._move(e));
    window.addEventListener('pointerup', () => this._up());
    window.addEventListener('pointercancel', () => this._up());
  }

  add(mesh, plane, handler) { this.items.push({ mesh, plane, handler, enabled: true }); }
  setEnabled(mesh, v) {
    const it = this.items.find(i => i.mesh === mesh);
    if (it) it.enabled = v;
  }
  setAllEnabled(v) { this.items.forEach(i => (i.enabled = v)); }

  _setRay(e) {
    const ndc = new THREE.Vector2(
      (e.clientX / innerWidth) * 2 - 1,
      -(e.clientY / innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
  }

  _down(e) {
    this._setRay(e);
    const meshes = this.items.filter(i => i.enabled).map(i => i.mesh);
    const hits = this.raycaster.intersectObjects(meshes, false);
    if (!hits.length) return;
    this.active = this.items.find(i => i.mesh === hits[0].object);
    this.controls.enabled = false;
    e.preventDefault();
  }

  _move(e) {
    if (!this.active) return;
    this._setRay(e);
    const p = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.active.plane, p)) {
      this.active.handler(p);
    }
  }

  _up() {
    if (!this.active) return;
    this.active = null;
    this.controls.enabled = true;
    if (this.onDrop) this.onDrop();
  }
}
```

---

## js/workshop/Minigames.js

```js
// [F1] trzy mini-gry narzędziowe na wspólnym pasku DOM:
//  drill   — wiertarka: trzymanie = rosnące ciśnienie; sweet spot 55–75%; >95% = pęka ściana
//  bend    — zaginacz: suwak punktu zgięcia vs zmierzony wymiar (±5 mm)
//  tension — napinacz: przytrzymanie KRĘĆ; sweet spot środka pętli; >85% = sprzęgło pęka
const $ = (s) => document.querySelector(s);

export class Minigame {
  constructor(audio) {
    this.audio = audio;
    this.box = $('#minigame'); this.info = $('#mg-info');
    this.fill = $('#mg-fill'); this.zone = $('#mg-zone');
    this.left = $('#mg-left'); this.right = $('#mg-right');
    this.done = $('#mg-done'); this.tilt = $('#tilt');
    this.holdL = false; this.holdR = false; this.mode = null; this.o = null;

    const hold = (el, prop) => {
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); this[prop] = true; });
      const off = () => { this[prop] = false; };
      el.addEventListener('pointerup', off);
      el.addEventListener('pointerleave', off);
      el.addEventListener('pointercancel', off);
    };
    hold(this.left, 'holdL');
    hold(this.right, 'holdR');
    this.done.addEventListener('click', () => { if (this.o && this.o.onDoneBtn) this.o.onDoneBtn(); });
  }

  start(mode, opts) {
    this.mode = mode; this.o = opts;
    this.box.style.display = 'flex';
    this.fill.style.width = '0%';
    this.tilt.style.display = 'none';
    this.done.style.display = 'none';
    this.left.style.display = 'none';
    this.right.style.display = 'none';

    if (mode === 'drill') {
      this.info.textContent = 'WIERTARKA — trzymaj przycisk i utrzymuj ciśnienie w zielonej strefie';
      this.left.style.display = '';
      this.left.textContent = '⊙ WIERTARKA — TRZYMAJ';
      this.zone.style.left = '55%'; this.zone.style.width = '20%';
      this.pressure = 0.2; this.prog = 0;
      this.fill.style.background = '#3498db';
    } else if (mode === 'bend') {
      this.info.textContent = `Zmierzono: ${opts.target.toFixed(1)} cm od środka otworu do sufitu`;
      this.tilt.style.display = '';
      this.tilt.min = 5; this.tilt.max = 40; this.tilt.step = 0.5; this.tilt.value = 15;
      this.done.style.display = ''; this.done.textContent = 'ZAGIŃ WSPORNIK';
      this.zone.style.left = '0%'; this.zone.style.width = '0%';
    } else if (mode === 'tension') {
      this.info.textContent = 'NAPINACZ — KRĘĆ w prawo; strzałka = środek pętli łańcucha w przekroju';
      this.left.style.display = ''; this.right.style.display = '';
      this.left.textContent = '◀ LUŹNIEJ'; this.right.textContent = 'NAPIĘCIEJ ▶';
      this.zone.style.left = '40%'; this.zone.style.width = '20%';
      this.r = 0.05; this.sweetTime = 0;
      this.fill.style.background = '#e67e22';
    }
  }

  update(dt) {
    if (!this.mode) return;
    if (this.mode === 'drill') {
      this.pressure += (this.holdL ? 0.55 : -0.45) * dt;
      this.pressure = Math.max(0, Math.min(1.05, this.pressure));
      this.fill.style.width = Math.min(this.pressure, 1) * 100 + '%';
      if (this.pressure > 0.95) {
        this.o.onError('ZBYT DUŻY NACISK — pęknięcie ściany! (−50 N)');
        this.pressure = 0.25; this.prog *= 0.5;
        return;
      }
      if (this.pressure >= 0.55 && this.pressure <= 0.75) {
        this.prog += dt;
        this.fill.style.background = '#2ecc71';
      } else this.fill.style.background = '#3498db';
      this.info.textContent = `WIERTARKA — postęp: ${Math.round((this.prog / 1.5) * 100)}%`;
      if (this.prog >= 1.5) this.o.onDone();
    }
    else if (this.mode === 'tension') {
      const dir = (this.holdR ? 1 : 0) - (this.holdL ? 1 : 0);
      if (dir !== 0) {
        this.r += dir * 0.22 * dt;
        if (this.r > 0.85) {              // [F2] przetęcie = sprzęgło pęka (jak w instrukcji)
          this.o.onError('SPRZĘGŁO PĘKŁO — zbyt mocne naprężenie! (−150 N)');
          this.r = 0.05; this.sweetTime = 0;
          return;
        }
        this.r = Math.max(0, Math.min(1, this.r));
        this._tick = (this._tick || 0) + dt;
        if (this._tick > 0.12) { this.audio.ratchet(); this._tick = 0; }
      }
      this.fill.style.width = this.r * 100 + '%';
      if (this.r >= 0.4 && this.r <= 0.6) {
        this.sweetTime += dt;
        this.fill.style.background = '#2ecc71';
      } else { this.sweetTime = 0; this.fill.style.background = '#e67e22'; }
      if (this.o.onUpdate) this.o.onUpdate(this.r);
      if (this.sweetTime >= 0.8) this.o.onDone();
    }
  }

  hide() { this.mode = null; this.box.style.display = 'none'; }
}
```

---

## js/garage/GateTestRunner.js

```js
// [F2] finałowy test z instrukcji (rozdz. 13): brama otwiera się, zamyka,
// "dotyka" klocka 50 mm i WYCOFUJE (system anty-przygnieceniowy działa).
export class GateTestRunner {
  constructor(gate, audio) {
    this.gate = gate;
    this.audio = audio;
    this.active = false;
    this.blockTop = 0.05;
  }

  start(onResult) {
    this.active = true;
    this.phase = 'open';
    this.t = 0;
    this.onResult = onResult;
    this.audio.motor(true);
  }

  update(dt) {
    if (!this.active) return;
    this.t += dt;
    const g = this.gate.position;
    if (this.phase === 'open') {
      g.y = Math.min(this.t * 1.1, 2.0);
      if (this.t >= 2.2) { this.phase = 'pause'; this.t = 0; }
    } else if (this.phase === 'pause') {
      if (this.t >= 0.6) { this.phase = 'close'; this.t = 0; this.audio.motor(true); }
    } else if (this.phase === 'close') {
      g.y -= dt * 0.7;
      if (g.y <= this.blockTop) {           // kontakt z klockiem 50 mm
        this.phase = 'reverse'; this.t = 0;
        this.audio.motor(false); this.audio.thud();
      }
    } else if (this.phase === 'reverse') {  // rewers — przeszkoda wykryta
      g.y += dt * 0.9;
      if (g.y >= this.blockTop + 0.45) { this.phase = 'end'; this.t = 0; }
    } else if (this.phase === 'end') {
      if (this.t >= 0.8) {
        this.active = false;
        this.gate.position.y = 0;
        this.onResult(true);
      }
    }
  }
}
```

---

## js/ui/Hud.js

```js
// [F1] HUD w DOM — wspólne dla PC i mobile
export class Hud {
  constructor(stepCount) {
    this.el = {
      title: document.getElementById('step-title'),
      hint: document.getElementById('step-hint'),
      budgetN: document.getElementById('budget-n'),
      budgetFill: document.getElementById('budget-fill'),
      parts: document.getElementById('parts'),
      big: document.getElementById('big'),
      progress: document.getElementById('progress'),
    };
    this.dots = [];
    for (let i = 0; i < stepCount; i++) {
      const d = document.createElement('div');
      d.className = 'dot';
      this.el.progress.appendChild(d);
      this.dots.push(d);
    }
    this._t = 0;
  }

  setStep(i, step) {
    this.el.title.textContent = step.title;
    this.el.hint.textContent = step.hint;
    this.dots.forEach((d, k) => {
      d.className = 'dot' + (k < i ? ' done' : k === i ? ' cur' : '');
    });
  }

  budget(n) {
    this.el.budgetN.textContent = n;
    this.el.budgetFill.style.width = Math.max(0, (n / 600) * 100) + '%';
  }

  parts(n) { this.el.parts.textContent = 'części zapasowe: ' + n; }

  flash(msg, ms = 2200) {
    this.el.big.textContent = msg;
    this.el.big.style.opacity = 1;
    clearTimeout(this._t);
    this._t = setTimeout(() => { this.el.big.style.opacity = 0; }, ms);
  }
}
```

---

## js/ui/CrossSection.js

```js
// [F0] widok przekroju jako rysunek techniczny (canvas 2D) — klimat ilustracji
// z instrukcji. Rysuje na żywo pomiar aktualnego kroku.
export class CrossSection {
  constructor() {
    this.c = document.getElementById('cross-canvas');
    this.ctx = this.c.getContext('2d');
    this.W = this.c.width; this.H = this.c.height;
    this.bg();
  }

  // mapowanie: scena z∈[-3.6, 1.2] → x px; y∈[0, 3.3] → y px (odwrócone)
  X(z) { return 20 + (z + 3.6) / 4.8 * (this.W - 40); }
  Y(y) { return this.H - 16 - y / 3.3 * (this.H - 32); }

  bg() {
    const g = this.ctx;
    g.fillStyle = '#141a22'; g.fillRect(0, 0, this.W, this.H);
    g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 1;
    g.strokeRect(4, 4, this.W - 8, this.H - 8);
  }

  label(txt, x, y, color = '#f1c40f') {
    const g = this.ctx;
    g.fillStyle = color; g.font = '10px system-ui'; g.textAlign = 'left';
    g.fillText(txt, x, y);
  }

  arrow(x1, y1, x2, y2, color) {
    const g = this.ctx;
    g.strokeStyle = color; g.lineWidth = 2;
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
  }

  // [F1] krok 1: wspornik vs kreski
  bracket(p) {
    this.bg();
    const g = this.ctx;
    g.fillStyle = '#3a4552';
    g.fillRect(this.X(-0.4), this.Y(2.9), this.X(0.4) - this.X(-0.4), this.Y(2.4) - this.Y(2.9));
    g.strokeStyle = '#f1c40f';
    g.beginPath(); g.moveTo(this.X(0), this.Y(2.9)); g.lineTo(this.X(0), this.Y(2.4)); g.stroke();
    g.beginPath(); g.moveTo(this.X(-0.5), this.Y(2.45)); g.lineTo(this.X(0.5), this.Y(2.45)); g.stroke();
    if (p) {
      g.fillStyle = '#c0392b';
      g.fillRect(this.X(p.x - 0.15), this.Y(p.y + 0.1), 14, this.Y(p.y - 0.1) - this.Y(p.y + 0.1));
      const dev = Math.abs(p.x) * 1000;
      const above = (p.y - 0.1 - 2.455) * 1000;
      this.label(`Δśrodek: ${dev.toFixed(0)} mm (max 10)`, 12, 18, dev <= 10 ? '#2ecc71' : '#e74c3c');
      this.label(`nad kreską: ${above.toFixed(0)} mm (min 5)`, 12, 32, above >= 5 ? '#2ecc71' : '#e74c3c');
    }
  }

  // [F0] krok 3: prowadnica i prześwit 35 mm
  rail(y) {
    this.bg();
    const g = this.ctx;
    g.fillStyle = '#3a4552';
    g.fillRect(10, this.Y(2.9), this.W - 20, 8);
    g.fillStyle = '#8fa3b8';
    g.fillRect(10, this.Y(2.4), this.W - 20, 6);
    if (y != null) {
      g.fillStyle = '#9aa4ad';
      g.fillRect(this.X(-2.5), this.Y(y + 0.07), this.X(0.6) - this.X(-2.5), 8);
      const gap = (y - 0.07 - 2.4) * 1000;
      const ok = gap >= 35;
      const gx = this.X(-3.2);
      this.arrow(gx, this.Y(2.4), gx, this.Y(y - 0.07), ok ? '#2ecc71' : '#e74c3c');
      this.label(`prześwit: ${gap.toFixed(0)} mm`, gx + 6, this.Y(2.2), ok ? '#2ecc71' : '#e74c3c');
      this.label('(min 35 mm)', gx + 6, this.Y(2.05), '#8899aa');
    }
  }

  // [F2] krok 5: strefy 20/40 cm + kąt ramienia
  connector(y) {
    this.bg();
    const g = this.ctx;
    const C = 2.52; // dolna krawędź wspornika
    g.fillStyle = '#3a4552';
    g.fillRect(10, this.Y(3.0), this.W - 20, 8);
    g.fillStyle = '#c0392b';
    g.fillRect(this.X(0.4), this.Y(C + 0.1), 10, 10);
    const zt = this.X(0.55), zb = this.X(0.75);
    g.fillStyle = 'rgba(46,204,113,.25)';
    g.fillRect(zt - 12, this.Y(C - 0.20), 24, this.Y(C - 0.20) - this.Y(C - 0.40));
    this.label('20 cm', zt + 14, this.Y(C - 0.185), '#2ecc71');
    this.label('40 cm', zb + 14, this.Y(C - 0.385), '#2ecc71');
    g.fillStyle = '#8fa3b8';
    g.fillRect(this.X(-2.5), this.Y(2.4), this.X(0.3) - this.X(-2.5), 5);
    if (y != null) {
      g.strokeStyle = '#7f8c8d'; g.lineWidth = 3;
      g.beginPath();
      g.moveTo(this.X(0.6), this.Y(2.5));
      g.lineTo(this.X(0.16), this.Y(y));
      g.stroke();
      g.fillStyle = '#e74c3c';
      g.fillRect(this.X(0.16) - 5, this.Y(y) - 4, 10, 8);
      const ang = Math.atan2(2.5 - y, 0.6 - 0.16) * 180 / Math.PI;
      this.label(`kąt ramienia: ${ang.toFixed(1)}° (max 30°)`, 12, 18, ang <= 30 ? '#2ecc71' : '#e74c3c');
      const inBand = y >= C - 0.40 && y <= C - 0.20;
      this.label(inBand ? 'strefa mocowania: OK' : 'poza strefą 20–40 cm!', 12, 32, inBand ? '#2ecc71' : '#e74c3c');
    }
  }

  // [F2] krok 7: napinacz — przekrój prowadnicy z pętlą łańcucha
  tension(r) {
    this.bg();
    const g = this.ctx;
    const cx = this.W / 2, cy = this.H / 2 - 10;
    g.strokeStyle = '#9aa4ad'; g.lineWidth = 3;
    g.beginPath();
    g.moveTo(cx - 30, cy - 22); g.lineTo(cx - 30, cy + 22);
    g.lineTo(cx + 30, cy + 22); g.lineTo(cx + 30, cy - 22);
    g.stroke();
    g.fillStyle = 'rgba(46,204,113,.2)';
    g.fillRect(cx - 26, cy - 5, 52, 10);
    const sag = 34 * (1 - Math.min(r, 1));
    g.strokeStyle = r > 0.85 ? '#e74c3c' : '#f1c40f';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(cx - 26, cy + 18);
    g.quadraticCurveTo(cx, cy + 18 + sag, cx + 26, cy + 18);
    g.stroke();
    g.fillStyle = '#f1c40f';
    g.beginPath();
    g.arc(cx, cy + 18 + sag / 2, 4, 0, Math.PI * 2);
    g.fill();
    const inSweet = r >= 0.4 && r <= 0.6;
    this.label(inSweet ? 'środek pętli: OK' :
      (r > 0.85 ? 'ZBYT NAPIĘTY!' : 'za luźno…'), 12, 18,
      inSweet ? '#2ecc71' : r > 0.85 ? '#e74c3c' : '#f1c40f');
  }

  // [F2] krok 8: test
  test(msg, ok = true) {
    this.bg();
    const g = this.ctx;
    g.fillStyle = '#8fa3b8';
    g.fillRect(this.W / 2 - 50, this.Y(2.4), 100, 5);
    g.fillRect(this.W / 2 - 50, this.Y(2.4), 5, this.Y(0) - this.Y(2.4));
    g.fillRect(this.W / 2 + 45, this.Y(2.4), 5, this.Y(0) - this.Y(2.4));
    g.fillStyle = '#27ae60';
    g.fillRect(this.W / 2 - 14, this.Y(0.05), 28, this.Y(0) - this.Y(0.05));
    this.label('klocek 50 mm', this.W / 2 - 30, this.Y(0) + 14, '#27ae60');
    this.label(msg, 12, 18, ok ? '#2ecc71' : '#e74c3c');
  }
}
```

---

## js/main.js

```js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { GameLoop } from './core/GameLoop.js';
import { Audio } from './core/AudioManager.js';
import { WorkshopScene } from './workshop/WorkshopScene.js';
import { DragSystem } from './workshop/DragSystem.js';
import { Minigame } from './workshop/Minigames.js';
import { GateTestRunner } from './garage/GateTestRunner.js';
import { Hud } from './ui/Hud.js';
import { CrossSection } from './ui/CrossSection.js';
import { CONSTRAINTS as C } from './data/constraints.js';

/* ---------- renderer / kamera 2.5D ---------- */

const isMobile = matchMedia('(pointer:coarse)').matches || navigator.maxTouchPoints > 0;

const renderer = new THREE.WebGLRenderer({ antialias: !isMobile });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile ? 1.5 : 2));
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x141a24);

// [F0] ortograficzna kamera izometryczna + ograniczony orbit (perspektywa nie może
// "oszukać" pomiarów — dlatego 2.5D zamiast pełnego 3D)
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
camera.position.set(7, 4.5, 7);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.4, -0.8);
controls.enablePan = false;
controls.minPolarAngle = 0.85;
controls.maxPolarAngle = 1.35;
controls.minZoom = 0.7;
controls.maxZoom = 2.2;

function fitCamera() {
  let h = 4.2;
  const a = innerWidth / innerHeight;
  if (h * a < 6.5) h = 6.5 / a;           // portrait mobile: miej szerokość sceny
  camera.left = -h * a / 2; camera.right = h * a / 2;
  camera.top = h / 2; camera.bottom = -h / 2;
  camera.updateProjectionMatrix();
}
fitCamera();

scene.add(new THREE.HemisphereLight(0x99aabb, 0x223344, 0.9));
const sun = new THREE.DirectionalLight(0xffeecc, 1.5);
sun.position.set(6, 10, 8);
scene.add(sun);

/* ---------- obiekty ---------- */

const audio = new Audio();
const workshop = new WorkshopScene(scene);
const P = workshop.parts;
const cross = new CrossSection();
const drag = new DragSystem(camera, renderer.domElement, controls);
const testRunner = new GateTestRunner(P.gate, audio);
const minigame = new Minigame(audio);

/* ---------- stan gry ---------- */

const STEPS = [
  { id: 'bracket',   title: '1/8 · Wspornik przedni',
    hint: 'Przeciągnij wspornik na nadproże: dokładnie na pionowej kresce (±10 mm), min. 5 mm NAD przecięciem kresek.' },
  { id: 'drill',     title: '2/8 · Wiercenie',
    hint: 'Mini-gra wiertarki: trzymaj przycisk i utrzymuj ciśnienie w zielonej strefie. Przekroczenie = pęka ściana.' },
  { id: 'rail',      title: '3/8 · Prowadnica',
    hint: 'Podnieś prowadnicę pod sufit. Prześwit dla ruchu bramy min. 35 mm — patrz przekrój.' },
  { id: 'bend',      title: '4/8 · Zginanie wsporników',
    hint: 'Ustaw punkt zgięcia suwakiem zgodnie ze zmierzonym wymiarem (±5 mm). Błąd = część do kosza.' },
  { id: 'connector', title: '5/8 · Łącznik na bramie',
    hint: 'Przeciągnij łącznik: strefa 20–40 cm pod wspornikiem i kąt ramienia ≤30°. Obróć go — linka zwalniająca po LEWEJ.' },
  { id: 'drive',     title: '6/8 · Napęd',
    hint: 'Dosuń napęd do sprzęgła z tyłu prowadnicy. Pochylenie wałka przy wkładaniu: 15–20° (suwak).' },
  { id: 'tension',   title: '7/8 · Napinacz łańcucha',
    hint: 'Napnij łańcuch, aż środek pętli wypadnie pośrodku przekroju. Zbyt mocno = pęknięte sprzęgło!' },
  { id: 'test',      title: '8/8 · Test 50 mm / 20 kg',
    hint: 'Klocek testowy leży pod bramą. Uruchom TEST — system musi wykryć przeszkodę i wycofać bramę.' },
];

const hud = new Hud(STEPS.length);

const state = {
  step: 0,
  budget: 600,
  spares: 2,
  t0: performance.now(),
  bracketPos: null,
  railY: null,
  measured: 0,
  connectorY: null,
  side: 1,          // +1 prawa (źle), −1 lewa (zgodnie z instrukcją)
  driveZ: null,
  tilt: 0,
  finished: false,
};

/* ---------- pomocnicze ---------- */

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const btnRotate = document.getElementById('btn-rotate');
const btnTest = document.getElementById('btn-test');
const btnReset = document.getElementById('btn-reset');

function penalty(n, msg) {
  state.budget = Math.max(0, state.budget - n);
  hud.budget(state.budget);
  audio.fail();
  hud.flash(msg + `\n(−${n} N)`, 2400);
  if (state.budget <= 0) {
    hud.flash('BUDŻET 600 N WYCZERPANY\n— restart montażu —', 4000);
    setTimeout(() => location.reload(), 2500);
  }
}

// lerp-snap (odpowiednik SnapSystem z planu)
const snaps = [];
function snapTo(mesh, target) {
  snaps.push({ mesh, from: mesh.position.clone(), to: target, t: 0 });
}

/* ---------- dragi: rejestracja części ---------- */

// [F1] wspornik — płaszczyzna frontu nadproża (z=0.26)
drag.add(P.bracket, new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.26), (p) => {
  P.bracket.position.set(clamp(p.x, -2.8, 2.8), clamp(p.y, 2.3, 2.85), 0.17);
  state.bracketPos = { x: P.bracket.position.x, y: P.bracket.position.y };
  cross.bracket(state.bracketPos);
});

// [F0] prowadnica — drag w pionie na płaszczyźnie bocznej (z=-1.3)
drag.add(P.rail, new THREE.Plane(new THREE.Vector3(0, 0, 1), 1.3), (p) => {
  P.rail.position.y = clamp(p.y, 0.2, 2.85);
  state.railY = P.rail.position.y;
  cross.rail(state.railY);
});

// [F2] łącznik — płaszczyzna frontu bramy (z=0.16), drag w pionie
drag.add(P.connector, new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.16), (p) => {
  P.connector.position.set(0, clamp(p.y, 1.2, 2.38), 0.16);
  state.connectorY = P.connector.position.y;
  updateArm();
  cross.connector(state.connectorY);
});

// [F2] napęd — pozioma płaszczyzna wzdłuż prowadnicy (y=2.42), drag w głębokości
drag.add(P.drive, new THREE.Plane(new THREE.Vector3(0, 1, 0), -2.42), (p) => {
  P.drive.position.z = clamp(p.z, -2.4, 0.1);
  state.driveZ = P.drive.position.z;
});

drag.setAllEnabled(false);

/* ---------- walidatory (ConstraintSolver) ---------- */

function validateBracket(p) {
  const errs = [];
  if (Math.abs(p.x) > C.centerTolerance)
    errs.push(`odchyłka od środka bramy: ${(Math.abs(p.x) * 1000).toFixed(0)} mm (max 10 mm)`);
  if (p.y - 0.1 < C.markY + C.bracketAboveMark)
    errs.push(`wspornik PONIŻEJ przecięcia kresek (min 5 mm nad kreską)`);
  return { ok: errs.length === 0, errs };
}

function validateRail(y) {
  const gap = y - 0.07 - 2.4;
  if (gap < C.minClearance)
    return { ok: false, errs: [`prześwit ${(gap * 1000).toFixed(0)} mm < 35 mm — brama się zablokuje`] };
  if (y < C.railSnapLo || y > C.railSnapHi)
    return { ok: false, errs: ['wsporniki nie sięgają sufitu — prowadnica za nisko do dokręcenia'] };
  return { ok: true, errs: [] };
}

function validateConnector(y) {
  const errs = [];
  if (y > C.bracketBottomY - C.bandTop || y < C.bracketBottomY - C.bandBottom)
    errs.push(`poza strefą 20–40 cm pod dolną krawędzią wspornika (jest: ${((C.bracketBottomY - y) * 100).toFixed(0)} cm)`);
  const ang = Math.atan2(C.trolley.y - y, C.trolley.z - 0.16) * 180 / Math.PI;
  if (ang > C.armAngleMax)
    errs.push(`kąt ramienia ${ang.toFixed(1)}° > 30° — łącznik za nisko`);
  return { ok: errs.length === 0, errs };
}

function validateDrive() {
  const errs = [];
  if (Math.abs(state.driveZ - C.driveSocketZ) > 0.12)
    errs.push('napęd nie jest w sprzęgle (dosuń do tyłu prowadnicy)');
  if (state.tilt < C.tiltMin || state.tilt > C.tiltMax)
    errs.push(`pochylenie ${state.tilt}° — ma być 15–20°`);
  return { ok: errs.length === 0, errs };
}

/* ---------- ramię (wizualnie łączy sanki z łącznikiem) ---------- */

function updateArm() {
  if (!P.arm.visible) return;
  const a = new THREE.Vector3(0, C.trolley.y, C.trolley.z);
  const b = P.connector.position.clone();
  const mid = a.clone().add(b).multiplyScalar(0.5);
  P.arm.position.copy(mid);
  const dir = b.clone().sub(a);
  const len = dir.length();
  P.arm.scale.set(1, len, 1);
  P.arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
}

/* ---------- przepływ kroków ---------- */

function setStep(i) {
  state.step = i;
  hud.setStep(i, STEPS[i]);
  drag.setAllEnabled(false);
  btnRotate.disabled = true;
  btnTest.disabled = true;
  const id = STEPS[i].id;

  if (id === 'bracket') {
    drag.setEnabled(P.bracket, true);
    cross.bracket(state.bracketPos);
  }
  if (id === 'drill') {
    minigame.start('drill', {
      onDone: () => {
        minigame.hide();
        P.screws.forEach(s => (s.visible = true));
        audio.snap();
        next();
      },
      onError: (m) => { penalty(50, m); audio.crack(); },
    });
  }
  if (id === 'rail') {
    drag.setEnabled(P.rail, true);
    cross.rail(state.railY);
  }
  if (id === 'bend') {
    minigame.start('bend', {
      target: state.measured,
      onDoneBtn: () => {
        const v = parseFloat(minigame.tilt.value);
        if (Math.abs(v - state.measured) <= 0.5) {
          minigame.hide();
          P.rearBrackets.forEach(rb => (rb.visible = true));
          audio.snap();
          next();
        } else {
          if (state.spares > 0) {
            state.spares--;
            hud.parts(state.spares);
            penalty(100, `punkt zgięcia ${v.toFixed(1)} cm ≠ ${state.measured.toFixed(1)} cm — wspornik do kosza`);
          } else {
            penalty(150, `punkt zgięcia ${v.toFixed(1)} cm ≠ ${state.measured.toFixed(1)} cm — brak części!`);
          }
        }
      },
    });
  }
  if (id === 'connector') {
    P.connector.visible = true;
    P.trolley.visible = true;
    P.arm.visible = true;
    drag.setEnabled(P.connector, true);
    btnRotate.disabled = false;
    cross.connector(state.connectorY);
  }
  if (id === 'drive') {
    P.drive.visible = true;
    drag.setEnabled(P.drive, true);
    // suwak pochylenia (współdzielony z mini-grami)
    minigame.box.style.display = 'flex';
    minigame.mode = 'driveTilt';
    minigame.o = {};
    minigame.info.textContent = 'Pochylenie modułu napędu: 15–20° (suwak) + dosuń do sprzęgła';
    minigame.tilt.style.display = '';
    minigame.tilt.min = 0; minigame.tilt.max = 45; minigame.tilt.value = 0;
    minigame.zone.style.left = '0%'; minigame.zone.style.width = '0%';
    minigame.fill.style.width = '0%';
  }
  if (id === 'tension') {
    P.chain.visible = true;
    P.nut.visible = true;
    minigame.start('tension', {
      onUpdate: (r) => {
        cross.tension(r);
        P.nut.position.y = 2.53 - r * 0.04;
      },
      onDone: () => {
        minigame.hide();
        audio.chime();
        hud.flash('ŁAŃCUCH NAPRĘŻONY — środek pętli w normie ✓', 2000);
        next();
      },
      onError: (m) => { penalty(150, m); audio.crack(); },
    });
  }
  if (id === 'test') {
    P.block.visible = true;
    P.bag.visible = true;
    btnTest.disabled = false;
    cross.test('gotowy do testu');
  }
}

function next() {
  if (state.step + 1 >= STEPS.length) return;
  hud.flash('✓ ' + STEPS[state.step].title.split('· ')[1], 1200);
  setStep(state.step + 1);
}

/* ---------- drop = walidacja ---------- */

drag.onDrop = () => {
  const id = STEPS[state.step].id;
  if (id === 'bracket') {
    const r = validateBracket(state.bracketPos);
    if (r.ok) { snapTo(P.bracket, new THREE.Vector3(0, 2.62, 0.17)); audio.snap(); next(); }
    else penalty(20, r.errs.join('\n'));
  }
  if (id === 'rail') {
    const r = validateRail(state.railY);
    if (r.ok) {
      snapTo(P.rail, new THREE.Vector3(0, 2.66, -1.3));
      state.measured = parseFloat(((2.9 - 2.66) * 100).toFixed(1)); // 24.0 cm
      audio.snap();
      hud.flash(`Prowadnica zamocowana.\nZmierzono: ${state.measured.toFixed(1)} cm do sufitu`, 2400);
      next();
    } else penalty(20, r.errs.join('\n'));
  }
  if (id === 'connector') {
    const r = validateConnector(state.connectorY);
    if (r.ok) { audio.snap(); next(); }
    else penalty(20, r.errs.join('\n'));
  }
  if (id === 'drive') {
    state.tilt = parseFloat(minigame.tilt.value);
    const r = validateDrive();
    if (r.ok) {
      P.drive.rotation.x = -state.tilt * Math.PI / 180;
      snapTo(P.drive, new THREE.Vector3(0, 2.42, C.driveSocketZ));
      audio.snap();
      minigame.hide();
      next();
    } else penalty(20, r.errs.join('\n'));
  }
};

/* ---------- obrót łącznika (linka zwalniająca po lewej) ---------- */

btnRotate.addEventListener('click', () => {
  state.side *= -1;
  P.connectorEar.position.x = state.side * 0.12;
  audio.click();
  hud.flash(state.side === -1
    ? 'Element przelotowy linki: LEWA strona ✓ (zgodnie z instrukcją)'
    : 'Element przelotowy linki: PRAWA strona — ma być LEWA!', 1800);
});

/* ---------- test końcowy ---------- */

btnTest.addEventListener('click', () => {
  if (state.finished || testRunner.active) return;
  if (state.side !== -1) {
    penalty(80, 'TEST ODRZUCONY: element przelotowy linki zwalniającej po PRAWEJ stronie\n(ma być po LEWEJ). Obróć łącznik i testuj ponownie.');
    return;
  }
  cross.test('test w toku…', true);
  hud.flash('TEST: otwieranie…', 1600);
  testRunner.start(() => {
    const time = ((performance.now() - state.t0) / 1000).toFixed(0);
    const best = Math.max(state.budget, +(localStorage.getItem('monter600n-best') || 0));
    localStorage.setItem('monter600n-best', best);
    audio.chime();
    state.finished = true;
    cross.test('50 mm: WYKRYTO ✓ · 20 kg: STOP ✓', true);
    hud.flash(
      `MONTAŻ ZALICZONY ✓\n` +
      `Test 50 mm: przeszkoda wykryta, rewers ✓\n` +
      `Test 20 kg: zatrzymanie ✓\n` +
      `Budżet: ${state.budget} N · Czas: ${time} s\n` +
      `Rekord: ${best} N`, 8000);
  });
});

/* ---------- reset kroku ---------- */

function resetStep() {
  const id = STEPS[state.step].id;
  if (id === 'bracket') P.bracket.position.set(2.6, 2.62, 0.17);
  if (id === 'rail') { P.rail.position.set(0, 0.2, -1.3); state.railY = null; cross.rail(null); }
  if (id === 'connector') { P.connector.position.set(0, 1.6, 0.16); state.connectorY = null; updateArm(); }
  if (id === 'drive') P.drive.position.set(0, 2.42, -0.2);
  audio.click();
}
btnReset.addEventListener('click', resetStep);
addEventListener('keydown', (e) => { if (e.code === 'KeyR') resetStep(); });

/* ---------- pętla ---------- */

function update(dt) {
  minigame.update(dt);
  testRunner.update(dt);
  for (let i = snaps.length - 1; i >= 0; i--) {
    const s = snaps[i];
    s.t = Math.min(1, s.t + dt * 4);
    s.mesh.position.lerpVectors(s.from, s.to, s.t);
    if (s.t >= 1) snaps.splice(i, 1);
  }
  updateArm();
}

function render() {
  controls.update();
  renderer.render(scene, camera);
}

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  fitCamera();
});

addEventListener('pointerdown', () => audio.init(), { once: true });
addEventListener('keydown', () => audio.init(), { once: true });

setStep(0);
hud.budget(state.budget);
hud.parts(state.spares);
new GameLoop(update, render);
```

---

## Uruchomienie i kontrolny przebieg

1. `npx serve .` (z katalogu `monter600n/`) → otwórz podany URL.
2. PC: drag lewym przyciskiem na części, orbit na pustym tle, `R` = reset kroku.
3. Mobile: drag jednym palcem po części, orbit dwoma palcami, mini-gry przyciskami
   przytrzymywanymi (pointer events + `touch-action:none`).
4. Kontrolny przebieg (żeby zobaczyć finał): wspornik na kreskę (±1 cm, nad przecięciem)
   → wiertarka (~2 s w zielonej strefie) → prowadnica pod sam sufit → zaginacz 24,0 cm
   → łącznik wysokość ~2,26–2,32 m + przycisk OBRÓĆ (ucho na lewo) → napęd dosunięty
   do tyłu + pochylenie 15–20° → napinacz do środka → TEST.

## Uwagi implementacyjne

**Faza 0 (pion):** wystarczą `GameLoop`, `WorkshopScene` (sufit + brama + prowadnica),
`DragSystem`, `CrossSection.rail()` i krok `rail` z walidatorem 35 mm + budżet w HUD.
To jest dokładnie "aha!" z planu: snap działa tylko, gdy constraint spełniony.

**Faza 1:** kroki 1–4 + `Minigames` (drill, bend), kary w N, limit części, kropki postępu.

**Faza 2:** kroki 5–8 + `GateTestRunner` (otwarcie, kontakt z klockiem 50 mm, rewers —
wiernie rozdz. 13 instrukcji), dźwięki, raport końcowy i rekord w localStorage.

**Celowe uproszczenia vs plan:** paleta części zamieniona na części startujące w scenie
(ta sama mechanika, mniejszy koszt UX); `SnapSystem` zwinięty do lerp-snap w `main.js`;
widok przekroju to canvas 2D zamiast drugiego render-targetu (tańsze i bardziej
"klimatyczne" — jak rysunki z PDF); suwak pochylenia napędu współdzielony z mini-grami.

**Strojenie:** wszystko siedzi w `data/constraints.js` — tryb "easy" = poszerzyć
`centerTolerance`/`railSnapLo/Hi`, tryb "instalator" = wartości nominalne z instrukcji.
