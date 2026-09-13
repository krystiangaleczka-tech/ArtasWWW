# TRYB NAUKI — kod Faz 0–2 (PC + mobile)

Trzecia gra z tryptyku: gracz wciela się w **firmware płyty E600/E1000** i przeprowadza
prawdziwą procedurę nauki z instrukcji (rozdz. 11.2) jako grę rytmiczno-logiczną:
6 naciśnięć OPEN w odpowiednich fazach ruchu bramy, potem konfiguracja przełączników
DS1 pod scenariusz klienta, a na koniec symulacja "dnia z życia" Twojej konfiguracji.

**Wymagania:** serwer HTTP (moduły ES nie działają z `file://`):

```bash
npx serve .          # lub: python3 -m http.server 8000
```

Three.js z CDN przez import map (bez build-stepu). Migracja na Vite: `npm i three`
+ usuń `<script type="importmap">`.

---

## Co dowiązują fazy

| Faza | Zawartość | Pliki |
|---|---|---|
| **0 — pion** | scena garażu z bramą na prowadnicy (krzywa), panel płyty E600 w DOM (SETUP trzymany 1 s, OPEN, diody LD, pasek podróży bramy), rdzeń rytmiczny: hold SETUP → start procedury → naciśnięcia OPEN w oknach czasowych | `GameLoop`, `GateView`, `GateSystem` (baza), `BoardPanel` |
| **1 — pełny cykl nauki** | cała sekwencja 6 naciśnięć wg rozdz. 11.2 (start zamykania → start otwierania → punkt spowolnienia → punkt zatrzymania → start zamykania → punkt spowolnienia), ocena PERFECT/GOOD/AUTO, błąd = wolne miganie diody SET UP i powtórka segmentu (jak w instrukcji), sukces = dioda świeci stale 5 s (też z instrukcji!), konfiguracja DS1 + logika A/B pod scenariusz + walidacja | `GateSystem` (pełny), scenariusze i config w `main.js` |
| **2 — symulacja** | "dzień z życia": kot przecina fotokomórki, wiatr (czułość), **interaktywny impuls radiowy podczas otwierania** (logika A: brak efektu / B: stop — tabele z rozdz. 8.5), przeszkoda 3× w tym samym miejscu (system "zapamiętuje" nowy punkt zamknięcia — rozdz. 8.5), blackout z akumulatorów (lampa miga = usterka), diagnostyka LED na żywo, scoring bezpieczeństwo/wygoda, raport + rekord localStorage | `Simulator`, dźwięki, raport w `main.js` |

Parametry z instrukcji odzwierciedlone w kodzie: procedura nauki z rozdz. 11.2
(6 naciśnięć, dioda SET UP miga / świeci 5 s przy sukcesie, wolne miganie = błąd),
przełączniki DS1 z rozdz. 8.4 (układ kontrolny, czułość przygniecenia, prędkość
sanek), logika A (automatyczna) vs B (półautomatyczna) z rozdz. 8.5, diody LD1–LD6
z rozdz. 8.2, 3-krotna detekcja przeszkody = nowy punkt zamknięcia, fakt, że
podczas nauki nie działa wykrywanie przeszkód (intro).

---

## Struktura

```
trybnauki/
  index.html
  js/
    main.js
    core/
      GameLoop.js
      AudioManager.js
    gate/
      GateSystem.js     (procedura nauki — FSM rytmiczna)
      GateView.js       (3D: brama na prowadnicy, lampa, fotokomórki)
    board/
      BoardPanel.js     (DOM: przyciski, diody, DS1, pasek podróży)
    sim/
      Simulator.js      (dzień z życia — zdarzenia)
    ui/
      Hud.js            (karty/scenariusze/raport)
```

---

## index.html

