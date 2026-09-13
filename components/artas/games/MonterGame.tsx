'use client';

import {useEffect, useMemo, useRef, useState} from 'react';
import {BadgeCheck, Box, Check, ChevronDown, Gauge, RotateCcw, ShieldCheck, Trophy, Wrench} from 'lucide-react';
import ProductScene from '../ProductScene';
import {loadScores, saveScore} from '@/lib/games/shared';
import {palette} from '@/lib/artas/catalog';

type Difficulty = 'normal' | 'installer';
type Step = {id: string; name: string; instruction: string; target: number; min: number; max: number; unit: string; input: 'range' | 'switch'; action: string};
type GhostRun = {stage: number; time: number; score: number}[];

const steps: Step[] = [
  {id: 'measure', name: 'Pomiar prześwitu', instruction: 'Ustaw wartość prześwitu między najwyższym punktem ruchomej bramy a sufitem.', target: 35, min: 0, max: 70, unit: ' mm', input: 'range', action: 'Potwierdź pomiar'},
  {id: 'bracket', name: 'Wspornik przedni', instruction: 'Wycentruj wspornik względem osi nadproża.', target: 0, min: -40, max: 40, unit: ' mm', input: 'range', action: 'Potwierdź pozycję wspornika'},
  {id: 'rail', name: 'Prowadnica', instruction: 'Ustaw długość prowadnicy bez naprężenia ani skręcenia.', target: 2250, min: 2180, max: 2320, unit: ' mm', input: 'range', action: 'Potwierdź prowadnicę'},
  {id: 'drill', name: 'Kotwy', instruction: 'Utrzymaj narzędzie w zaznaczonej, bezpiecznej strefie nacisku.', target: 50, min: 0, max: 100, unit: '%', input: 'range', action: 'Potwierdź kotwy'},
  {id: 'drive', name: 'Napęd', instruction: 'Ustaw moduł napędu pod lekkim pochyleniem do tylnego mocowania.', target: 17, min: 0, max: 35, unit: '°', input: 'range', action: 'Potwierdź napęd'},
  {id: 'chain', name: 'Napinacz', instruction: 'Ustaw łańcuch w środkowej strefie przekroju prowadnicy.', target: 50, min: 0, max: 100, unit: '%', input: 'range', action: 'Potwierdź napięcie'},
  {id: 'safety', name: 'Zabezpieczenia', instruction: 'Potwierdź czujniki i punkt odcięcia przed testem demonstracyjnym.', target: 1, min: 0, max: 1, unit: '', input: 'switch', action: 'Potwierdź zabezpieczenia'},
];

const defaultValues: Record<string, number> = {measure: 20, bracket: -25, rail: 2200, drill: 25, drive: 7, chain: 25, safety: 0};

function tolerance(difficulty: Difficulty, step: Step) {
  if (step.id === 'measure') return difficulty === 'installer' ? 0 : 4;
  if (difficulty === 'installer') return step.id === 'rail' ? 8 : step.id === 'drive' ? 2 : 5;
  return step.id === 'rail' ? 25 : step.id === 'drive' ? 7 : 12;
}

function targetLabel(step: Step, difficulty: Difficulty) {
  if (step.input === 'switch') return 'CEL: potwierdzone';
  return `CEL: ${step.target}${step.unit} · tolerancja ±${tolerance(difficulty, step)}${step.unit}`;
}

