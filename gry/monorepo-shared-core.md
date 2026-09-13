# MONOREPO TRYPTYKU — shared core + 3 gry na jednej stronie

Dokument migracyjny: jak z trzech osobnych codebase'ów (Gate Rush, Monter 600 N,
Tryb nauki) złożyć jeden projekt ze współdzielonym rdzeniem (`shared/`), trzema
sekcjami na stronie i leniwym ładowaniem. Wszystkie ścieżki odnoszą się do kodu
Faz 0–2 z poprzednich plików.

---

## 1. Docelowa struktura

```
faac-games/
├── index.html                  ← strona główna: 3 sekcje z grami (lazy load)
├── js/
│   └── loader.js               ← IntersectionObserver + dynamic import()
├── shared/                     ← SHARED CORE (jeden egzemplarz wszystkiego wspólnego)
│   ├── core/
│   │   ├── GameLoop.js         ← identyczny plik, jaki był w każdej grze
│   │   ├── device.js           ← detekcja mobile, pixelRatio, make-up renderer/fitos kamery
│   │   └── AudioBase.js        ← baza WebAudio (init po geście, voice(), blip, crack, motor)
│   ├── scene/
│   │   ├── GateRig.js          ← brama segmentowa na prowadnicy + szyny + lampa + fotokomórki
│   │   └── GarageEnvironment.js ← nadproże/sufit/ściany/podłoga (parametryzowane)
│   └── ui/
│       └── FlashOverlay.js     ← wielki komunikat "flash" (wspólny przez 3 HUD-y)
├── games/
│   ├── gate-rush/
│   │   ├── index.html          ← wejście samodzielne (działa bez strony głównej)
│   │   └── js/
│   │       ├── main.js         ← export start(container) / stop()
│   │       ├── Sfx.js          ← extends AudioBase (silnik, thud, beep…)
│   │       ├── InputManager.js │ VehicleController.js │ VehicleView.js
│   │       ├── GateSystem.js   ← FSM cyklu bramy (logika gry — NIE współdzielona)
│   │       ├── ChaseCamera.js
│   │       └── Hud.js          ← używa FlashOverlay z shared
│   ├── monter/                 (dawniej monter600n)
│   │   ├── index.html
│   │   └── js/
│   │       ├── main.js         ← export start(container) / stop()
│   │       ├── Sfx.js          ← extends AudioBase (ratchet, snap, drill…)
│   │       ├── constraints.js  (dawniej data/constraints.js)
│   │       ├── WorkshopScene.js │ DragSystem.js │ Minigames.js
│   │       ├── GateTestRunner.js
│   │       ├── Hud.js │ CrossSection.js
│   └── tryb-nauki/
│       ├── index.html
│       └── js/
│           ├── main.js         ← export start(container) / stop()
│           ├── Sfx.js          ← extends AudioBase (press, perfect, error…)
│           ├── LearnCycle.js   (dawniej gate/GateSystem.js — logika procedury nauki)
│           ├── BoardPanel.js │ Simulator.js
│           └── Hud.js
└── vite.config.js              ← opcjonalnie (bez buildu też działa — patrz §7)
```

**Zasada podziału:** w `shared/` ląduje tylko to, co jest identyczne lub
parametryzowalne między grami. Logika rozgrywki (FSM bramy Gate Rusha, procedura
nauki, constrainty Montera) zostaje w `games/` — bo tam gry się różnią.

---

## 2. Tabela migracji — co dokąd się przenosi

### Gate Rush

| Stary plik | Los | Uwagi |
|---|---|---|
| `js/core/GameLoop.js` | **usuwamy** → `shared/core/GameLoop.js` | identyczny plik, zero zmian treści |
| `js/core/InputManager.js` | `games/gate-rush/js/InputManager.js` | bez zmian |
| `js/core/AudioManager.js` | `games/gate-rush/js/Sfx.js` | refaktor: extends `AudioBase` (§4.3) |
| `js/vehicle/VehicleController.js` | `games/gate-rush/js/VehicleController.js` | bez zmian |
| `js/vehicle/VehicleView.js` | `games/gate-rush/js/VehicleView.js` | bez zmian |
| `js/gate/GateSystem.js` | `games/gate-rush/js/GateSystem.js` | bez zmian (logika gry) |
| `js/gate/GateView.js` | **usuwamy** → `shared/scene/GateRig.js` | opcje: `gapMeasure:true, photocells:true` (§4.4) |
| `js/level/ChaseCamera.js` | `games/gate-rush/js/ChaseCamera.js` | bez zmian |
| `js/ui/Hud.js` | `games/gate-rush/js/Hud.js` | flash → `FlashOverlay` (§4.6) |
| `js/main.js` | `games/gate-rush/js/main.js` | refaktor na `start(container)` (§5) |

