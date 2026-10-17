import colorsys
import json
import random
import sys
import urllib.request
from pathlib import Path
from PIL import Image, ImageChops, ImageFilter

H = 96
R = 2
RAMP = 6
U = "https://d8j0ntlcm91z4.cloudfront.net/user_3Hn0qEeIrzd8eKu5vKMg5oAY4ej/hf_20261017_"
VIEWS = ("front", "hand", "sit")
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


def hsv(c):
    return colorsys.rgb_to_hsv(c[0] / 255, c[1] / 255, c[2] / 255)


def load(name, key):
    p = raw / f"{name}.png"
    if not p.exists():
        urllib.request.urlretrieve(U + key + ".png", p)
        print("downloaded", p.name)
    return Image.open(p).convert("RGBA")


def box(im):
    return im.getchannel("A").point(lambda v: 255 if v > 128 else 0).getbbox()


def small(im):
    return im.reduce(R)


def skin_stats(base):
    pts = []
    for p in small(base).get_flattened_data():
        if p[3] > 200:
            h, s, v = hsv(p)
            if 0.02 < h < 0.12 and s > 0.3 and v > 0.45:
                pts.append((h, s, v, p[:3]))
    n = len(pts)
    mean = [sum(p[i] for p in pts) / n for i in range(3)]
    sd = [(sum((p[i] - mean[i]) ** 2 for p in pts) / n) ** 0.5 for i in range(3)]
    return mean, sd, [p[3] for p in pts]


def is_skin(p, st):
    if p[3] <= 128:
        return False
    c = hsv(p)
    if sum(((c[i] - st[0][i]) / st[1][i]) ** 2 for i in range(3)) < 6.25:
        return True
    if abs(c[0] - st[0][0]) > 3.5 * st[1][0]:
        return False
    shadow = abs(c[0] - st[0][0]) < 2.5 * st[1][0] and 0.45 < c[1] < 0.8 and 0.5 < c[2] <= st[0][2]
    return shadow or (0.2 < c[1] < 0.75 and c[2] > st[0][2])


def skin_mask(im, st):
    m = Image.new("L", im.size)
    m.putdata([255 if is_skin(p, st) else 0 for p in im.get_flattened_data()])
    return m


def components(mask):
    w, h = mask.size
    on = list(mask.get_flattened_data())
    seen = [False] * (w * h)
    comps = []
    for i in range(w * h):
        if on[i] and not seen[i]:
            seen[i] = True
            stack, comp = [i], []
            while stack:
                j = stack.pop()
                comp.append(j)
                x, y = j % w, j // w
                for k in (j - 1 if x else -1, j + 1 if x < w - 1 else -1, j - w, j + w):
                    if 0 <= k < w * h and on[k] and not seen[k]:
                        seen[k] = True
                        stack.append(k)
            comps.append(comp)
    return comps


