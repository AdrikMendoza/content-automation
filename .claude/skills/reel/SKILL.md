---
name: reel
description: Produce un reel vertical (30-80 s, 1080x1920) con guion, voz clonada del usuario, motion graphics, efectos y música, listo para subir. Usar después de elegir un tema o cuando pidan "haz un reel/video sobre X".
---

# Hacer un reel

Antes: leer `brand.json` (si `"configurado": false`, correr la skill `configurar`). Carpeta nueva por reel:
`reels/AAAA-MM-DD-tema-corto/` (nunca sobrescribir otra).

## 1. Guion

Fórmula que funciona:
1. **Gancho** en los primeros 2 s: algo que sorprende (una noticia real, un dato, "este video no lo grabé").
2. **Pasos numerados** ("Uno… Dos… Tres…"): cómo funciona la cosa por dentro, una idea por pantalla.
3. **El fix**: algo concreto que el que mira puede hacer.
4. **Remate** con humor y el CTA de `brand.json`.

Reglas:
- 40-50 s (125-160 palabras a ~190 por minuto), hasta 80 s si hace falta. Frases de menos de 12 palabras.
- Un renglón por idea, línea en blanco entre bloques, `…` antes de cada remate.
- `guion.txt` = lo que se ve (cifras: "-6.1%"). `guion_voz.txt` = lo que se dice ("menos seis punto uno por ciento"),
  con `[+]` en remates y `[-]` en explicaciones, y la misma puntuación de fin de frase que `guion.txt`.
- Siglas que el modelo se come: escribirlas como suenan. Nombres de apps en inglés: tal cual.
- Cada dato con fuente en `fuentes.md` (abrir cada página; marcar **Revisar** lo dudoso). Nada inventado como real:
  los ejemplos inventados se marcan en pantalla como ejemplo.
- `caption.txt`: 3-5 líneas que resumen el valor + 5 hashtags. `reel.json`: `{"mood": "..."}`.

## 2. Voz

`"%LOCALAPPDATA%\content-automation\venv\Scripts\python.exe" tts.py <reel>/guion_voz.txt <reel>/voz.wav --pantalla <reel>/guion.txt`

Escuchar los nombres raros. Para arreglar una frase sin perder la toma: `empalmar_voz.py --desde N` con un archivo que
tenga **solo las frases nuevas**.

## 3. Animación

Copiar `plantilla/` (compose.mjs, sfx.py, mezcla.py, assets/) a la carpeta del reel y reescribir las escenas de
`compose.mjs` para este guion. La plantilla es el reel de ejemplo: úsala como **referencia de movimiento**.

- **Mucho movimiento, nunca aburrido**: cámara virtual sobre un tablero 3D que viaja de escena en escena, tarjetas que
  entran con giro, cifras que suben en pasos, karaoke con la palabra activa en el color de acento, una onda que se
  mueve con la voz real cuando se habla de audio. Algo cambia cada 1.5-2.5 s.
- **Cada movimiento tiene su sonido** (`cue(...)`): pop, click, whoosh, tick; tecleo = una tecla por carácter.
- Anclar todo a las palabras de `tiempos.json` (`W(frase, "palabra")`), nunca a segundos fijos.
- Estilo de `brand.json` → `estilo.opuscar`: fondo y letras del estilo; si es otro de Lemo-Opuscar, leer su `STYLE.md`.
- Colores y letras **solo** desde `brand.json` (la plantilla los cambia sola al generar). Acento: una cosa por pantalla.
- Subtítulos en su carril (entre y=1370 y 1540), nunca encima de la animación. Contenido entre y=310 y 1340.
- Apps nombradas: logo oficial del kit de prensa de la marca en `assets/logos/` (anotar URL y fecha en
  `assets/logos/FUENTES.txt`), plano y sin modificar. Sin kit oficial: chip con la inicial.
- Terminal o pantalla de código solo cuando el guion habla de código o comandos.
- Prohibido: `Math.random`, `Date.now`, animaciones CSS sueltas, rebotes, emojis.

## 4. Sonido, revisión y render

En la carpeta del reel:
1. `node compose.mjs` → `index.html` + `sfx_cues.json`.
2. `python sfx.py` (efectos CC0 de `sfx/`) y `python mezcla.py` (voz + efectos + música, -14 LUFS estéreo).
3. `npx hyperframes check` = 0 errores. `npx hyperframes snapshot --at <tiempos clave>` y **mirar** las capturas:
   texto cortado, encimado, fuera de zona segura. Arreglar y repetir.
4. `npx hyperframes render -o .reel.partial.mp4`, verificar duración (30-80 s), renombrar a `reel.mp4`.
   `portada.jpg` = un cuadro del gancho. Medir -14 LUFS.

Entregar al usuario: ruta del `reel.mp4`, duración, qué revisar (datos marcados **Revisar**) y el `caption.txt`.
