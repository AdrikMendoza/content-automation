"""TTS: text file -> voz.wav (-14 LUFS) + tiempos.json, using your cloned voice.

Usage:
    python tts.py guion.txt reels/2026-11-18-tema/voz.wav [--ref voice/mi_voz.wav]

Model: ResembleAI/Chatterbox-Multilingual-es-mx-latam (MIT), loaded from .safetensors only.
Falls back to the multilingual base model (language "es") with --base.
"""
from __future__ import annotations

import os

# Must be set before torch is imported: every torch.load becomes weights_only (no pickle code exec).
os.environ.setdefault("TORCH_FORCE_WEIGHTS_ONLY_LOAD", "1")
os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")

import argparse
import json
import re
import shutil
import subprocess
import sys
import tempfile
import time
import warnings
from pathlib import Path

warnings.filterwarnings("ignore")

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "vendor"))

OUT_SR = 48000
# Pauses follow the meaning of the text, not one fixed gap (seconds, before --pause-scale):
#   clause    comma split of a very long sentence
#   sentence  next sentence of the same idea (same line)
#   question  after "?"
#   line      end of a line in the script = next idea
#   suspense  after "…" = comic beat before the punchline
#   paragraph blank line in the script = next block
PAUSES = {"clause": 0.08, "sentence": 0.20, "question": 0.30, "line": 0.35, "suspense": 0.50, "paragraph": 0.75}
PAUSE_RANK = ["clause", "sentence", "question", "line", "suspense", "paragraph"]
LEAD_IN = 0.10
TAIL = 0.35
MAX_CHUNK = 250         # model was trained on <=300 chars per call
CHARS_PER_SEC = 15.0    # rough Spanish speaking rate, for the sanity check


def log(msg: str) -> None:
    print(f"[tts] {msg}", flush=True)


def split_text(text: str) -> list[dict]:
    """Return [{'text', 'pause'}]: one chunk per sentence (long ones split at commas), each with the
    kind of pause that follows it (see PAUSES). Line breaks only change pauses, never the chunk count,
    so a voice script and its on-screen twin split the same way."""
    text = text.replace("—", ", ").replace("–", ", ").replace("\r\n", "\n")
    out: list[dict] = []
    paragraphs = [p for p in re.split(r"\n\s*\n", text) if p.strip()]
    for pi, para in enumerate(paragraphs):
        lines = [ln for ln in para.split("\n") if ln.strip()]
        for li, line in enumerate(lines):
            line = re.sub(r"\s+", " ", line).strip()
            # energy marker at the start of a line: "[+]" punchline (more energy), "[-]" calm explanation
            energy = "normal"
            m = re.match(r"^\[([+-])\]\s*", line)
            if m:
                energy = "alta" if m.group(1) == "+" else "baja"
                line = line[m.end():]
            sentences = [s.strip() for s in re.split(r"(?<=[.!?…])\s+", line) if s.strip()]
            for si, s in enumerate(sentences):
                if si < len(sentences) - 1:
                    kind = "sentence"
                elif li < len(lines) - 1:
                    kind = "line"
                else:
                    kind = "paragraph" if pi < len(paragraphs) - 1 else "line"
                punct = "suspense" if s.endswith("…") else "question" if s.endswith("?") else "sentence"
                kind = max(kind, punct, key=PAUSE_RANK.index)
                if len(s) <= MAX_CHUNK:
                    out.append({"text": s, "pause": kind, "energy": energy})
                    continue
                parts, cur = [], ""
                for piece in re.split(r"(?<=[,;:])\s+", s):
                    if cur and len(cur) + len(piece) + 1 > MAX_CHUNK:
                        parts.append(cur)
                        cur = piece
                    else:
                        cur = f"{cur} {piece}".strip()
                if cur:
                    parts.append(cur)
                for j, p in enumerate(parts):
                    out.append({"text": p, "pause": kind if j == len(parts) - 1 else "clause", "energy": energy})
    return out


def find_ffmpeg() -> str:
    exe = os.environ.get("FFMPEG") or shutil.which("ffmpeg")
    if not exe:
        raise SystemExit("ffmpeg not found (set FFMPEG or add it to PATH)")
    return exe


def _measure(ffmpeg: str, src: Path, target: float, tp: float) -> dict:
    p = subprocess.run([ffmpeg, "-hide_banner", "-nostats", "-i", str(src), "-af",
                        f"loudnorm=I={target}:TP={tp}:LRA=11:print_format=json", "-f", "null", "-"],
                       capture_output=True, text=True)
    m = re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", p.stderr)
    if not m:
        raise RuntimeError("loudnorm measurement failed:\n" + p.stderr[-2000:])
    return json.loads(m.group(0))


