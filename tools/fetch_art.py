import json
import subprocess
import sys
import urllib.request
from pathlib import Path
from statistics import median
from PIL import Image

# 96px with each sprite keeping its own colors. The original 44px shared-palette pass turned violet
# hoodies grey and yellow shirts into skin. Scene scales in "vault/Arena Art.md" were written for 44px;
# multiply them by 44/96 for these sprites.
H = 96
root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(".")
here = Path(__file__).parent
src = json.loads((here / "art-sources.json").read_text())

raw = root / "assets" / "raw"
sprites = root / "web" / "public" / "art" / "sprites"
desks = root / "web" / "public" / "art" / "desks"
scenes = root / "web" / "public" / "art" / "scenes"
for d in (raw, sprites, desks, scenes):
    d.mkdir(parents=True, exist_ok=True)

def get(url, path):
    if not path.exists():
        urllib.request.urlretrieve(url, path)
        print("downloaded", path.name)

for name, url in src["scenes"].items():
    get(url, scenes / f"{name}.png")
for name, url in src["sprites"].items():
    get(url, raw / f"{name}.png")
for look, urls in src["seated"].items():
    for i, url in enumerate(urls):
        get(url, raw / f"{look}-sit{i + 1}.png")
for name, url in src["desks"].items():
    get(url, raw / f"desk-{name}.png")

def box(path):
    im = Image.open(path).convert("RGBA")
    return im.getchannel("A").point(lambda v: 255 if v > 128 else 0).getbbox()

def clean(src_path, out_path, *opts):
    subprocess.run([sys.executable, str(here / "cleanup.py"), str(src_path), str(out_path),
                    "--preview", "0", "--colors", "48", *opts], check=True)

for name in src["sprites"]:
    clean(raw / f"{name}.png", sprites / f"{name}.png", "--height", str(H))

# Seated frames use the same scale as the look's standing front view, so heads match.
seat_widths = []
for look, urls in src["seated"].items():
    b = box(raw / f"{look}-front.png")
    scale = H / (b[3] - b[1])
    boxes = [box(raw / f"{look}-sit{i + 1}.png") for i in range(len(urls))]
    u = (min(x[0] for x in boxes), min(x[1] for x in boxes), max(x[2] for x in boxes), max(x[3] for x in boxes))
    for i in range(len(urls)):
        clean(raw / f"{look}-sit{i + 1}.png", sprites / f"{look}-sit{i + 1}.png", "--scale", f"{scale:.5f}", "--box", ",".join(map(str, u)))
    seat_widths.append(Image.open(sprites / f"{look}-sit1.png").width)

desk_w = round(median(seat_widths) * 1.6)
for name in src["desks"]:
    clean(raw / f"desk-{name}.png", desks / f"{name}.png", "--width", str(desk_w))

looks = {}
for name in src["sprites"]:
    look, view = name.rsplit("-", 1)
    looks.setdefault(look, {})[view] = f"/art/sprites/{name}.png"
for look, urls in src["seated"].items():
    looks[look]["sit"] = [f"/art/sprites/{look}-sit{i + 1}.png" for i in range(len(urls))]

out = {
    "height": H,
    "lead": {
        "bodies": ["a", "b"],
        "outfits": ["blazer", "hoodie", "flannel", "track"],
        "looks": {k: v for k, v in looks.items() if k.startswith("lead-")},
    },
    "team": {k: v for k, v in looks.items() if not k.startswith("lead-")},
    "desks": {name: f"/art/desks/{name}.png" for name in src["desks"]},
    "scenes": {name: f"/art/scenes/{name}.png" for name in src["scenes"] if name != "welcome-bg"} | {"club": "/art/scenes/club.png"},
}
(root / "web" / "public" / "art" / "sprites.json").write_text(json.dumps(out, indent=2))
print("wrote sprites.json, desk width", desk_w)
