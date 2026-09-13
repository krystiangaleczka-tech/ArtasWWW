# GATE RUSH — kod Faz 0–2 (PC + mobile)

Kompletna, działająca implementacja trzech pierwszych faz z planu. Kod jest jednym
spójnym codebase'em — komentarze `// [F0]`, `// [F1]`, `// [F2]` oznaczają, do której
fazy dany blok logicznie należy, dzięki czemu można go budować etapami jak w roadmapie.

**Wymagania:** dowolny statyczny serwer HTTP (moduły ES nie działają z `file://`):

```bash
# opcja A (bez instalacji)
npx serve .
# opcja B
python3 -m http.server 8000
```

Three.js ładowany z CDN przez import map (działa od razu, bez build-stepu).
Przy przenoszeniu na Vite: `npm i three` i usuń `<script type="importmap">`.

---

## Co dowiązują fazy

| Faza | Zawartość | Pliki |
|---|---|---|
| **0 — pion** | autko (arcade bicycle model), brama jako cykl otwierania/zamykania, chase-cam, sterowanie klawiatura + dotyk, fixed timestep | `index.html`, `GameLoop`, `InputManager`, `Vehicle*`, `GateSystem` (baza), `ChaseCamera` |
| **1 — MVP grywalne** | FSM z fazami prędkości (6,6 → 1,3 m/min w skali gry), lampa ostrzegawcza 5 s przed ruchem, anty-przygniecenie (rewers + respawn po 3.), HUD, reset klawiszem R | `GateSystem` (pełny), `Hud`, strefy kolizji w `main.js` |
| **2 — pełna pętla** | fotokomórki (hold zamykania), pilot ×1 (logika A/B), combo + perfect thread, dźwięk (WebAudio), segmenty bramy na prowadnicy (krzywa), lampa z bloomem, leaderboard (localStorage) | `GateView` (pełny), `AudioManager`, scoring w `main.js` |

Parametry z instrukcji FAAC D600 odzwierciedlone w kodzie: wstępna sygnalizacja lampą
błyskową przed ruchem (rozdz. 11.3), faza "wolnej prędkości przy krańcach" (1,3 m/min
vs 6,6 m/min z danych technicznych), logika impulsu radiowego A/B (tabele z rozdz. 8.5),
rewers bramy po wykryciu przeszkody przy zamykaniu i zatrzymanie przy otwieraniu.

---

## Struktura

```
gate-rush/
  index.html
  js/
    main.js
    core/
      GameLoop.js
      InputManager.js
      AudioManager.js
    vehicle/
      VehicleController.js
      VehicleView.js
    gate/
      GateSystem.js
      GateView.js
    level/
      ChaseCamera.js
    ui/
      Hud.js
```

---

## index.html

```html
<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<title>Gate Rush</title>
<style>
  html, body { margin:0; height:100%; overflow:hidden; background:#0d1420;
    font-family: system-ui, sans-serif; color:#fff; touch-action:none;
    -webkit-user-select:none; user-select:none; }
  #app { position:fixed; inset:0; }
  canvas { display:block; }

  #hud { position:absolute; top:12px; left:12px; right:12px;
    display:flex; justify-content:space-between; gap:8px;
    pointer-events:none; font-size:14px; text-shadow:0 1px 3px #000; }
  .panel { background:rgba(0,0,0,.5); padding:8px 14px; border-radius:10px;
    backdrop-filter:blur(4px); white-space:nowrap; }
  .panel b { font-variant-numeric:tabular-nums; }

  #big { position:absolute; top:38%; left:50%; transform:translate(-50%,-50%);
    font-size:min(9vw,56px); font-weight:800; letter-spacing:.05em; text-align:center;
    text-shadow:0 2px 12px #000; pointer-events:none; opacity:0;
    transition:opacity .25s; white-space:pre-line; }

  #btn-reset { position:absolute; right:12px; top:64px; pointer-events:auto;
    background:rgba(0,0,0,.5); border:1px solid rgba(255,255,255,.25); color:#fff;
    padding:6px 10px; border-radius:8px; font-size:12px; }

  /* [F2] panele dotykowe — pokazywane tylko na urządzeniach z coarse pointer */
  #touch { position:absolute; inset:0; display:none; pointer-events:none; }
  #touch .btn { position:absolute; width:70px; height:70px; border-radius:50%;
    background:rgba(255,255,255,.10); border:1px solid rgba(255,255,255,.35);
    display:flex; align-items:center; justify-content:center; font-size:24px;
    pointer-events:auto; touch-action:none; }
  #touch .btn:active { background:rgba(255,255,255,.28); }
  #btn-left  { left:16px;  bottom:26px; }
  #btn-right { left:100px; bottom:26px; }
  #btn-gas   { right:16px; bottom:104px; }
  #btn-brake { right:16px; bottom:26px; }
  #btn-remote { right:16px; top:120px; width:auto; height:auto; padding:12px 16px;
    border-radius:12px; font-size:12px; font-weight:700; }
</style>
</head>
<body>
<div id="app"></div>

<div id="hud">
  <div class="panel"><b id="time">0.00</b> s &nbsp;·&nbsp; combo <b id="combo">×1</b></div>
  <div class="panel" id="gate-status">ZAMKNIĘTA</div>
</div>
<div id="big"></div>
<button id="btn-reset">R — reset</button>

<div id="touch">
  <div class="btn" id="btn-left">◀</div>
  <div class="btn" id="btn-right">▶</div>
  <div class="btn" id="btn-gas">▲</div>
  <div class="btn" id="btn-brake">▼</div>
  <div class="btn" id="btn-remote">PILOT</div>
</div>

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
// [F0] fixed timestep 60 Hz + render co klatkę (deterministyczna fizyka → potem ghost replay)
export class GameLoop {
  constructor(update, render) {
    this.update = update;
    this.render = render;
    this.step = 1 / 60;
    this.acc = 0;
    this.last = performance.now();
    const tick = (now) => {
      const dt = Math.min((now - this.last) / 1000, 0.1);
      this.last = now;
      this.acc += dt;
      while (this.acc >= this.step) {
        this.update(this.step);
        this.acc -= this.step;
      }
      this.render(dt);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}
```