def _ff(ffmpeg: str, args: list[str], what: str) -> None:
    p = subprocess.run([ffmpeg, "-y", "-hide_banner", "-v", "error", *args], capture_output=True, text=True)
    if p.returncode:
        raise RuntimeError(f"{what} failed:\n" + p.stderr[-2000:])


def loudnorm(ffmpeg: str, src: Path, dst: Path, target: float, tp: float = -1.0, channels: int = 1) -> dict:
    """EBU R128 to `target` LUFS with true peak <= `tp` dBTP. Timing untouched.

    1. measure; 2. gain to target + true-peak limiter (4x oversampled) so peaks can't block the gain;
    3. two-pass loudnorm in linear mode (pure gain) for the last fraction of a dB.
    Returns the first measurement plus the final {'output_i', 'output_tp'}.
    """
    first = _measure(ffmpeg, src, target, tp)
    gain = target - float(first["input_i"])
    mid = dst.with_suffix(".lim.wav")
    _ff(ffmpeg, ["-i", str(src), "-af",
                 f"aresample=192000,volume={gain:.2f}dB,"
                 f"alimiter=limit={10 ** ((tp - 0.6) / 20):.4f}:attack=2:release=60:level=disabled,"
                 f"aresample={OUT_SR}", "-c:a", "pcm_f32le", str(mid)], "limiter")
    m = _measure(ffmpeg, mid, target, tp)
    flt = (f"loudnorm=I={target}:TP={tp}:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}"
           f":measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
    _ff(ffmpeg, ["-i", str(mid), "-af", flt, "-ar", str(OUT_SR), "-ac", str(channels), "-c:a", "pcm_s16le", str(dst)], "loudnorm")
    mid.unlink(missing_ok=True)
    final = _measure(ffmpeg, dst, target, tp)
    first["output_i"], first["output_tp"] = final["input_i"], final["input_tp"]
    return first


VOICE_DIR = ROOT / "voice"
VOICE_CFG = VOICE_DIR / "voice.json"
CACHE_DIR = VOICE_DIR / ".cache"


def active_reference() -> Path:
    """voice/voice.json -> {"active": "mi_voz.wav"}; only plain file names inside voice/."""
    if not VOICE_CFG.exists():
        raise SystemExit(f"missing {VOICE_CFG} (expected {{\"active\": \"mi_voz.wav\"}})")
    name = json.loads(VOICE_CFG.read_text(encoding="utf-8-sig")).get("active", "")
    if not name or Path(name).name != name:
        raise SystemExit(f"voice.json: 'active' must be a file name inside voice/, got {name!r}")
    return VOICE_DIR / name


def conds_cache_path(ref: Path, model_tag: str) -> Path:
    """Cache name carries the sample's name + mtime + size, so a new/edited sample regenerates it."""
    st = ref.stat()
    stamp = time.strftime("%Y%m%dT%H%M%S", time.localtime(st.st_mtime))
    return CACHE_DIR / f"{ref.stem}__{stamp}__{st.st_size}__{model_tag}.safetensors"


def load_or_build_conds(model, ctts, ref: Path, exaggeration: float, model_tag: str) -> str:
    """Speaker conditionals (voice fingerprint), cached as safetensors (no pickle)."""
    import torch
    from safetensors.torch import save_file, safe_open
    path = conds_cache_path(ref, model_tag)
    if path.exists():
        t3, gen = {}, {}
        with safe_open(str(path), framework="pt", device="cpu") as f:
            meta = f.metadata() or {}
            for k in f.keys():
                grp, name = k.split(".", 1)
                (t3 if grp == "t3" else gen)[name] = f.get_tensor(k)
        for name in json.loads(meta.get("gen_none", "[]")):
            gen[name] = None
        model.conds = ctts.Conditionals(ctts.T3Cond(**t3), gen).to(model.device)
        return f"cache {path.name}"
    model.prepare_conditionals(str(ref), exaggeration=exaggeration)
    c = model.conds
    tensors, gen_none = {}, []
    for name, v in vars(c.t3).items():
        if isinstance(v, torch.Tensor):
            tensors[f"t3.{name}"] = v.detach().cpu().contiguous()
    for name, v in c.gen.items():
        if isinstance(v, torch.Tensor):
            tensors[f"gen.{name}"] = v.detach().cpu().contiguous()
        elif v is None:
            gen_none.append(name)
    CACHE_DIR.mkdir(exist_ok=True)
    for old in CACHE_DIR.glob(f"{ref.stem}__*__{model_tag}.safetensors"):
        old.unlink()  # stale fingerprints of an older version of this same file
    save_file(tensors, str(path), metadata={"ref": ref.name, "gen_none": json.dumps(gen_none)})
    return f"built + cached {path.name}"


def word_times(text: str, start: float, end: float) -> list[dict]:
    """Estimate per-word timing inside a phrase, weighted by letters (+1 for the gap)."""
    words = text.split()
    weights = [len(re.sub(r"[^\w]", "", w)) + 1 for w in words]
    total = sum(weights) or 1
    t, out = start, []
    for w, k in zip(words, weights):
        d = (end - start) * k / total
        out.append({"w": w, "inicio": round(t, 3), "fin": round(t + d, 3)})
        t += d
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("texto", type=Path, help="UTF-8 text file (guion.txt)")
    ap.add_argument("salida", type=Path, help="output wav path (voz.wav)")
    ap.add_argument("--tiempos", type=Path, help="timing json (default: tiempos.json next to salida)")
    ap.add_argument("--ref", type=Path, help="override the voice sample (default: 'active' in voice/voice.json)")
    ap.add_argument("--no-cache", action="store_true", help="always recompute the voice fingerprint")
    ap.add_argument("--exaggeration", type=float, default=1.1)
    ap.add_argument("--exag-hi", type=float, default=1.25, help='exaggeration for lines starting with "[+]" (punchlines)')
    ap.add_argument("--exag-lo", type=float, default=1.0, help='exaggeration for lines starting with "[-]" (calm)')
    ap.add_argument("--locutor-nivel", type=float, default=0.5, help="presenter colour amount, 0-1 (0.5 = half)")
    ap.add_argument("--no-locutor", dest="locutor", action="store_false",
                    help="skip the presenter colour (warmth, tighter compression, tiny room); on by default since 2026-11-19")
    ap.add_argument("--cfg-weight", type=float, default=0.5)
    ap.add_argument("--temperature", type=float, default=0.85)
    ap.add_argument("--seed", type=int, default=1234)
    ap.add_argument("--lufs", type=float, default=-14.0)
    ap.add_argument("--speed", type=float, default=1.2, help="tempo multiplier, pitch preserved")
    ap.add_argument("--stretch", choices=["atempo", "rubberband"], default="atempo",
                    help="time-stretch method for --speed (atempo sounded less robotic in tests)")
    ap.add_argument("--pitch", type=float, default=0.0, help="pitch shift in semitones, duration unchanged")
    ap.add_argument("--pitch-method", choices=["timbre", "brillo"], default="timbre",
                    help="timbre: rubberband, formants preserved; brillo: asetrate (formants move too)")
    ap.add_argument("--pause-scale", type=float, default=0.55,
                    help="multiply every meaning-based pause (PAUSES); <1 = tighter, >1 = more air")
    ap.add_argument("--no-studio", dest="studio", action="store_false",
                    help="skip the studio chain (EQ, de-esser, compression, light denoise)")
    ap.add_argument("--retries", type=int, default=2, help="regenerations when a phrase length looks wrong")
    ap.add_argument("--base", action="store_true", help="use multilingual base model instead of the LATAM finetune")
    ap.add_argument("--device", default="cuda")
    ap.add_argument("--pantalla", type=Path,
                    help="on-screen text (same sentences/punctuation as the voice text, but e.g. '5' instead of "
                         "'cinco'); adds texto_pantalla + palabras_pantalla to tiempos.json for captions")
    args = ap.parse_args()

    t_all = time.perf_counter()
    args.ref = args.ref or active_reference()
    if not args.ref.exists():
        log(f"ERROR: missing voice sample {args.ref}. See README.md -> 'Grabar la muestra de voz' "
            f"or point voice/voice.json back to a sample that exists.")
        return 3
    log(f"voice sample: {args.ref.name}")
    text = args.texto.read_text(encoding="utf-8").strip()
    if not text:
        log("ERROR: empty text file")
        return 2
    chunks = split_text(text)
    screen_chunks = None
    if args.pantalla:
        screen_chunks = split_text(args.pantalla.read_text(encoding="utf-8").strip())
        if len(screen_chunks) != len(chunks):
            log(f"ERROR: --pantalla has {len(screen_chunks)} phrases but the voice text has {len(chunks)}; "
                f"keep the same sentence punctuation in both files")
            return 2
    for c in chunks:
        c["pause_after"] = PAUSES[c["pause"]] * args.pause_scale
    log(f"{len(chunks)} phrases, {len(text)} chars")

    import numpy as np
    import soundfile as sf
    import torch
    import librosa

    if args.device == "cuda" and not torch.cuda.is_available():
        log("ERROR: CUDA not available. Check the NVIDIA driver (nvidia-smi) or run with --device cpu (slow).")
        return 4

    import chatterbox.tts as ctts
    if args.base:
        ctts.REPO_ID = ctts.BASE_REPO_ID
        ctts.T3_FILENAME = "t3_mtl23ls_v3.safetensors"
        log("using multilingual base model")

    t0 = time.perf_counter()
    model = ctts.ChatterboxTTS.from_pretrained(args.device)
    model_tag = Path(ctts.T3_FILENAME).stem
    if args.no_cache:
        model.prepare_conditionals(str(args.ref), exaggeration=args.exaggeration)
        how = "no cache"
    else:
        how = load_or_build_conds(model, ctts, args.ref, args.exaggeration, model_tag)
    t_load = time.perf_counter() - t0
    log(f"model + voice ready in {t_load:.1f}s ({how})")

    sr = model.sr
    t0 = time.perf_counter()
    pieces: list[tuple[np.ndarray, float]] = []
    for i, c in enumerate(chunks):
        expected = max(0.6, len(c["text"]) / CHARS_PER_SEC)
        best = None
        for attempt in range(args.retries + 1):
            torch.manual_seed(args.seed + i * 101 + attempt * 7919)
            ex = {"alta": args.exag_hi, "baja": args.exag_lo}.get(c.get("energy"), args.exaggeration)
            wav = model.generate(c["text"], language_id="es", exaggeration=ex,
                                 cfg_weight=args.cfg_weight, temperature=args.temperature)
            wav = wav.squeeze(0).cpu().numpy().astype(np.float32)
            wav, _ = librosa.effects.trim(wav, top_db=40, frame_length=1024, hop_length=256)
            dur = len(wav) / sr
            ratio = dur / expected
            ok = 0.45 <= ratio <= 2.0
            if best is None or abs(np.log(ratio)) < abs(np.log(best[1])):
                best = (wav, ratio)
            if ok:
                break
            log(f"  phrase {i + 1}: {dur:.2f}s vs ~{expected:.2f}s expected, regenerating")
        wav, ratio = best
        # 8 ms fades so trimmed edges never click
        f = min(len(wav) // 2, int(0.008 * sr))
        if f:
            wav[:f] *= np.linspace(0, 1, f)
            wav[-f:] *= np.linspace(1, 0, f)
        pieces.append((wav, c["pause_after"]))
        log(f"  {i + 1}/{len(chunks)} {len(wav) / sr:5.2f}s  {c['text'][:60]}")
    t_gen = time.perf_counter() - t0

    # assemble + timings
    frases, buf, t = [], [np.zeros(int(LEAD_IN * sr), np.float32)], LEAD_IN
    for i, ((wav, pause), c) in enumerate(zip(pieces, chunks)):
        start, end = t, t + len(wav) / sr
        frases.append({"i": i, "texto": c["text"], "inicio": round(start, 3), "fin": round(end, 3),
                       "palabras": word_times(c["text"], start, end)})
        buf.append(wav)
        is_last = i == len(pieces) - 1
        # the tempo change below shortens silence too: pre-stretch gaps so they land at their real length
        gap = (TAIL if is_last else pause) * args.speed
        buf.append(np.zeros(int(gap * sr), np.float32))
        t = end + gap
    audio = np.concatenate(buf)

    args.salida.parent.mkdir(parents=True, exist_ok=True)
    ffmpeg = find_ffmpeg()
    with tempfile.TemporaryDirectory() as td:
        raw = Path(td) / "raw.wav"
        sf.write(raw, audio, sr, subtype="FLOAT")
        if abs(args.speed - 1.0) > 1e-3:
            fast = Path(td) / "fast.wav"
            flt = (f"atempo={args.speed}" if args.stretch == "atempo" else
                   f"rubberband=tempo={args.speed}:pitchq=quality:transients=smooth:formant=preserved")
            subprocess.run([ffmpeg, "-y", "-v", "error", "-i", str(raw), "-af", flt,
                            "-c:a", "pcm_f32le", str(fast)], check=True, capture_output=True)
            raw = fast
            k = 1.0 / args.speed
            for f in frases:
                f["inicio"], f["fin"] = round(f["inicio"] * k, 3), round(f["fin"] * k, 3)
                for w in f["palabras"]:
                    w["inicio"], w["fin"] = round(w["inicio"] * k, 3), round(w["fin"] * k, 3)
        if abs(args.pitch) > 1e-3:
            r = 2 ** (args.pitch / 12)
            flt = (f"rubberband=pitch={r:.5f}:formant=preserved:pitchq=quality" if args.pitch_method == "timbre" else
                   f"asetrate={sr * r:.1f},aresample={sr},atempo={1 / r:.5f}")
            shifted = Path(td) / "pitch.wav"
            subprocess.run([ffmpeg, "-y", "-v", "error", "-i", str(raw), "-af", flt,
                            "-c:a", "pcm_f32le", str(shifted)], check=True, capture_output=True)
            raw = shifted
        if args.studio:
            # "studio" voice: 48 kHz, rumble out, light denoise of model hiss, less boxiness (250 Hz),
            # presence (3.2 kHz) and air, de-essing, gentle 3:1 compression so every word reads.
            chain = ("aresample=48000:resampler=soxr,highpass=f=75,afftdn=nr=6:nf=-42,"
                     "equalizer=f=250:t=q:w=1.0:g=-3,equalizer=f=3200:t=q:w=1.0:g=3,highshelf=f=8000:g=2.5,"
                     "deesser=i=0.4,acompressor=threshold=-22dB:ratio=3:attack=5:release=90:makeup=2")
            n = args.locutor_nivel if args.locutor else 0.0
            if n > 0:
                # presenter colour scaled by --locutor-nivel (1 = full): chest warmth (160 Hz),
                # firmer compression (up to 4:1), very short small-room echo
                chain += (f",equalizer=f=160:t=q:w=1.2:g={2 * n:.2f},"
                          f"acompressor=threshold=-24dB:ratio={1 + 3 * n:.2f}:attack=3:release=60:makeup={1 + 0.5 * n:.2f},"
                          f"aecho=1.0:0.95:11|23:{0.10 * n:.3f}|{0.06 * n:.3f}")
            studio = Path(td) / "studio.wav"
            subprocess.run([ffmpeg, "-y", "-v", "error", "-i", str(raw), "-af", chain,
                            "-c:a", "pcm_f32le", str(studio)], check=True, capture_output=True)
            raw = studio
        tmp_out = args.salida.with_suffix(".tmp.wav")
        meas = loudnorm(ffmpeg, raw, tmp_out, args.lufs)
        os.replace(tmp_out, args.salida)

    duracion = round(sf.info(str(args.salida)).duration, 3)
    words = sum(len(f["palabras"]) for f in frases)
    log(f"pace: {words / duracion * 60:.0f} words/min (speed x{args.speed}, pauses x{args.pause_scale}, "
        f"studio {'on' if args.studio else 'off'})")
    if screen_chunks:
        # captions show the on-screen spelling, timed by the (final, speed-scaled) voice phrase
        for f, sc in zip(frases, screen_chunks):
            f["texto_pantalla"] = sc["text"]
            f["palabras_pantalla"] = word_times(sc["text"], f["inicio"], f["fin"])

    tiempos = {
        "audio": args.salida.name,
        "duracion": duracion,
        "lufs_objetivo": args.lufs,
        "lufs_medido": float(meas["output_i"]),
        "true_peak_dbtp": float(meas["output_tp"]),
        "muestra_voz": args.ref.name,
        "exaggeration": args.exaggeration,
        "cfg_weight": args.cfg_weight,
        "speed": args.speed,
        "pause_scale": args.pause_scale,
        "exag_hi": args.exag_hi,
        "exag_lo": args.exag_lo,
        "locutor": args.locutor,
        "locutor_nivel": args.locutor_nivel if args.locutor else 0.0,
        "studio": args.studio,
        "stretch": args.stretch,
        "pitch_semitonos": args.pitch,
        "pitch_metodo": args.pitch_method,
        "palabras_por_minuto": round(words / duracion * 60),
        "modelo": ctts.REPO_ID + "/" + ctts.T3_FILENAME,
        "frases": frases,
    }
    tpath = args.tiempos or args.salida.with_name("tiempos.json")
    tpath.write_text(json.dumps(tiempos, ensure_ascii=False, indent=2), encoding="utf-8")

    total = time.perf_counter() - t_all
    rtf = t_gen / duracion if duracion else 0
    log(f"audio {duracion:.2f}s | load {t_load:.1f}s | generate {t_gen:.1f}s (x{rtf:.2f} realtime) | "
        f"total {total:.1f}s | {meas['input_i']} LUFS -> {meas['output_i']} LUFS, true peak {meas['output_tp']} dBTP")
    log(f"wrote {args.salida} and {tpath}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
