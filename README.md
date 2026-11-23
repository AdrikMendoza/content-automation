# content-automation

Un agente que hace reels verticales (1080x1920) **mientras duermes**: investiga un tema, escribe el guion, lo dice
con **tu voz clonada en tu propia PC**, arma motion graphics animados con subtítulos karaoke, efectos y música, revisa
el resultado y te deja los videos listos para elegir cuál subes.

Todo corre local. Tu voz nunca sale de tu computadora.

## Qué hace cada pieza

| Pieza | Qué hace |
|---|---|
| **Claude Code** + skills en `.claude/skills/` | Elige el tema (`temas`), escribe el guion y arma el video (`reel`), configura tu marca (`configurar`) |
| `tts.py` | Texto → `voz.wav` con tu voz + `tiempos.json` con el tiempo de cada palabra |
| `instalar_chatterbox.py` | Baja el modelo de voz [Chatterbox](https://huggingface.co/spaces/ResembleAI/Chatterbox-Multilingual-TTS-es-mx-latam) (Resemble AI, MIT) de su fuente oficial y le pone un parche de seguridad |
| `plantilla/compose.mjs` | Genera las animaciones (HyperFrames + GSAP): cámara sobre un tablero 3D, tarjetas, onda que reacciona a la voz, karaoke |
| `plantilla/sfx.py`, `plantilla/mezcla.py` | Efectos sincronizados con cada movimiento y mezcla final a -14 LUFS |
| `elegir_musica.py` | Elige música de tu catálogo con licencia, sin repetir |
| `agente/` | Corre todo solo cada noche (Programador de tareas de Windows) |

## Requisitos

- Windows 10/11 con **tarjeta gráfica NVIDIA** (8 GB o más de memoria de video recomendados).
- [Claude Code](https://claude.com/claude-code), Python 3.11, Node.js 20+, ffmpeg en el PATH, Git.
- 10 segundos de tu voz grabados en un lugar silencioso.

## Instalación (5 minutos)

```bash
git clone https://github.com/AdrikMendoza/content-automation
cd content-automation
claude
```

Y dentro de Claude Code escribe:

```
configura el proyecto
```

Claude te va a preguntar: el nombre de tu marca, tus colores, tus letras, **qué estilo de motion graphics te gusta**
(te muestra la librería de estilos de [Lemo-Opuscar](https://github.com/lemomo-ai/lemo-opuscar)), tu acento y cómo
grabar tu muestra de voz. Después instala todo, baja el modelo de voz y hace una prueba.

## Tu primer reel

```
haz un reel sobre <tema>
```

O deja que el agente busque el tema: `busca temas para un reel`.

Cada reel queda en `reels/AAAA-MM-DD-tema/` con `reel.mp4`, `caption.txt` (texto y hashtags) y `fuentes.md`.

## Agente nocturno

```powershell
powershell -ExecutionPolicy Bypass -File agente\instalar_tarea.ps1 -Hora 01:00 -Videos 2
```

La PC tiene que quedar **suspendida, no apagada** (activa "Permitir temporizadores de reactivación" en Opciones de
energía). En la mañana revisa `reels/AAAA-MM-DD-agente/resumen.md`.

## Reglas que trae

- El modelo de voz se carga **solo en `.safetensors`** y solo desde la organización oficial `ResembleAI` en Hugging Face.
- Tu muestra de voz (`voice/`) está en `.gitignore`: nunca se sube a ningún repo.
- Nada de canciones comerciales en el video (Instagram y TikTok lo silencian). Solo música con licencia que tú agregas.
- Logos de apps: solo del kit de prensa oficial de cada marca, sin modificar.
- Cada dato del guion lleva fuente en `fuentes.md`.

## Licencias

- Código de este repo: MIT (`LICENSE`).
- Chatterbox (Resemble AI, MIT): no viene en este repo; `instalar_chatterbox.py` baja el código del [Space oficial](https://huggingface.co/spaces/ResembleAI/Chatterbox-Multilingual-TTS-es-mx-latam) en una versión fija y los pesos de Hugging Face, solo `.safetensors`.
- `sfx/*.wav`: efectos CC0 (dominio público), autor y fuente de cada uno en `sfx/LICENCIAS.md`.
- Fuentes Inter, Inter Tight y JetBrains Mono: SIL Open Font License 1.1.
- No incluye música: agrega la tuya con licencia clara (ver `sfx/LICENCIAS.md`).