```html
<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"/>
<title>TRYB NAUKI — E600</title>
<style>
  html, body { margin:0; height:100%; overflow:hidden; background:#0d1420;
    font-family:system-ui, sans-serif; color:#e8ecf1; touch-action:none;
    -webkit-user-select:none; user-select:none; }
  #layout { display:flex; height:100%; }
  #scene-wrap { position:relative; flex:1; min-width:0; }
  #app { position:absolute; inset:0; }
  canvas { display:block; }

  /* karta narracyjna (intro / scenariusz / zdarzenia / raport) */
  #card { position:absolute; top:12px; left:12px; max-width:min(420px, 92vw);
    background:rgba(0,0,0,.65); border:1px solid rgba(255,255,255,.15);
    border-radius:12px; padding:12px 14px; backdrop-filter:blur(4px);
    font-size:13px; line-height:1.45; pointer-events:auto; }
  #card-title { font-weight:800; margin-bottom:6px; font-size:14px; }
  #card-text { white-space:pre-line; }
  #btn-advance { margin-top:10px; width:100%; background:#2457a0;
    border:none; color:#fff; padding:10px; border-radius:8px; font-size:14px;
    font-weight:700; display:none; }

  #big { position:absolute; top:34%; left:50%; transform:translate(-50%,-50%);
    font-size:min(8vw,44px); font-weight:800; text-shadow:0 2px 12px #000;
    opacity:0; transition:opacity .25s; pointer-events:none; white-space:pre-line;
    text-align:center; }

  /* panel płyty E600 */
  #board { width:330px; background:#151b24; border-left:1px solid rgba(255,255,255,.12);
    padding:12px; display:flex; flex-direction:column; gap:10px; overflow-y:auto;
    box-sizing:border-box; }
  #board h3 { margin:0; font-size:12px; letter-spacing:.08em; opacity:.7;
    font-weight:700; }

  .leds { display:flex; gap:6px; flex-wrap:wrap; }
  .led { display:flex; flex-direction:column; align-items:center; gap:3px;
    font-size:9px; opacity:.95; width:46px; }
  .led i { width:14px; height:14px; border-radius:50%; background:#26120e;
    border:1px solid #000; box-shadow:inset 0 0 3px #000; }
  .led.on i { background:#ff4422; box-shadow:0 0 10px #ff4422; }
  .led.gr i { background:#2ecc71; box-shadow:0 0 10px #2ecc71; }

  #travel { position:relative; height:34px; background:#0a0e14; border-radius:8px;
    border:1px solid rgba(255,255,255,.12); overflow:hidden; }
  #travel-zone { position:absolute; top:0; bottom:0; background:rgba(46,204,113,.35);
    border-left:2px solid #2ecc71; border-right:2px solid #2ecc71; display:none; }
  #travel-marker { position:absolute; top:0; bottom:0; width:3px; background:#f1c40f; }
  #travel-label { position:absolute; bottom:2px; left:8px; font-size:10px; opacity:.75; }
  #travel-hint { font-size:10px; opacity:.65; text-align:center; }

  .btns { display:flex; gap:8px; }
  .btns button { flex:1; padding:14px 8px; border-radius:10px; border:1px solid
    rgba(255,255,255,.25); background:#1d2733; color:#fff; font-size:13px;
    font-weight:700; touch-action:none; position:relative; overflow:hidden; }
  .btns button:active { background:#2a3a4d; }
  .btns button:disabled { opacity:.3; }
  #hold-fill { position:absolute; left:0; top:0; bottom:0; width:0;
    background:rgba(46,204,113,.45); pointer-events:none; }

  .sw-row { display:flex; justify-content:space-between; align-items:center;
    gap:8px; font-size:11px; padding:4px 0; }
  .sw { min-width:74px; padding:8px 10px; border-radius:8px; font-size:12px;
    font-weight:700; background:#1d2733; color:#fff;
    border:1px solid rgba(255,255,255,.25); touch-action:manipulation; }
  .sw.on { background:#7a4f12; border-color:#f1c40f; }
  .sw:disabled { opacity:.35; }
  #board-note { font-size:10px; opacity:.55; line-height:1.4; }

  /* mobile: scena u góry, panel pod spodem */
  @media (max-width: 720px) {
    #layout { flex-direction:column; }
    #board { width:100%; border-left:none; border-top:1px solid rgba(255,255,255,.12);
      max-height:52%; }
    #card { max-width:70vw; font-size:12px; }
  }
</style>
</head>
<body>
<div id="layout">
  <div id="scene-wrap">
    <div id="app"></div>
    <div id="card">
      <div id="card-title">—</div>
      <div id="card-text">—</div>
      <button id="btn-advance">DALEJ</button>
    </div>
    <div id="big"></div>
  </div>

  <div id="board">
    <h3>PŁYTA E600 / E1000</h3>

    <div class="leds">
      <div class="led" id="ld1"><i></i>LD1<br/>OTW.</div>
      <div class="led" id="ld2"><i></i>LD2<br/>STOP</div>
      <div class="led" id="ld3"><i></i>LD3<br/>FSW</div>
      <div class="led" id="ld4"><i></i>LD4<br/>SET UP</div>
      <div class="led" id="ld5"><i></i>LD5<br/>OPEN A</div>
      <div class="led" id="ld6"><i></i>LD6<br/>OPEN B</div>
    </div>

    <div>
      <div id="travel">
        <div id="travel-zone"></div>
        <div id="travel-marker"></div>
        <div id="travel-label">brama zamknięta ————— otwarta</div>
      </div>
      <div id="travel-hint">pasek podróży bramy · zielona strefa = okno naciśnięcia</div>
    </div>

    <div class="btns">
      <button id="btn-setup">SETUP<i id="hold-fill"></i></button>
      <button id="btn-open">OPEN</button>
    </div>

    <h3>PRZEŁĄCZNIKI DS1</h3>
    <div class="sw-row"><span>1 · UKŁAD KONTROLNY</span><button class="sw" id="sw-control" disabled>WYŁ</button></div>
    <div class="sw-row"><span>2 · CZUŁOŚĆ PRZYGNIECENIA</span><button class="sw" id="sw-sens" disabled>MAŁA</button></div>
    <div class="sw-row"><span>4 · PRĘDKOŚĆ SANEK</span><button class="sw" id="sw-speed" disabled>DUŻA</button></div>
    <div class="sw-row"><span>LOGIKA STEROWANIA</span><button class="sw" id="sw-logic" disabled>A</button></div>
    <div id="board-note">A = automatyczny (zamyka po przerwie) · B = półautomatyczny.
      Podczas nauki detekcja przeszkód nie działa (rozdz. 11.2).</div>
  </div>
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
// [F0] fixed timestep 60 Hz (współdzielony z pozostałymi grami tryptyku)
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
// [F2] WebAudio; init po pierwszym geście
export class Audio {
  constructor() { this.ctx = null; }

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.3;
    this.master.connect(this.ctx.destination);
    this.hum = this.ctx.createOscillator();
    this.hum.type = 'triangle'; this.hum.frequency.value = 55;
    this.humGain = this.ctx.createGain(); this.humGain.gain.value = 0;
    this.hum.connect(this.humGain).connect(this.master);
    this.hum.start();
  }

  motor(on) { if (this.ctx) this.humGain.gain.value = on ? 0.12 : 0; }
  press()   { this._blip(1000, 0.07, 0.3); }
  switch()  { this._blip(1500, 0.04, 0.2, 'square'); }
  perfect() { this._blip(880, 0.12, 0.3); this._blip(1320, 0.15, 0.25); }
  good()    { this._blip(700, 0.1, 0.3); }
  error()   { this._blip(140, 0.5, 0.5, 'square'); }
  chime()   { [660, 880, 1100].forEach((f, i) =>
    setTimeout(() => this._blip(f, 0.25, 0.3), i * 140)); }

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

## js/gate/GateSystem.js

```js
// [F1] procedura nauki z instrukcji FAAC (rozdz. 11.2, tryb ręczny, logika B):
//  1. SETUP 1 s → dioda SET UP miga
//  2. OPEN: powolne zamykanie do punktu zatrzymania
//  3. OPEN: otwieranie
//  4. OPEN: punkt spowolnienia (otwieranie)
//  5. OPEN: punkt zatrzymania (otwieranie) — lub system sam wykryje
//  6. OPEN: zamykanie
//  7. OPEN: punkt spowolnienia (zamykanie) → dojazd do punktu → SUKCES
// Błąd = dioda SET UP miga wolno → powtórka segmentu (jak w instrukcji).
// Sukces = dioda świeci światłem ciągłym 5 s (dosłownie z instrukcji).