---

## js/core/InputManager.js

```js
// [F0] klawiatura + gamepad-ready; [F2] panele dotykowe i pilot na mobile
export class Input {
  constructor() {
    this.keys = {};
    this.touch = { left: false, right: false, gas: false, brake: false };
    this.remotePressed = false;
    this.resetPressed = false;

    this.isTouch =
      matchMedia('(pointer:coarse)').matches || navigator.maxTouchPoints > 0;

    addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) this.remotePressed = true; }
      if (e.code === 'KeyR' && !e.repeat) this.resetPressed = true;
    });
    addEventListener('keyup', (e) => { this.keys[e.code] = false; });

    // nie "zatkuj" klawiszy po utracie focusu
    addEventListener('blur', () => { this.keys = {}; });

    if (this.isTouch) this._bindTouch();
  }

  _bindTouch() {
    document.getElementById('touch').style.display = 'block';
    const hold = (id, prop) => {
      const el = document.getElementById(id);
      const on = (e) => { e.preventDefault(); this.touch[prop] = true; };
      const off = (e) => { e.preventDefault(); this.touch[prop] = false; };
      el.addEventListener('pointerdown', on);
      el.addEventListener('pointerup', off);
      el.addEventListener('pointercancel', off);
      el.addEventListener('pointerleave', off);
    };
    hold('btn-left', 'left');
    hold('btn-right', 'right');
    hold('btn-gas', 'gas');
    hold('btn-brake', 'brake');
    document.getElementById('btn-remote')
      .addEventListener('pointerdown', (e) => { e.preventDefault(); this.remotePressed = true; });
  }

  get throttle() { return (this.keys.ArrowUp || this.keys.KeyW || this.touch.gas) ? 1 : 0; }
  get brake()    { return (this.keys.ArrowDown || this.keys.KeyS || this.touch.brake) ? 1 : 0; }
  get steer() {
    return ((this.keys.ArrowRight || this.keys.KeyD || this.touch.right) ? 1 : 0) -
           ((this.keys.ArrowLeft  || this.keys.KeyA || this.touch.left)  ? 1 : 0);
  }
  consumeRemote() { const v = this.remotePressed; this.remotePressed = false; return v; }
  consumeReset()  { const v = this.resetPressed;  this.resetPressed = false; return v; }
}
```

---

## js/core/AudioManager.js

```js
// [F2] WebAudio, init dopiero po geście użytkownika (wymóg przeglądarek)
export class Audio {
  constructor() { this.ctx = null; }

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.3;
    this.master.connect(this.ctx.destination);

    // silnik RC: piła, pitch od prędkości
    this.eng = this.ctx.createOscillator();
    this.eng.type = 'sawtooth';
    this.engGain = this.ctx.createGain();
    this.engGain.gain.value = 0;
    this.eng.connect(this.engGain).connect(this.master);
    this.eng.start();

    // szum napędu bramy
    this.hum = this.ctx.createOscillator();
    this.hum.type = 'triangle';
    this.hum.frequency.value = 55;
    this.humGain = this.ctx.createGain();
    this.humGain.gain.value = 0;
    this.hum.connect(this.humGain).connect(this.master);
    this.hum.start();
  }

  engine(speedNorm) {
    if (!this.ctx) return;
    this.eng.frequency.value = 45 + speedNorm * 240;
    this.engGain.gain.value = 0.04 + speedNorm * 0.12;
  }
  gateHum(on) { if (this.ctx) this.humGain.gain.value = on ? 0.12 : 0; }
  click() { this._blip(1400, 0.06, 0.25); }
  thud()  { this._blip(80, 0.3, 0.7, 'square'); }
  beep()  { this._blip(880, 0.15, 0.3); }

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

## js/vehicle/VehicleController.js

```js
import * as THREE from 'three';

