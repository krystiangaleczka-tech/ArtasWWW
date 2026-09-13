'use client';

import {useEffect, useRef, useState} from 'react';
import * as T from 'three';
import {Check, ChevronDown, CircleDot, Cpu, Lightbulb, RotateCcw, Settings2, Trophy} from 'lucide-react';
import {AudioBase, createRenderer, disposeObject, FixedGameLoop, loadScores, saveScore} from '@/lib/games/shared';

type Phase = 'brief' | 'calibration' | 'config' | 'simulation' | 'report';
type Logic = 'A' | 'B';
type Configuration = {control: boolean; sensitivity: 'DUŻA' | 'MAŁA'; logic: Logic; speed: 'DUŻA' | 'MAŁA'};
type Scenario = {name: string; description: string; target: Configuration};
type CalibrationStep = {name: string; description: string; target: number; tolerance: number};
type Decision = {title: string; text: string; options: string[]; correct: number; explanation: string};

const defaultConfig: Configuration = {control: false, sensitivity: 'MAŁA', logic: 'A', speed: 'DUŻA'};
const calibrationSteps: CalibrationStep[] = [
  {name: 'Punkt zamknięcia', description: 'Ustaw pozycję, w której brama kończy ruch przy podłodze.', target: .06, tolerance: .05},
  {name: 'Strefa zwolnienia', description: 'Zaznacz miejsce, od którego napęd powinien zwalniać przed końcem ruchu.', target: .76, tolerance: .06},
  {name: 'Punkt otwarcia', description: 'Ustaw górny punkt zatrzymania bramy.', target: .94, tolerance: .04},
];
const scenarios: Scenario[] = [
  {name: 'Dom z dziećmi i zwierzakami', description: 'W tej symulacji najważniejsze są ostrożny ruch i aktywna ochrona fotokomórką.', target: {control: true, sensitivity: 'DUŻA', logic: 'B', speed: 'MAŁA'}},
  {name: 'Warsztat i nieregularny ruch', description: 'Przy częstym ruchu oraz podmuchach potrzebna jest kontrola czujników i spokojna praca napędu.', target: {control: true, sensitivity: 'DUŻA', logic: 'A', speed: 'MAŁA'}},
  {name: 'Spokojny garaż', description: 'Niewielki ruch pozwala użyć prostszej automatyki, nadal z zachowaniem podstawowej kontroli.', target: {control: false, sensitivity: 'MAŁA', logic: 'A', speed: 'DUŻA'}},
];
const decisions: Decision[] = [
  {title: 'Fotokomórka', text: 'W trakcie zamykania wiązkę przerywa kot.', options: ['Przerwij zamykanie i usuń przeszkodę z przejazdu.', 'Wyłącz fotokomórkę, aby brama dokończyła ruch.', 'Przyspiesz zamykanie, zanim kot wróci.'], correct: 0, explanation: 'Właściwa reakcja to zatrzymanie ruchu i usunięcie przeszkody — nie obchodzenie zabezpieczenia.'},
  {title: 'Nierówny ruch', text: 'Po podmuchu wiatru brama porusza się nierówno.', options: ['Wstrzymaj użycie i zleć sprawdzenie mechanizmu.', 'Podnieś prędkość, aby szybciej pokonać opór.', 'Zignoruj objaw, jeśli brama nadal się porusza.'], correct: 0, explanation: 'Nietypowy ruch wymaga przerwania eksploatacji i kontroli przez serwis.'},
  {title: 'Pilot podczas ruchu', text: 'Ktoś naciska pilot, gdy brama jest już w ruchu.', options: ['Sprawdź ustawioną logikę i dopiero potem reaguj na impuls.', 'Wielokrotnie naciskaj pilot, aż ruch się zmieni.', 'Odłącz zasilanie bez sprawdzania stanu bramy.'], correct: 0, explanation: 'Najpierw trzeba rozpoznać stan i logikę sterowania; przypadkowe impulsy nie są bezpieczną procedurą.'},
  {title: 'Zanik zasilania', text: 'Podczas testu znika zasilanie, a lampa sygnalizuje usterkę.', options: ['Przerwij test i postępuj zgodnie z instrukcją awaryjną producenta.', 'Kontynuuj test tak, jakby zasilanie działało.', 'Zablokuj czujniki, żeby nie przeszkadzały.'], correct: 0, explanation: 'Przy awarii zasilania test należy zatrzymać i stosować wyłącznie przewidzianą procedurę awaryjną.'},
];