export const SEQUENCE = [
  { motion: 'close', from: 1, to: 0, time: 6.5, slow: true, points: [] },
  { motion: 'open',  from: 0, to: 1, time: 5.0, slow: false,
    points: [{ t: 0.75, id: 'slow-open' }, { t: 0.94, id: 'stop-open', auto: true }] },
  { motion: 'close', from: 1, to: 0, time: 5.0, slow: false, final: true,
    points: [{ t: 0.30, id: 'slow-close' }] },
];

export class LearnCycle {
  constructor() {
    this.cfg = { reactionPerfect: 1.2, reactionGood: 3.0, autoTimeout: 8,
                 winPerfect: 0.04, winGood: 0.09 };
    this.onEvent = null;   // callback(type, payload)
    this.reset();
  }

  reset() {
    this.si = 0;           // indeks segmentu
    this.pi = 0;           // indeks oczekiwanego punktu w segmencie
    this.phase = 'idle';   // idle | await | moving | error | success
    this.t = 1;            // start: brama otwarta (nauka od dowolnej pozycji — rozdz. 11.2)
    this.awaitT = 0;
    this.errT = 0;
    this.successT = 0;
    this.log = [];         // {label, score}
    this.errors = 0;
  }

  get seg() { return SEQUENCE[this.si]; }
  get pendingPoint() { return this.seg.points[this.pi] || null; }

  begin() { this.reset(); this.phase = 'await'; this.awaitT = 0; }

  // [F0/F1] naciśnięcie OPEN — serce gry rytmicznej
  pressOpen() {
    if (this.phase === 'await') {
      const score = this.awaitT <= this.cfg.reactionPerfect ? 100 :
                    this.awaitT <= this.cfg.reactionGood ? 60 : 40;
      this.log.push({ label: `start ${this.seg.motion === 'open' ? 'otwierania' : 'zamykania'}`, score });
      this.phase = 'moving';
      this._emit('phase-start', { score });
    }
    else if (this.phase === 'moving') {
      const p = this.pendingPoint;
      if (!p) { this._emit('stray'); return; }
      const err = Math.abs(this.t - p.t);
      if (err <= this.cfg.winPerfect) this._scorePoint(100, 'PERFECT!');
      else if (err <= this.cfg.winGood) this._scorePoint(60, 'dobrze');
      else this._fail('naciśnięcie poza oknem — punkt ustawiony błędnie');
    }
  }

  _scorePoint(score, tag) {
    const p = this.pendingPoint;
    this.log.push({ label: `punkt ${p.id}`, score });
    this.pi++;
    this._emit('point', { score, tag, id: p.id });
  }

  _fail(reason) {
    this.errors++;
    this.phase = 'error';
    this.errT = 0;
    this._emit('error', { reason });   // dioda SET UP miga wolno (jak w instrukcji)
  }

  _emit(type, payload) { if (this.onEvent) this.onEvent(type, payload); }

  get learnScore() {
    if (!this.log.length) return 0;
    return Math.round(this.log.reduce((s, l) => s + l.score, 0) / this.log.length);
  }

  update(dt) {
    if (this.phase === 'await') {
      this.awaitT += dt;
      if (this.awaitT > this.cfg.autoTimeout) {     // system sam kontynuuje (rozdz. 11.2)
        this.log.push({ label: 'auto-start', score: 30 });
        this.phase = 'moving';
        this._emit('phase-start', { score: 30, auto: true });
      }
    }
    else if (this.phase === 'moving') {
      const s = this.seg;
      const dir = Math.sign(s.to - s.from);
      const v = (1 / s.time) * (s.slow ? 0.55 : 1);
      this.t += dir * v * dt;

      const p = this.pendingPoint;
      if (p) {
        const passed = dir > 0 ? this.t > p.t + this.cfg.winGood
                               : this.t < p.t - this.cfg.winGood;
        if (passed) {
          if (p.auto) {                                  // punkt zatrzymania: auto-detect OK
            this.log.push({ label: `punkt ${p.id} (auto)`, score: 30 });
            this.pi++;
            this._emit('point', { score: 30, tag: 'AUTO — system sam wykrył', id: p.id });
          } else {
            this._fail('miniono okno punktu spowolnienia');
          }
        }
      }
      if ((dir > 0 && this.t >= s.to) || (dir < 0 && this.t <= s.to)) {
        this.t = s.to;
        if (s.final) { this.phase = 'success'; this.successT = 0; this._emit('success'); }
        else { this.si++; this.pi = 0; this.phase = 'await'; this.awaitT = 0; this._emit('segment-done'); }
      }
    }
    else if (this.phase === 'error') {
      this.errT += dt;
      if (this.errT > 2.5) {                             // powtórka segmentu
        this.t = this.seg.from;
        this.pi = 0;
        this.phase = 'await';
        this.awaitT = 0;
        this._emit('retry');
      }
    }
    else if (this.phase === 'success') {
      this.successT += dt;                               // dioda SET UP: 5 s światła ciągłego
      if (this.successT > 5) this._emit('success-end');
    }
  }
}
```

---

## js/gate/GateView.js

```js
import * as THREE from 'three';

