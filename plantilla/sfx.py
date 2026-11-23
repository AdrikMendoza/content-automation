"""Synthesised sound design (numpy, no samples, no licences) for this reel.

Reads sfx_cues.json (written by compose.mjs, same seconds as the timeline) and writes:
  assets/sfx.wav   effects only (whoosh, pop, click, keys, buzz, ding, impacts)
  assets/beat.wav  120 bpm bed (kick + hats + sub pulse), mixed later at -22 LUFS with ducking
Usage: python sfx.py
Sound recipes CC0 library in sfx/.
"""
import json
import sys
import wave
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
SR = 48000
cues = json.loads((HERE / "sfx_cues.json").read_text(encoding="utf-8"))
DUR = float(cues["total"])
rng = np.random.default_rng(7)


def env(n, a=0.005, d=0.2):
    t = np.arange(n) / SR
    return np.minimum(t / a, 1.0) * np.exp(-t / d)


def lowpass(x, k):
    return np.convolve(x, np.ones(k) / k, mode="same")


def whoosh(dur=0.35):
    n = int(SR * dur)
    x = rng.standard_normal(n)
    t = np.arange(n) / n
    y = lowpass(x, 40) * (1 - t) + lowpass(x, 8) * np.sin(np.pi * t)
    return y * np.sin(np.pi * t) ** 1.5 * 0.9


def click():
    n = int(SR * 0.03)
    return rng.standard_normal(n) * env(n, 0.0005, 0.004) * 0.8


def pop(f=900):
    n = int(SR * 0.09)
    t = np.arange(n) / SR
    fr = f * (1 + 1.5 * np.exp(-t / 0.01))
    return np.sin(2 * np.pi * np.cumsum(fr) / SR) * env(n, 0.001, 0.03) * 0.6


def impact():
    n = int(SR * 0.9)
    t = np.arange(n) / SR
    fr = 45 + 110 * np.exp(-t / 0.05)
    body = np.sin(2 * np.pi * np.cumsum(fr) / SR) * env(n, 0.002, 0.35)
    crack = lowpass(rng.standard_normal(n), 3) * env(n, 0.001, 0.03) * 0.5
    return (body + crack) * 0.95


def buzz():
    n = int(SR * 0.22)
    t = np.arange(n) / SR
    sq = np.sign(np.sin(2 * np.pi * 110 * t)) * 0.25 + np.sign(np.sin(2 * np.pi * 116 * t)) * 0.25
    return lowpass(sq, 6) * env(n, 0.002, 0.12)


def ding():
    n = int(SR * 0.7)
    t = np.arange(n) / SR
    s = np.sin(2 * np.pi * 1318 * t) + 0.5 * np.sin(2 * np.pi * 1976 * t)
    return s * env(n, 0.002, 0.25) * 0.35


def key():
    n = int(SR * 0.025)
    return lowpass(rng.standard_normal(n), 2) * env(n, 0.0005, 0.006) * 0.35


def add(buf, sig, t, gain=1.0):
    i = int(round(t * SR))
    if i < 0 or i >= len(buf):
        return
    n = min(len(sig), len(buf) - i)
    buf[i:i + n] += sig[:n] * gain


def write(path, x, peak=0.85):
    x = x / max(1e-9, np.abs(x).max()) * peak
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((x * 32767).astype(np.int16).tobytes())


SFX_DIR = HERE.parents[1] / "sfx"  # CC0 library, see sfx/LICENCIAS.md


def sample(name, max_s=None, fade_s=0.15):
    """Load sfx/<name>.wav (48 kHz mono 16-bit), peak-normalised, optionally cut with a fade."""
    with wave.open(str(SFX_DIR / f"{name}.wav")) as w:
        assert w.getframerate() == SR and w.getnchannels() == 1, name
        x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64) / 32768
    if max_s and len(x) > int(max_s * SR):
        x = x[: int(max_s * SR)].copy()
        f = int(fade_s * SR)
        x[-f:] *= np.linspace(1, 0, f)
    return x / max(1e-9, np.abs(x).max())


USE_SAMPLES = (SFX_DIR / "whoosh.wav").exists()
if USE_SAMPLES:
    S = {
        "whoosh": sample("whoosh"), "swoosh": sample("swoosh"), "pop": sample("pop"), "pop2": sample("pop2"),
        "click": sample("click"), "hit": sample("hit"), "boom": sample("boom", 1.6, 0.6),
        "ding": sample("ding"), "glitch": sample("glitch", 0.45, 0.12), "typing": sample("typing"), "tick": sample("tick"),
    }
    # one keystroke = a 70 ms grain of the real typing recording, picked deterministically
    grains = [S["typing"][int(s * SR): int(s * SR) + int(0.07 * SR)] * np.linspace(1, 0, int(0.07 * SR)) for s in np.arange(0.1, 3.6, 0.23)]
    k_i = [0]

    def key_sample():
        k_i[0] += 1
        return grains[(k_i[0] * 7) % len(grains)]

    MAKE = {
        "whoosh": lambda p: S["swoosh"] if (p or 0.35) < 0.25 else S["whoosh"],
        "click": lambda p: S["click"],
        "pop": lambda p: S["pop2"] if (p or 900) >= 1200 else S["pop"],
        "impact": lambda p: S["boom"],
        "buzz": lambda p: S["glitch"],
        "ding": lambda p: S["ding"],
        "key": lambda p: key_sample(),
        "tick": lambda p: S["tick"],
    }
else:  # fallback: synthesised recipes from the template
    MAKE = {
        "whoosh": lambda p: whoosh(p or 0.35), "click": lambda p: click(), "pop": lambda p: pop(p or 900),
        "impact": lambda p: impact(), "buzz": lambda p: buzz(), "ding": lambda p: ding(), "key": lambda p: key(),
        "tick": lambda p: click(),
    }

fx = np.zeros(int(SR * DUR))
for t, kind, gain, p in cues["cues"]:
    sig = MAKE[kind](p)
    if USE_SAMPLES and kind == "impact" and gain < 0.9:
        sig = S["hit"]  # soft slams get the short hit, punch-ins keep the big boom
    add(fx, sig, t, gain * (0.7 if USE_SAMPLES else 1.0))

beat = np.zeros(int(SR * DUR))
b = 0.5  # 120 bpm
for i in range(int(DUR / b)):
    tb = i * b
    n = int(SR * 0.35)
    t = np.arange(n) / SR
    add(beat, np.sin(2 * np.pi * np.cumsum(50 + 120 * np.exp(-t / 0.03)) / SR) * env(n, 0.001, 0.12), tb, 0.30)
    hn = int(SR * 0.04)
    hat = (rng.standard_normal(hn) - lowpass(rng.standard_normal(hn), 4)) * env(hn, 0.0005, 0.01)
    add(beat, hat, tb + b / 2, 0.10)
    if i % 2 == 1:
        add(beat, hat, tb + b * 0.75, 0.05)
    if i % 4 == 0:  # sub pulse every bar
        sn = int(SR * 0.45)
        st = np.arange(sn) / SR
        add(beat, np.sin(2 * np.pi * 55 * st) * env(sn, 0.01, 0.25), tb, 0.12)
# fade the bed out over the last 1.5 s
fo = int(SR * 1.5)
beat[-fo:] *= np.linspace(1, 0, fo)

(HERE / "assets").mkdir(exist_ok=True)
write(HERE / "assets" / "sfx.wav", fx)
write(HERE / "assets" / "beat.wav", beat)
print(f"ok: {len(cues['cues'])} efectos, {DUR:.2f} s")
