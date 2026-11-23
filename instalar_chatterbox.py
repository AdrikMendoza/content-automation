"""Download Chatterbox (Resemble AI, MIT) from its official Hugging Face Space and apply the safety patch.

The model code is not copied into this repo: it is fetched from the source, pinned to a fixed revision, into
vendor/chatterbox/. Patch (parches/chatterbox_cargadores.py.txt): weights are loaded ONLY from .safetensors files and
ONLY from the ResembleAI organization (no pickle, no .pt).

    python instalar_chatterbox.py
"""
from pathlib import Path

from huggingface_hub import HfApi, hf_hub_download

# https://huggingface.co/spaces/ResembleAI/Chatterbox-Multilingual-TTS-es-mx-latam
SPACE = "ResembleAI/Chatterbox-Multilingual-TTS-es-mx-latam"
REVISION = "0d2648c4c1637eccfa8d45c7e192a0ad8d5b1fca"  # pinned: the version this template was tested with
PREFIX = "chatterbox/src/chatterbox/"
ROOT = Path(__file__).resolve().parent
DEST = ROOT / "vendor" / "chatterbox"
LOADERS = ROOT / "parches" / "chatterbox_cargadores.py.txt"


def replace_once(s: str, a: str, b: str) -> str:
    if s.count(a) != 1:
        raise SystemExit(f"parche: no encontre {a!r} (cambio la version del Space?)")
    return s.replace(a, b)


def patch_tts(path: Path) -> None:
    s = path.read_text(encoding="utf-8").replace("\r\n", "\n")
    s = replace_once(s, "from huggingface_hub import snapshot_download, hf_hub_download", "from huggingface_hub import hf_hub_download")
    s = replace_once(s, 'S3GEN_FILENAME = "s3gen_v3.pt"', 'S3GEN_FILENAME = "s3gen_v3.safetensors"')
    i = s.index("TOKENIZER_FILENAME = ")
    j = s.index("\n", i) + 1
    s = s[:j] + 'VE_FILENAME = "ve.safetensors"\nTRUSTED_ORG = "ResembleAI"\n' + s[j:]
    a = s.index("    @classmethod\n    def from_local(")
    b = s.index("    def prepare_conditionals(")
    loaders = LOADERS.read_text(encoding="utf-8").replace("\r\n", "\n").rstrip("\n")
    s = (s[:a] + "    # --- patch: safetensors-only loading, ResembleAI-only sources ---\n" + loaders + "\n"
         + "    # --- end patch ---\n\n" + s[b:])
    path.write_text(s, encoding="utf-8")


def main() -> None:
    files = [f for f in HfApi().list_repo_files(SPACE, repo_type="space", revision=REVISION)
             if f.startswith(PREFIX) and f.endswith(".py")]
    if not files:
        raise SystemExit("no encontre el codigo en el Space")
    for f in files:
        local = Path(hf_hub_download(SPACE, f, repo_type="space", revision=REVISION))
        out = DEST / f[len(PREFIX):]
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_bytes(local.read_bytes())
    init = DEST / "__init__.py"
    keep = [l for l in init.read_text(encoding="utf-8").splitlines(True) if "from .vc import" not in l]
    init.write_text("".join(keep), encoding="utf-8")
    patch_tts(DEST / "tts.py")
    (DEST / "ORIGEN.txt").write_text(f"https://huggingface.co/spaces/{SPACE} @ {REVISION} (MIT, Resemble AI).\n"
                                     "Parcheado por instalar_chatterbox.py (solo .safetensors de ResembleAI).\n", encoding="utf-8")
    print(f"listo: {len(files)} archivos de {SPACE} en {DEST} (parche safetensors aplicado)")


if __name__ == "__main__":
    main()
