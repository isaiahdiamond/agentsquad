import json
import random
import sys
import urllib.request
from pathlib import Path
from PIL import Image

H = 44
U = "https://d8j0ntlcm91z4.cloudfront.net/user_3Hn0qEeIrzd8eKu5vKMg5oAY4ej/hf_20261017_"
here = Path(__file__).parent
src = json.loads((here / "lead-sources.json").read_text())
root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(".")
raw = root / "assets" / "raw" / "lead"
out = root / "web" / "public" / "art" / "lead"
raw.mkdir(parents=True, exist_ok=True)
out.mkdir(parents=True, exist_ok=True)

def rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))

def hexc(c):
    return "#%02X%02X%02X" % c[:3]

def lum(c):
    return 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]

def sat(c):
    return (max(c[:3]) - min(c[:3])) / 255

def load(name, key):
    p = raw / f"{name}.png"
    if not p.exists():
        urllib.request.urlretrieve(U + key + ".png", p)
        print("downloaded", p.name)
    return Image.open(p).convert("RGBA")

def box(im):
    return im.getchannel("A").point(lambda v: 255 if v > 128 else 0).getbbox()

def shrink(im, b, scale, pal):
    im = im.crop(b)
    im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.BOX)
    a = im.getchannel("A").point(lambda v: 255 if v > 128 else 0)
    q = im.convert("RGB").quantize(palette=pal, dither=Image.Dither.NONE).convert("RGBA")
    q.putalpha(a)
    return q

def opaque(im, x, y):
    return 0 <= x < im.width and 0 <= y < im.height and im.getpixel((x, y))[3]

def body_cx(im):
    h = im.height
    xs = [x for y in range(round(h * 0.6), h) for x in range(im.width) if opaque(im, x, y)]
    return sum(xs) / len(xs)

def head_top(im, cx):
    cols = [round(cx) + d for d in range(-2, 3)]
    return next(y for y in range(im.height) if any(opaque(im, x, y) for x in cols))

def head(im, dx):
    cx = body_cx(im) + dx
    return [round(cx), head_top(im, cx)]

def skin_set(base, hx, hy):
    count = {}
    h = base.height
    for y in range(hy + round(h * 0.08), hy + round(h * 0.22)):
        for x in range(hx - 6, hx + 7):
            if opaque(base, x, y):
                c = base.getpixel((x, y))
                if lum(c) > 60 and sat(c) > 0.12:
                    count[c[:3]] = count.get(c[:3], 0) + 1
    return sorted([c for c, n in count.items() if n >= 3], key=lum)

def hair_layer(base, hair):
    layer = Image.new("RGBA", hair.size)
    for y in range(round(hair.height * 0.6)):
        for x in range(hair.width):
            c = hair.getpixel((x, y))
            if not c[3]:
                continue
            b = base.getpixel((x, y)) if opaque(base, x, y) else None
            same = b is not None and sum(abs(b[i] - c[i]) for i in range(3)) < 24
            if not same and sat(c) < 0.18 and lum(c) > 40:
                layer.putpixel((x, y), c)
    return layer

images = {}
for body, b in src["bodies"].items():
    images[f"{body}-base"] = load(f"{body}-base", b["base"])
    for o, views in b["outfits"].items():
        for v, k in zip(("front", "hand", "sit"), views):
            images[f"{body}-{o}-{v}"] = load(f"{body}-{o}-{v}", k)
    for s, k in b["hair"].items():
        images[f"{body}-hair-{s}"] = load(f"{body}-hair-{s}", k)
for c, views in src["characters"].items():
    for v, k in zip(("front", "hand", "sit"), views):
        images[f"{c}-{v}"] = load(f"{c}-{v}", k)

px = bytearray()
for im in images.values():
    t = im.crop(box(im)).resize((40, 60), Image.BOX).tobytes()
    for i in range(0, len(t), 4):
        if t[i + 3] > 128:
            px += t[i:i + 3]
