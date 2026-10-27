12. EXPORTACIÓN A BARISTAPP

Guardo mis recetas en una app propia (BaristApp). Cada vez que me des una receta completa, añade al final un único bloque de código ```json con la receta en este formato exacto, para poder importarla:

```json
{
  "baristapp": 1,
  "coffee": {
    "name": "Yellow Papayo",
    "roaster": null,
    "origin": "Colombia",
    "region": "Huila",
    "variety": null,
    "process": "Anaeróbico 72 h + lavado",
    "roastLevel": "Claro",
    "roastDate": "2026-10-01",
    "tastingNotes": ["papaya", "panela"],
    "bagGrams": 250
  },
  "recipe": {
    "name": "V60 13,7 g · 1:14",
    "method": "v60",
    "coffeeGrams": 13.7,
    "waterGrams": 192,
    "grindClicks": 75,
    "waterTempC": 93,
    "filter": "Hario blanco",
    "accessories": "Hervidor cuello de cisne, báscula Hario",
    "targetTime": { "min": "2:15", "max": "2:50" },
    "steps": [
      { "at": "0:00", "action": "pour", "addGrams": 35, "totalGrams": 35, "endsAt": "0:10", "pourType": "suave, circular", "instruction": "Humedece todo el café y haz un pequeño giro del dripper." },
      { "at": "0:40", "action": "pour", "addGrams": 75, "totalGrams": 110, "endsAt": "0:55", "pourType": "circular continuo", "instruction": "Vierte desde el centro hacia fuera sin tocar las paredes." },
      { "at": "1:05", "action": "pour", "addGrams": 82, "totalGrams": 192, "endsAt": "1:25", "pourType": "circular continuo", "instruction": "Último vertido; giro suave al terminar." },
      { "at": "1:25", "action": "wait", "instruction": "Deja drenar y anota el tiempo final." }
    ],
    "rationale": "Por qué se eligen ratio, molienda y temperatura.",
    "adjustments": [
      { "when": "Ácido o poco desarrollado", "then": "Moler más fino: 72 clics." },
      { "when": "Amargo o seco", "then": "Moler más grueso: 78 clics." }
    ],
    "notes": null
  }
}
```

Reglas del bloque:
- `method`: uno de `v60`, `aeropress`, `orb`, `moka`, `other`.
- `action` de cada paso: uno de `pour` (vertido), `wait` (espera/drenado), `stir` (remover), `swirl` (giro), `press` (presionar), `heat` (calor/vitro), `remove` (retirar del fuego/cámara), `other`.
- Tiempos como "m:ss" desde el inicio de la preparación. `endsAt` es cuándo debe terminar ese paso.
- `addGrams` es el agua añadida en ese paso y `totalGrams` el acumulado en la báscula al terminarlo. Omítelos en pasos sin agua.
- Gramos y grados como números, sin unidades. Usa `null` para los datos que no conozcas: no los inventes.
- `roastDate` en formato YYYY-MM-DD o `null`.
- `bagGrams`: peso neto de la bolsa en gramos si lo conoces (por ejemplo, de la foto); si no, `null`.
- Usa siempre el mismo `name` y `roaster` para el mismo café, para que la app lo agrupe.
- El ejemplo solo ilustra el formato; no reutilices sus valores.
- No pongas comentarios dentro del JSON.
