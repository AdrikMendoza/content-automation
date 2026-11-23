---
name: configurar
description: Configura el proyecto la primera vez (marca, colores, letras, estilo de motion graphics, voz) e instala todo. Usar cuando el usuario diga "configura el proyecto", "instalar", "setup", o cuando brand.json tenga "configurado" en false.
---

# Configurar content-automation

Conversación corta y amable, **una pregunta a la vez**, con opciones concretas. Al final, todo queda en `brand.json`
y `voice/voice.json`, y se hace una prueba real.

## 1. Preguntas (en este orden)

1. **Marca**: ¿cómo se llama tu marca o tu cuenta? (va como firma al final de cada video) ¿Y qué CTA quieres al cierre?
   Ejemplos: "SÍGUEME PARA MÁS", "GUÁRDALO Y PRUÉBALO". Avisar: un CTA tipo "Escribe X y te mando…" solo si de
   verdad hay algo que mandar.
2. **Tema de la cuenta**: ¿de qué hablas y para quién? (lo usa la skill `temas` para buscar ideas). Guardarlo en
   `brand.json` → `"nicho"`.
3. **Estilo de motion graphics**: mostrar la librería de [Lemo-Opuscar](https://github.com/lemomo-ai/lemo-opuscar)
   (galería y videos en su README; cada estilo en `styles/<nombre>/`). Recomendar estas tres, que la plantilla ya
   combina, y dejar que elija cualquiera de la librería:
   - **dark-keynote**: fondo casi negro con luz suave arriba, letra grande y limpia (presentación de keynote).
   - **swiss-motion**: diseño suizo, todo entra con cortes y máscaras, sin rebotes, números que suben en pasos.
   - **living-screencast**: una terminal o pantalla viva con zoom al cursor (ideal si hablas de código o apps).
   Si elige otro estilo, clonar el repo de Opuscar en una carpeta de referencia **fuera** de este proyecto, leer su
   `styles/<nombre>/STYLE.md` y adaptar fondo, letras y forma de moverse en `plantilla/compose.mjs`. Respetar la
   licencia de Opuscar (código MIT; personajes y marcas de terceros, como Clawd de Anthropic, no se usan).
   Preguntar también **cuánto movimiento**: alto (recomendado: cámara, tarjetas 3D, onda que reacciona a la voz) o medio.
4. **Colores**: proponer 3 paletas que combinen con el estilo elegido (fondo, texto, acento, acento 2, secundario) y
   aceptar sus propios códigos hex. Regla: el acento se usa en **una sola cosa por pantalla**. Revisar contraste del
   texto sobre el fondo (4.5:1 o más).
5. **Letras**: título, cifras gigantes y etiquetas. Por defecto Inter / Inter Tight / JetBrains Mono. Si quiere otras,
   que sean de licencia abierta (Google Fonts / `@fontsource`): `npm i -D @fontsource/<fuente>` y copiar los `.woff2`
   a `plantilla/assets/fonts/` con los nombres de `plantilla/assets/fonts/LEEME.md`.
6. **Voz**:
   - Acento/idioma. Español latino → modelo `ResembleAI/Chatterbox-Multilingual-es-mx-latam` (el que usa `tts.py`).
     Otro idioma → el multilingüe `ResembleAI/chatterbox`; ajustar `tts.py` para ese repo (solo `.safetensors`).
   - Grabar la muestra: 15-20 s hablando natural, como en tus videos, en un cuarto silencioso, celular a 20 cm, sin
     música. **Los primeros 10 s son los que se copian**: que empiece hablando, sin silencio. Guardar como
     `voice/mi_voz.wav` (WAV o convertir con ffmpeg a 24 kHz mono) y escribir `voice/voice.json` = `{"active": "mi_voz.wav"}`.
   - Recordar: la voz nunca sale de su PC y `voice/` está en `.gitignore`.
7. **Música**: ¿qué mood? (trap, lo-fi, hype, tensión…). La plantilla no trae música: explicar cómo agregar pistas
   con licencia (ver `sfx/LICENCIAS.md`). Sin catálogo, el video sale solo con voz y efectos.

Escribir todo en `brand.json` y poner `"configurado": true`.

## 2. Instalación

Mostrar cada comando antes de correrlo. Windows:

1. Revisar: `python --version` (3.11), `node --version` (20+), `ffmpeg -version`, `nvidia-smi` (hay tarjeta NVIDIA).
   Si falta algo, decir cómo instalarlo y esperar.
2. Entorno de Python fuera de carpetas sincronizadas:
   `python -m venv "%LOCALAPPDATA%\content-automation\venv"` y
   `"%LOCALAPPDATA%\content-automation\venv\Scripts\python.exe" -m pip install -r requirements.txt`.
3. `npm install`.
3b. Código del modelo de voz: `python instalar_chatterbox.py` (lo baja del Space oficial de Resemble AI, versión fija, y aplica el parche de solo `.safetensors`).
4. Modelo de voz: lo baja `tts.py` la primera vez, **solo `.safetensors` de `ResembleAI`**. Verificar en la salida el
   nombre del repo y la extensión.

## 3. Prueba

1. `pruebas/frase.txt` con dos renglones (`[-] Hola, esta es mi voz clonada.` / `[+] ¡Y suena increíble!`) →
   `python tts.py pruebas/frase.txt pruebas/frase.wav`. Que el usuario lo escuche. Si no se parece: otra muestra
   (más limpia, empezando a hablar desde el segundo 0) o ajustar `--exaggeration` y `--speed`, y que compare de oído.
2. Reel de ejemplo con su marca: copiar `plantilla/` a `reels/ejemplo/`, generar la voz del `guion_voz.txt`
   (`python tts.py reels/ejemplo/guion_voz.txt reels/ejemplo/voz.wav --pantalla reels/ejemplo/guion.txt`) y seguir la
   skill `reel` desde el paso de render. Mostrarle el `reel.mp4`.
3. Ofrecer instalar el agente nocturno (`agente/instalar_tarea.ps1`).
