import { STEP_ACTION_LABELS, type Recipe, type Step } from '../lib/types';
import { formatNum, formatRatio, formatTime } from '../lib/time';

export function RecipeParams({ r }: { r: Recipe }) {
  return (
    <div className="params">
      <div className="param"><b>{formatNum(r.coffeeGrams)} g</b><small>café</small></div>
      <div className="param"><b>{formatNum(r.waterGrams)} g</b><small>agua</small></div>
      <div className="param"><b>{formatRatio(r.coffeeGrams, r.waterGrams)}</b><small>ratio</small></div>
      <div className="param"><b>{r.grindClicks ?? '—'}</b><small>clics K6</small></div>
      <div className="param"><b>{r.waterTempC !== undefined ? `${r.waterTempC} °C` : '—'}</b><small>agua</small></div>
      <div className="param">
        <b>{r.targetTimeMin !== undefined && r.targetTimeMax !== undefined ? `${formatTime(r.targetTimeMin)}–${formatTime(r.targetTimeMax)}` : '—'}</b>
        <small>objetivo</small>
      </div>
    </div>
  );
}

export function StepDetail({ s }: { s: Step }) {
  return (
    <>
      <div>
        <b>{STEP_ACTION_LABELS[s.action]}</b>
        {s.addGrams !== undefined && <> · +{s.addGrams} g</>}
        {s.totalGrams !== undefined && <> → <b>{s.totalGrams} g</b></>}
        {s.endsAt !== undefined && <span className="muted"> · hasta {formatTime(s.endsAt)}</span>}
      </div>
      {s.pourType && <div className="small muted">{s.pourType}</div>}
      <div className="small">{s.instruction}</div>
    </>
  );
}

export function StepList({ steps, current }: { steps: Step[]; current?: number }) {
  return (
    <ol className="steps">
      {steps.map((s, i) => (
        <li key={i} className={current === undefined ? '' : i < current ? 'done' : i === current ? 'now' : ''}>
          <span className="t">{formatTime(s.at)}</span>
          <div><StepDetail s={s} /></div>
        </li>
      ))}
    </ol>
  );
}