### Monter 600 N (dawniej monter600n)

| Stary plik | Los | Uwagi |
|---|---|---|
| `js/core/GameLoop.js` | **usuwamy** → shared | |
| `js/core/AudioManager.js` | `games/monter/js/Sfx.js` | extends `AudioBase` |
| `js/data/constraints.js` | `games/monter/js/constraints.js` | zmiana tylko importów |
| `js/workshop/WorkshopScene.js` | `games/monter/js/WorkshopScene.js` | zostaje — geometria warsztatu jest gameplay'em (płaszczyzny draga); opcjonalnie może podmienić ściany na `GarageEnvironment` |
| `js/workshop/DragSystem.js` | `games/monter/js/DragSystem.js` | bez zmian — generyczny, nadaje się do shared przy 4. grze |
| `js/workshop/Minigames.js` | `games/monter/js/Minigames.js` | bez zmian |
| `js/garage/GateTestRunner.js` | `games/monter/js/GateTestRunner.js` | bez zmian |
| `js/ui/Hud.js` | `games/monter/js/Hud.js` | flash → `FlashOverlay` |
| `js/ui/CrossSection.js` | `games/monter/js/CrossSection.js` | bez zmian |
| `js/main.js` | `games/monter/js/main.js` | refaktor na `start(container)` |

### Tryb nauki

| Stary plik | Los | Uwagi |
|---|---|---|
| `js/core/GameLoop.js` | **usuwamy** → shared | |
| `js/core/AudioManager.js` | `games/tryb-nauki/js/Sfx.js` | extends `AudioBase` |
| `js/gate/GateSystem.js` | `games/tryb-nauki/js/LearnCycle.js` | bez zmian (logika procedury) |
| `js/gate/GateView.js` | **usuwamy** → `shared/scene/GateRig.js` | opcje: `environment:true` |
| `js/board/BoardPanel.js` | `games/tryb-nauki/js/BoardPanel.js` | bez zmian |
| `js/sim/Simulator.js` | `games/tryb-nauki/js/Simulator.js` | bez zmian |
| `js/ui/Hud.js` | `games/tryb-nauki/js/Hud.js` | flash → `FlashOverlay` |
| `js/main.js` | `games/tryb-nauki/js/main.js` | refaktor na `start(container)` |

Bilans: ~6 plików znika z duplexu/konfliktu wersji (GameLoop ×3, brama ×2,
AudioBase ×3 scalone w rodzinę), a przy 4. grze `DragSystem` i `Minigames`
byłyby gotowymi kandydatami do awansu do `shared/`.

---

## 3. Zmiany w importach (wszystkie gry)

Każdy plik w `games/*/js/` zamienia importy modułów wspólnych:

```js
// przed (Gate Rush, main.js)
import { GameLoop } from './core/GameLoop.js';
import { Audio } from './core/AudioManager.js';
import { GateView } from './gate/GateView.js';

// po
import { GameLoop } from 'shared/core/GameLoop.js';
import { Sfx } from './Sfx.js';
import { GateRig } from 'shared/scene/GateRig.js';
```

Alias `shared/` działa na dwa sposoby:

**A) bez buildu (import map w HTML każdej strony):**

```html
<script type="importmap">
{
  "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/",
    "shared/": "/shared/"
  }
}
</script>
```

Uwaga: mapowanie `"shared/"` musi być bezwzględne (`/shared/`) — import mapy
rozwiązują się względem strony, a gry leżą o poziom głębiej niż katalog `shared/`.

**B) z Vite (vite.config.js):**

```js
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: { alias: { shared: path.resolve(__dirname, 'shared') } },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        rush: path.resolve(__dirname, 'games/gate-rush/index.html'),
        monter: path.resolve(__dirname, 'games/monter/index.html'),
        nauka: path.resolve(__dirname, 'games/tryb-nauki/index.html'),
      },
    },
  },
});
```

---

## 4. Kod plików shared core

### 4.1 `shared/core/GameLoop.js`

