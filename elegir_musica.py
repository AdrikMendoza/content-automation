"""Pick the background music for a reel automatically (no human choice needed).

    python elegir_musica.py reels/X --total 60.5 [--mood trap|groove|hype|tension] [--nueva]

- exact track: reels/X/reel.json {"musica": "<archivo del catalogo>"} (Claude picks the one that fits the video).
- mood: --mood, else reels/X/reel.json {"mood": ...}, else the first mood in the catalog.
- picks the track of that mood used longest ago (sfx/musica/historial.json), so reels don't repeat music.
- starts at the top of the track; loops only if the track is
  shorter than the reel.
- writes reels/X/musica.json and reuses it on later runs (same reel = same music) unless --nueva.
All tracks: Mixkit Stock Music Free License (see sfx/LICENCIAS.md).
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MUSIC = ROOT / "sfx" / "musica"
CATALOG = MUSIC / "catalogo.json"
HISTORY = MUSIC / "historial.json"


def choose(reel: Path, total: float, mood: str | None = None, nueva: bool = False) -> dict:
    out = reel / "musica.json"
    if out.exists() and not nueva:
        pick = json.loads(out.read_text(encoding="utf-8"))
        if (MUSIC / pick["archivo"]).exists():
            return pick
    tracks = json.loads(CATALOG.read_text(encoding="utf-8"))["pistas"]
    tracks = [t for t in tracks if (MUSIC / t["archivo"]).exists()]
    if not tracks:
        return None  # empty catalog: mix without music
    cfg = json.loads((reel / "reel.json").read_text(encoding="utf-8")) if (reel / "reel.json").exists() else {}
    if mood is None:
        mood = cfg.get("mood") or tracks[0]["mood"]
    wanted = [t for t in tracks if t["archivo"] == cfg.get("musica")]
    pool = wanted or [t for t in tracks if t["mood"] == mood] or tracks
    history = json.loads(HISTORY.read_text(encoding="utf-8")) if HISTORY.exists() else []
    last_used = {h["archivo"]: i for i, h in enumerate(history)}  # higher index = used more recently
    # least recently used first; ties broken by a stable hash of the reel name (deterministic, no randomness)
    key = lambda t: (last_used.get(t["archivo"], -1), hashlib.md5((reel.name + t["archivo"]).encode()).hexdigest())
    t = sorted(pool, key=key)[0]
    loop = t["duracion"] < total + 1.0
    start = 0.0  # from the top of the track
    pick = {"archivo": t["archivo"], "mood": t["mood"], "titulo": t["titulo"], "artista": t["artista"],
            "inicio": round(start, 2), "loop": loop, "fuente": t["fuente"], "licencia": t["licencia"]}
    out.write_text(json.dumps(pick, ensure_ascii=False, indent=1), encoding="utf-8")
    history.append({"fecha": dt.date.today().isoformat(), "reel": reel.name, "archivo": t["archivo"]})
    HISTORY.write_text(json.dumps(history[-200:], ensure_ascii=False, indent=1), encoding="utf-8")
    return pick


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("reel", type=Path)
    ap.add_argument("--total", type=float, required=True, help="reel length in seconds")
    ap.add_argument("--mood")
    ap.add_argument("--nueva", action="store_true", help="ignore the saved choice and pick again")
    a = ap.parse_args()
    p = choose(a.reel, a.total, a.mood, a.nueva)
    if p is None:
        print("[musica] catalogo vacio: sin musica")
        return 0
    print(f"[musica] {p['titulo']} ({p['artista']}, {p['mood']}) desde {p['inicio']}s{' en loop' if p['loop'] else ''}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