// [F0] arcade "bicycle model" — bez zewnętrznego silnika fizyki
export class Vehicle {
  constructor() {
    this.pos = new THREE.Vector3(0, 0, 30);   // start: koniec podjazdu
    this.heading = Math.PI;                   // patrzymy w -Z (na garaż)
    this.speed = 0;
    this.steerVisual = 0;
    this.cfg = { accel: 12, maxSpeed: 8, reverse: 2.5, brake: 20, drag: 1.1, steerRate: 2.6 };
  }

  get forward() { return new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading)); }

  update(input, dt) {
    const c = this.cfg;
    if (input.throttle) this.speed += c.accel * dt;
    if (input.brake)    this.speed -= c.brake * dt;
    this.speed -= this.speed * c.drag * dt;                       // toczenie/opór
    this.speed = THREE.MathUtils.clamp(this.speed, -c.reverse, c.maxSpeed);

    // skręt skuteczny dopiero od niskiej prędkości (RC feel)
    const grip = Math.min(Math.abs(this.speed) / 2.2, 1);
    this.heading -= input.steer * c.steerRate * grip * dt * Math.sign(this.speed || 1);

    this.steerVisual += (input.steer - this.steerVisual) * Math.min(10 * dt, 1);
    this.pos.addScaledVector(this.forward, this.speed * dt);

    // granice podjazdu / garażu
    this.pos.x = THREE.MathUtils.clamp(this.pos.x, -5.4, 5.4);
    this.pos.z = THREE.MathUtils.clamp(this.pos.z, -5.6, 33);
  }

  reset() { this.pos.set(0, 0, 30); this.heading = Math.PI; this.speed = 0; this.steerVisual = 0; }
}
```

---

## js/vehicle/VehicleView.js

```js
import * as THREE from 'three';

// [F0] low-poly RC autko zbudowane z prymitywów; koła w pivotach (skręt + spin)
export class VehicleView {
  constructor(scene) {
    this.group = new THREE.Group();

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.16, 0.85),
      new THREE.MeshStandardMaterial({ color: 0xe74c3c, roughness: 0.35, metalness: 0.15 }));
    body.position.y = 0.17;
    body.castShadow = true;

    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.13, 0.42),
      new THREE.MeshStandardMaterial({ color: 0x1c2430, roughness: 0.15, metalness: 0.4 }));
    cabin.position.set(0, 0.3, -0.06);
    cabin.castShadow = true;

    this.group.add(body, cabin);

    const wMat = new THREE.MeshStandardMaterial({ color: 0x14171c, roughness: 0.9 });
    const wGeo = new THREE.CylinderGeometry(0.105, 0.105, 0.08, 14);
    wGeo.rotateZ(Math.PI / 2); // oś koła wzdłuż X (oś lokalna = oś spinu)

    this.pivots = [];
    for (const [x, z] of [[-0.25, 0.28], [0.25, 0.28], [-0.25, -0.3], [0.25, -0.3]]) {
      const pivot = new THREE.Group();
      pivot.position.set(x, 0.105, z);
      const mesh = new THREE.Mesh(wGeo, wMat);
      mesh.castShadow = true;
      pivot.add(mesh);
      this.group.add(pivot);
      this.pivots.push(pivot);
    }
    scene.add(this.group);
  }

  sync(v, dt) {
    this.group.position.copy(v.pos);
    this.group.rotation.y = v.heading;
    const spin = (v.speed / 0.105) * dt;
    this.pivots.forEach((p, i) => {
      p.children[0].rotation.x += spin;
      if (i < 2) p.rotation.y = -v.steerVisual * 0.45; // przednie koła
    });
  }
}
```

---

## js/gate/GateSystem.js

```js
// [F1] FSM zgodna z układem logicznym sterowania z instrukcji:
// ZAMKNIĘTA → (lampka 5 s) → OTWIERANIE → OTWARTE (przerwa) → (lampka) → ZAMYKANIE → ...
// Impuls radiowy w trakcie ZAMYKANIA odwraca ruch (logika A/B, rozdz. 8.5).
// Przeszkoda przy zamykaniu → rewers; przy otwieraniu → stop (anty-podniesienie).
export const GateState = Object.freeze({
  CLOSED: 'ZAMKNIĘTA',
  WARNING_OPEN: 'OTWIERANIE ZA 5 s',
  OPENING: 'OTWIERANIE',
  OPEN: 'OTWARTE',
  WARNING_CLOSE: 'ZAMYKANIE ZA 5 s',
  CLOSING: 'ZAMYKANIE',
});