pal = Image.frombytes("RGB", (len(px) // 3, 1), bytes(px)).quantize(colors=96, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)

manifest = {"height": H, "skinTones": src["skinTones"], "hairColors": src["hairColors"], "bodies": {}, "characters": {}}
preview = []

for body, b in src["bodies"].items():
    base_raw = images[f"{body}-base"]
    bb = box(base_raw)
    scale = H / (bb[3] - bb[1])
    base = shrink(base_raw, bb, scale, pal)
    bx, by = head(base, 0)
    dx = bx - body_cx(base)
    skins = skin_set(base, bx, by)
    base.save(out / f"{body}-base.png")
    entry = {"skin": [hexc(c) for c in skins], "base": f"/art/lead/{body}-base.png", "outfits": {}, "hair": {"bald": None}}
    for o in b["outfits"]:
        entry["outfits"][o] = {}
        for v in ("front", "hand", "sit"):
            im = shrink(images[f"{body}-{o}-{v}"], box(images[f"{body}-{o}-{v}"]), scale, pal)
            name = f"{body}-{o}-{v}.png"
            im.save(out / name)
            entry["outfits"][o][v] = {"src": f"/art/lead/{name}", "head": head(im, dx)}
    for s in b["hair"]:
        hr = images[f"{body}-hair-{s}"]
        hb = box(hr)
        u = (min(bb[0], hb[0]), min(bb[1], hb[1]), max(bb[2], hb[2]), max(bb[3], hb[3]))
        base_u = shrink(base_raw, u, scale, pal)
        layer = hair_layer(base_u, shrink(hr, u, scale, pal))
        lb = layer.getbbox()
        if not lb:
            print("WARNING: empty hair layer", body, s)
            continue
        hx, hy = head(base_u, dx)
        layer.crop(lb).save(out / f"{body}-hair-{s}.png")
        entry["hair"][s] = {"src": f"/art/lead/{body}-hair-{s}.png", "offset": [lb[0] - hx, lb[1] - hy]}
    manifest["bodies"][body] = entry
    print(body, "skin colors:", len(skins), "hair styles:", len(entry["hair"]) - 1)

for c in src["characters"]:
    f = images[f"{c}-front"]
    fb = box(f)
    scale = H / (fb[3] - fb[1])
    manifest["characters"][c] = {}
    for v in ("front", "hand", "sit"):
        im = shrink(images[f"{c}-{v}"], box(images[f"{c}-{v}"]), scale, pal)
        im.save(out / f"{c}-{v}.png")
        manifest["characters"][c][v] = {"src": f"/art/lead/{c}-{v}.png"}

(out / "lead.json").write_text(json.dumps(manifest, indent=2))

def recolor_skin(im, skins, ramp):
    im = im.copy()
    ramp = [rgb(c) for c in reversed(ramp)]
    lookup = {rgb(c): ramp[min(len(ramp) - 1, i * len(ramp) // len(skins))] for i, c in enumerate(skins)}
    for y in range(im.height):
        for x in range(im.width):
            p = im.getpixel((x, y))
            if p[3] and p[:3] in lookup:
                im.putpixel((x, y), lookup[p[:3]] + (255,))
    return im

def tint(layer, color):
    t = rgb(color)
    im = layer.copy()
    for y in range(im.height):
        for x in range(im.width):
            p = im.getpixel((x, y))
            if p[3]:
                k = 0.45 + 0.75 * lum(p) / 255
                im.putpixel((x, y), tuple(min(255, round(v * k)) for v in t) + (255,))
    return im

def compose(body, outfit, view, hair, skin, hcolor):
    e = manifest["bodies"][body]
    o = e["outfits"][outfit][view]
    im = Image.open(out / Path(o["src"]).name).convert("RGBA")
    im = recolor_skin(im, e["skin"], src["skinTones"][skin])
    pad = 12
    canvas = Image.new("RGBA", (im.width + pad * 2, im.height + pad))
    canvas.alpha_composite(im, (pad, pad))
    h = e["hair"].get(hair)
    if h:
        layer = tint(Image.open(out / Path(h["src"]).name).convert("RGBA"), src["hairColors"][hcolor])
        canvas.alpha_composite(layer, (pad + o["head"][0] + h["offset"][0], pad + o["head"][1] + h["offset"][1]))
    return canvas.crop(canvas.getbbox())

random.seed(4)
for body, e in manifest["bodies"].items():
    row = []
    styles = [s for s in e["hair"] if s != "bald"]
    for i, o in enumerate(e["outfits"]):
        for v in ("front", "hand", "sit"):
            row.append(compose(body, o, v, styles[i % len(styles)], random.choice(list(src["skinTones"])), random.choice(list(src["hairColors"]))))
    preview.append(row)
row = []
for c in manifest["characters"]:
    for v in ("front", "hand", "sit"):
        row.append(Image.open(out / f"{c}-{v}.png").convert("RGBA"))
preview.append(row)

cw = max(c.width for r in preview for c in r) + 4
ch = max(c.height for r in preview for c in r) + 8
sheet = Image.new("RGBA", (cw * max(len(r) for r in preview), ch * len(preview)), (24, 26, 33, 255))
for j, r in enumerate(preview):
    for i, c in enumerate(r):
        sheet.alpha_composite(c, (i * cw + (cw - c.width) // 2, j * ch + ch - c.height - 3))
root_preview = root / "assets" / "lead-preview.png"
sheet.resize((sheet.width * 5, sheet.height * 5), Image.NEAREST).save(root_preview)
print("wrote", out / "lead.json", "and", root_preview)