def make_ramp(st):
    px = sorted(st[2], key=lum)
    lo, hi = lum(px[len(px) // 50]), lum(px[-len(px) // 50])
    bins = [[] for _ in range(RAMP)]
    for p in px:
        bins[min(RAMP - 1, max(0, int((lum(p) - lo) / (hi - lo) * RAMP)))].append(p)
    return [tuple(round(sum(p[i] for p in b) / len(b)) for i in range(3)) for b in bins if b]


def shrink(im, b, scale, pal, st=None, ramp=None):
    size = (max(1, round((b[2] - b[0]) * scale)), max(1, round((b[3] - b[1]) * scale)))
    im = im.crop(b).resize(size, Image.BOX)
    a = im.getchannel("A").point(lambda v: 255 if v > 128 else 0)
    for c in components(a):
        if len(c) < 8:
            for j in c:
                a.putpixel((j % a.width, j // a.width), 0)
    q = im.convert("RGB").quantize(palette=pal, dither=Image.Dither.NONE).convert("RGBA")
    q.putalpha(a)
    if not ramp:
        return q, None
    m = skin_mask(im, st)
    rs = set(ramp)
    for y in range(q.height):
        for x in range(q.width):
            p = q.getpixel((x, y))
            if not p[3]:
                continue
            if m.getpixel((x, y)):
                c = im.getpixel((x, y))
                q.putpixel((x, y), min(ramp, key=lambda r: sum((r[i] - c[i]) ** 2 for i in range(3))) + (255,))
            elif p[:3] in rs:
                q.putpixel((x, y), (p[0], p[1], p[2] ^ 1, 255))
    return q, m


def head(m):
    w = m.width
    comps = [c for c in components(m) if min(c) // w < m.height * 0.45]
    c = max(comps, key=len)
    top = min(c) // w
    xs = [j % w for j in c if j // w < top + round(H * 0.2)]
    return [round((min(xs) + max(xs)) / 2), top]


def head_template(m):
    hx, hy = head(m)
    return [(x - hx, y - hy) for y in range(hy, hy + round(H * 0.12)) for x in range(m.width) if m.getpixel((x, y))]


def fit_head(m, tpl, guess):
    hx, hy = guess

    def score(p):
        s = 0
        for dx, dy in tpl:
            x, y = p[0] + dx, p[1] + dy
            s += 1 if 0 <= x < m.width and 0 <= y < m.height and m.getpixel((x, y)) else -1
        return s
    shifts = [(dx, dy) for dx in range(-5, 6) for dy in range(-5, 6)]
    dx, dy = max(shifts, key=lambda d: (score((hx + d[0], hy + d[1])), -abs(d[0]) - abs(d[1])))
    return [hx + dx, hy + dy]


def cover_rim(layer, base, bottom):
    for _ in range(2):
        fill = []
        for y in range(min(bottom, layer.height)):
            for x in range(layer.width):
                if layer.getpixel((x, y))[3] or not base.getpixel((x, y))[3]:
                    continue
                near = [layer.getpixel((nx, ny)) for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1))
                        if 0 <= nx < layer.width and 0 <= ny < layer.height]
                near = [p for p in near if p[3]]
                if len(near) >= 2:
                    fill.append(((x, y), near[0]))
        for p, c in fill:
            layer.putpixel(p, c)


def hair_mask(base, hair, st):
    b, h = small(base), small(hair)
    cand = Image.new("L", h.size)
    data = []
    for p, q in zip(h.get_flattened_data(), b.get_flattened_data()):
        ok = False
        if p[3] > 128 and hsv(p)[1] < 0.22 and lum(p) > 35 and not is_skin(p, st):
            ok = q[3] <= 128 or sum(abs(p[i] - q[i]) for i in range(3)) > 60
        data.append(255 if ok else 0)
    cand.putdata(data)
    opened = cand.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))
    comps = components(opened)
    if not comps:
        return None
    big = max(len(c) for c in comps)
    keep = Image.new("L", h.size)
    w = h.width
    bb = box(b)
    neck = bb[1] + (bb[3] - bb[1]) * 0.28
    for c in comps:
        if len(c) >= big * 0.08 and min(c) // w < neck:
            for j in c:
                keep.putpixel((j % w, j // w), 255)
    keep = keep.filter(ImageFilter.MaxFilter(5))
    m = Image.new("L", h.size)
    m.putdata([255 if a and k else 0 for a, k in zip(cand.get_flattened_data(), keep.get_flattened_data())])
    return m.resize(hair.size, Image.NEAREST)


images = {}
for body, b in src["bodies"].items():
    images[f"{body}-base"] = load(f"{body}-base", b["base"])
    for o, views in b["outfits"].items():
        for v, k in zip(VIEWS, views):
            images[f"{body}-{o}-{v}"] = load(f"{body}-{o}-{v}", k)
    for s, k in b["hair"].items():
        images[f"{body}-hair-{s}"] = load(f"{body}-hair-{s}", k)
for c, views in src["characters"].items():
    for v, k in zip(VIEWS, views):
        images[f"{c}-{v}"] = load(f"{c}-{v}", k)

px = bytearray()
for im in images.values():
    t = im.crop(box(im)).resize((64, 96), Image.BOX).tobytes()
    for i in range(0, len(t), 4):
        if t[i + 3] > 128:
            px += t[i:i + 3]
pal = Image.frombytes("RGB", (len(px) // 3, 1), bytes(px)).quantize(colors=128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)

manifest = {"height": H, "skinTones": src["skinTones"], "hairColors": src["hairColors"], "bodies": {}, "characters": {}}

for body, b in src["bodies"].items():
    base_raw = images[f"{body}-base"]
    st = skin_stats(base_raw)
    ramp = make_ramp(st)
    bb = box(base_raw)
    scale = H / (bb[3] - bb[1])
    base, base_m = shrink(base_raw, bb, scale, pal, st, ramp)
    tpl = head_template(base_m)
    bh = head(base_m)
    raw_head = (bb[0] + bh[0] / scale, bb[1] + bh[1] / scale)
    base.save(out / f"{body}-base.png")
    entry = {"skin": [hexc(c) for c in ramp], "base": f"/art/lead/{body}-base.png", "outfits": {}, "hair": {"bald": None}}
    for o in b["outfits"]:
        entry["outfits"][o] = {}
        for v in VIEWS:
            r = images[f"{body}-{o}-{v}"]
            rb = box(r)
            im, m = shrink(r, rb, scale, pal, st, ramp)
            guess = (round((raw_head[0] - rb[0]) * scale), round((raw_head[1] - rb[1]) * scale))
            name = f"{body}-{o}-{v}.png"
            im.save(out / name)
            entry["outfits"][o][v] = {"src": f"/art/lead/{name}", "head": fit_head(m, tpl, guess)}
    for s in b["hair"]:
        hr = images[f"{body}-hair-{s}"]
        mask = hair_mask(base_raw, hr, st)
        if mask is None:
            print("WARNING: empty hair layer", body, s)
            continue
        hr = hr.copy()
        hr.putalpha(ImageChops.multiply(hr.getchannel("A"), mask))
        hb = box(hr)
        u = (min(bb[0], hb[0]), min(bb[1], hb[1]), max(bb[2], hb[2]), max(bb[3], hb[3]))
        base_u, bm = shrink(base_raw, u, scale, pal, st, ramp)
        layer, _ = shrink(hr, u, scale, pal)
        hx, hy = head(bm)
        cover_rim(layer, base_u, hy + round(H * 0.1))
        lb = layer.getbbox()
        if not lb:
            print("WARNING: empty hair layer", body, s)
            continue
        layer.crop(lb).save(out / f"{body}-hair-{s}.png")
        entry["hair"][s] = {"src": f"/art/lead/{body}-hair-{s}.png", "offset": [lb[0] - hx, lb[1] - hy]}
    manifest["bodies"][body] = entry
    print(body, "skin ramp:", entry["skin"], "hair styles:", len(entry["hair"]) - 1)

for c in src["characters"]:
    fb = box(images[f"{c}-front"])
    scale = H / (fb[3] - fb[1])
    manifest["characters"][c] = {}
    for v in VIEWS:
        r = images[f"{c}-{v}"]
        im, _ = shrink(r, box(r), scale, pal)
        im.save(out / f"{c}-{v}.png")
        manifest["characters"][c][v] = {"src": f"/art/lead/{c}-{v}.png"}

(out / "lead.json").write_text(json.dumps(manifest, indent=2) + "\n")


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
    pad = 24
    canvas = Image.new("RGBA", (im.width + pad * 2, im.height + pad))
    canvas.alpha_composite(im, (pad, pad))
    h = e["hair"].get(hair)
    if h:
        layer = tint(Image.open(out / Path(h["src"]).name).convert("RGBA"), src["hairColors"][hcolor])
        canvas.alpha_composite(layer, (pad + o["head"][0] + h["offset"][0], pad + o["head"][1] + h["offset"][1]))
    return canvas.crop(canvas.getbbox())


random.seed(4)
tones = list(src["skinTones"])
colors = list(src["hairColors"])
preview = []
for body, e in manifest["bodies"].items():
    styles = [s for s in e["hair"] if s != "bald"]
    row = []
    for i, o in enumerate(e["outfits"]):
        for v in VIEWS:
            row.append(compose(body, o, v, styles[i % len(styles)], random.choice(tones), random.choice(colors)))
    preview.append(row)
    row = []
    for i, s in enumerate(styles):
        o = list(e["outfits"])[i % len(e["outfits"])]
        for v in VIEWS:
            row.append(compose(body, o, v, s, tones[(i * 3 + 1) % len(tones)], colors[i % len(colors)]))
    preview.append(row)
    o = list(e["outfits"])[0]
    preview.append([compose(body, o, "front", (["bald"] + styles)[i % (len(styles) + 1)], t, colors[(i + 2) % len(colors)]) for i, t in enumerate(tones)])
preview.append([Image.open(out / f"{c}-{v}.png").convert("RGBA") for c in manifest["characters"] for v in VIEWS])

cw = max(c.width for r in preview for c in r) + 4
ch = max(c.height for r in preview for c in r) + 8
sheet = Image.new("RGBA", (cw * max(len(r) for r in preview), ch * len(preview)), (24, 26, 33, 255))
for j, r in enumerate(preview):
    for i, c in enumerate(r):
        sheet.alpha_composite(c, (i * cw + (cw - c.width) // 2, j * ch + ch - c.height - 3))
root_preview = root / "assets" / "lead-preview.png"
sheet.resize((sheet.width * 3, sheet.height * 3), Image.NEAREST).save(root_preview)
print("wrote", out / "lead.json", "and", root_preview)