export class GateSystem {
  constructor() {
    this.state = GateState.CLOSED;
    this.next = null;
    this.t = 0;              // 0 = zamknięta, 1 = otwarta
    this.timer = 0;
    this.collisions = 0;     // anty-przygniecenie: 3 = respawn gracza
    this.beamHold = false;   // fotokomórka trzyma bramę (nie zamyka się)
    this.gapY = 0;           // prześwit pod dolną krawędzią (uzupełnia GateView)
    this.lampOn = false;
    this.lampBlink = false;
    this.cfg = {
      openTime: 4.5,
      closeTime: 4.0,
      pauseTime: 8,      // przerwa w trybie automatycznym (skalowana z ~3 min)
      warnTime: 5,       // wstępna sygnalizacja lampą (rozdz. 11.3)
      restTime: 2,       // postój po domknięciu przed kolejnym cyklem
    };
  }

  // profil prędkości z danych technicznych: 6,6 m/min → 1,3 m/min przy krańcach
  speedProfile(t) { return (t < 0.12 || t > 0.88) ? 0.35 : 1; }

  _set(state, next = null) {
    this.state = state;
    this.next = next;
    this.timer = 0;
  }

  // [F2] pilot — jeden impuls, logika A/B: w otwieraniu ignorowany
  triggerRemote() {
    if (this.state === GateState.OPENING || this.state === GateState.OPEN ||
        this.state === GateState.WARNING_OPEN) return false;
    this._set(GateState.WARNING_OPEN, GateState.OPENING);
    return true;
  }

  // [F1] kontakt zamykającej się krawędzi z autkiem → rewers (jak w instrukcji)
  crushed() {
    this.collisions++;
    this._set(GateState.OPENING);
    return this.collisions >= 3 ? 'respawn' : 'bounce';
  }

  // [F1] przeszkoda przy otwieraniu → stop (zapobiega podniesieniu)
  holdOpening() { this._set(GateState.OPEN); }

  update(dt, beamBlocked) {
    this.timer += dt;
    this.beamHold = false;
    this.lampOn = false;
    this.lampBlink = false;

    switch (this.state) {
      case GateState.CLOSED:
        if (this.timer > this.cfg.restTime) this._set(GateState.WARNING_OPEN, GateState.OPENING);
        break;

      case GateState.WARNING_OPEN:
      case GateState.WARNING_CLOSE:
        this.lampOn = true; this.lampBlink = true;         // telegraf dla gracza
        if (this.timer > this.cfg.warnTime) this._set(this.next);
        break;

      case GateState.OPENING:
        this.lampOn = true;
        this.t += (dt / this.cfg.openTime) * this.speedProfile(this.t);
        if (this.t >= 1) { this.t = 1; this._set(GateState.OPEN); }
        break;

      case GateState.OPEN:
        if (this.timer > this.cfg.pauseTime) this._set(GateState.WARNING_CLOSE, GateState.CLOSING);
        break;

      case GateState.CLOSING:
        this.lampOn = true;
        if (beamBlocked) {                                    // fotokomórka: nie zamykaj
          this.beamHold = true;
          break;
        }
        this.t -= (dt / this.cfg.closeTime) * this.speedProfile(this.t);
        if (this.t <= 0) { this.t = 0; this._set(GateState.CLOSED); }
        break;
    }
  }

  get statusText() {
    if (this.beamHold) return 'FOTOKOMÓRKA — TRZYMANA';
    return this.state;
  }
}
```

---

## js/gate/GateView.js

```js
import * as THREE from 'three';

