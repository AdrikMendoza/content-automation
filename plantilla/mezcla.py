"""Mix: voz.wav (100%) + assets/sfx.wav + music (-19 LUFS, light ducking 4:1) -> assets/mezcla.wav (-14 LUFS).
Usage: python mezcla.py      (needs ffmpeg on PATH or FFMPEG set)
"""
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT))
from tts import loudnorm  # two-pass EBU R128 with true-peak limiter  # noqa: E402

FF = os.environ.get("FFMPEG") or shutil.which("ffmpeg")
TOTAL = json.loads((HERE / "sfx_cues.json").read_text(encoding="utf-8"))["total"]
BED_LUFS = float(os.environ.get("REEL_BED_LUFS", "-19.0"))
SFX_DB = float(os.environ.get("REEL_SFX_DB", "-4.0"))
DUCK_RATIO = float(os.environ.get("REEL_DUCK_RATIO", "4"))


def integrated(path: Path) -> float:
    p = subprocess.run([FF, "-hide_banner", "-nostats", "-i", str(path), "-af", "ebur128", "-f", "null", "-"],
                       capture_output=True, text=True)
    return float(re.findall(r"I:\s+(-?[\d.]+) LUFS", p.stderr)[-1])


from elegir_musica import MUSIC as MUSIC_DIR, choose  # noqa: E402

# music chosen automatically by mood + rotation (reel.json / sfx/musica/catalogo.json); saved in musica.json
pick = choose(HERE, TOTAL)
bed_src = HERE / "assets" / "musica.wav"
if pick is None:
    print("musica: catalogo vacio, mezcla sin musica (agrega pistas con licencia en sfx/musica/)")
    subprocess.run([FF, "-y", "-v", "error", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-t", str(TOTAL), str(bed_src)], check=True)
    bed_gain = 0.0
else:
    MUSIC = MUSIC_DIR / pick["archivo"]
    loop = ["-stream_loop", "-1"] if pick["loop"] else []
    subprocess.run([FF, "-y", "-v", "error", *loop, "-ss", str(pick["inicio"]), "-i", str(MUSIC), "-t", str(TOTAL), "-af",
                    f"afade=t=in:d=0.4,afade=t=out:st={TOTAL - 2.0}:d=2.0", "-ar", "48000", "-ac", "2", str(bed_src)], check=True)
    print(f"musica: {pick['titulo']} ({pick['artista']}, {pick['mood']}) desde {pick['inicio']} s")
    bed_gain = BED_LUFS - integrated(bed_src)
graph = ";".join([
    f"[0:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,apad=whole_dur={TOTAL},atrim=0:{TOTAL},asplit=2[v][vsc]",
    f"[1:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,volume={SFX_DB}dB[fx]",
    f"[2:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,volume={bed_gain:.2f}dB[bed]",
    f"[bed][vsc]sidechaincompress=threshold=0.03:ratio={DUCK_RATIO:g}:attack=15:release=350:makeup=1[duck]",
    "[v][fx][duck]amix=inputs=3:normalize=0:duration=first[mix]",
])
pre = HERE / "assets" / "_mezcla_pre.wav"
subprocess.run([FF, "-y", "-v", "error", "-i", str(HERE / "voz.wav"), "-i", str(HERE / "assets" / "sfx.wav"),
                "-i", str(bed_src), "-filter_complex", graph, "-map", "[mix]", "-t", str(TOTAL),
                "-c:a", "pcm_f32le", str(pre)], check=True)
out = HERE / "assets" / "mezcla.wav"
m = loudnorm(FF, pre, out, -14.0, -1.0, channels=2)  # stereo, measured as delivered
pre.unlink()
# Instagram version: voice + effects, no music (the viral track is added inside Instagram, licensed there)
graph_nm = ";".join([
    f"[0:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,apad=whole_dur={TOTAL},atrim=0:{TOTAL}[v]",
    f"[1:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,volume={SFX_DB}dB[fx]",
    "[v][fx]amix=inputs=2:normalize=0:duration=first[mix]",
])
subprocess.run([FF, "-y", "-v", "error", "-i", str(HERE / "voz.wav"), "-i", str(HERE / "assets" / "sfx.wav"),
                "-filter_complex", graph_nm, "-map", "[mix]", "-t", str(TOTAL), "-c:a", "pcm_f32le", str(pre)], check=True)
m2 = loudnorm(FF, pre, HERE / "assets" / "mezcla_sin_musica.wav", -14.0, -1.0, channels=2)
pre.unlink()
print(f"sin musica: {m2['output_i']} LUFS, true peak {m2['output_tp']} dBTP")
print(f"{bed_src.name} a {BED_LUFS} LUFS (ganancia {bed_gain:+.1f} dB), efectos {SFX_DB} dB; "
      f"mezcla {m['input_i']} -> {m['output_i']} LUFS, true peak {m['output_tp']} dBTP")