Dokładnie ten sam plik, jaki był we wszystkich trzech grach (bez zmian):

```js
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

### 4.2 `shared/core/device.js`

Wzorzec `isMobile` + pixelRatio + fit kamery powtarzał się we wszystkich trzech
`main.js` — tu trafia w jedno miejsce:

```js
import * as THREE from 'three';

export const isMobile =
  matchMedia('(pointer:coarse)').matches || navigator.maxTouchPoints > 0;

export function makeRenderer() {
  const r = new THREE.WebGLRenderer({ antialias: !isMobile });
  r.setPixelRatio(Math.min(devicePixelRatio, isMobile ? 1.5 : 2));
  return r;
}

// perspektywa: w portrait potrzebny szerszy fov (wzorzec z Trybu nauki)
export function fitPerspective(camera, aspect, fovLandscape = 58, fovPortrait = 70) {
  camera.aspect = aspect;
  camera.fov = aspect < 1 ? fovPortrait : fovLandscape;
  camera.updateProjectionMatrix();
}

// ortografia: gwarantuj minimalną szerokość sceny (wzorzec z Montera)
export function fitOrtho(camera, aspect, minHeight = 4.2, minWidth = 6.5) {
  let h = minHeight;
  if (h * aspect < minWidth) h = minWidth / aspect;
  camera.left = -h * aspect / 2; camera.right = h * aspect / 2;
  camera.top = h / 2; camera.bottom = -h / 2;
  camera.updateProjectionMatrix();
}
```

### 4.3 `shared/core/AudioBase.js`

Baza z tego, co było identyczne w trzech AudioManagerach: init po geście,
master gain, szum silnika (motor), `_blip`, `crack` (szum z zanikiem) oraz
helper `voice()` do budowy stałych oscylatorów przez podklasy:

```js
export class AudioBase {
  constructor() { this.ctx = null; }

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.3;
    this.master.connect(this.ctx.destination);
    this.hum = this.voice('triangle', 55);
  }
  get ready() { return !!this.ctx; }

  // stały głos (oscylator + gain), np. silnik bramy czy silnik autka
  voice(type, freq) {
    const o = this.ctx.createOscillator();
    o.type = type; o.frequency.value = freq;
    const g = this.ctx.createGain(); g.gain.value = 0;
    o.connect(g).connect(this.master);
    o.start();
    return { osc: o, gain: g };
  }

  motor(on) { if (this.ctx) this.hum.gain.gain.value = on ? 0.13 : 0; }

  blip(freq, dur, vol, type = 'sine') {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    o.connect(g).connect(this.master);
    o.start(); o.stop(this.ctx.currentTime + dur);
  }

  crack() {
    if (!this.ctx) return;
    const dur = 0.3, sr = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, sr * dur, sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const g = this.ctx.createGain(); g.gain.value = 0.5;
    src.connect(g).connect(this.master); src.start();
  }

  chime() { [660, 880, 1100].forEach((f, i) =>
    setTimeout(() => this.blip(f, 0.25, 0.3), i * 140)); }
}
```

Przykładowa podklasa — `games/gate-rush/js/Sfx.js` (zamiana starego AudioManagera):

```js
import { AudioBase } from 'shared/core/AudioBase.js';

export class Sfx extends AudioBase {
  init() {
    super.init();
    this.engineVoice = this.voice('sawtooth', 45);   // silnik RC
  }
  engine(speedNorm) {
    if (!this.ctx) return;
    this.engineVoice.osc.frequency.value = 45 + speedNorm * 240;
    this.engineVoice.gain.gain.value = 0.04 + speedNorm * 0.12;
  }
  gateHum(on) { this.motor(on); }
  click() { this.blip(1400, 0.06, 0.25); }
  thud()  { this.blip(80, 0.3, 0.7, 'square'); }
  beep()  { this.blip(880, 0.15, 0.3); }
}
```

Analogicznie `games/monter/js/Sfx.js` (ratchet, snap, fail, thud, drill…) i
`games/tryb-nauki/js/Sfx.js` (press, perfect, good, error) — każde ~15 linii
zamiast ~50 i pełnej kopii infrastruktury.

### 4.4 `shared/scene/GateRig.js`

Scala dwa niemal identyczne `GateView` (Gate Rush + Tryb nauki). API zunifikowane:
`sync(t, dt, {moving, blink, beamBlocked})`, własność `gapY` opcjonalna
(Monter nie potrzebuje, Gate Rush tak — mechanika anty-przygniecenia):

```js
import * as THREE from 'three';