// [F2] segmenty bramy rozkładane po prowadnicy (CatmullRomCurve3 z parametryzacją
// długości łuku) + lampa ostrzegawcza (emissive/bloom) + fotokomórki.
// [F0/F1] w wersji minimalnej wystarczy jeden przesuwany box — patrz uwaga na końcu.
export class GateView {
  constructor(scene) {
    this.doorLen = 2.4;
    this.segs = 6;
    this.segH = this.doorLen / this.segs;

    // prowadnica: pion (przed nadprożem) → łuk → bieg pod sufitem garażu (-Z)
    const pts = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 2.6, 0),
      new THREE.Vector3(0, 2.9, -1.0),
      new THREE.Vector3(0, 2.9, -3.2),
    ];
    this._buildArcLength(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.4));

    // segmenty bramy
    const segMat = new THREE.MeshStandardMaterial({
      color: 0x9aa4ad, metalness: 0.55, roughness: 0.45 });
    this.segments = [];
    for (let k = 0; k < this.segs; k++) {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(6, this.segH * 0.97, 0.07), segMat);
      m.castShadow = true;
      scene.add(m);
      this.segments.push(m);
    }

    // szyny po bokach (wizualizacja prowadnicy)
    const railGeo = new THREE.TubeGeometry(this.curve, 48, 0.045, 8);
    const railMat = new THREE.MeshStandardMaterial({ color: 0x2b323b, roughness: 0.6 });
    for (const x of [-3.08, 3.08]) {
      const rail = new THREE.Mesh(railGeo, railMat);
      rail.position.x = x;
      scene.add(rail);
    }

    // [F1/F2] lampa ostrzegawcza nad bramą
    this.lampMat = new THREE.MeshStandardMaterial({
      color: 0x330606, emissive: 0xff2211, emissiveIntensity: 0 });
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.2), this.lampMat);
    lamp.position.set(2.4, 3.35, 0.35);
    scene.add(lamp);
    this.lampLight = new THREE.PointLight(0xff3311, 0, 9, 2);
    this.lampLight.position.set(2.4, 3.3, 0.5);
    scene.add(this.lampLight);

    // [F2] fotokomórki: słupki + wiązka
    const postMat = new THREE.MeshStandardMaterial({ color: 0x22262c, roughness: 0.7 });
    for (const x of [-3.25, 3.25]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.3, 0.12), postMat);
      post.position.set(x, 0.15, 0.7);
      scene.add(post);
    }
    this.beamMat = new THREE.MeshStandardMaterial({
      color: 0x003318, emissive: 0x22ff77, emissiveIntensity: 1.2 });
    this.beam = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.025, 0.025), this.beamMat);
    this.beam.position.set(0, 0.18, 0.7);
    scene.add(this.beam);

    this._time = 0;
  }

  _buildArcLength(curve) {
    this.curve = curve;
    const N = 256;
    this.samples = curve.getSpacedPoints(N);     // równomierne wzdłuż łuku
    this.segLen = this.curve.getLength() / N;
    this.totalLen = this.curve.getLength();
    this.travel = this.totalLen - this.doorLen - 0.2; // zakres przesuwu drzwi
  }

  pathPoint(s) {
    s = THREE.MathUtils.clamp(s, 0, this.totalLen - 1e-3);
    const i = Math.min(Math.floor(s / this.segLen), this.samples.length - 2);
    const f = (s - i * this.segLen) / this.segLen;
    return new THREE.Vector3().lerpVectors(this.samples[i], this.samples[i + 1], f);
  }

  sync(gate, beamBlocked, dt) {
    this._time += dt;
    const d = gate.t * this.travel;

    // prześwit pod dolną krawędzią → mechanika anty-przygnieceniowa w main.js
    gate.gapY = this.pathPoint(d).y;

    this.segments.forEach((seg, k) => {
      const s = d + (k + 0.5) * this.segH;
      const p = this.pathPoint(s);
      const p2 = this.pathPoint(s + 0.05);
      const tan = p2.clone().sub(p).normalize();
      // panel prostopadły do stycznej prowadnicy; szerokość zawsze wzdłuż X
      const x = new THREE.Vector3(1, 0, 0);
      const z = new THREE.Vector3().crossVectors(x, tan).normalize();
      seg.position.copy(p);
      seg.matrixAutoUpdate = false;
      seg.matrix.makeBasis(x, tan, z).setPosition(p);
      seg.matrixAutoUpdate = true;
    });

    // lampa: miganie w fazie ostrzegewania, światło stałe w ruchu
    let intensity = 0;
    if (gate.lampOn) {
      intensity = gate.lampBlink
        ? ((this._time * 4) % 1 < 0.5 ? 3.2 : 0.1)
        : 2.2;
    }
    this.lampMat.emissiveIntensity = intensity;
    this.lampLight.intensity = intensity * 0.8;

    // wiązka fotokomórek pulsuje, gdy przerwana
    this.beamMat.emissiveIntensity = beamBlocked
      ? 2.5 + Math.sin(this._time * 20) * 1.5
      : 1.1;
  }
}
```

---

## js/level/ChaseCamera.js

```js
import * as THREE from 'three';

