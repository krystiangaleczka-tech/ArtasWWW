'use client';

import {useEffect, useRef, useState} from 'react';
import * as T from 'three';
import {CarFront, ChevronDown, Gamepad2, RotateCcw, Trophy, Zap} from 'lucide-react';
import {AudioBase, clamp, createRenderer, disposeObject, FixedGameLoop, FlashOverlay, loadScores, saveScore} from '@/lib/games/shared';

type GatePattern = {pause: number; speed: number; delay: number};
type Level = {
  id: string; name: string; gates: number; obstacles: number; pause: number; speed: number;
  blackout?: boolean; hardcore?: boolean; gatePattern?: GatePattern[]; powerups?: number; rivals?: number;
};
type InputState = {left: boolean; right: boolean; gas: boolean; brake: boolean; remote: boolean};
type GateData = {
  t: number; state: 'closed' | 'warning-open' | 'opening' | 'open' | 'warning-close' | 'closing';
  timer: number; collisions: number; beamHold: boolean; pause: number; speed: number; boost: number;
  warn: number; closedWait: number; pauseBase: number;
};
type ObstacleData = {x: number; z: number; baseX: number; phase: number; mesh: T.Mesh};
type GhostPoint = {x: number; z: number; time: number};
type PowerupType = 'turbo' | 'shield' | 'pilot' | 'slowmo' | 'multi';
type PowerupSlot = {type: PowerupType; x: number; z: number; mesh: T.Mesh; active: boolean};
type RivalData = {mesh: T.Group; z: number; lane: number; speed: number};

const levels: Level[] = [
  {
    id: 'tutorial', name: 'Podjazd · tutorial', gates: 4, obstacles: 2, pause: 2.6, speed: 1.3, powerups: 2, rivals: 1,
    gatePattern: [
      {pause: 2.0, speed: 1.7, delay: 0},
      {pause: 4.4, speed: 1.0, delay: .3},
      {pause: 1.5, speed: 2.1, delay: .6},
      {pause: 3.1, speed: 1.35, delay: .1},
    ],
  },
  {id: 'garage', name: 'Garaż · krótkie okna', gates: 4, obstacles: 3, pause: 3.0, speed: 1.4, powerups: 2, rivals: 2},
  {id: 'frenzy', name: 'Frenzy · slalom bram', gates: 5, obstacles: 4, pause: 2.5, speed: 1.55, powerups: 1, rivals: 2},
  {id: 'blackout', name: 'Blackout · tryb awaryjny', gates: 5, obstacles: 5, pause: 3.3, speed: .85, blackout: true, powerups: 2, rivals: 1},
  {id: 'hardcore', name: 'Hardcore · logika B', gates: 6, obstacles: 6, pause: 2.1, speed: 1.5, hardcore: true, powerups: 1, rivals: 2},
];

const powerupColors: Record<PowerupType, string> = {
  turbo: '#ffd23f', shield: '#49c2ff', pilot: '#7dff8a', slowmo: '#c084fc', multi: '#ff5fa2',
};
const powerupLabels: Record<PowerupType, string> = {
  turbo: 'TURBO', shield: 'OSŁONA', pilot: '+PILOT', slowmo: 'SLOW-MO', multi: 'MNOŻNIK',
};

class RushAudio extends AudioBase {
  private engine: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;

  startEngine() {
    if (!this.context || !this.master || this.engine) return;
    this.engine = this.context.createOscillator();
    this.engineGain = this.context.createGain();
    this.engine.type = 'sawtooth';
    this.engineGain.gain.value = 0;
    this.engine.connect(this.engineGain).connect(this.master);
    this.engine.start();
  }

  updateEngine(speed: number) {
    if (!this.context || !this.engine || !this.engineGain) return;
    this.engine.frequency.value = 45 + speed * 230;
    this.engineGain.gain.value = speed > .01 ? .025 + speed * .08 : 0;
  }

  stopEngine() {
    if (!this.engine) return;
    this.engine.stop();
    this.engine.disconnect();
    this.engine = null;
    this.engineGain = null;
  }

  dispose() {
    this.stopEngine();
    super.dispose();
  }
}

