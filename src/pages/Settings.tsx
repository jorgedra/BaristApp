import { useEffect, useState } from 'react';
import { db, exportBackup, restoreBackup } from '../lib/db';
import { globalSummary } from '../lib/summary';
import { LLM_INSTRUCTION } from '../lib/prompt';
import { ShareText } from '../components/ShareText';

export default function Settings() {
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => {});
  }, []);

  async function download() {
    const data = JSON.stringify(await exportBackup(db), null, 2);
    const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `baristapp-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function restore(file: File) {
    if (!confirm('Esto sustituirá TODOS los datos actuales por los de la copia. ¿Continuar?')) return;
    try {
      await restoreBackup(db, JSON.parse(await file.text()));
      setMsg({ kind: 'ok', text: 'Copia restaurada.' });
    } catch (e) {
      setMsg({ kind: 'error', text: (e as Error).message });
    }
  }

  async function summary() {
    const [c, r, b] = await Promise.all([db.coffees.toArray(), db.recipes.toArray(), db.brews.toArray()]);
    return globalSummary(c, r, b);
  }

  return (
    <>
      <h1>Ajustes</h1>

      <h2>Instrucción para el LLM</h2>
      <p className="small muted">
        Añádela al final de tu prompt de barista para que cada receta incluya un bloque JSON importable.
      </p>
      <div className="row">
        <ShareText label="Copiar instrucción" title="Instrucción BaristApp" text={LLM_INSTRUCTION} />
        <button type="button" onClick={() => setShowPrompt(!showPrompt)}>{showPrompt ? 'Ocultar' : 'Ver'}</button>
      </div>
      {showPrompt && <pre className="export">{LLM_INSTRUCTION}</pre>}

      <h2>Estado para una conversación nueva</h2>
      <p className="small muted">Resumen de todos los cafés con existencias: recetas, referencia y últimas preparaciones.</p>
      <button
        type="button"
        onClick={async () => {
          const text = await summary();
          try {
            await navigator.clipboard.writeText(text);
            setMsg({ kind: 'ok', text: 'Resumen copiado.' });
          } catch {
            if ('share' in navigator) await navigator.share({ text }).catch(() => {});
          }
        }}
      >
        📋 Copiar resumen global
      </button>

      <h2>Copia de seguridad</h2>
      <p className="small muted">
        Los datos viven solo en este navegador. Descarga una copia de vez en cuando
        {persisted === false && ' (el navegador no ha concedido almacenamiento persistente: instala la app en la pantalla de inicio para reducir el riesgo de borrado)'}.
      </p>
      <div className="row">
        <button type="button" onClick={download}>⬇︎ Descargar copia</button>
        <label className="btn" style={{ margin: 0, color: 'var(--text)', fontSize: '1rem' }}>
          ⬆︎ Restaurar copia
          <input type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && restore(e.target.files[0])} />
        </label>
      </div>
      {msg && <div className={`msg ${msg.kind}`}>{msg.text}</div>}

      <p className="small muted" style={{ marginTop: 24 }}>BaristApp v{__APP_VERSION__}</p>
    </>
  );
}