// [F0] chase-cam z wyprzedzeniem; [F1] screen shake po kolizji
export class ChaseCamera {
  constructor(camera) {
    this.cam = camera;
    this.pos = new THREE.Vector3(0, 3, 38);
    this.look = new THREE.Vector3(0, 1, 30);
  }

  update(v, dt, shake) {
    const fwd = v.forward;
    const wantPos = v.pos.clone().addScaledVector(fwd, -5.2).setY(2.6);
    const wantLook = v.pos.clone().addScaledVector(fwd, 4).setY(0.7);
    const k = 1 - Math.pow(0.0005, dt); // wygładzanie niezależne od fps
    this.pos.lerp(wantPos, k);
    this.look.lerp(wantLook, k);
    this.cam.position.copy(this.pos);
    if (shake > 0) {
      this.cam.position.x += (Math.random() - 0.5) * shake * 0.5;
      this.cam.position.y += (Math.random() - 0.5) * shake * 0.3;
    }
    this.cam.lookAt(this.look);
  }
}
```

---

## js/ui/Hud.js

```js
// [F1] HUD w DOM (tanie, ostre na mobile, nie obciąża WebGL)
export class Hud {
  constructor() {
    this.el = {
      time: document.getElementById('time'),
      combo: document.getElementById('combo'),
      status: document.getElementById('gate-status'),
      big: document.getElementById('big'),
      remote: document.getElementById('btn-remote'),
    };
    this._t = 0;
  }

  update(race, gate) {
    this.el.time.textContent = race.time.toFixed(2);
    this.el.combo.textContent = '×' + race.combo;
    this.el.status.textContent = gate.statusText;
    this.el.remote.style.opacity = race.remoteLeft > 0 ? 1 : 0.25;
  }

  flash(msg, ms = 1000) {
    this.el.big.textContent = msg;
    this.el.big.style.opacity = 1;
    clearTimeout(this._t);
    this._t = setTimeout(() => { this.el.big.style.opacity = 0; }, ms);
  }
}
```

---

## js/main.js

```js
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { Input } from './core/InputManager.js';
import { GameLoop } from './core/GameLoop.js';
import { Audio } from './core/AudioManager.js';
import { Vehicle } from './vehicle/VehicleController.js';
import { VehicleView } from './vehicle/VehicleView.js';
import { GateSystem, GateState } from './gate/GateSystem.js';
import { GateView } from './gate/GateView.js';
import { ChaseCamera } from './level/ChaseCamera.js';
import { Hud } from './ui/Hud.js';

/* ---------- setup renderer / scene ---------- */

const isMobile = matchMedia('(pointer:coarse)').matches || navigator.maxTouchPoints > 0;

const renderer = new THREE.WebGLRenderer({ antialias: !isMobile });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile ? 1.5 : 2));
renderer.shadowMap.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d1420);
scene.fog = new THREE.Fog(0x0d1420, 35, 95);

const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 200);

/* [F0] światła */
scene.add(new THREE.HemisphereLight(0x8899bb, 0x1a1f28, 0.7));
const sun = new THREE.DirectionalLight(0xffeecc, 1.6);
sun.position.set(12, 20, 14);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -14; sun.shadow.camera.right = 14;
sun.shadow.camera.top = 14;   sun.shadow.camera.bottom = -14;
scene.add(sun);

/* ---------- środowisko: podjazd + garaż ---------- */

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(30, 90),
  new THREE.MeshStandardMaterial({ color: 0x23272e, roughness: 0.95 }));
ground.rotation.x = -Math.PI / 2;
ground.position.z = 10;
ground.receiveShadow = true;
scene.add(ground);

const garageMat = new THREE.MeshStandardMaterial({ color: 0x2e3640, roughness: 0.85 });
const addBox = (w, h, d, x, y, z) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), garageMat);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  scene.add(m);
  return m;
};
addBox(1.2, 4.0, 7,  -3.9, 2.0, -3.2);  // ściana lewa garażu (otwór 6 m)
addBox(1.2, 4.0, 7,   3.9, 2.0, -3.2);  // ściana prawa
addBox(9, 1.6, 7,     0, 3.6, -3.2);    // nadproże + sufit od frontu
addBox(9, 0.4, 7,     0, 3.0, -3.2);    // sufit garażu (kamera 3D nad nim nie wchodzi)
addBox(9, 4.2, 0.4,   0, 2.1, -6.4);    // ściana tylna
// krawężniki podjazdu
addBox(0.4, 0.15, 40, -5.6, 0.07, 12);
addBox(0.4, 0.15, 40,  5.6, 0.07, 12);

