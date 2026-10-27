import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, deleteAllPhotos, exportBackup, restoreBackup, setSetting } from '../lib/db';
import { useSetting } from '../lib/hooks';
import { formatBytes, photosSize } from '../lib/photos';
import { globalSummary } from '../lib/summary';
import { LLM_INSTRUCTION } from '../lib/prompt';
import { ShareText } from '../components/ShareText';

export default function Settings() {
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const photosEnabled = useSetting('photosEnabled');
  const photoStats = useLiveQuery(() => photosSize(db));
  const [quota, setQuota] = useState<string>();

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => {});
    navigator.storage
      ?.estimate?.()
      .then((e) => e.usage !== undefined && setQuota(`${formatBytes(e.usage)}${e.quota ? ` de ${formatBytes(e.quota)} disponibles` : ''}`))
      .catch(() => {});
  }, [photoStats]);

  async function download(includePhotos: boolean) {
    const data = JSON.stringify(await exportBackup(db, includePhotos));
    const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `baristapp-${new Date().toISOString().slice(0, 10)}${includePhotos ? '' : '-sin-fotos'}.json`;
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
        <button type="button" onClick={() => download(true)}>⬇︎ Copia completa</button>
        <button type="button" onClick={() => download(false)}>⬇︎ Copia sin fotos</button>
        <label className="btn" style={{ margin: 0, color: 'var(--text)', fontSize: '1rem' }}>
          ⬆︎ Restaurar copia
          <input type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && restore(e.target.files[0])} />
        </label>
      </div>
      <p className="small muted">La copia sin fotos es mucho más ligera; al restaurarla, los cafés y la lista de deseos quedan sin foto.</p>
      {msg && <div className={`msg ${msg.kind}`}>{msg.text}</div>}

      <h2>Fotos</h2>
      <div className="card stack">
        <label className="toggle">
          Mostrar y permitir fotos
          <input type="checkbox" checked={photosEnabled} onChange={(e) => setSetting(db, 'photosEnabled', e.target.checked)} />
        </label>
        <p className="small muted">
          Desactivadas, la app no carga ni pide fotos, pero las conserva: puedes volver a activarlas cuando quieras.
        </p>
        {photoStats && (
          <p className="small">
            {photoStats.count} foto{photoStats.count === 1 ? '' : 's'} · {formatBytes(photoStats.bytes)}
            {quota && <span className="muted"> · almacenamiento total de la app: {quota}</span>}
          </p>
        )}
        {!!photoStats?.count && (
          <button
            type="button"
            className="danger"
            onClick={async () => {
              if (confirm(`¿Borrar las ${photoStats.count} fotos? No se puede deshacer (descarga antes una copia completa si quieres conservarlas).`)) {
                await deleteAllPhotos(db);
                setMsg({ kind: 'ok', text: 'Fotos borradas.' });
              }
            }}
          >
            Borrar todas las fotos
          </button>
        )}
      </div>

      <p className="small muted" style={{ marginTop: 24 }}>BaristApp v{__APP_VERSION__}</p>
    </>
  );
}
