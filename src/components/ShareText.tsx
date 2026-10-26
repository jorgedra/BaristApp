import { useState } from 'react';

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback para navegadores sin API de portapapeles
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

/** Botones de copiar y (si el móvil lo permite) compartir un texto. */
export function ShareText({ text, label = 'Copiar', title }: { text: string | (() => string); label?: string; title?: string }) {
  const [done, setDone] = useState(false);
  const get = () => (typeof text === 'function' ? text() : text);
  return (
    <span className="row">
      <button
        type="button"
        onClick={async () => {
          if (await copy(get())) {
            setDone(true);
            setTimeout(() => setDone(false), 1500);
          }
        }}
      >
        {done ? '✓ Copiado' : `📋 ${label}`}
      </button>
      {'share' in navigator && (
        <button type="button" onClick={() => navigator.share({ title, text: get() }).catch(() => {})} aria-label="Compartir">
          ↗︎
        </button>
      )}
    </span>
  );
}