// meta (finish) wewnątrz garażu
const finish = new THREE.Mesh(
  new THREE.BoxGeometry(6, 0.02, 1),
  new THREE.MeshStandardMaterial({ color: 0x143320, emissive: 0x22ff66, emissiveIntensity: 0.8 }));
finish.position.set(0, 0.012, -3.6);
scene.add(finish);

// pozycja startowa
const startPad = new THREE.Mesh(
  new THREE.BoxGeometry(2.5, 0.02, 2.5),
  new THREE.MeshStandardMaterial({ color: 0x302a14, emissive: 0xffcc22, emissiveIntensity: 0.5 }));
startPad.position.set(0, 0.012, 30);
scene.add(startPad);

/* ---------- obiekty gry ---------- */

const input = new Input();
const audio = new Audio();
const hud = new Hud();
const car = new Vehicle();
const carView = new VehicleView(scene);
const gate = new GateSystem();
const gateView = new GateView(scene);
const chase = new ChaseCamera(camera);

/* [F2] bloom tylko na desktop (mobile: koszt GPU) */
let composer = null;
if (!isMobile) {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.55, 0.85, 0.85));
  composer.addPass(new OutputPass());
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  if (composer) composer.setSize(innerWidth, innerHeight);
});

/* [F2] audio dopiero po geście użytkownika */
const armAudio = () => { audio.init(); };
addEventListener('pointerdown', armAudio, { once: true });
addEventListener('keydown', armAudio, { once: true });

/* ---------- stan wyścigu ---------- */

const race = {
  phase: 'ready',   // ready | running | finished | crushed
  time: 0,
  combo: 1,
  remoteLeft: 1,
  shake: 0,
  crossed: false,    // czy przejechane pod bramą (do perfect thread)
};

function resetRace(msg) {
  car.reset();
  gate.t = 0;
  gate.collisions = 0;
  gate._set(GateState.CLOSED);
  race.phase = 'ready';
  race.time = 0;
  race.combo = 1;
  race.remoteLeft = 1;
  race.crossed = false;
  if (msg) hud.flash(msg, 1400);
}

function respawnCrushed() {
  race.phase = 'crushed';
  hud.flash('ZGNIECIONY!\nrespawn...', 1500);
  setTimeout(() => resetRace('JESZCZE RAZ!'), 1600);
}

/* [F2] leaderboard localStorage */
const LB_KEY = 'gate-rush-scores';
function loadScores() { try { return JSON.parse(localStorage.getItem(LB_KEY)) || []; } catch { return []; } }
function saveScore(t) {
  const s = loadScores();
  s.push({ t, d: Date.now() });
  s.sort((a, b) => a.t - b.t);
  localStorage.setItem(LB_KEY, JSON.stringify(s.slice(0, 5)));
  return s.slice(0, 5);
}
function finishRun() {
  race.phase = 'finished';
  const scores = saveScore(race.time);
  const list = scores.map((s, i) => `${i + 1}. ${s.t.toFixed(2)} s`).join('\n');
  hud.flash(`META! ${race.time.toFixed(2)} s\n combo ×${race.combo}\n— TOP 5 —\n${list}\n(R / tap = od nowa)`, 6000);
}

document.getElementById('btn-reset').addEventListener('click', () => resetRace('R — reset'));

/* ---------- główna logika ---------- */

const CAR_TOP = 0.5; // wysokość autka — próg "przygniecenia"

