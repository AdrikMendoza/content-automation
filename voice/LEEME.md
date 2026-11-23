# Tu muestra de voz

Esta carpeta **nunca se sube a git** (ver `.gitignore`), salvo este archivo y `voice.json`.

1. Graba 15-20 s hablando natural, como en tus videos: cuarto silencioso, celular a 20 cm, sin música.
   Empieza a hablar desde el segundo 0: el modelo copia **los primeros 10 segundos**.
2. Guárdala aquí, por ejemplo `voice/mi_voz.wav` (convertir: `ffmpeg -i grabacion.m4a -ar 24000 -ac 1 voice/mi_voz.wav`).
3. Escribe en `voice/voice.json`: `{"active": "mi_voz.wav"}`.

Para cambiar de voz, graba un archivo nuevo con otro nombre y cambia `voice.json`. No sobrescribas la anterior.