// [F0] brama segmentowa na prowadnicy (krzywa z parametryzacją długości łuku —
// ten sam wzorzec co w Gate Rush) + lampa ostrzegawcza + fotokomórki.
export class GateView {
  constructor(scene) {
    this.doorLen = 2.4;
    this.segs = 6;
    this.segH = this.doorLen / this.segs;

    const pts = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 2.6, 0),
      new THREE.Vector3(0, 2.9, -1.0),
      new THREE.Vector3(0, 2.9, -3.2),
    ];
    this.curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.4);
    const N = 256;
    this.samples = this.curve.getSpacedPoints(N);
    this.segLen = this.curve.getLength() / N;
    this.totalLen = this.curve.getLength();
    this.travel = this.totalLen - this.doorLen - 0.2;

    // środowisko: nadproże + sufit + podłoga + ściany
    const wall = new THREE.MeshStandardMaterial({ color: 0x2c333d, roughness: 0.9 });
    const mk = (w, h, d, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wall);
      m.position.set(x, y, z); scene.add(m);
    };
    mk(9, 0.5, 0.5, 0, 2.65, 0);        // nadproże
    mk(9, 0.2, 3.6, 0, 3.0, -1.8);     // sufit
    mk(1, 3.4, 4.2, -4.5, 1.7, -2.0);   // ściana lewa
    mk(1, 3.4, 4.2, 4.5, 1.7, -2.0);   // ściana prawa
    const floor = new THREE.Mesh(new THREE.BoxGeometry(12, 0.1, 10),
      new THREE.MeshStandardMaterial({ color: 0x20252c, roughness: 0.95 }));
    floor.position.set(0, -0.05, 0.5);
    scene.add(floor);

    // segmenty bramy
    const segMat = new THREE.MeshStandardMaterial({
      color: 0x8fa3b8, roughness: 0.55, metalness: 0.3 });
    this.segments = [];
    for (let k = 0; k < this.segs; k++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(6, this.segH * 0.97, 0.07), segMat);
      scene.add(m);
      this.segments.push(m);
    }

    // szyny
    const railGeo = new THREE.TubeGeometry(this.curve, 48, 0.045, 8);
    const railMat = new THREE.MeshStandardMaterial({ color: 0x2b323b, roughness: 0.6 });
    for (const x of [-3.08, 3.08]) {
      const r = new THREE.Mesh(railGeo, railMat);
      r.position.x = x; scene.add(r);
    }

    // lampa ostrzegawcza (miga w ruchu — jak w instrukcji)
    this.lampMat = new THREE.MeshStandardMaterial({
      color: 0x330606, emissive: 0xff2211, emissiveIntensity: 0 });
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.2), this.lampMat);
    lamp.position.set(2.4, 3.35, 0.35); scene.add(lamp);

    // fotokomórki (używane w symulacji — zdarzenie "kot")
    const postMat = new THREE.MeshStandardMaterial({ color: 0x22262c, roughness: 0.7 });
    for (const x of [-3.25, 3.25]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.3, 0.12), postMat);
      post.position.set(x, 0.15, 0.7); scene.add(post);
    }
    this.beamMat = new THREE.MeshStandardMaterial({
      color: 0x003318, emissive: 0x22ff77, emissiveIntensity: 1.0 });
    this.beam = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.025, 0.025), this.beamMat);
    this.beam.position.set(0, 0.18, 0.7); scene.add(this.beam);

    this._time = 0;
  }

  pathPoint(s) {
    s = THREE.MathUtils.clamp(s, 0, this.totalLen - 1e-3);
    const i = Math.min(Math.floor(s / this.segLen), this.samples.length - 2);
    const f = (s - i * this.segLen) / this.segLen;
    return new THREE.Vector3().lerpVectors(this.samples[i], this.samples[i + 1], f);
  }

  sync(t, moving, beamBlocked, dt) {
    this._time += dt;
    const d = t * this.travel;
    this.segments.forEach((seg, k) => {
      const s = d + (k + 0.5) * this.segH;
      const p = this.pathPoint(s);
      const p2 = this.pathPoint(s + 0.05);
      const tan = p2.clone().sub(p).normalize();
      const x = new THREE.Vector3(1, 0, 0);
      const z = new THREE.Vector3().crossVectors(x, tan).normalize();
      seg.position.copy(p);
      seg.matrix.makeBasis(x, tan, z).setPosition(p);
    });
    this.lampMat.emissiveIntensity = moving
      ? ((this._time * 4) % 1 < 0.5 ? 3.0 : 0.2) : 0;
    this.beamMat.emissiveIntensity = beamBlocked
      ? 2.5 + Math.sin(this._time * 20) * 1.5 : 1.0;
  }
}
```

---

## js/board/BoardPanel.js

```js
// [F0] panel płyty E600 w DOM — przyciski dotykowe z natury (mobile-first),
// diody LD1–LD6, pasek podróży bramy, [F1] przełączniki DS1 + logika A/B.
const $ = (s) => document.querySelector(s);

