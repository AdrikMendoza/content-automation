# CLAUDE.md — content-automation

Pipeline local que convierte un guion en un reel vertical (1080x1920, 30 fps, 30-80 s) con la voz clonada del
usuario. Claude escribe el tema y el guion con las skills de `.claude/skills/`; este repo hace la voz y el video.

**Si `brand.json` tiene `"configurado": false`, antes de cualquier otra cosa corre la skill `configurar`.**

## Mapa

| Archivo | Qué hace |
|---|---|
| `brand.json` | Marca del usuario: nombre, CTA, colores, letras, estilo, acento. **Fuente de verdad** |
| `tts.py` | Texto → `voz.wav` (-14 LUFS, true peak -1 dBTP) + `tiempos.json` (frases y palabras con inicio/fin) |
| `empalmar_voz.py` | Rehace unas frases de la voz sin perder el resto de la toma |
| `plantilla/` | Reel base: `compose.mjs` (animación), `sfx.py` (efectos), `mezcla.py` (mezcla). Copiar por reel |
| `elegir_musica.py` | Música del catálogo `sfx/musica/catalogo.json`, por mood, sin repetir |
| `capturar.mjs` | Captura de páginas públicas para mostrar en el video |
| `vendor/chatterbox/` | Código de Resemble AI (MIT), parcheado para cargar solo safetensors |
| `voice/` | Muestra de voz del usuario y `voice.json`. **Nunca se sube a git** |
| `agente/` | Agente nocturno (Programador de tareas) |

## Reglas que no se rompen

### Seguridad de modelos
1. Solo pesos **`.safetensors`** y solo de la organización **`ResembleAI`** en Hugging Face.
2. Si algo exige un `.pt`: `torch.load(..., weights_only=True)`.
3. El entorno de Python vive fuera de carpetas sincronizadas (OneDrive/Dropbox): `%LOCALAPPDATA%\content-automation\venv`.

### Voz
- La muestra activa se lee de `voice/voice.json` (`{"active": "<archivo en voice/>"}`). Nunca rutas fijas.
  Para cambiar de voz: archivo nuevo con otro nombre + editar `voice.json`. Nunca sobrescribir ni borrar muestras.
- Chatterbox copia los **primeros 10 s** de la muestra: la calidad del clon depende de eso.
- Guion de voz: un renglón por idea, línea en blanco entre bloques, `…` antes de cada remate. `[+]` = remate con
  energía, `[-]` = explicación calmada. Si la voz necesita otra ortografía, usar `guion_voz.txt` + `--pantalla guion.txt`.
- Nombres de apps en inglés se escriben tal cual; si uno suena mal, probar variantes y que el usuario elija de oído.
- La generación en GPU no es bit a bit determinista. No prometer lo contrario.
- `tts.py` escribe `tiempos.json` junto al wav de salida: las pruebas van en otra carpeta.

### Video
- Colores, letras, nombre y CTA salen de `brand.json`. No escribir colores a mano en un reel.
- Zona segura: 220 px arriba, 380 abajo, 60 a los lados. Subtítulos en su propio carril: **nunca encima de la animación**.
- **Motion muy llamativo y con mucho movimiento**: cámara, tarjetas que entran y giran, onda que reacciona a la voz.
  Algo cambia cada 1.5-2.5 s y cada movimiento tiene su sonido. Prohibido: `Math.random`/`Date.now` (render determinista).
- Logos: solo del kit de prensa oficial de la marca, planos, sin modificar, con la fuente anotada en `assets/logos/FUENTES.txt`.
  Si no hay kit oficial, chip con la inicial.

### Guion
- 40-50 s normal, hasta 80 s si el tema lo pide. Frases de menos de 12 palabras.
- Cada dato con fuente en `fuentes.md`; marcar **Revisar** lo que solo tenga fuentes secundarias.
- Nunca consejo de inversión, nada sobre la vida privada de personas reales, nada de clips de terceros.

### Audio
- Voz + efectos (CC0, `sfx/`) + música con licencia del catálogo, total -14 LUFS en estéreo.
- **Nunca canciones comerciales** dentro del MP4.

### Pipeline
- Nunca dejar un `reel.mp4` a medias: render a `.reel.partial.mp4`, verificar duración, renombrar.
- `npx hyperframes check` con 0 errores y **mirar** las capturas (`npx hyperframes snapshot`) antes del render.
- No subir a git audio, video, modelos, `node_modules` ni `voice/`.