export class GateRig {
  constructor(scene, opts = {}) {
    const o = Object.assign({
      width: 6,
      doorHeight: 2.4,
      segs: 6,
      // prowadnica: pion → łuk → bieg pod sufitem (z ujemnym Z = wnętrze garażu)
      rail: [[0, 0, 0], [0, 2.6, 0], [0, 2.9, -1.0], [0, 2.9, -3.2]],
      rails: true,          // szyny po bokach
      lamp: true,           // lampa ostrzegawcza
      photocells: true,     // słupki + wiązka
      gapMeasure: false,    // wystawia this.gapY (prześwit pod dolną krawędzią)
      segColor: 0x8fa3b8,
    }, opts);
    this.o = o;

    this.doorLen = o.doorHeight;
    this.segs = o.segs;
    this.segH = o.doorHeight / o.segs;

    const pts = o.rail.map((p) => new THREE.Vector3(...p));
    this.curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.4);
    const N = 256;
    this.samples = this.curve.getSpacedPoints(N);      // równomierne wzdłuż łuku
    this.segLen = this.curve.getLength() / N;
    this.totalLen = this.curve.getLength();
    this.travel = this.totalLen - this.doorLen - 0.2;

    // segmenty bramy
    const segMat = new THREE.MeshStandardMaterial({
      color: o.segColor, roughness: 0.55, metalness: 0.3 });
    this.segments = [];
    for (let k = 0; k < this.segs; k++) {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(o.width, this.segH * 0.97, 0.07), segMat);
      scene.add(m);
      this.segments.push(m);
    }

    if (o.rails) {
      const railGeo = new THREE.TubeGeometry(this.curve, 48, 0.045, 8);
      const railMat = new THREE.MeshStandardMaterial({ color: 0x2b323b, roughness: 0.6 });
      for (const x of [-o.width / 2 - 0.08, o.width / 2 + 0.08]) {
        const r = new THREE.Mesh(railGeo, railMat);
        r.position.x = x; scene.add(r);
      }
    }

    if (o.lamp) {
      this.lampMat = new THREE.MeshStandardMaterial({
        color: 0x330606, emissive: 0xff2211, emissiveIntensity: 0 });
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.2), this.lampMat);
      lamp.position.set(o.width / 2 - 0.6, 3.35, 0.35);
      scene.add(lamp);
    }

    if (o.photocells) {
      const postMat = new THREE.MeshStandardMaterial({ color: 0x22262c, roughness: 0.7 });
      for (const x of [-o.width / 2 - 0.25, o.width / 2 + 0.25]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.3, 0.12), postMat);
        post.position.set(x, 0.15, 0.7); scene.add(post);
      }
      this.beamMat = new THREE.MeshStandardMaterial({
        color: 0x003318, emissive: 0x22ff77, emissiveIntensity: 1.0 });
      this.beam = new THREE.Mesh(
        new THREE.BoxGeometry(o.width + 0.5, 0.025, 0.025), this.beamMat);
      this.beam.position.set(0, 0.18, 0.7); scene.add(this.beam);
    }

    this._time = 0;
    this.gapY = 0;
  }

  pathPoint(s) {
    s = THREE.MathUtils.clamp(s, 0, this.totalLen - 1e-3);
    const i = Math.min(Math.floor(s / this.segLen), this.samples.length - 2);
    const f = (s - i * this.segLen) / this.segLen;
    return new THREE.Vector3().lerpVectors(this.samples[i], this.samples[i + 1], f);
  }

  sync(t, dt, s = {}) {
    const { moving = false, blink = false, beamBlocked = false } = s;
    this._time += dt;
    const d = t * this.travel;

    if (this.o.gapMeasure) this.gapY = this.pathPoint(d).y;

    this.segments.forEach((seg, k) => {
      const sPos = d + (k + 0.5) * this.segH;
      const p = this.pathPoint(sPos);
      const p2 = this.pathPoint(sPos + 0.05);
      const tan = p2.clone().sub(p).normalize();
      const x = new THREE.Vector3(1, 0, 0);
      const z = new THREE.Vector3().crossVectors(x, tan).normalize();
      seg.position.copy(p);
      seg.matrix.makeBasis(x, tan, z).setPosition(p);
    });

    if (this.lampMat) {
      this.lampMat.emissiveIntensity = moving
        ? (blink ? ((this._time * 4) % 1 < 0.5 ? 3.0 : 0.15) : 2.2)
        : 0;
    }
    if (this.beamMat) {
      this.beamMat.emissiveIntensity = beamBlocked
        ? 2.5 + Math.sin(this._time * 20) * 1.5 : 1.0;
    }
  }
}
```

Użycie w grach (zamiast starych `GateView`):

```js
// Gate Rush — main.js
const rig = new GateRig(scene, { gapMeasure: true });   // gapY do anty-przygniecenia
// w render():
rig.sync(gate.t, dt, { moving: gate.lampOn, blink: gate.lampBlink, beamBlocked });
const gapY = rig.gapY;   // zamiast gate.gapY ustawianego przez widok

