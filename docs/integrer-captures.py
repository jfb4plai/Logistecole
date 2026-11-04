"""Intègre les captures de docs/captures/capture_00N.png dans docs/guide-logistecole.html.

Le guide reste un seul fichier autonome : chaque <img data-capture="N"> reçoit l'image en JPEG réduit (base64).
À relancer après avoir remplacé une capture : python docs/integrer-captures.py
"""
import base64
import io
import re
import sys
from pathlib import Path

from PIL import Image

DOCS = Path(__file__).resolve().parent
GUIDE = DOCS / "guide-logistecole.html"
LARGEUR_MAX = 1000
QUALITE = 85


def jpeg_base64(chemin: Path) -> str:
    image = Image.open(chemin).convert("RGB")
    if image.width > LARGEUR_MAX:
        image = image.resize((LARGEUR_MAX, round(image.height * LARGEUR_MAX / image.width)), Image.LANCZOS)
    tampon = io.BytesIO()
    image.save(tampon, "JPEG", quality=QUALITE, optimize=True)
    return base64.b64encode(tampon.getvalue()).decode("ascii")


def main() -> int:
    html = GUIDE.read_text(encoding="utf-8")
    manquantes = []

    def remplacer(m: re.Match) -> str:
        numero = m.group(2)
        source = DOCS / "captures" / f"capture_{int(numero):03d}.png"
        if not source.exists():
            manquantes.append(source.name)
            return m.group(0)
        return f'{m.group(1)}data-capture="{numero}" src="data:image/jpeg;base64,{jpeg_base64(source)}"'

    html = re.sub(r'(<img class="capture-img" )data-capture="(\d+)" src="[^"]*"', remplacer, html)
    GUIDE.write_text(html, encoding="utf-8")
    if manquantes:
        print("Captures introuvables :", ", ".join(manquantes))
        return 1
    print(f"Guide mis à jour : {GUIDE.stat().st_size // 1024} Ko")
    return 0


if __name__ == "__main__":
    sys.exit(main())
