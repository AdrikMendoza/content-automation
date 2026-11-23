"""Replace the voice from phrase N to the end, keeping the approved take before it.

    python empalmar_voz.py reels/X --desde 44 --voz final_voz.txt [--pantalla final_pantalla.txt] [tts.py options]

Generates only the new phrases with tts.py (same voice, studio chain and pauses), splices them where
phrase N started in reels/X/voz.wav, rewrites tiempos.json and re-normalises the whole file to -14 LUFS.
The previous voz.wav / tiempos.json are kept as *.antes.* until the next run.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
from tts import LEAD_IN, find_ffmpeg, loudnorm  # noqa: E402


def shift(f: dict, dt: float, i: int) -> dict:
    f = dict(f, i=i, inicio=round(f["inicio"] + dt, 3), fin=round(f["fin"] + dt, 3))
    for key in ("palabras", "palabras_pantalla"):
        if key in f:
            f[key] = [dict(w, inicio=round(w["inicio"] + dt, 3), fin=round(w["fin"] + dt, 3)) for w in f[key]]
    return f


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("reel", type=Path)
    ap.add_argument("--desde", type=int, required=True, help="index of the first phrase to replace (tiempos.json 'i')")
    ap.add_argument("--voz", type=Path, required=True, help="text for the new phrases (voice spelling)")
    ap.add_argument("--pantalla", type=Path, help="same phrases, on-screen spelling")
    args, tts_extra = ap.parse_known_args()

    voz, tj = args.reel / "voz.wav", args.reel / "tiempos.json"
    T = json.loads(tj.read_text(encoding="utf-8"))
    old = T["frases"]
    if not 0 < args.desde < len(old):
        print(f"--desde must be between 1 and {len(old) - 1}")
        return 2
    cut = old[args.desde]["inicio"] - LEAD_IN  # the new take brings its own LEAD_IN of silence

    with tempfile.TemporaryDirectory() as td:
        new_wav, new_tj = Path(td) / "nuevo.wav", Path(td) / "nuevo.json"
        cmd = [sys.executable, str(ROOT / "tts.py"), str(args.voz), str(new_wav), "--tiempos", str(new_tj), *tts_extra]
        if args.pantalla:
            cmd += ["--pantalla", str(args.pantalla)]
        if subprocess.run(cmd).returncode:
            return 20
        N = json.loads(new_tj.read_text(encoding="utf-8"))
        a, sr = sf.read(voz, dtype="float32")
        b, sr_b = sf.read(new_wav, dtype="float32")
        assert sr == sr_b, (sr, sr_b)
        audio = np.concatenate([a[: int(round(cut * sr))], b])
        raw = Path(td) / "empalme.wav"
        sf.write(raw, audio, sr, subtype="FLOAT")
        shutil.copy(voz, voz.with_suffix(".antes.wav"))
        shutil.copy(tj, tj.with_suffix(".antes.json"))
        tmp = voz.with_suffix(".tmp.wav")
        m = loudnorm(find_ffmpeg(), raw, tmp, T.get("lufs_objetivo", -14.0))
        os.replace(tmp, voz)

    frases = old[: args.desde] + [shift(f, cut, args.desde + k) for k, f in enumerate(N["frases"])]
    T.update(frases=frases, duracion=round(len(audio) / sr, 3), lufs_medido=float(m["output_i"]),
             true_peak_dbtp=float(m["output_tp"]))
    tj.write_text(json.dumps(T, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[empalme] frases {args.desde}+ reemplazadas ({len(N['frases'])} nuevas) desde {cut:.2f}s; "
          f"duracion {T['duracion']:.2f}s; {m['output_i']} LUFS, TP {m['output_tp']} dBTP")
    for f in frases[args.desde:]:
        print(f"  {f['i']:2d} {f['inicio']:6.2f} {f['fin']:6.2f}  {f.get('texto_pantalla', f['texto'])}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