export class BoardPanel {
  constructor() {
    this.leds = {};
    for (const n of [1, 2, 3, 4, 5, 6]) this.leds[n] = $('#ld' + n);
    this.zone = $('#travel-zone');
    this.marker = $('#travel-marker');
    this.hint = $('#travel-hint');
    this.btnSetup = $('#btn-setup');
    this.btnOpen = $('#btn-open');
    this.holdFill = $('#hold-fill');
    this.sw = {
      control: $('#sw-control'), sens: $('#sw-sens'),
      speed: $('#sw-speed'), logic: $('#sw-logic'),
    };

    this.onOpen = null;
    this.onSetup = null;
    this.onSwitch = null;

    this.btnOpen.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (this.onOpen) this.onOpen();
    });

    // [F0] SETUP: przytrzymaj 1 s (jak w instrukcji — "wciśnij i przytrzymać 1 s")
    let holdRAF = null;
    const startHold = (e) => {
      e.preventDefault();
      let t0 = performance.now();
      const step = () => {
        const p = Math.min((performance.now() - t0) / 1000, 1);
        this.holdFill.style.width = p * 100 + '%';
        if (p >= 1) { this._endHold(); if (this.onSetup) this.onSetup(); return; }
        holdRAF = requestAnimationFrame(step);
      };
      holdRAF = requestAnimationFrame(step);
    };
    const cancelHold = () => {
      cancelAnimationFrame(holdRAF);
      this.holdFill.style.width = '0%';
    };
    this.btnSetup.addEventListener('pointerdown', startHold);
    this.btnSetup.addEventListener('pointerup', cancelHold);
    this.btnSetup.addEventListener('pointerleave', cancelHold);
    this.btnSetup.addEventListener('pointercancel', cancelHold);

    // przełączniki
    const wire = (key) => {
      this.sw[key].addEventListener('click', () => {
        if (this.sw[key].disabled) return;
        this._toggle(key);
        if (this.onSwitch) this.onSwitch(key, this.config[key]);
      });
    };
    ['control', 'sens', 'speed', 'logic'].forEach(wire);
    this._applySwitchVisuals();
  }

  _states = { control: false, sens: 'MAŁA', speed: 'DUŻA', logic: 'A' };

  _toggle(key) {
    if (key === 'control') this._states.control = !this._states.control;
    else if (key === 'sens') this._states.sens = this._states.sens === 'MAŁA' ? 'DUŻA' : 'MAŁA';
    else if (key === 'speed') this._states.speed = this._states.speed === 'DUŻA' ? 'MAŁA' : 'DUŻA';
    else if (key === 'logic') this._states.logic = this._states.logic === 'A' ? 'B' : 'A';
    this._applySwitchVisuals();
  }

  _applySwitchVisuals() {
    this.sw.control.textContent = this._states.control ? 'ZŁ' : 'WYŁ';
    this.sw.control.classList.toggle('on', this._states.control);
    this.sw.sens.textContent = this._states.sens;
    this.sw.sens.classList.toggle('on', this._states.sens === 'DUŻA');
    this.sw.speed.textContent = this._states.speed;
    this.sw.speed.classList.toggle('on', this._states.speed === 'MAŁA');
    this.sw.logic.textContent = this._states.logic;
    this.sw.logic.classList.toggle('on', this._states.logic === 'B');
  }

  get config() { return { ...this._states }; }
  setSwitchesEnabled(v) {
    Object.values(this.sw).forEach(b => (b.disabled = !v));
  }
  setButtonsEnabled(setup, open) {
    this.btnSetup.disabled = !setup;
    this.btnOpen.disabled = !open;
  }
  setOpenLabel(txt) { this.btnOpen.textContent = txt; this.btnOpen.prepend(this.holdFill); }

  // diody: on/off + opcjonalne miganie (obsługiwane w update)
  setLED(n, mode) { this.leds[n].dataset.mode = mode; } // 'off'|'on'|'blink'|'gr'
  updateLEDs(time) {
    for (const n of Object.keys(this.leds)) {
      const el = this.leds[n];
      const m = el.dataset.mode || 'off';
      const on = m === 'on' || m === 'gr' ||
        (m === 'blink' && (time * 2) % 1 < 0.5) ||
        (m === 'slowblink' && (time * 0.7) % 1 < 0.5);
      el.classList.toggle('on', on && m !== 'gr');
      el.classList.toggle('gr', on && m === 'gr');
    }
  }

  setTravel(t, point) {
    this.marker.style.left = `calc(${(t * 100).toFixed(1)}% - 1px)`;
    if (point) {
      const w = 0.09; // okno ±0.09 w jednostkach t
      this.zone.style.display = 'block';
      this.zone.style.left = ((point.t - w) * 100) + '%';
      this.zone.style.width = (2 * w * 100) + '%';
      this.hint.textContent = `celuj w zieloną strefę: ${point.id}`;
    } else {
      this.zone.style.display = 'none';
      this.hint.textContent = this._hint || '';
    }
  }
  setHint(txt) { this._hint = txt; this.hint.textContent = txt; }
}
```

---

## js/sim/Simulator.js

```js
// [F2] "dzień z życia" skonfigurowanego systemu — zdarzenia z instrukcji:
//  cat       — kot przecina fotokomórki przy zamykaniu (rozdz. 10, FSW)
//  wind      — duże opory/nieregularny ruch vs czułość zabezpieczenia (rozdz. 8.4)
//  radio     — interaktywnie: impuls radiowy w trakcie otwierania (logika A/B, rozdz. 8.5)
//  obstacle3 — przeszkoda 3× w tym samym miejscu → nowy punkt zamknięcia (rozdz. 8.5)
//  blackout  — zanik zasilania → praca z akumulatorów, lampa miga = usterka (rozdz. 17.4)
export const SIM_EVENTS = [
  {
    id: 'cat', title: 'Kot na podjeździe',
    text: 'Podczas zamykania kot przecina wiązkę fotokomórek.',
    eval(cfg) {
      if (cfg.control)
        return { text: 'Układ kontrolny zadziałał: brama zatrzymana i wycofana. Kot przechodzi bezpiecznie. ✓',
                 safety: 0, convenience: -2, gate: 'cat-safe', led: 3 };
      return { text: 'UKŁAD KONTROLNY WYŁĄCZONY — brama kontynuuje zamykanie mimo przerwania wiązki! zagrożenie. ✗',
               safety: -30, convenience: 0, gate: 'cat-fail' };
    },
  },
  {
    id: 'wind', title: 'Silny wiatr — brama "szarpie"',
    text: 'Nieregularny ruch bramy przy podmuchach wiatru.',
    eval(cfg) {
      if (cfg.sens === 'DUŻA')
        return { text: 'Wysoka czułość zabezpieczenia: fałszywe rewersy przy podmuchach (irytujące, ale bezpieczne).',
                 safety: 0, convenience: -12, gate: 'reversal' };
      return { text: 'Obniżona czułość (zalecana dla bram o nieregularnym ruchu): brama działa płynnie — ale zapas bezpieczeństwa mniejszy.',
               safety: -8, convenience: 0, gate: 'normal' };
    },
  },
  {
    id: 'radio', title: 'Impuls radiowy w trakcie otwierania',
    text: 'Gospodarz (ty!) wciska pilota, gdy brama właśnie się otwiera. Co zrobi Twój układ?',
    interactive: true,
    eval(cfg) {
      if (cfg.logic === 'A')
        return { text: 'LOGIKA A: sygnał podczas otwierania nie wywiera żadnego skutku — brama jedzie dalej (tabela z rozdz. 8.5).',
                 safety: 0, convenience: 0, gate: 'radio-a', score: 10 };
      return { text: 'LOGIKA B: sygnał podczas otwierania ZATRZYMUJE bramę (rozdz. 8.5). Prawidłowe zachowanie dla trybu półautomatycznego.',
               safety: 0, convenience: -3, gate: 'radio-b', score: 10 };
    },
  },
  {
    id: 'obstacle3', title: 'Przeszkoda 3× w tym samym miejscu',
    text: 'Gałąź blokuje bramę w tym samym punkcie przy trzech kolejnych próbach zamykania.',
    eval(cfg) {
      if (cfg.sens === 'DUŻA')
        return { text: 'Po trzech detekcjach system przyjął tę pozycję jako NOWY PUNKT ZAMKNIĘCIA (rozdz. 8.5). Konieczna nowa procedura nauki!',
                 safety: -8, convenience: -8, gate: 'newclose' };
      return { text: 'System zachował punkt zamknięcia, ale kara za zbyt niską czułość już została naliczona wcześniej.',
               safety: -5, convenience: 0, gate: 'normal' };
    },
  },
  {
    id: 'blackout', title: 'Zanik zasilania',
    text: 'Wyłączenie prądu w całym domu w trakcie ruchu bramy.',
    eval() {
      return { text: 'Zestaw akumulatorów przejmuje zasilanie — brama kończy manewr (rozdz. 17.4). Lampa miga: system sygnalizuje tryb awaryjny.',
               safety: 0, convenience: -5, gate: 'blackout' };
    },
  },
];

