import { useId, useRef, useState } from 'react';
import { db } from '../lib/db';
import { savePhoto } from '../lib/photos';
import { usePhotoUrl, useSetting } from '../lib/hooks';

/** Añade https:// si falta, para que el enlace abra la web y no una ruta de la app. */
export function normalizeUrl(url: string): string {
  const u = url.trim();
  if (!u) return '';
  return /^[a-z][a-z0-9+.-]*:/i.test(u) ? u : `https://${u}`;
}

export function hostOf(url: string): string {
  try {
    return new URL(normalizeUrl(url)).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function LinkButton({ url, label = 'Abrir' }: { url: string; label?: string }) {
  return (
    <a className="btn" href={normalizeUrl(url)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
      ↗ {label}
    </a>
  );
}

export function Tags({ tags, active, onClick }: { tags: string[]; active?: string[]; onClick?: (t: string) => void }) {
  if (!tags.length) return null;
  return (
    <div className="chips">
      {tags.map((t) =>
        onClick ? (
          <button key={t} type="button" className={`chip tag${active?.includes(t) ? ' ref' : ''}`} onClick={() => onClick(t)}>#{t}</button>
        ) : (
          <span key={t} className="chip tag">#{t}</span>
        ),
      )}
    </div>
  );
}

/** Etiquetas como chips; Intro o coma añaden, con sugerencias de las ya usadas. */
export function TagInput({ value, onChange, suggestions }: { value: string[]; onChange: (v: string[]) => void; suggestions: string[] }) {
  const [text, setText] = useState('');
  const listId = useId();
  const add = (raw: string) => {
    const t = raw.trim().toLowerCase().replace(/^#/, '');
    if (t && !value.includes(t)) onChange([...value, t]);
    setText('');
  };
  return (
    <label>
      Etiquetas
      <div className="chips">
        {value.map((t) => (
          <button key={t} type="button" className="chip tag" onClick={() => onChange(value.filter((x) => x !== t))} aria-label={`Quitar ${t}`}>
            #{t} ✕
          </button>
        ))}
      </div>
      <input
        value={text}
        list={listId}
        placeholder="Escribe y pulsa Intro"
        enterKeyHint="done"
        onChange={(e) => (e.target.value.endsWith(',') ? add(e.target.value.slice(0, -1)) : setText(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            add(text);
          }
        }}
        onBlur={() => text && add(text)}
      />
      <datalist id={listId}>
        {suggestions.filter((s) => !value.includes(s)).map((s) => <option key={s} value={s} />)}
      </datalist>
    </label>
  );
}

export function PhotoThumb({ photoId, size = 56 }: { photoId?: number; size?: number }) {
  const url = usePhotoUrl(photoId, 'thumb');
  if (!url) return null;
  return <img className="thumb" src={url} alt="" width={size} height={size} />;
}

export function PhotoView({ photoId }: { photoId?: number }) {
  const url = usePhotoUrl(photoId, 'data');
  if (!url) return null;
  return <img className="photo" src={url} alt="" />;
}

/**
 * Selector de foto (cámara o galería). Guarda la foto al elegirla y devuelve su id.
 * La foto anterior solo se borra al confirmar el formulario (ver `replacePhoto`).
 */
export function PhotoField({ value, onChange }: { value?: number; onChange: (id: number | undefined) => void }) {
  const enabled = useSetting('photosEnabled');
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  if (!enabled) return null;
  return (
    <div style={{ marginBottom: 10 }}>
      <div className="small muted" style={{ marginBottom: 4 }}>Foto</div>
      <PhotoView photoId={value} />
      <div className="row">
        <button type="button" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? 'Procesando…' : value !== undefined ? '📷 Cambiar foto' : '📷 Añadir foto'}
        </button>
        {value !== undefined && <button type="button" onClick={() => onChange(undefined)}>Quitar</button>}
      </div>
      {error && <div className="msg error">{error}</div>}
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          setBusy(true);
          setError(undefined);
          try {
            onChange(await savePhoto(db, file));
          } catch (err) {
            setError((err as Error).message || 'No se pudo leer la imagen.');
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}

/** Al guardar un formulario con foto: borra la anterior si se cambió o quitó. */
export async function replacePhoto(oldId: number | undefined, newId: number | undefined) {
  if (oldId !== undefined && oldId !== newId) await db.photos.delete(oldId);
}

/** Al cancelar un formulario: borra la foto subida que no llegó a guardarse. */
export async function discardPhoto(savedId: number | undefined, draftId: number | undefined) {
  if (draftId !== undefined && draftId !== savedId) await db.photos.delete(draftId);
}