class LearnAudio extends AudioBase {
  press(correct: boolean) { this.tone(correct ? 920 : 220, correct ? .12 : .2, .28, correct ? 'sine' : 'square'); }
  success() { this.tone(720, .1, .22); setTimeout(() => this.tone(1080, .16, .22), 80); }
}

function configurationMatches(config: Configuration, target: Configuration) {
  return config.control === target.control && config.sensitivity === target.sensitivity && config.logic === target.logic && config.speed === target.speed;
}

function configurationHints(target: Configuration) {
  return [
    `Fotokomórka: ${target.control ? 'włączona' : 'wyłączona'}`,
    `Czułość: ${target.sensitivity.toLowerCase()}`,
    `Logika pilota: ${target.logic}`,
    `Prędkość: ${target.speed.toLowerCase()}`,
  ];
}

export default function LearnModeGame() {
  const host = useRef<HTMLDivElement>(null);
  const phaseRef = useRef<Phase>('brief');
  const gateRef = useRef(.5);
  const simTimeRef = useRef(0);
  const decisionIndexRef = useRef(0);
  const [phase, setPhase] = useState<Phase>('brief');
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [calibrationIndex, setCalibrationIndex] = useState(0);
  const [gateT, setGateT] = useState(.5);
  const [config, setConfig] = useState<Configuration>(defaultConfig);
  const [decisionIndex, setDecisionIndex] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<number, boolean>>({});
  const [simTime, setSimTime] = useState(0);
  const [score, setScore] = useState(0);
  const [message, setMessage] = useState('Cel ćwiczenia: ustaw trzy punkty ruchu, dobierz ustawienia do sytuacji i podejmij bezpieczne decyzje.');
  const [scores, setScores] = useState(() => loadScores<{score: number; scenario: string}>('artas-learn-scores'));
  const saved = useRef(false);
  const audio = useRef(new LearnAudio());
  const scenario = scenarios[scenarioIndex];
  const calibration = calibrationSteps[calibrationIndex];
  const decision = decisions[decisionIndex];
  const visibleGateT = phase === 'simulation' ? .48 + Math.sin(simTime * .85) * .4 : gateT;

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { gateRef.current = gateT; }, [gateT]);
  useEffect(() => { simTimeRef.current = simTime; }, [simTime]);
  useEffect(() => { decisionIndexRef.current = decisionIndex; }, [decisionIndex]);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const renderer = createRenderer(element);
    const scene = new T.Scene();
    scene.background = new T.Color('#111a20');
    scene.fog = new T.Fog('#111a20', 12, 38);
    const camera = new T.PerspectiveCamera(58, 1, .1, 80);
    camera.position.set(6.8, 4.1, 9.4);
    camera.lookAt(0, 1.15, 0);
    scene.add(new T.HemisphereLight('#b5d5df', '#1b252b', 1.5));
    const key = new T.DirectionalLight('#ffe8c9', 2.4);
    key.position.set(-3, 8, 5);
    scene.add(key);
    const floor = new T.Mesh(new T.PlaneGeometry(18, 18), new T.MeshStandardMaterial({color: '#293439', roughness: .92}));
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);
    const frame = new T.Mesh(new T.BoxGeometry(5.8, .2, .35), new T.MeshStandardMaterial({color: '#6f7778', metalness: .5, roughness: .45}));
    frame.position.y = 3.1;
    scene.add(frame);
    const panels: T.Mesh[] = [];
    for (let index = 0; index < 6; index++) {
      const panel = new T.Mesh(new T.BoxGeometry(5.6, .43, .08), new T.MeshStandardMaterial({color: '#aab4b5', metalness: .48, roughness: .42}));
      panel.position.y = .25 + index * .43;
      panels.push(panel);
      scene.add(panel);
    }
    const lampMaterial = new T.MeshStandardMaterial({color: '#421516', emissive: '#ff2919', emissiveIntensity: 0});
    const lamp = new T.Mesh(new T.BoxGeometry(.28, .14, .2), lampMaterial);
    lamp.position.set(2.5, 3.45, .1);
    scene.add(lamp);
    const beamMaterial = new T.MeshStandardMaterial({color: '#104c2d', emissive: '#22e981', emissiveIntensity: 1});
    const beam = new T.Mesh(new T.BoxGeometry(5.9, .025, .025), beamMaterial);
    beam.position.set(0, .2, .55);
    scene.add(beam);
    const state = {t: .5};
    const resize = () => {
      if (!element.clientWidth || !element.clientHeight) return;
      renderer.setSize(element.clientWidth, element.clientHeight, false);
      camera.aspect = element.clientWidth / element.clientHeight;
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(element);
    resize();
    const loop = new FixedGameLoop((dt) => {
      const target = phaseRef.current === 'simulation' ? .48 + Math.sin(simTimeRef.current * .85) * .4 : gateRef.current;
      state.t += (target - state.t) * Math.min(dt * 8, 1);
    }, () => {
      panels.forEach((panel, index) => { panel.position.y = .25 + index * .43 + state.t * 2.55; });
      const active = phaseRef.current === 'simulation';
      lampMaterial.emissiveIntensity = active ? (Math.sin(simTimeRef.current * 9) < 0 ? .2 : 1.8) : .15;
      beamMaterial.emissiveIntensity = active && decisionIndexRef.current === 0 ? 3 : 1;
      renderer.render(scene, camera);
    });
    const gameAudio = audio.current;
    const initAudio = () => gameAudio.init();
    element.addEventListener('pointerdown', initAudio, {once: true});
    loop.start();
    return () => {
      loop.stop();
      gameAudio.dispose();
      resizeObserver.disconnect();
      element.removeEventListener('pointerdown', initAudio);
      disposeObject(scene);
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  useEffect(() => {
    if (phase !== 'simulation') return;
    const startedAt = Date.now();
    const timer = setInterval(() => setSimTime((Date.now() - startedAt) / 1000), 100);
    return () => clearInterval(timer);
  }, [phase, decisionIndex]);

  const reset = (nextScenario = scenarioIndex) => {
    setScenarioIndex(nextScenario);
    setPhase('brief');
    setCalibrationIndex(0);
    setGateT(.5);
    setConfig(defaultConfig);
    setDecisionIndex(0);
    setChoice(null);
    setAnswers({});
    setSimTime(0);
    setScore(0);
    saved.current = false;
    setMessage('Cel ćwiczenia: ustaw trzy punkty ruchu, dobierz ustawienia do sytuacji i podejmij bezpieczne decyzje.');
  };

  const begin = () => {
    audio.current.init();
    setPhase('calibration');
    setMessage(`Krok 1 z 3: przeciągnij marker do zielonej strefy „${calibrationSteps[0].name}”, potem zapisz punkt.`);
  };

  const saveCalibration = () => {
    const distance = Math.abs(gateT - calibration.target);
    if (distance > calibration.tolerance) {
      audio.current.press(false);
      setMessage(`Marker jest na ${Math.round(gateT * 100)}%. Zielona strefa dla „${calibration.name}” to ${Math.round((calibration.target - calibration.tolerance) * 100)}–${Math.round((calibration.target + calibration.tolerance) * 100)}%.`);
      return;
    }
    audio.current.success();
    if (calibrationIndex === calibrationSteps.length - 1) {
      setPhase('config');
      setMessage('Punkty ruchu zapisane. Teraz dopasuj ustawienia do karty sytuacji.');
      return;
    }
    const nextIndex = calibrationIndex + 1;
    setCalibrationIndex(nextIndex);
    setMessage(`Punkt zapisany. Krok ${nextIndex + 1} z 3: ustaw „${calibrationSteps[nextIndex].name}”.`);
  };

  const submitConfig = () => {
    if (!configurationMatches(config, scenario.target)) {
      audio.current.press(false);
      setMessage('Ustawienia jeszcze nie zgadzają się z kartą sytuacji. Porównaj je punkt po punkcie z listą podpowiedzi.');
      return;
    }
    audio.current.success();
    setDecisionIndex(0);
    setChoice(null);
    setAnswers({});
    setSimTime(0);
    setPhase('simulation');
    setMessage('Konfiguracja pasuje. W każdym zdarzeniu wybierz najbezpieczniejszą reakcję i przeczytaj uzasadnienie.');
  };

  const choose = (index: number) => {
    if (choice !== null) return;
    const correct = index === decision.correct;
    audio.current.press(correct);
    setChoice(index);
    setAnswers((state) => ({...state, [decisionIndex]: correct}));
    setMessage(correct ? 'Dobra decyzja. Zobacz, dlaczego jest właściwa.' : 'Ta decyzja nie jest bezpieczna. Zobacz właściwe postępowanie przed kolejnym zdarzeniem.');
  };

  const advanceDecision = () => {
    if (decisionIndex < decisions.length - 1) {
      setDecisionIndex((index) => index + 1);
      setChoice(null);
      return;
    }
    const correct = Object.values(answers).filter(Boolean).length;
    const total = 60 + correct * 10;
    setScore(total);
    setPhase('report');
    setMessage('Ćwiczenie ukończone. Wynik pokazuje, ile decyzji bezpieczeństwa udało się rozpoznać.');
    if (!saved.current) {
      saved.current = true;
      setScores(saveScore('artas-learn-scores', {score: total, scenario: scenario.name}));
    }
  };

  return <div className="embedded-game learn-game" tabIndex={0} onKeyDown={(event) => {if (event.code === 'KeyR') reset();}}>
    <div className="embedded-game-top"><div className="game-title"><Cpu size={16}/> DIAGNOSTYKA BRAMY <span>ĆWICZENIE DECYZYJNE</span></div><label className="game-select"><span>Sytuacja</span><ChevronDown size={14}/><select value={scenarioIndex} onChange={(event) => reset(Number(event.target.value))}>{scenarios.map((item, index) => <option value={index} key={item.name}>{item.name}</option>)}</select></label></div>
    <div className="learn-layout"><div className="learn-scene"><div className="learn-scene-meta"><span>BRAMA NA PROWADNICY</span><span>{phase === 'simulation' ? 'WIZUALIZACJA ZDARZENIA' : 'PODGLĄD USTAWIEŃ'}</span></div><div className="learn-canvas" ref={host}/><div className="travel-meter" aria-label={`Położenie bramy: ${Math.round(visibleGateT * 100)} procent`}>{phase === 'calibration' && <i style={{left: `${(calibration.target - calibration.tolerance) * 100}%`, width: `${calibration.tolerance * 200}%`}}/>}<span style={{width: `${visibleGateT * 100}%`}}/><b style={{left: `${visibleGateT * 100}%`}}>{Math.round(visibleGateT * 100)}%</b></div>{phase === 'calibration' && <p className="travel-hint">Zielona strefa: {Math.round((calibration.target - calibration.tolerance) * 100)}–{Math.round((calibration.target + calibration.tolerance) * 100)}%</p>}</div><aside className="learn-controls"><div className="learn-card"><span className="small-label">{phase === 'brief' ? 'CEL ĆWICZENIA' : phase === 'calibration' ? `KALIBRACJA ${calibrationIndex + 1}/3` : phase === 'config' ? 'DOBÓR USTAWIEŃ' : phase === 'simulation' ? `DECYZJA ${decisionIndex + 1}/${decisions.length}` : 'RAPORT'}</span><h3>{phase === 'brief' ? 'Rozpoznaj ryzyko, nie zapamiętuj skróty.' : phase === 'calibration' ? calibration.name : phase === 'config' ? scenario.name : phase === 'simulation' ? decision.title : `Wynik: ${score}/100`}</h3><p>{phase === 'brief' ? 'To krótka symulacja: najpierw ustawiasz punkty ruchu, potem czytasz kartę sytuacji i podejmujesz cztery decyzje dotyczące bezpiecznej eksploatacji.' : phase === 'calibration' ? calibration.description : phase === 'config' ? scenario.description : phase === 'simulation' ? decision.text : '30 pkt za kalibrację · 30 pkt za konfigurację · 40 pkt za bezpieczne decyzje.'}</p></div>{phase === 'brief' && <button className="primary-btn learn-start" onClick={begin}>Rozpocznij ćwiczenie <CircleDot size={16}/></button>}{phase === 'calibration' && <div className="calibration-panel"><label>Pozycja bramy <output>{Math.round(gateT * 100)}%</output></label><input type="range" min="0" max="100" value={Math.round(gateT * 100)} onChange={(event) => setGateT(Number(event.target.value) / 100)}/><p>Cel: <strong>{Math.round((calibration.target - calibration.tolerance) * 100)}–{Math.round((calibration.target + calibration.tolerance) * 100)}%</strong></p><button className="primary-btn" onClick={saveCalibration}>Zapisz punkt <Check size={16}/></button></div>}{phase === 'config' && <div className="ds1-panel"><div className="scenario-requirements"><strong>Karta sytuacji</strong><ul>{configurationHints(scenario.target).map((hint) => <li key={hint}>{hint}</li>)}</ul></div><label className="toggle-line"><span>Fotokomórka</span><button className={config.control ? 'active' : ''} onClick={() => setConfig((state) => ({...state, control: !state.control}))}>{config.control ? 'WŁĄCZONA' : 'WYŁĄCZONA'}</button></label><label className="toggle-line"><span>Czułość</span><button className={config.sensitivity === 'DUŻA' ? 'active' : ''} onClick={() => setConfig((state) => ({...state, sensitivity: state.sensitivity === 'DUŻA' ? 'MAŁA' : 'DUŻA'}))}>{config.sensitivity}</button></label><label className="toggle-line"><span>Logika pilota</span><button className={config.logic === 'B' ? 'active' : ''} onClick={() => setConfig((state) => ({...state, logic: state.logic === 'A' ? 'B' : 'A'}))}>LOGIKA {config.logic}</button></label><label className="toggle-line"><span>Prędkość</span><button className={config.speed === 'MAŁA' ? 'active' : ''} onClick={() => setConfig((state) => ({...state, speed: state.speed === 'MAŁA' ? 'DUŻA' : 'MAŁA'}))}>{config.speed}</button></label><button className="primary-btn" onClick={submitConfig}>Sprawdź ustawienia <Settings2 size={16}/></button></div>}{phase === 'simulation' && <div className="decision-panel"><div className="decision-options">{decision.options.map((option, index) => <button className={choice === index ? (index === decision.correct ? 'correct' : 'wrong') : ''} key={option} disabled={choice !== null} onClick={() => choose(index)}><span>{String.fromCharCode(65 + index)}</span>{option}</button>)}</div>{choice !== null && <div className={'decision-feedback '+(choice === decision.correct ? 'correct' : 'wrong')}><strong>{choice === decision.correct ? 'Dobra decyzja' : 'Właściwa odpowiedź'}</strong><p>{decision.explanation}</p><button className="primary-btn" onClick={advanceDecision}>{decisionIndex === decisions.length - 1 ? 'Zobacz raport' : 'Następne zdarzenie'} <Check size={16}/></button></div>}</div>}{phase === 'report' && <div className="report-card"><Trophy size={27}/><strong>{score} / 100</strong><span>{Object.values(answers).filter(Boolean)} z {decisions.length} decyzji bezpieczeństwa poprawnie</span><button className="primary-btn" onClick={() => reset()}><RotateCcw size={15}/> Zagraj ponownie</button></div>}<p className="learn-message" role="status">{message}</p></aside></div><div className="embedded-game-bottom"><div className="learn-progress"><span style={{width: `${phase === 'brief' ? 0 : phase === 'calibration' ? (calibrationIndex / calibrationSteps.length) * 30 : phase === 'config' ? 45 : phase === 'simulation' ? 60 + (decisionIndex / decisions.length) * 35 : 100}%`}}/></div><div className="learn-footer"><small><Lightbulb size={14}/> Symulacja edukacyjna — nie zastępuje instrukcji producenta ani serwisu.</small><button className="text-button" onClick={() => reset()}><RotateCcw size={14}/> Reset</button></div><details><summary><Trophy size={14}/> Ranking scenariuszy</summary><ol>{scores.slice(0, 3).map((item, index) => <li key={`${item.score}-${index}`}>{item.score}/100 · {item.scenario}</li>)}</ol></details></div>
  </div>;
}