function update(dt) {
  if (input.consumeReset()) resetRace('R — reset');

  if (race.phase === 'running' || race.phase === 'ready') {
    car.update(input, dt);
  }

  // start zegara
  if (race.phase === 'ready' && Math.abs(car.speed) > 0.5) {
    race.phase = 'running';
    hud.flash('GO!', 700);
  }
  if (race.phase === 'running') race.time += dt;

  // [F2] pilot — 1× na próbę (logika A: w otwieraniu ignorowany)
  if (input.consumeRemote()) {
    if (race.remoteLeft > 0 && gate.triggerRemote()) {
      race.remoteLeft--;
      audio.click();
      hud.flash('KLIK! PILOT', 700);
    }
  }

  // [F2] wiązka fotokomórek: autko w pasku wiązki = przeszkoda
  const beamBlocked =
    race.phase === 'running' &&
    Math.abs(car.pos.z - 0.7) < 0.45 &&
    Math.abs(car.pos.x) < 3.2;

  // [F1] strefa bramy: kontakt z dolną krawędzią
  const inGateZone = Math.abs(car.pos.z) < 0.5 && Math.abs(car.pos.x) < 3.1;
  if (inGateZone && gate.gapY < CAR_TOP && race.phase === 'running') {
    if (gate.state === GateState.CLOSING) {
      const result = gate.crushed();          // rewers bramy (jak w instrukcji)
      race.combo = 1;                          // kara: reset combo
      race.shake = 1;
      audio.thud();
      car.speed = -Math.max(Math.abs(car.speed), 1.5) * 0.5;
      car.pos.z = 0.9;                         // wypchnięcie ze strefy
      if (result === 'respawn') { respawnCrushed(); return; }
      hud.flash(`AŁ! REWERS (${gate.collisions}/3)`, 900);
    } else if (gate.state === GateState.CLOSED) {
      car.speed *= -0.35;
      car.pos.z = 0.9;
      audio.thud();
    } else if (gate.state === GateState.OPENING) {
      gate.holdOpening();                      // stop: zapobiega podniesieniu
      car.speed *= 0.2;
    }
  }

  gate.update(dt, beamBlocked);

  // [F2] perfect thread: przejazd, gdy prześwit < 1 m
  if (race.phase === 'running' && !race.crossed && car.pos.z < 0.2 && car.pos.z > -0.5) {
    race.crossed = true;
    if (gate.gapY < 1.0 && gate.gapY >= CAR_TOP) {
      race.combo = Math.min(race.combo + 1, 5);
      audio.beep();
      hud.flash('PERFECT THREAD! ×' + race.combo, 900);
    }
  }

  // meta
  if (race.phase === 'running' && car.pos.z < -3.6 && Math.abs(car.pos.x) < 3) {
    finishRun();
  }

  race.shake = Math.max(0, race.shake - dt * 3);
  audio.engine(Math.abs(car.speed) / car.cfg.maxSpeed);
  audio.gateHum(gate.state === GateState.OPENING || gate.state === GateState.CLOSING);
}

function render(dt) {
  carView.sync(car, dt);
  gateView.sync(gate, race.phase === 'running' &&
    Math.abs(car.pos.z - 0.7) < 0.45 && Math.abs(car.pos.x) < 3.2, dt);
  chase.update(car, dt, race.shake);
  hud.update(race, gate);
  if (composer) composer.render();
  else renderer.render(scene, camera);
}

/* start po tapnięciu overlaya na ekranie końcowym */
addEventListener('pointerdown', () => {
  if (race.phase === 'finished') resetRace('JESZCZE RAZ!');
});

new GameLoop(update, render);
```

---

## Uwagi implementacyjne

**Faza 0 (pion, jeśli budujesz inkrementalnie):** z powyższego kodu wystarczą
`index.html`, `GameLoop`, `InputManager` (bez dotyku), `VehicleController/View`,
`ChaseCamera` oraz `GateSystem` zredukowany do prostego cyklu
`OPENING ↔ OPEN ↔ CLOSING ↔ CLOSED` (bez `WARNING`, bez `crushed()`), a `GateView`
zastąpiony jednym `BoxGeometry(6, 2.4, 0.07)` przesuwanym po `gate.t * 2.4` w osi Y.
To ~150 linii i pozwala ocenić feeling rytmu bramy.

**Faza 1:** dokładasz stany `WARNING_*` + `lampOn/lampBlink`, metodę `crushed()`
(rewers), licznik kolizji z respawnem w `main.js`, `Hud` i strefę `inGateZone`.

**Faza 2:** dokładasz `GateView` z segmentami na prowadnicy, fotokomórki
(`beamBlocked` → freeze zamykania w FSM zamiast rewersu — wiernie instrukcji:
fotokomórka *nie pozwala* się zamknąć, a czujnik krawędziowy robi rewers), pilota,
combo/perfect thread, `AudioManager`, bloom i leaderboard.

**Mobile:** detekcja `pointer:coarse`, panele dotykowe (`pointerdown/up/leave`,
`touch-action:none` — działa też w przeglądarce mobilnej bez eventów dotykowych
per-gest), `pixelRatio` cap 1.5, brak bloomu i antialiasu. Kamera i HUD są
wspólne — `#big` skaluje się przez `min(9vw,56px)`.

**Znane uproszczenia vs plan (celowo):** brak ghost replay (Faza 3), brak poziomów
slalomu/blackout (Faza 3), fotokomórka jako freeze-a-not-reverse (uproszczenie
zgodne z instrukcją), brak wariantu logiki B (wystarczy rozszerzyć `triggerRemote()`
o warunek `state === CLOSING → ignoruj`).

**Strojenie:** wszystkie kluczowe liczby siedzą w `GateSystem.cfg` (czasy cyklu),
`Vehicle.cfg` (fizyka) i `CAR_TOP`/progi w `main.js` — do wywalenia do JSON-a
przy rozszerzaniu na poziomy.