export default function MonterGame() {
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [stage, setStage] = useState(0);
  const [values, setValues] = useState(defaultValues);
  const [mistakes, setMistakes] = useState(0);
  const [test, setTest] = useState(false);
  const [message, setMessage] = useState('Krok 1: ustaw widoczny cel pomiaru, a potem go potwierdź. Model 3D służy tylko do obejrzenia konstrukcji.');
  const [elapsed, setElapsed] = useState(0);
  const [ghostStage, setGhostStage] = useState(0);
  const startedAt = useRef(0);
  const saved = useRef(false);
  const current = steps[stage];
  const done = stage === steps.length;
  const ghost = useMemo(() => loadScores<{score: number; ghost?: GhostRun[]}>('artas-monter-scores')[0]?.ghost ?? [], []);
  const [scores, setScores] = useState(() => loadScores<{score: number; time: number; mode: Difficulty}>('artas-monter-scores'));

  useEffect(() => { startedAt.current = Date.now(); }, []);

  useEffect(() => {
    if (done) return;
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - startedAt.current) / 100) / 10), 100);
    return () => clearInterval(timer);
  }, [done]);

  useEffect(() => {
    if (!done || saved.current) return;
    saved.current = true;
    const score = Math.max(0, Math.round(10000 - elapsed * 25 - mistakes * 220 + (difficulty === 'installer' ? 650 : 0)));
    const run: GhostRun = steps.map((_, index) => ({stage: index + 1, time: elapsed * (index + 1) / steps.length, score}));
    setScores(saveScore('artas-monter-scores', {score, time: elapsed, mode: difficulty, ghost: run}));
  }, [difficulty, done, elapsed, mistakes]);

  useEffect(() => {
    if (!done || !ghost.length) return;
    const timer = setInterval(() => setGhostStage((value) => value >= steps.length ? 0 : value + 1), 720);
    return () => clearInterval(timer);
  }, [done, ghost.length]);

  const reset = (nextDifficulty = difficulty) => {
    setDifficulty(nextDifficulty);
    setStage(0);
    setValues(defaultValues);
    setMistakes(0);
    setTest(false);
    setElapsed(0);
    setGhostStage(0);
    saved.current = false;
    startedAt.current = Date.now();
    setMessage('Krok 1: ustaw widoczny cel pomiaru, a potem go potwierdź. Model 3D służy tylko do obejrzenia konstrukcji.');
  };

  const confirmStep = () => {
    if (!current) return;
    const value = values[current.id];
    const accepted = current.input === 'switch' ? value === 1 : Math.abs(value - current.target) <= tolerance(difficulty, current);
    if (!accepted) {
      setMistakes((value) => value + 1);
      setMessage(`Jeszcze nie. ${targetLabel(current, difficulty)}; obecnie: ${value}${current.unit}.`);
      return;
    }
    const nextStage = stage + 1;
    setStage(nextStage);
    setMessage(nextStage === steps.length ? 'Wszystkie warunki demonstracyjne są gotowe. Możesz uruchomić test otwarcia.' : `Gotowe. Krok ${nextStage + 1}: ${steps[nextStage].name.toLowerCase()}.`);
  };

  const setValue = (value: number) => {
    if (!current) return;
    setValues((state) => ({...state, [current.id]: value}));
  };

  return <div className="embedded-game monter-game" tabIndex={0} onKeyDown={(event) => {if (event.key === 'Enter') confirmStep();}}>
    <div className="embedded-game-top"><div className="game-title"><Wrench size={16}/> MONTER: 600 N <span>ĆWICZENIE DEMONSTRACYJNE</span></div><label className="game-select"><span>Tryb</span><ChevronDown size={14}/><select value={difficulty} onChange={(event) => reset(event.target.value as Difficulty)}><option value="normal">Prowadzony</option><option value="installer">Precyzyjny</option></select></label></div>
    <div className="monter-layout"><div className="monter-scene"><div className="monter-scene-meta"><span>{done ? 'TEST BRAMY' : 'PODGLĄD KONSTRUKCJI'}</span><span>przeciągnij, aby obejrzeć</span></div><ProductScene kind="gate" color={palette[0].hex} profile={500} open={test ? 100 : 0} assembled={stage} zoom={.78}/><div className="monter-badge"><BadgeCheck size={16}/>{done ? '7 / 7 — konstrukcja gotowa' : `Krok ${stage + 1} / 7 — ${current.name}`}</div></div><aside className="monter-controls"><div className="monter-stat-row"><span><Gauge size={14}/> {elapsed.toFixed(1)} s</span><span><ShieldCheck size={14}/> {mistakes} korekt</span></div><p className="small-label">PLAN ĆWICZENIA</p><div className="monter-steps">{steps.map((step, index) => <div key={step.id} className={index < stage ? 'is-done' : index === stage ? 'is-current' : ''}><span>{index < stage ? <Check size={14}/> : index + 1}</span>{step.name}</div>)}</div>{!done && <><div className="monter-constraint"><p>{current.instruction}</p><div className="monter-target"><span>{targetLabel(current, difficulty)}</span><output>{current.input === 'switch' ? (values[current.id] ? 'POTWIERDZONE' : 'NIEPOTWIERDZONE') : `${values[current.id]}${current.unit}`}</output></div>{current.input === 'range' ? <><input aria-label={`Ustawienie: ${current.name}`} type="range" min={current.min} max={current.max} value={values[current.id]} onChange={(event) => setValue(Number(event.target.value))}/><button className="target-fill-button" onClick={() => setValue(current.target)}>Ustaw wartość docelową</button></> : <button className={'constraint-switch '+(values[current.id] ? 'active' : '')} onClick={() => setValue(values[current.id] ? 0 : 1)}>{values[current.id] ? 'Czujniki potwierdzone' : 'Potwierdź zabezpieczenia'}</button>}</div><button className="primary-btn" onClick={confirmStep}>{current.action} <Box size={16}/></button></>}{done && <><button className={'primary-btn '+(test ? 'active' : '')} onClick={() => setTest((value) => !value)}>{test ? 'Zatrzymaj test' : 'Uruchom test otwarcia'} <Gauge size={16}/></button><p className="learn-tip"><strong>CO DALEJ</strong><br/>Ćwiczenie pokazuje kolejność kontroli. Rzeczywisty montaż i testy bezpieczeństwa wykonuje uprawniony fachowiec.</p></>}<button className="text-button" onClick={() => reset()}><RotateCcw size={14}/> Zacznij od nowa</button></aside></div><div className="embedded-game-bottom"><div className="game-progress"><span style={{width: `${stage / steps.length * 100}%`}}/></div><p role="status">{message}</p><div className="monter-bottom-row"><small>Enter — potwierdź krok · 600 N to parametr demonstracyjnego napędu.</small>{ghost.length > 0 && done && <span className="ghost-replay"><span className="ghost-dot" style={{left: `${ghostStage / steps.length * 100}%`}}/>Najlepszy wynik</span>}</div><details><summary><Trophy size={14}/> Ranking lokalny</summary><ol>{scores.slice(0, 3).map((item, index) => <li key={`${item.score}-${index}`}>{item.score} pkt · {item.time}s · {item.mode}</li>)}</ol></details></div>
  </div>;
}