// Tryb nauki — main.js
const rig = new GateRig(scene, {});
buildGarage(scene);       // środowisko z shared/scene/GarageEnvironment.js
rig.sync(t, dt, { moving, beamBlocked: anim.beam });
```

### 4.5 `shared/scene/GarageEnvironment.js`

Środowisko garażu z Trybu nauki (nadproże, sufit, ściany, podłoga) — parametryzowane:

```js
import * as THREE from 'three';

export function buildGarage(scene, opts = {}) {
  const o = Object.assign({
    width: 9, depth: 4.2, wallX: 4.5,
    lintel: { w: 9, h: 0.5, d: 0.5, y: 2.65, z: 0 },
    ceiling: { y: 3.0, d: 3.6, z: -1.8 },
    floorColor: 0x20252c,
  }, opts);

  const wall = new THREE.MeshStandardMaterial({ color: 0x2c333d, roughness: 0.9 });
  const mk = (w, h, d, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wall);
    m.position.set(x, y, z); scene.add(m); return m;
  };
  mk(o.lintel.w, o.lintel.h, o.lintel.d, 0, o.lintel.y, o.lintel.z);
  mk(o.width, 0.2, o.ceiling.d, 0, o.ceiling.y, o.ceiling.z);
  mk(1, 3.4, o.depth, -o.wallX, 1.7, -2.0);
  mk(1, 3.4, o.depth, o.wallX, 1.7, -2.0);

  const floor = new THREE.Mesh(new THREE.BoxGeometry(12, 0.1, 10),
    new THREE.MeshStandardMaterial({ color: o.floorColor, roughness: 0.95 }));
  floor.position.set(0, -0.05, 0.5);
  scene.add(floor);
}
```

Monter celowo zostaje przy własnym `WorkshopScene` — tam wymiary ścian są
sandboxem gameplay'u (płaszczyzny draga, wysokość nadproża pod constraint 5 mm),
więc hard-coded geometria jest częścią mechaniki, nie dekoracją.

### 4.6 `shared/ui/FlashOverlay.js`

Wielki środkowy komunikat — identyczny wzorzec we wszystkich trzech grach:

```js
export class FlashOverlay {
  constructor(el) {
    this.el = el || document.getElementById('big');
    if (!this.el) {
      this.el = document.createElement('div');
      this.el.id = 'big';
      document.body.appendChild(this.el);
    }
    this._t = 0;
  }
  flash(msg, ms = 1300) {
    this.el.textContent = msg;
    this.el.style.opacity = 1;
    clearTimeout(this._t);
    this._t = setTimeout(() => { this.el.style.opacity = 0; }, ms);
  }
}
```

Każdy per-gra `Hud` zachowuje swoje API i w środku robi
`this.flash = new FlashOverlay()` — zero zmian w kodzie wywołującym
`hud.flash(...)`.

---

## 5. Refaktor `main.js` → `start(container) / stop()`

Kluczowa zmiana dla osadzenia gier na stronie głównej: `main.js` przestaje być
skryptem top-level dotykającym globalnego `#app`, a staje się modułem z API.
Schemat na przykładzie Gate Rush:

