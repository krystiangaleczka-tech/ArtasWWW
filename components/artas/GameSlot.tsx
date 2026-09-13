'use client';

import {useEffect, useRef, useState} from 'react';

type GameComponent = React.ComponentType;
type GameLoader = () => Promise<{default: GameComponent}>;

const loaders: Record<string, GameLoader> = {
  rush: () => import('./games/GateRushGame'),
  monter: () => import('./games/MonterGame'),
  learn: () => import('./games/LearnModeGame'),
};

export default function GameSlot({game, label}: {game: keyof typeof loaders; label: string}) {
  const host = useRef<HTMLDivElement>(null);
  const [Game, setGame] = useState<GameComponent | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let disposed = false;
    const load = () => {
      observer.disconnect();
      loaders[game]().then((module) => {
        if (!disposed) setGame(() => module.default);
      }).catch(() => {
        if (!disposed) setError(true);
      });
    };
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) load();
    }, {rootMargin: '240px'});
    observer.observe(element);
    return () => {
      disposed = true;
      observer.disconnect();
    };
  }, [game]);

  return <div ref={host} className="game-slot" aria-label={label}>
    {Game ? <Game/> : error ? <div className="game-placeholder">Nie udało się załadować tej gry.</div> : <div className="game-placeholder"><span className="game-placeholder-dot"/>Gra załaduje się, gdy dotrzesz do tej sekcji…</div>}
  </div>;
}
