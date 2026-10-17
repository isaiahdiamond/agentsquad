import json
import subprocess
import sys
import urllib.request
from pathlib import Path

root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(".")
here = Path(__file__).parent
src = json.loads((here / "art-sources.json").read_text())

raw = root / "assets" / "raw"
sprites = root / "web" / "public" / "art" / "sprites"
scenes = root / "web" / "public" / "art" / "scenes"
for d in (raw, sprites, scenes):
    d.mkdir(parents=True, exist_ok=True)

def get(url, path):
    if not path.exists():
        urllib.request.urlretrieve(url, path)
        print("downloaded", path.name)

for name, url in src["scenes"].items():
    get(url, scenes / f"{name}.png")

for name, url in src["sprites"].items():
    get(url, raw / f"{name}.png")

from PIL import Image

px = bytearray()
for name in src["sprites"]:
    im = Image.open(raw / f"{name}.png").convert("RGBA")
    im = im.crop(im.getchannel("A").point(lambda v: 255 if v > 128 else 0).getbbox())
    b = im.resize((max(1, round(im.width * 44 / im.height)), 44), Image.BOX).tobytes()
    for i in range(0, len(b), 4):
        if b[i + 3] > 128:
            px += b[i:i + 3]

sheet = Image.frombytes("RGB", (len(px) // 3, 1), bytes(px))
palette = root / "assets" / "palette.png"
sheet.quantize(colors=64, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB").save(palette)

for name in src["sprites"]:
    subprocess.run([sys.executable, str(here / "cleanup.py"), str(raw / f"{name}.png"), str(sprites / f"{name}.png"),
                    "--height", "44", "--preview", "0", "--palette", str(palette)], check=True)

looks = {}
for name in src["sprites"]:
    look, view = name.rsplit("-", 1)
    looks.setdefault(look, {})[view] = f"/art/sprites/{name}.png"

out = {
    "height": 44,
    "lead": {
        "bodies": ["a", "b"],
        "outfits": ["blazer", "hoodie", "flannel", "track"],
        "looks": {k: v for k, v in looks.items() if k.startswith("lead-")},
    },
    "team": {k: v for k, v in looks.items() if not k.startswith("lead-")},
    "scenes": {name: f"/art/scenes/{name}.png" for name in src["scenes"]},
}
(root / "web" / "public" / "art" / "sprites.json").write_text(json.dumps(out, indent=2))
print("wrote sprites.json")
