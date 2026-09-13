import * as T from 'three';

export type GameCleanup = () => void;

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function isCoarsePointer() {
  return typeof window !== 'undefined' &&
    (window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0);
}

export function createRenderer(container: HTMLElement, alpha = false) {
  const renderer = new T.WebGLRenderer({
    antialias: !isCoarsePointer(),
    alpha,
    powerPreference: 'low-power',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isCoarsePointer() ? 1.5 : 2));
  renderer.shadowMap.enabled = !isCoarsePointer();
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.setClearColor('#101619', alpha ? 0 : 1);
  container.appendChild(renderer.domElement);
  return renderer;
}

export class FixedGameLoop {
  private frame = 0;
  private last = 0;
  private accumulator = 0;
  private running = false;
  private readonly step = 1 / 60;

  constructor(
    private readonly update: (dt: number) => void,
    private readonly render: (dt: number) => void,
  ) {}

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const tick = (now: number) => {
      if (!this.running) return;
      const dt = Math.min((now - this.last) / 1000, 0.1);
      this.last = now;
      this.accumulator += dt;
      while (this.accumulator >= this.step) {
        this.update(this.step);
        this.accumulator -= this.step;
      }
      this.render(dt);
      this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.frame);
  }
}

export class AudioBase {
  protected context: AudioContext | null = null;
  protected master: GainNode | null = null;

  init() {
    if (this.context) {
      if (this.context.state === 'suspended') void this.context.resume();
      return;
    }
    const AudioContextCtor = window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;
    this.context = new AudioContextCtor();
    this.master = this.context.createGain();
    this.master.gain.value = 0.18;
    this.master.connect(this.context.destination);
  }

  tone(frequency: number, duration = 0.12, volume = 0.3, type: OscillatorType = 'sine') {
    if (!this.context || !this.master) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + duration);
    oscillator.connect(gain).connect(this.master);
    oscillator.start();
    oscillator.stop(this.context.currentTime + duration);
  }

  dispose() {
    if (this.context) void this.context.close();
    this.context = null;
    this.master = null;
  }
}

export class FlashOverlay {
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly element: HTMLElement) {}

  show(text: string, tone = '') {
    this.element.textContent = text;
    this.element.dataset.tone = tone;
    this.element.classList.add('is-visible');
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.element.classList.remove('is-visible'), 1100);
  }

  dispose() {
    if (this.timer) clearTimeout(this.timer);
  }
}

export function loadScores<T>(key: string): T[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function saveScore<T extends { score: number }>(key: string, score: T, limit = 5) {
  const scores = loadScores<T>(key);
  scores.push(score);
  scores.sort((a, b) => b.score - a.score);
  localStorage.setItem(key, JSON.stringify(scores.slice(0, limit)));
  return scores.slice(0, limit);
}

export function disposeObject(root: T.Object3D) {
  root.traverse((object) => {
    if (!(object instanceof T.Mesh)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => material.dispose());
  });
}