```js
// games/gate-rush/js/main.js
import * as THREE from 'three';
import { GameLoop } from 'shared/core/GameLoop.js';
import { makeRenderer, fitPerspective } from 'shared/core/device.js';
import { Sfx } from './Sfx.js';
import { InputManager } from './InputManager.js';
import { Vehicle } from './VehicleController.js';
import { VehicleView } from './VehicleView.js';
import { GateSystem } from './GateSystem.js';
import { GateRig } from 'shared/scene/GateRig.js';
import { ChaseCamera } from './ChaseCamera.js';
import { Hud } from './Hud.js';

export function start(container) {
  // — wszystko, co było na top-level, z jednym zastąpieniem:
  const renderer = makeRenderer();
  container.appendChild(renderer.domElement);   // zamiast getElementById('app')

  const scene = new THREE.Scene();
  // ... reszta bez zmian ...

  const loop = new GameLoop(update, render);

  // porządek przy zamykaniu (np. przełączanie sekcji na mobile)
  return {
    stop() {
      loop.running = false;                     // patrz uwaga niżej
      renderer.dispose();
      container.removeChild(renderer.domElement);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointerdown', armAudio);
    },
  };
}
```

`GameLoop` wymaga drobnego rozszerzenia o flagę zatrzymania (4 linie):

```js
// shared/core/GameLoop.js — dodaj:
constructor(update, render) {
  this.running = true;
  // ...
  const tick = (now) => {
    if (!this.running) return;      // ← stop() przerywa pętlę
    // ...reszta bez zmian...
  };
}
```

Samodzielne `index.html` każdej gry woła start ręcznie (gra nadal działa solo):

```html
<script type="module">
  import { start } from './js/main.js';
  start(document.getElementById('app'));
</script>
```

To samo refaktoryzujesz w `games/monter/js/main.js` (uwaga: `DragSystem`
i `OrbitControls` wiszą na `renderer.domElement` — przy `stop()` wystarczy
`controls.dispose()`) oraz `games/tryb-nauki/js/main.js` (BoardPanel jest w DOM
tej strony — przy `stop()` schowaj `#board`).

---

## 6. Strona główna z trzema sekcjami + lazy loading

### `index.html` (root)

```html
<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>FAAC — automatyzacja bram</title>
<style>
  body { margin:0; font-family:system-ui, sans-serif; color:#e8ecf1;
    background:#0d1420; }
  section.game { min-height: 90vh; padding: 40px 16px; box-sizing:border-box; }
  section.game h2 { text-align:center; }
  .game-slot { position:relative; height: 70vh; border-radius:14px; overflow:hidden;
    background:#101825; }
  .placeholder { position:absolute; inset:0; display:flex; align-items:center;
    justify-content:center; color:#5a6b80; font-size:14px; }
</style>
<script type="importmap">
{
  "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/",
    "shared/": "/shared/"
  }
}
</script>
</head>
<body>

<section class="game" id="sec-rush" data-game="gate-rush">
  <h2>GATE RUSH — wjedź przed bramą</h2>
  <div class="game-slot"><div class="placeholder">gra załaduje się, gdy dotrzesz do tej sekcji…</div></div>
</section>

<section class="game" id="sec-monter" data-game="monter">
  <h2>MONTER: 600 N — złóż napęd</h2>
  <div class="game-slot"><div class="placeholder">gra załaduje się, gdy dotrzesz do tej sekcji…</div></div>
</section>

<section class="game" id="sec-nauka" data-game="tryb-nauki">
  <h2>TRYB NAUKI — zaprogramuj płytę E600</h2>
  <div class="game-slot"><div class="placeholder">gra załaduje się, gdy dotrzesz do tej sekcji…</div></div>
</section>

<script type="module" src="./js/loader.js"></script>
</body>
</html>
```

### `js/loader.js`

```js
// Lazy loading: gra startuje dopiero, gdy sekcja wejdzie w viewport
// (+200 px zapasu, żeby nie było "przeskoku" przy scrollu).
const io = new IntersectionObserver(async (entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    const sec = e.target;
    io.unobserve(sec);
    const slot = sec.querySelector('.game-slot');
    slot.querySelector('.placeholder')?.remove();
    try {
      const mod = await import(`../games/${sec.dataset.game}/js/main.js`);
      mod.start(slot);
    } catch (err) {
      slot.innerHTML = '<div class="placeholder">nie udało się załadować gry :(</div>';
      console.error(err);
    }
  }
}, { rootMargin: '200px' });

document.querySelectorAll('section.game').forEach((s) => io.observe(s));
```

Dlaczego to działa "za darmo" z Three.js: dynamiczny `import()` ładuje moduł
`three` raz — drugi i trzeci `import()` trafia do cache przeglądarki (bez buildu)
lub do wspólnego chunka (z Vite/Rollup), więc trzy gry kosztują jeden Three.js,
a nie trzy.

