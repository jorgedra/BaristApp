# BaristApp

Recetario y diario de extracciones de café, pensado para el móvil. Las recetas las genera tu chat LLM de barista; la app las guarda, te guía mientras preparas el café y registra el resultado para devolvérselo al LLM.

Sin backend ni IA: los datos viven en el navegador (IndexedDB) y funciona sin conexión como PWA.

## Flujo de uso

1. **Ajustes → Copiar instrucción** y añádela al final de tu prompt de barista ([docs/instruccion-llm.md](docs/instruccion-llm.md)). A partir de ahí, cada receta del LLM incluye un bloque JSON.
2. **Importar**: pega la respuesta del LLM (entera o solo el JSON). Se valida, avisa de incoherencias (acumulados que no cuadran, AeroPress > 200 g…) y la agrupa con el café si ya existe (mismo nombre y tostador).
3. **Preparar**: cronómetro guiado con el paso actual (gramos acumulados, vertido, hasta cuándo), cuenta atrás al siguiente, pitidos 3-2-1, vibración y pantalla siempre encendida.
4. **Terminar → Registrar**: el tiempo final se rellena solo; anota parámetros reales, la variable cambiada, sabor, problemas y valoración.
5. **Copiar resultado** y pégalo en el chat para el diagnóstico o el siguiente ajuste. Si el LLM propone una receta nueva, se importa como otra receta del mismo café.
6. Marca la que funcione como **★ referencia** (una por café y método).
7. Para cambiar de conversación: **Copiar resumen** del café o el **resumen global** en Ajustes.

## Instalar en el móvil

Abre la URL publicada y usa «Añadir a pantalla de inicio» (Safari) o «Instalar app» (Chrome). Instalada, el navegador conserva mejor los datos; aun así, descarga una copia de seguridad de vez en cuando desde Ajustes.

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # tests de importación, cronómetro, BD y exportación
npm run build      # typecheck + build en dist/
```

Stack: React + TypeScript + Vite, Dexie (IndexedDB), Zod (validación del JSON), vite-plugin-pwa.

## Despliegue

`.github/workflows/deploy.yml` publica en GitHub Pages en cada push a `main`. Hay que activarlo una vez: **Settings → Pages → Source: GitHub Actions**.