export class Simulator {
  constructor() { this.i = 0; this.radioPressed = false; }
  get current() { return SIM_EVENTS[this.i]; }
  get done() { return this.i >= SIM_EVENTS.length; }
  advance(cfg) {
    const ev = this.current;
    const out = ev.eval(cfg);
    if (ev.interactive) out.radioPressed = this.radioPressed;
    this.i++;
    return out;
  }
}
```

---

## js/ui/Hud.js

```js
// [F1] karty narracyjne + wielki flash
export class Hud {
  constructor() {
    this.card = document.getElementById('card');
    this.title = document.getElementById('card-title');
    this.text = document.getElementById('card-text');
    this.btn = document.getElementById('btn-advance');
    this.big = document.getElementById('big');
    this.onAdvance = null;
    this.btn.addEventListener('click', () => { if (this.onAdvance) this.onAdvance(); });
    this._t = 0;
  }
  cardShow(title, text, btnLabel) {
    this.card.style.display = 'block';
    this.title.textContent = title;
    this.text.textContent = text;
    this.btn.style.display = btnLabel ? 'block' : 'none';
    this.btn.textContent = btnLabel || '';
  }
  cardHide() { this.card.style.display = 'none'; }
  flash(msg, ms = 1300) {
    this.big.textContent = msg;
    this.big.style.opacity = 1;
    clearTimeout(this._t);
    this._t = setTimeout(() => { this.big.style.opacity = 0; }, ms);
  }
}
```

---

## js/main.js

```js
import * as THREE from 'three';
import { GameLoop } from './core/GameLoop.js';
import { Audio } from './core/AudioManager.js';
import { GateView } from './gate/GateView.js';
import { LearnCycle, SEQUENCE } from './gate/GateSystem.js';
import { BoardPanel } from './board/BoardPanel.js';
import { Simulator, SIM_EVENTS } from './sim/Simulator.js';
import { Hud } from './ui/Hud.js';

/* ---------- renderer / scena ---------- */

const isMobile = matchMedia('(pointer:coarse)').matches || navigator.maxTouchPoints > 0;

const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: !isMobile });
renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile ? 1.5 : 2));
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d1420);
scene.fog = new THREE.Fog(0x0d1420, 20, 60);

const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 100);
scene.add(new THREE.HemisphereLight(0x8899bb, 0x1a1f28, 0.9));
const sun = new THREE.DirectionalLight(0xffeecc, 1.4);
sun.position.set(8, 12, 10);
scene.add(sun);

function resize() {
  const w = app.clientWidth, h = app.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.fov = camera.aspect < 1 ? 70 : 58;   // portrait: szerszy kąt
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);

/* ---------- obiekty ---------- */

const audio = new Audio();
const gateView = new GateView(scene);
const board = new BoardPanel();
const hud = new Hud();
const learn = new LearnCycle();
const sim = new Simulator();

/* ---------- scenariusze konfiguracji (F1) ---------- */

const SCENARIOS = [
  { name: 'Dom z dziećmi i zwierzakami',
    text: 'Brama garażowa w domu rodzinnym. Podjazdem często biegają dzieci i kot.\n' +
          'Ustaw przełączniki DS1 i tryb logiki tak, żeby bezpieczeństwo było priorytetem.',
    want: { control: true, sens: 'DUŻA', logic: 'B', speed: 'MAŁA' } },
  { name: 'Warsztat — stara brama o nieregularnym ruchu',
    text: 'Duży ruch całym dniem, brama czasem "szarpie" przy podmuchach.\n' +
          'Instrukcja zaleca tu obniżoną czułość zabezpieczenia przed przygnieceniem.',
    want: { control: true, sens: 'MAŁA', logic: 'A', speed: 'DUŻA' } },
  { name: 'Dom jednorodzinny, krótki podjazd',
    text: 'Standardowy dom, sprawna brama, krótki podjazd od ulicy.\n' +
          'Wygoda użytkowania jest ważna, ale fotokomórki muszą działać.',
    want: { control: true, sens: 'DUŻA', logic: 'A', speed: 'DUŻA' } },
];
const scenario = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];

/* ---------- stan etapów ---------- */

const S = { stage: 'intro', simAnim: null, results: null, time: 0 };

function setStage(name) {
  S.stage = name;
  if (name === 'intro') {
    hud.cardShow('TRYB NAUKI — płyta E600',
      'Jesteś firmware centrali E600/E1000.\n' +
      'Nowo zamontowany napęd D600 nie zna jeszcze punktów zatrzymania bramy.\n\n' +
      'Przeprowadź procedurę nauki (rozdz. 11.2):\n' +
      'przytrzymaj SETUP przez 1 sekundę, a potem naciskaj OPEN we właściwych ' +
      'momentach podróży bramy.\n\nUwaga: podczas nauki detekcja przeszkód nie działa.');
    board.setButtonsEnabled(true, false);
    board.setSwitchesEnabled(false);
    board.setHint('przytrzymaj SETUP');
  }
  if (name === 'learn') {
    hud.cardHide();
    board.setButtonsEnabled(false, true);
    board.setHint('naciskaj OPEN w zielonych strefach');
    learn.begin();
  }
  if (name === 'config') {
    hud.cardShow('KONFIGURACJA — ' + scenario.name, scenario.text, 'ZATWIERDŹ');
    board.setButtonsEnabled(false, false);
    board.setSwitchesEnabled(true);
    board.setHint('ustaw DS1 + logikę');
  }
  if (name === 'sim') {
    hud.cardShow('SYMULACJA — dzień z życia',
      'System działa w Twojej konfiguracji.\nPrzejdź przez zdarzenia dnia.', 'START');
    board.setButtonsEnabled(false, false);
    board.setSwitchesEnabled(false);
  }
  if (name === 'report') {
    showReport();
  }
}

/* ---------- zdarzenia płyty ---------- */

board.onSetup = () => {
  if (S.stage !== 'intro') return;
  audio.init(); audio.press();
  setStage('learn');
};