**Uwaga o HUD-ach w DOM:** Monter i Tryb nauki mają elementy HUD w swoim
`index.html` (`#minigame`, `#board`, `#cross`, `#card`…). Przy osadzaniu w sekcji
strony głównej trzeba je przenieść do `start(container)` — najprościej: gracz
otrzymuje kontener, a `start()` tworzy własne elementy HUD jako dzieci kontenera
(`container.insertAdjacentHTML('beforeend', HUD_TEMPLATE)`) zamiast polegać na
`getElementById` z dokumentu strony. To jedyna poważniejsza praca refaktorowa
w całej migracji — właściwie trzy bloki HTML do przeniesienia + zmiana
kwerend z `document` na `container`.

---

## 7. Dwie ścieżki wdrożenia

| | A: bez buildu (import map) | B: Vite |
|---|---|---|
| Uruchomienie | `npx serve .` | `npm run dev` / `npm run build` |
| Importy | `"shared/": "/shared/"` w import mapie każdej strony | alias `shared` w `vite.config.js` |
| Three.js | CDN (cache między grami) | npm, jeden chunk |
| Minifikacja/bundling | brak | tak |
| Zmiana struktury | zero | dodanie `vite.config.js` |
| Kiedy | szybki start, strona statyczna | produkcja, CI, większy ruch |

Rekomendacja: zacznij od **A** (migracja czysto katalogowa, nic więcej się nie
zmienia), a Vite dołóż później — refaktor `start(container)` z §5 jest wspólny
dla obu ścieżek i niczego nie psuje.

---

## 8. Kolejność migracji (checklista)

1. **Utwórz `shared/`** i przenieś `GameLoop.js` (identyczny plik ×3 → 1).
   W każdej z trzech gier: usuń lokalną kopię, popraw import, odpal grę.
   **Test:** wszystkie trzy gry działają jak przed.
2. **`device.js`**: dodaj moduł, w `main.js` każdej gry podmień `isMobile`/
   pixelRatio/fit kamery na helpery. **Test:** portrait na telefonie.
3. **`AudioBase.js` + `Sfx.js`**: przenieś infrastrukturę, zredukuj każdy
   AudioManager do podklasy z samymi dźwiękami. **Test:** audio po pierwszym
   geście w każdej grze.
4. **`GateRig.js`**: najpierw Gate Rush (`gapMeasure: true`; w kodzie kolizji
   `gate.gapY` → `rig.gapY`), potem Tryb nauki (+ `GarageEnvironment`).
   Monter zostaje przy `WorkshopScene`. **Test:** animacja bramy + wiązka
   fotokomórek w obu grach.
5. **`FlashOverlay.js`**: podmień metodę flash w trzech Hudach.
6. **Refaktor `start(container)`/`stop()`** wg §5 (+ rozszerzenie `GameLoop`
   o flagę `running`). **Test:** każda gra solo przez własny `index.html`
   oraz zamontowana w kontenerze strony głównej.
7. **Strona główna + `loader.js`**: trzy sekcje, IntersectionObserver, lazy load.
   **Test:** scroll na mobile — gra ładuje się raz, przy powrocie nie startuje
   ponownie (unobserve), po `stop()`/restarcie nie zostają zdublowane listenery.
8. (Opcjonalnie) **Vite** wg §7B.

---

## 9. Czego świadomie NIE współdzielimy (i dlaczego)

- **`GateSystem` (Gate Rush) vs `LearnCycle` (Tryb nauki)** — obie klasy dotyczą
  bramy, ale pierwsza to FSM cyklu automatycznego, druga to procedura nauki z
  oceną rytmiczną. Wspólny byłby interfejs `t`/`update(dt)` — ale to już
  czystość akademicka, koszt > zysk.
- **`WorkshopScene` (Monter)** — geometria jest constraintem gameplay'u.
- **HUD-y** — różnią się na poziomie API (czas/combo vs budżet/kroki vs karty);
  współdzielona jest tylko warstwa `FlashOverlay`.
- **`DragSystem` i `Minigames`** — dziś używane tylko przez Montera; awansują
  do `shared/` dopiero, gdy powstanie czwarta gra, która ich potrzebuje
  (zasada: do shared przenosi się drugi użytkownik, nie pierwszy).
