import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { timerState } from '../lib/brewTimer';
import { formatTime } from '../lib/time';
import { RecipeParams, StepDetail, StepList } from '../components/RecipeBits';

/** Pitido corto con WebAudio (no requiere archivos). */
function useBeep() {
  const ctx = useRef<AudioContext | null>(null);
  return {
    unlock() {
      ctx.current ??= new AudioContext();
      void ctx.current.resume();
    },
    beep(freq = 880, ms = 120) {
      const c = ctx.current;
      if (!c) return;
      const o = c.createOscillator();
      const g = c.createGain();
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.25, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + ms / 1000);
      o.connect(g).connect(c.destination);
      o.start();
      o.stop(c.currentTime + ms / 1000);
    },
  };
}

/** Mantiene la pantalla encendida mientras `active`. */
function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | undefined;
    const acquire = () => navigator.wakeLock.request('screen').then((l) => (lock = l)).catch(() => {});
    void acquire();
    const onVis = () => document.visibilityState === 'visible' && acquire();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      void lock?.release();
    };
  }, [active]);
}

export default function BrewMode() {
  const id = Number(useParams().id) || -1; // -1: clave válida que nunca existe (NaN rompe IndexedDB)
  const navigate = useNavigate();
  const recipe = useLiveQuery(async () => (await db.recipes.get(id)) ?? null, [id]);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [sound, setSound] = useState(true);
  const { unlock, beep } = useBeep();
  const lastSecond = useRef(-1);
  useWakeLock(startedAt !== null);

  useEffect(() => {
    if (startedAt === null) return;
    const t = setInterval(() => setElapsed((performance.now() - startedAt) / 1000), 100);
    return () => clearInterval(t);
  }, [startedAt]);

  const steps = recipe?.steps ?? [];
  const sec = Math.floor(elapsed);
  const state = timerState(steps, sec);

  // Avisos: 3-2-1 antes de cada paso y pitido largo + vibración al empezar.
  useEffect(() => {
    if (startedAt === null || sec === lastSecond.current) return;
    lastSecond.current = sec;
    if (steps.some((s) => s.at === sec && sec > 0)) {
      if (sound) beep(1320, 350);
      navigator.vibrate?.(300);
    } else if (state.untilNext !== undefined && state.untilNext <= 3) {
      if (sound) beep(880, 100);
    }
  }, [sec, startedAt, steps, state.untilNext, sound, beep]);

  if (recipe === null) return <p className="empty">Receta no encontrada.</p>;
  if (!recipe) return null;
  const step = steps[state.current];

  if (startedAt === null) {
    return (
      <div className="brew">
        <Link to={`/receta/${id}`} className="small">← Volver</Link>
        <h1>{recipe.name}</h1>
        <RecipeParams r={recipe} />
        {recipe.filter && <p className="small muted">Filtro: {recipe.filter}</p>}
        <p className="small muted">Prepara el café molido, el agua a temperatura y la báscula a cero. El cronómetro empieza con el primer paso.</p>
        <label className="row" style={{ justifyContent: 'center' }}>
          <input type="checkbox" checked={sound} onChange={(e) => setSound(e.target.checked)} style={{ width: 'auto', margin: 0 }} /> Avisos sonoros
        </label>
        <button
          type="button"
          className="primary block"
          style={{ fontSize: '1.3rem', minHeight: 64 }}
          onClick={() => {
            unlock();
            if (sound) beep(1320, 350);
            lastSecond.current = 0;
            setElapsed(0);
            setStartedAt(performance.now());
          }}
        >
          ▶ Empezar
        </button>
      </div>
    );
  }

  const finished = state.next === undefined;
  return (
    <div className="brew">
      <div className="clock">{formatTime(elapsed)}</div>
      {recipe.targetTimeMin !== undefined && recipe.targetTimeMax !== undefined && (
        <div className="small muted">Objetivo {formatTime(recipe.targetTimeMin)}–{formatTime(recipe.targetTimeMax)}</div>
      )}

      {step && (
        <div className="big-step">
          {step.totalGrams !== undefined && (
            <div className="grams">{step.totalGrams} g <small>{step.addGrams !== undefined && `(+${step.addGrams} g)`}</small></div>
          )}
          {state.pouring && <div className="pouring">Vertiendo · termina en {formatTime(step.endsAt!)}</div>}
          <StepDetail s={step} />
        </div>
      )}

      {state.next ? (
        <div className="next">
          <div className="countdown">{formatTime(state.untilNext!)}</div>
          Siguiente en <b>{formatTime(state.next.at)}</b>
          {state.next.totalGrams !== undefined && <> · hasta <b>{state.next.totalGrams} g</b></>}
          <div className="small">{state.next.instruction}</div>
        </div>
      ) : (
        <p className="next">Último paso. Pulsa «Terminar» cuando acabe de drenar o de salir el café.</p>
      )}

      <div className="row" style={{ justifyContent: 'center', margin: '16px 0' }}>
        <button
          type="button"
          className={finished ? 'primary' : ''}
          style={{ minHeight: 56, padding: '0 28px' }}
          onClick={() => navigate(`/receta/${id}/registrar?t=${Math.round(elapsed)}`, { replace: true })}
        >
          ■ Terminar
        </button>
        <button
          type="button"
          onClick={() => {
            if (confirm('¿Reiniciar el cronómetro?')) {
              setStartedAt(null);
              setElapsed(0);
            }
          }}
        >
          ↺
        </button>
      </div>

      <div className="card" style={{ textAlign: 'left' }}>
        <StepList steps={steps} current={state.current} />
      </div>
    </div>
  );
}