learn.onEvent = (type, p) => {
  if (type === 'phase-start') { audio.press(); audio.motor(true); }
  if (type === 'point') {
    if (p.score >= 100) { audio.perfect(); hud.flash('PERFECT!', 800); }
    else if (p.score >= 60) { audio.good(); hud.flash('dobrze', 700); }
    else { audio.press(); hud.flash('AUTO — system sam wykrył punkt', 1100); }
  }
  if (type === 'error') { audio.error(); audio.motor(false); hud.flash('BŁĄD CYKLU\nSET UP miga wolno — powtórka segmentu', 2000); }
  if (type === 'retry') { hud.flash('ponawiam segment…', 900); }
  if (type === 'segment-done') { audio.motor(false); hud.flash('segment OK', 800); }
  if (type === 'stray') { audio.press(); hud.flash('zbędny impuls — zignorowany (logika B: STOP)', 900); }
  if (type === 'success') {
    audio.motor(false); audio.chime();
    hud.flash('CYKL NAUKI ZALICZONY\nLD4: światło ciągłe 5 s', 2200);
  }
  if (type === 'success-end') setStage('config');
};

/* ---------- walidacja konfiguracji ---------- */

hud.onAdvance = () => {
  if (S.stage === 'config') {
    const cfg = board.config;
    const checks = [
      ['układ kontrolny', cfg.control === scenario.want.control],
      ['czułość', cfg.sens === scenario.want.sens],
      ['logika', cfg.logic === scenario.want.logic],
      ['prędkość', cfg.speed === scenario.want.speed],
    ];
    const ok = checks.filter(c => c[1]).length;
    S.configScore = Math.round(ok / 4 * 30);
    const wrong = checks.filter(c => !c[1]).map(c => c[0]).join(', ');
    hud.cardShow('WERYFIKACJA KONFIGURACJI',
      `Poprawne przełączniki: ${ok}/4\n` +
      (wrong ? `Do poprawy: ${wrong}\n` : '') +
      `Wynik konfiguracji: ${S.configScore}/30`, 'DO SYMULACJI');
    S.stage = 'sim-ready';
    return;
  }
  if (S.stage === 'sim-ready') { setStage('sim'); return; }
  if (S.stage === 'sim') { runSimEvent(); return; }
  if (S.stage === 'sim-wait') { showNextSimResult(); return; }
};

/* ---------- symulacja (F2) ---------- */

let simOutcome = null;

function runSimEvent() {
  if (sim.done) { setStage('report'); return; }
  const ev = sim.current;
  hud.cardShow(`ZDARZENIE ${sim.i + 1}/${SIM_EVENTS.length} · ${ev.title}`, ev.text,
    ev.interactive ? null : 'DALEJ');
  if (ev.interactive) {
    // gracz sam wciska pilota podczas otwierania bramy
    board.setButtonsEnabled(false, true);
    board.setOpenLabel('PILOT');
    board.setHint('wciśnij PILOT w trakcie otwierania');
    startSimAnim('radio-open');
    S.stage = 'sim-radio';
  } else {
    S.stage = 'sim-run';
    startSimAnim('brief');
    setTimeout(() => { if (S.stage === 'sim-run') showNextSimResult(); }, 900);
  }
}

function showNextSimResult() {
  const out = sim.advance(board.config);
  simOutcome = out;
  if (out.led) board.setLED(out.led, 'on');
  hud.cardShow('WYNIK ZDARZENIA', out.text, 'DALEJ');
  startSimAnim(out.gate);
  S.stage = 'sim-wait';
  if (sim.done) {
    S.stage = 'sim-last';
  }
}

// finał symulacji → raport
hud.onAdvanceWrapper = null;

function showReport() {
  const learnScore = Math.round(learn.learnScore * 0.3);
  const safety = Math.max(0, 100 + (S.safety || 0));
  const convenience = Math.max(0, 100 + (S.convenience || 0));
  const total = learnScore + (S.configScore || 0) +
    Math.round(safety * 0.25) + Math.round(convenience * 0.15);
  const grade = total >= 85 ? 'INSTALATOR FAAC ✓' : total >= 60 ? 'MONTER — DOBRZE' : 'POWTÓRZ SZKOLENIE';
  const best = Math.max(total, +(localStorage.getItem('trybnauki-best') || 0));
  localStorage.setItem('trybnauki-best', best);
  hud.cardShow('RAPORT KOŃCOWY',
    `Tryb nauki: ${learn.learnScore}/100 → ${learnScore}/30 pkt\n` +
    `Konfiguracja: ${S.configScore || 0}/30 pkt\n` +
    `Bezpieczeństwo: ${safety}/100 → ${Math.round(safety * 0.25)}/25 pkt\n` +
    `Wygoda: ${convenience}/100 → ${Math.round(convenience * 0.15)}/15 pkt\n\n` +
    `RAZEM: ${total}/100\nOCENA: ${grade}\nRekord: ${best}`, 'OD NOWA');
  S.stage = 'report';
  audio.chime();
}

hud.onAdvance = (() => {
  const orig = hud.onAdvance;
  return () => {
    if (S.stage === 'report') { location.reload(); return; }
    if (S.stage === 'sim-last') {
      // ostatni wynik już pokazany → raport
      finishSim(); return;
    }
    orig();
  };
})();

function finishSim() {
  setStage('report');
}

/* ---------- animacje symulacji (prosty tween t) ---------- */

const anim = { active: false, t: 0, target: 0, speed: 0.25, then: null, beam: false };

function startSimAnim(kind) {
  anim.active = true;
  anim.kind = kind;
  anim.beam = false;
  if (kind === 'brief') { anim.active = false; return; }
  if (kind === 'radio-open') { anim.t = 0; anim.target = 0.7; anim.speed = 0.25; }
  if (kind === 'cat-safe' || kind === 'cat-fail') {
    anim.t = 0.7; anim.target = 0.3; anim.speed = 0.3; anim.beam = kind === 'cat-safe';
  }
  if (kind === 'reversal') { anim.t = 0.6; anim.target = 0.75; anim.speed = 0.35; }
  if (kind === 'normal' || kind === 'radio-a') { anim.t = 0.3; anim.target = 0.9; anim.speed = 0.25; }
  if (kind === 'radio-b') { anim.t = 0.4; anim.target = 0.45; anim.speed = 0.25; }
  if (kind === 'newclose') { anim.t = 0.8; anim.target = 0.2; anim.speed = 0.2; }
  if (kind === 'blackout') { anim.t = 0.4; anim.target = 0.6; anim.speed = 0.12; }
}