function makeCar(color: string, transparent = false) {
  const group = new T.Group();
  const body = new T.Mesh(new T.BoxGeometry(.62, .2, 1.05), new T.MeshStandardMaterial({color, metalness: .2, roughness: .36, transparent, opacity: transparent ? .35 : 1}));
  body.position.y = .2;
  const cabin = new T.Mesh(new T.BoxGeometry(.42, .16, .46), new T.MeshStandardMaterial({color: '#17252c', metalness: .55, roughness: .2, transparent, opacity: transparent ? .3 : 1}));
  cabin.position.set(0, .37, -.08);
  group.add(body, cabin);
  const wheelMaterial = new T.MeshStandardMaterial({color: '#0c1114', roughness: .85, transparent, opacity: transparent ? .35 : 1});
  const wheelGeometry = new T.CylinderGeometry(.12, .12, .1, 12);
  wheelGeometry.rotateZ(Math.PI / 2);
  for (const [x, z] of [[-.31, .34], [.31, .34], [-.31, -.35], [.31, -.35]]) {
    const wheel = new T.Mesh(wheelGeometry, wheelMaterial);
    wheel.position.set(x, .12, z);
    group.add(wheel);
  }
  return group;
}

export default function GateRushGame() {
  const host = useRef<HTMLDivElement>(null);
  const input = useRef<InputState>({left: false, right: false, gas: false, brake: false, remote: false});
  const selectedLevel = useRef(levels[0]);
  const world = useRef<{
    reset: () => void;
    start: () => void;
    dispose: () => void;
    running: boolean;
  } | null>(null);
  const [levelId, setLevelId] = useState(levels[0].id);
  const [running, setRunning] = useState(false);
  const [snapshot, setSnapshot] = useState({
    time: 0, score: 0, combo: 1, status: 'ZAMKNIĘTA', collisions: 0, gates: 0, finished: false, failed: false, best: 0,
    shield: false, turbo: false, slowmo: false, remote: 2,
  });

  useEffect(() => {
    selectedLevel.current = levels.find((level) => level.id === levelId) ?? levels[0];
  }, [levelId]);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const renderer = createRenderer(element);
    const scene = new T.Scene();
    scene.background = new T.Color('#0d151b');
    scene.fog = new T.Fog('#0d151b', 22, 95);
    const camera = new T.PerspectiveCamera(62, 1, .1, 140);
    const hemi = new T.HemisphereLight('#9bb2c5', '#172027', 1.5);
    const sun = new T.DirectionalLight('#ffe1bd', 2.4);
    sun.position.set(8, 16, 12);
    sun.castShadow = true;
    scene.add(hemi, sun);
    const ground = new T.Mesh(new T.PlaneGeometry(18, 130), new T.MeshStandardMaterial({color: '#283238', roughness: .9}));
    ground.rotation.x = -Math.PI / 2;
    ground.position.z = -8;
    ground.receiveShadow = true;
    scene.add(ground);
    for (const x of [-6.2, 6.2]) {
      const wall = new T.Mesh(new T.BoxGeometry(.18, 2.6, 130), new T.MeshStandardMaterial({color: '#404b50', roughness: .72}));
      wall.position.set(x, 1.3, -8);
      scene.add(wall);
    }
    const startPad = new T.Mesh(new T.BoxGeometry(5, .025, 2), new T.MeshStandardMaterial({color: '#6d3d27', emissive: '#37170b', emissiveIntensity: .4}));
    startPad.position.set(0, .012, 27);
    scene.add(startPad);
    const finish = new T.Mesh(new T.BoxGeometry(5.4, .03, .15), new T.MeshStandardMaterial({color: '#d9e2dc', emissive: '#61776c', emissiveIntensity: .35}));
    finish.position.set(0, .025, -52);
    scene.add(finish);

    const car = makeCar('#e75f38');
    car.castShadow = true;
    scene.add(car);
    const ghost = makeCar('#78d4b0', true);
    scene.add(ghost);
    const rivalColors = ['#3d7fd9', '#c94ee0'];
    const rivals: RivalData[] = rivalColors.map((color) => {
      const mesh = makeCar(color);
      scene.add(mesh);
      return {mesh, z: -56, lane: 0, speed: 6};
    });

    const gateGroups: T.Group[] = [];
    const lampMaterials: T.MeshStandardMaterial[] = [];
    const createGate = (z: number, index: number) => {
      const group = new T.Group();
      group.position.z = z;
      const panelMaterial = new T.MeshStandardMaterial({color: index % 2 ? '#aab7b8' : '#8f9fa2', metalness: .5, roughness: .4});
      for (let i = 0; i < 6; i++) {
        const panel = new T.Mesh(new T.BoxGeometry(5.6, .38, .075), panelMaterial);
        panel.position.y = .22 + i * .38;
        panel.castShadow = true;
        group.add(panel);
      }
      for (const x of [-3, 3]) {
        const post = new T.Mesh(new T.BoxGeometry(.16, 2.8, .18), new T.MeshStandardMaterial({color: '#222c30', roughness: .65}));
        post.position.set(x, 1.4, 0);
        group.add(post);
      }
      const lampMaterial = new T.MeshStandardMaterial({color: '#3d1110', emissive: '#ff291b', emissiveIntensity: 0});
      const lamp = new T.Mesh(new T.BoxGeometry(.3, .16, .2), lampMaterial);
      lamp.position.set(2.25, 3.35, .1);
      group.add(lamp);
      lampMaterials.push(lampMaterial);
      scene.add(group);
      gateGroups.push(group);
    };
    const gateBaseZ = [16, 2, -10, -17, -34, -45];
    gateBaseZ.forEach((z, index) => createGate(z, index));

    const obstacleMeshes: ObstacleData[] = [];
    const coneMaterial = new T.MeshStandardMaterial({color: '#ff7a1f', roughness: .5, emissive: '#5a2400', emissiveIntensity: .5});
    const stripeMaterial = new T.MeshStandardMaterial({color: '#f4f6f5', roughness: .4});
    for (let i = 0; i < 6; i++) {
      const cone = new T.Group();
      const base = new T.Mesh(new T.CylinderGeometry(.34, .4, .08, 12), stripeMaterial);
      base.position.y = .04;
      const body = new T.Mesh(new T.ConeGeometry(.26, .62, 12), coneMaterial);
      body.position.y = .39;
      body.castShadow = true;
      cone.add(base, body);
      scene.add(cone);
      obstacleMeshes.push({x: 0, z: 0, baseX: 0, phase: 0, mesh: cone as unknown as T.Mesh});
    }

    const powerupSlotsPos: [number, number][] = [[1.6, 20], [-1.6, 10], [1.8, -1], [-1.8, -13], [1.6, -25], [-1.6, -37]];
    const powerupTypes: PowerupType[] = ['turbo', 'shield', 'pilot', 'slowmo', 'multi', 'turbo'];
    const powerups: PowerupSlot[] = powerupSlotsPos.map(([x, z], index) => {
      const type = powerupTypes[index];
      const mesh = new T.Mesh(
        new T.IcosahedronGeometry(.28, 0),
        new T.MeshStandardMaterial({color: powerupColors[type], emissive: powerupColors[type], emissiveIntensity: .6, metalness: .3, roughness: .35}),
      );
      mesh.position.set(x, .55, z);
      mesh.visible = false;
      scene.add(mesh);
      return {type, x, z, mesh, active: false};
    });

    const particles: {mesh: T.Mesh; life: number; velocity: T.Vector3}[] = [];
    const particleMaterial = new T.MeshStandardMaterial({color: '#ffad57', emissive: '#f05e21', emissiveIntensity: 1});
    const audio = new RushAudio();
    const flash = new FlashOverlay(element.querySelector<HTMLElement>('.rush-flash')!);
    let gates: GateData[] = [];
    const position = new T.Vector3(0, 0, 27);
    let heading = 0;
    let camHeading = 0;
    let speed = 0;
    let time = 0;
    let score = 0;
    let combo = 1;
    let collisions = 0;
    let remoteLeft = 2;
    let finished = false;
    let failed = false;
    let shield = false;
    let turboTimer = 0;
    let slowmoTimer = 0;
    let ghostData: GhostPoint[] = [];
    let bestGhost: GhostPoint[] = [];
    let ghostScore = 0;
    let lastHud = 0;
    const resize = () => {
      const width = element.clientWidth;
      const height = element.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(element);
    resize();

    const currentLevel = () => selectedLevel.current;
    const reset = () => {
      const level = currentLevel();
      input.current = {left: false, right: false, gas: false, brake: false, remote: false};
      gates = Array.from({length: level.gates}, (_, i) => {
        const pattern = level.gatePattern?.[i];
        const pauseBase = pattern?.pause ?? level.pause;
        return {
          t: 0,
          state: 'warning-open',
          timer: -((pattern?.delay ?? i * .4) + Math.random() * .8),
          collisions: 0,
          beamHold: false,
          pause: pauseBase * (.35 + Math.random() * 1.15),
          pauseBase,
          speed: (pattern?.speed ?? level.speed) * (.85 + Math.random() * .8),
          boost: 0,
          warn: .25 + Math.random() * .9,
          closedWait: .1 + Math.random() * .6,
        };
      });
      gateGroups.forEach((group, index) => {
        group.visible = index < level.gates;
        if (index < level.gates) group.position.z = gateBaseZ[index] + Math.random() * 6 - 3;
        if (index >= level.gates) group.children.slice(0, 6).forEach((panel, panelIndex) => {
          panel.position.y = .22 + panelIndex * .38;
        });
      });
      lampMaterials.forEach((material, index) => {
        material.emissiveIntensity = index < level.gates ? material.emissiveIntensity : 0;
      });
      obstacleMeshes.forEach((obstacle, index) => {
        const active = index < level.obstacles;
        obstacle.mesh.visible = active;
        if (active) {
          obstacle.x = index % 2 ? 2.3 : -2.3;
          if (index >= 4) obstacle.x = 0;
          obstacle.z = 20 - index * 11;
          obstacle.baseX = obstacle.x;
          obstacle.phase = index * 1.9;
          obstacle.mesh.position.set(obstacle.x, 0, obstacle.z);
        }
      });
      const activePowerups = level.powerups ?? 0;
      powerups.forEach((p, index) => {
        p.active = index < activePowerups;
        p.mesh.visible = p.active;
        p.mesh.position.set(p.x, .55, p.z);
      });
      const activeRivals = level.rivals ?? 0;
      rivals.forEach((rival, index) => {
        const active = index < activeRivals;
        rival.mesh.visible = active;
        rival.z = -56 - index * 16;
        rival.lane = index % 2 ? 1.9 : -1.9;
        rival.speed = 5.4 + index * .9 + level.speed;
      });
      position.set(0, 0, 27);
      heading = 0;
      camHeading = 0;
      speed = 0;
      time = 0;
      score = 0;
      combo = 1;
      collisions = 0;
      remoteLeft = 2;
      finished = false;
      failed = false;
      shield = false;
      turboTimer = 0;
      slowmoTimer = 0;
      ghostData = [];
      car.position.copy(position);
      ghost.visible = bestGhost.length > 0;
      flash.show('START');
    };
    const start = () => {
      reset();
      audio.init();
      audio.startEngine();
    };
    const fail = (label: string) => {
      if (failed || finished) return;
      if (shield) {
        shield = false;
        flash.show('OSŁONA — BLOK', 'success');
        audio.tone(560, .12, .3);
        return;
      }
      failed = true;
      combo = 1;
      speed = 0;
      for (let index = 0; index < 14; index++) {
        const mesh = new T.Mesh(new T.SphereGeometry(.035, 6, 6), particleMaterial);
        mesh.position.copy(car.position);
        scene.add(mesh);
        particles.push({mesh, life: .7, velocity: new T.Vector3((Math.random() - .5) * 2, Math.random() * 1.8, (Math.random() - .5) * 2)});
      }
      audio.tone(78, .4, .5, 'square');
      flash.show(label, 'warning');
      setSnapshot((current) => ({...current, failed: true, status: label}));
    };
    const applyPowerup = (type: PowerupType) => {
      if (type === 'turbo') { turboTimer = 4; audio.tone(900, .15, .3); }
      else if (type === 'shield') { shield = true; audio.tone(500, .15, .3); }
      else if (type === 'pilot') { remoteLeft = Math.min(4, remoteLeft + 1); audio.tone(1400, .1, .25); }
      else if (type === 'slowmo') { slowmoTimer = 3.5; audio.tone(300, .2, .3); }
      else { combo = Math.min(8, combo + 1.5); score += 150; audio.tone(1100, .1, .3); }
      flash.show(powerupLabels[type], 'success');
    };
    const updateGate = (gate: GateData, index: number, dt: number) => {
      if (gate.boost > 0) gate.boost = Math.max(0, gate.boost - dt);
      const boostMul = gate.boost > 0 ? 5 : 1;
      gate.timer += dt;
      gate.beamHold = false;
      if (gate.state === 'warning-open' || gate.state === 'warning-close') {
        if (gate.timer > gate.warn) {
          gate.state = gate.state === 'warning-open' ? 'opening' : 'closing';
          gate.timer = 0;
          gate.warn = .25 + Math.random() * .9;
        }
      } else if (gate.state === 'opening') {
        gate.t = clamp(gate.t + dt * 1.5 * gate.speed * boostMul, 0, 1);
        if (gate.t >= 1) {
          gate.t = 1;
          gate.state = 'open';
          gate.timer = 0;
        }
      } else if (gate.state === 'open' && gate.timer > gate.pause) {
        gate.state = 'warning-close';
        gate.timer = 0;
        gate.pause = gate.pauseBase * (.35 + Math.random() * 1.15);
      } else if (gate.state === 'closing') {
        const beamBlocked = Math.abs(position.z - gateGroups[index].position.z - .7) < .5 && Math.abs(position.x) < 2.8;
        gate.beamHold = beamBlocked;
        if (!beamBlocked) {
          gate.t = clamp(gate.t - dt * 1.9 * gate.speed * boostMul, 0, 1);
          if (gate.t <= 0) {
            gate.state = 'closed';
            gate.timer = 0;
            gate.closedWait = .1 + Math.random() * .6;
          }
        }
      } else if (gate.state === 'closed' && gate.timer > gate.closedWait) {
        gate.state = 'warning-open';
        gate.timer = 0;
      }
      const group = gateGroups[index];
      group.children.slice(0, 6).forEach((panel, panelIndex) => {
        panel.position.y = .22 + (panelIndex * .38) + gate.t * 2.35;
      });
      lampMaterials[index].emissiveIntensity = gate.state.startsWith('warning') ? (Math.sin(time * 12) > 0 ? 2.6 : .1) : gate.state === 'open' || gate.state === 'opening' || gate.state === 'closing' ? 1.25 : 0;
    };
    const keyDown = (event: KeyboardEvent) => {
      if (!element.contains(document.activeElement) && document.activeElement !== element) return;
      if (event.code === 'ArrowLeft' || event.code === 'KeyA') input.current.left = true;
      if (event.code === 'ArrowRight' || event.code === 'KeyD') input.current.right = true;
      if (event.code === 'ArrowUp' || event.code === 'KeyW') input.current.gas = true;
      if (event.code === 'ArrowDown' || event.code === 'KeyS') input.current.brake = true;
      if (event.code === 'Space' && !event.repeat) input.current.remote = true;
      if (event.code === 'KeyR' && !event.repeat) reset();
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(event.code)) event.preventDefault();
    };
    const keyUp = (event: KeyboardEvent) => {
      if (event.code === 'ArrowLeft' || event.code === 'KeyA') input.current.left = false;
      if (event.code === 'ArrowRight' || event.code === 'KeyD') input.current.right = false;
      if (event.code === 'ArrowUp' || event.code === 'KeyW') input.current.gas = false;
      if (event.code === 'ArrowDown' || event.code === 'KeyS') input.current.brake = false;
    };
    const loop = new FixedGameLoop((dt) => {
      if (!world.current?.running || finished || failed) return;
      const level = currentLevel();
      time += dt;
      if (turboTimer > 0) turboTimer = Math.max(0, turboTimer - dt);
      if (slowmoTimer > 0) slowmoTimer = Math.max(0, slowmoTimer - dt);
      if (input.current.gas) speed += dt * 9;
      if (input.current.brake) speed -= dt * 15;
      speed -= speed * dt * 1.2;
      const speedCap = level.blackout ? 4.8 : (turboTimer > 0 ? 11 : 8);
      speed = clamp(speed, -2.4, speedCap);
      const steer = Number(input.current.right) - Number(input.current.left);
      const targetHeading = steer * Math.PI / 4;
      const turnRate = Math.min(Math.abs(speed) / 2.5, 1) * 9;
      heading += clamp(targetHeading - heading, -turnRate * dt, turnRate * dt);
      position.x = clamp(position.x + Math.sin(heading) * speed * dt, -5.4, 5.4);
      position.z = clamp(position.z - Math.cos(heading) * speed * dt, -56, 30);
      if (input.current.remote) {
        input.current.remote = false;
        if (remoteLeft > 0) {
          const candidates = gates
            .map((gate, index) => ({gate, index}))
            .filter(({gate, index}) => (gate.state === 'closing' || gate.state === 'warning-close' || gate.state === 'closed') && gateGroups[index].position.z < position.z)
            .sort((a, b) => gateGroups[b.index].position.z - gateGroups[a.index].position.z);
          const target = candidates[0];
          if (target && !(level.hardcore && target.gate.state === 'closed')) {
            target.gate.state = 'opening';
            target.gate.timer = 0;
            target.gate.t = Math.max(target.gate.t, .55);
            target.gate.boost = .9;
            remoteLeft -= 1;
            flash.show('PILOT — TURBO', 'success');
            audio.tone(1250, .08, .25);
          }
        }
      }
      const dtGate = dt * (slowmoTimer > 0 ? .4 : 1);
      gates.forEach((gate, index) => {
        updateGate(gate, index, dtGate);
        const gateZ = gateGroups[index].position.z;
        if (Math.abs(position.z - gateZ) < .62 && gate.t < .5 && Math.abs(position.x) < 2.9) fail('PRZEGRANA — BRAMA');
        if (!failed && Math.abs(position.z - gateZ) < .6 && gate.t > .3 && gate.t < .5 && speed > 1.5) {
          score += Math.round(20 * combo);
          combo = Math.min(8, combo + .25);
          flash.show('PERFECT THREAD', 'success');
        }
      });
      for (const obstacle of obstacleMeshes) {
        if (!obstacle.mesh.visible) continue;
        const amplitude = obstacle.baseX === 0 ? 1.6 : 1.9;
        obstacle.x = clamp(obstacle.baseX + Math.sin(time * 1.4 + obstacle.phase) * amplitude, -5, 5);
        obstacle.mesh.position.set(obstacle.x, 0, obstacle.z);
      }
      if (!failed) for (const obstacle of obstacleMeshes) {
        if (!obstacle.mesh.visible) continue;
        if (Math.hypot(position.x - obstacle.x, position.z - obstacle.z) < .72) {
          fail('PRZEGRANA — PRZESZKODA');
          break;
        }
      }
      if (!failed) for (const p of powerups) {
        if (!p.active) continue;
        if (Math.hypot(position.x - p.x, position.z - p.z) < .85) {
          p.active = false;
          p.mesh.visible = false;
          applyPowerup(p.type);
        }
      }
      rivals.forEach((rival) => {
        if (!rival.mesh.visible) return;
        rival.z += rival.speed * dt;
        if (rival.z > 34) {
          rival.z = -58;
          rival.lane = Math.random() > .5 ? 1.9 : -1.9;
        }
        const wobble = Math.sin((time + rival.z) * .6) * .4;
        const laneX = rival.lane + wobble;
        rival.mesh.position.set(laneX, 0, rival.z);
        rival.mesh.rotation.y = Math.sin((time + rival.z) * .6) * .18;
        if (!failed && !finished && Math.hypot(position.x - laneX, position.z - rival.z) < .78) {
          fail('KOLIZJA — RUCH PRZECIWNY');
        }
      });
      if (position.z < -50) {
        finished = true;
        score += Math.max(0, Math.round(1600 - time * 18)) * combo;
        const best = saveScore('artas-gate-rush-scores', {score: Math.round(score), time: Number(time.toFixed(2)), level: level.id});
        if (score > ghostScore) localStorage.setItem('artas-gate-rush-ghost', JSON.stringify({score: Math.round(score), path: ghostData}));
        setSnapshot((current) => ({...current, score: Math.round(score), finished: true, best: best[0]?.score ?? Math.round(score)}));
        const next = levels[(levels.findIndex((entry) => entry.id === level.id) + 1) % levels.length];
        flash.show('META — ' + next.name.toUpperCase(), 'success');
      }
      ghostData.push({x: position.x, z: position.z, time});
      particles.forEach((particle) => {
        particle.life -= dt;
        particle.mesh.position.addScaledVector(particle.velocity, dt);
        particle.velocity.y -= dt * 3;
      });
      while (particles[0]?.life <= 0) {
        const particle = particles.shift();
        if (particle) {
          scene.remove(particle.mesh);
          particle.mesh.geometry.dispose();
        }
      }
      audio.updateEngine(Math.abs(speed) / 8);
      if (time - lastHud > .12) {
        lastHud = time;
        const active = gates.find((gate) => gate.state !== 'open');
        setSnapshot({
          time, score: Math.round(score), combo: Number(combo.toFixed(1)),
          status: active?.beamHold ? 'FOTOKOMÓRKA — TRZYMA' : active?.state.toUpperCase() ?? 'META',
          collisions, gates: gates.length, finished, failed, best: ghostScore,
          shield, turbo: turboTimer > 0, slowmo: slowmoTimer > 0, remote: remoteLeft,
        });
      }
    }, (dt) => {
      camHeading = T.MathUtils.lerp(camHeading, heading, 1 - Math.pow(.002, dt));
      const forward = new T.Vector3(Math.sin(camHeading), 0, -Math.cos(camHeading));
      car.position.copy(position);
      car.rotation.y = Math.PI - heading;
      const desiredCamera = position.clone().setY(4.6).add(new T.Vector3(0, 0, 8.4));
      camera.position.lerp(desiredCamera, 1 - Math.pow(.0005, dt));
      camera.lookAt(position.clone().addScaledVector(forward, 5.2).setY(1));
      powerups.forEach((p) => {
        if (p.mesh.visible) {
          p.mesh.rotation.y += dt * 2.2;
          p.mesh.position.y = .55 + Math.sin(time * 3 + p.z) * .08;
        }
      });
      if (bestGhost.length) {
        const point = bestGhost.find((entry) => entry.time >= time) ?? bestGhost.at(-1);
        if (point) ghost.position.set(point.x, .02, point.z);
      }
      renderer.render(scene, camera);
    });
    const onPointerDown = () => audio.init();
    element.addEventListener('pointerdown', onPointerDown, {once: true});
    element.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    try {
      const saved = JSON.parse(localStorage.getItem('artas-gate-rush-ghost') ?? 'null') as {score?: number; path?: GhostPoint[]} | null;
      bestGhost = saved?.path ?? [];
      ghostScore = saved?.score ?? 0;
    } catch { bestGhost = []; }
    reset();
    loop.start();
    world.current = {reset, start, running: false, dispose: () => {
      loop.stop();
      audio.dispose();
      flash.dispose();
      resizeObserver.disconnect();
      element.removeEventListener('pointerdown', onPointerDown);
      element.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      disposeObject(scene);
      renderer.dispose();
      renderer.domElement.remove();
    }};
    return () => {
      const dispose = world.current?.dispose;
      world.current = null;
      dispose?.();
    };
  }, []);

  const begin = () => {
    if (snapshot.finished) {
      const next = levels[(levels.findIndex((level) => level.id === levelId) + 1) % levels.length];
      setLevelId(next.id);
      selectedLevel.current = next;
    }
    host.current?.focus();
    world.current?.start();
    if (world.current) world.current.running = true;
    setSnapshot((current) => ({...current, time: 0, score: 0, combo: 1, collisions: 0, finished: false, failed: false}));
    setRunning(true);
  };
  const reset = () => {
    world.current?.reset();
    setRunning(false);
    if (world.current) world.current.running = false;
    setSnapshot((current) => ({...current, time: 0, score: 0, combo: 1, collisions: 0, finished: false, failed: false}));
  };
  const setTouch = (key: keyof InputState, value: boolean) => {
    input.current[key] = value;
    if (value) host.current?.focus();
  };
  const changeLevel = (value: string) => {
    setLevelId(value);
    selectedLevel.current = levels.find((level) => level.id === value) ?? levels[0];
    reset();
  };
  const scores = loadScores<{score: number; time: number; level: string}>('artas-gate-rush-scores').slice(0, 3);
  const nextLevel = levels[(levels.findIndex((level) => level.id === levelId) + 1) % levels.length];

  return <div className="embedded-game gate-rush-game" tabIndex={0} ref={host}>
    <div className="rush-scene"/>
    <div className="rush-flash"/>
    <div className="embedded-game-top"><div className="game-title"><Gamepad2 size={16}/> GATE RUSH <span>FAZA 3 · BRAMA VS RC</span></div><label className="game-select"><span>Poziom</span><ChevronDown size={14}/><select value={levelId} onChange={(event) => changeLevel(event.target.value)}>{levels.map((level) => <option value={level.id} key={level.id}>{level.name}</option>)}</select></label></div>
    <div className="rush-hud">
      <span><b>{snapshot.time.toFixed(1)}s</b> czas</span>
      <span><b>{snapshot.score}</b> pkt</span>
      <span><b>×{snapshot.combo}</b> combo</span>
      <span><b>{snapshot.remote}</b> pilot</span>
      {snapshot.shield && <span><b>OSŁONA</b></span>}
      {snapshot.turbo && <span><b>TURBO</b></span>}
      {snapshot.slowmo && <span><b>SLOW-MO</b></span>}
      <span><b>{snapshot.status}</b></span>
    </div>
    {(!running || snapshot.finished || snapshot.failed) && <div className="embedded-overlay"><div className="embedded-card"><CarFront size={32}/><h3>{snapshot.finished ? 'Przejazd ukończony.' : snapshot.failed ? 'Przegrana — ' + snapshot.status.toLowerCase() + '.' : 'Jedź w stronę bramy.'}</h3><p>{snapshot.finished ? `Wynik ${snapshot.score} pkt. Następny poziom: ${nextLevel.name}.` : snapshot.failed ? 'Dotknięcie bramy, przeszkody lub nadjeżdżającego auta kończy poziom (chyba że masz osłonę). Naciśnij przycisk, aby zresetować i spróbować ponownie.' : 'Kamera jest sztywno za autem: ↑ / W jedzie do bramy, ← i → skręcają autem. Omijaj pomarańczowe pachołki i auta jadące pod prąd, zbieraj kolorowe power-upy i użyj pilota, by błyskawicznie otworzyć zamkniętą bramę.'}</p><button className="primary-btn" onClick={begin}>{snapshot.finished ? 'Następny poziom' : snapshot.failed ? 'Jeszcze raz' : 'Rozpocznij grę'} <Zap size={16}/></button></div></div>}
    <div className="rush-touch" aria-label="Sterowanie dotykowe"><button aria-label="Skręć w lewo" onPointerDown={() => setTouch('left', true)} onPointerUp={() => setTouch('left', false)} onPointerCancel={() => setTouch('left', false)} onPointerLeave={() => setTouch('left', false)}>←</button><button aria-label="Skręć w prawo" onPointerDown={() => setTouch('right', true)} onPointerUp={() => setTouch('right', false)} onPointerCancel={() => setTouch('right', false)} onPointerLeave={() => setTouch('right', false)}>→</button><button aria-label="Jedź do przodu" onPointerDown={() => setTouch('gas', true)} onPointerUp={() => setTouch('gas', false)} onPointerCancel={() => setTouch('gas', false)} onPointerLeave={() => setTouch('gas', false)}>↑</button><button aria-label="Hamuj lub cofnij" onPointerDown={() => setTouch('brake', true)} onPointerUp={() => setTouch('brake', false)} onPointerCancel={() => setTouch('brake', false)} onPointerLeave={() => setTouch('brake', false)}>↓</button><button onClick={() => setTouch('remote', true)}><Zap size={15}/> PILOT</button></div>
    <div className="embedded-game-bottom"><p role="status">{snapshot.finished ? 'R — reset · wynik i ghost zapisane w tej przeglądarce.' : '↑ / W — do bramy · ↓ / S — hamuj lub cofnij · ← / → / A / D — skręt autem · Space — pilot (szybkie otwarcie bramy) · pachołek, brama lub auto z przeciwka = przegrana'}</p><button className="icon-button" onClick={reset} aria-label="Zresetuj Gate Rush"><RotateCcw size={17}/></button><details><summary><Trophy size={14}/> Ranking lokalny</summary><ol>{scores.length ? scores.map((item, index) => <li key={`${item.score}-${index}`}>{item.score} pkt · {item.time}s · {item.level}</li>) : <li>Brak rekordów — zagraj pierwszą próbę.</li>}</ol></details></div>
  </div>;
}