function updateAnim(dt) {
  if (!anim.active) return;
  const dir = Math.sign(anim.target - anim.t);
  anim.t += dir * anim.speed * dt;
  if ((dir > 0 && anim.t >= anim.target) || (dir < 0 && anim.t <= anim.target)) {
    anim.t = anim.target;
    anim.active = false;
    if (anim.kind === 'cat-safe') { anim.active = true; anim.target = 1; anim.kind = 'cat-reverse'; }
    else if (anim.kind === 'radio-open') {
      // okno na pilota minęło — jeśli nie wciśnięto, zdarzenie przepada z kosztem
      if (S.stage === 'sim-radio' && !sim.radioPressed) {
        hud.cardShow('SPÓŹNIENIE', 'Impuls radiowy nie nastąpił podczas otwierania — zdarzenie testowe pominięte (−10 pkt).', 'DALEJ');
        S.stage = 'sim-wait'; if (sim.done) S.stage = 'sim-last';
        sim.radioPressed = true; // zużyj zdarzenie
        sim.i++;
      }
    }
  }
}

/* ---------- pilot w symulacji ---------- */

board.onOpen = () => {
  audio.init();
  if (S.stage === 'learn') { learn.pressOpen(); return; }
  if (S.stage === 'sim-radio') {
    sim.radioPressed = true;
    audio.press();
    const out = sim.advance(board.config);
    const bonus = out.score || 0;
    S.safety = (S.safety || 0) + out.safety;
    S.convenience = (S.convenience || 0) + out.convenience;
    hud.cardShow('WYNIK: impuls w trakcie otwierania', out.text, 'DALEJ');
    board.setOpenLabel('OPEN');
    board.setButtonsEnabled(false, false);
    startSimAnim(out.gate);
    S.stage = sim.done ? 'sim-last' : 'sim-wait';
  }
};

/* ---------- pętla ---------- */

function update(dt) {
  S.time += dt;
  learn.update(dt);
  updateAnim(dt);
}

function render() {
  let t, moving;
  if (S.stage === 'sim' || S.stage === 'sim-radio' || S.stage === 'sim-wait' ||
      S.stage === 'sim-run' || S.stage === 'sim-ready' || S.stage === 'sim-last' ||
      S.stage === 'report') {
    t = anim.t; moving = anim.active;
  } else {
    t = learn.t;
    moving = learn.phase === 'moving';
  }

  // diody wg stanu
  board.setLED(1, moving && t < 1 && t > 0 ? 'on' : 'off');
  board.setLED(2, !moving ? 'on' : 'off');
  board.setLED(3, anim.beam ? 'on' : 'off');
  board.setLED(4, learn.phase === 'moving' || learn.phase === 'await' ? 'blink'
    : learn.phase === 'error' ? 'slowblink'
    : learn.phase === 'success' ? 'on' : 'off');
  board.updateLEDs(S.time);

  // pasek podróży
  const point = (S.stage === 'learn' && learn.phase === 'moving') ? learn.pendingPoint : null;
  board.setTravel(t, point);

  gateView.sync(t, moving, anim.beam, 1 / 60);
  audio.motor(moving);
  renderer.render(scene, camera);
}

resize();
setStage('intro');
new GameLoop(update, render);

addEventListener('pointerdown', () => audio.init(), { once: true });
addEventListener('keydown', (e) => {
  if (e.code === 'Space') { e.preventDefault(); board.onOpen && board.onOpen(); }
});
```

---

## Uruchomienie i kontrolny przebieg

1. `npx serve .` (z katalogu `trybnauki/`) → otwórz podany URL.
2. Przytrzymaj **SETUP** 1 s (wypełnia się zielony pasek na przycisku).
3. Rytm: OPEN startuje zamykanie → czekaj na powrót do "await" → OPEN startuje
   otwieranie → OPEN w strefie ~75% (punkt spowolnienia) → OPEN przy ~94%
   (punkt zatrzymania) → OPEN startuje zamykanie → OPEN przy ~30% → czekaj na domknięcie.
4. Konfiguracja: ustaw DS1 + logikę wg scenariusza z karty → ZATWIERDŹ.
5. Symulacja: przechodź zdarzenia; przy "impulsie radiowym" wciśnij PILOT
   (przycisk OPEN zmienia etykietę) w trakcie otwierania bramy.

## Uwagi implementacyjne

**Faza 0 (pion):** wystarczą `GameLoop`, `GateView`, `BoardPanel` (bez DS1) i `LearnCycle`
zredukowany do dwóch pierwszych segmentów z jednym punktem. Test feelingu: czy okno
±4%/±9% na pasku podróży daje satysfakcyjne "PERFECT!".

**Faza 1:** pełna sekwencja 6 naciśnięć + ocena, obsługa błędów (wolne miganie LD4
i powtórka segmentu — jak sygnalizacja błędu z instrukcji), sukces = LD4 świeci
stale 5 s, konfiguracja DS1 z walidacją pod scenariusz.

**Faza 2:** `Simulator` z pięcioma zdarzeniami (kot/wiatr/radio/3×przeszkoda/blackout),
interaktywny pilot, animacje bramy i wiązki fotokomórek, raport końcowy
(30 pkt nauka + 30 konfiguracja + 25 bezpieczeństwo + 15 wygoda) i rekord
w localStorage.

**Sterowanie:** SETUP = przytrzymanie (hold z paskiem postępu), OPEN/PILOT = tap
lub Space na PC, przełączniki DS1 = zwykłe kliknięcia — wszystko działa identycznie
na dotyku i myszce (pointer events, `touch-action:none` na przyciskach hold).

**Celowe uproszczenia vs plan:** etap 3 "dzień z życia" jest półautomatyczny
(zdarzenia pokazywane kartami + jedna interakcja pilota) zamiast w pełni
czasowego — pełną wersję czasu-rzeczywistego łatwo dobudować na `Simulator`,
podmieniając `setTimeout` na harmonogram w `update()`. Diody LD5/LD6 (pamięć
kanałów radiowych) są w panelu, ale nieaktywne — rezerwa pod rozbudowę o
programowanie pilotów (rozdz. 12).
