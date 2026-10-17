import sys
import argparse
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument("src")
ap.add_argument("out")
ap.add_argument("--height", type=int, default=64)
ap.add_argument("--colors", type=int, default=32)
ap.add_argument("--palette")
ap.add_argument("--tol", type=int, default=40)
ap.add_argument("--preview", type=int, default=6)
ap.add_argument("--scale", type=float)
ap.add_argument("--width", type=int)
ap.add_argument("--box")
a = ap.parse_args()

im = Image.open(a.src).convert("RGBA")
px = im.load()
w, h = im.size

if im.getextrema()[3][0] == 255:
    bg = px[0, 0]
    for y in range(h):
        for x in range(w):
            r, g, b, _ = px[x, y]
            if abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2]) < a.tol:
                px[x, y] = (0, 0, 0, 0)

if a.box:
    box = tuple(int(v) for v in a.box.split(","))
else:
    box = im.getchannel("A").point(lambda v: 255 if v > 128 else 0).getbbox()
if not box:
    sys.exit("image is empty after background removal")
im = im.crop(box)

if a.scale:
    nh = max(1, round(im.height * a.scale))
    nw = max(1, round(im.width * a.scale))
elif a.width:
    nw = a.width
    nh = max(1, round(im.height * nw / im.width))
else:
    nh = a.height
    nw = max(1, round(im.width * nh / im.height))
small = im.resize((nw, nh), Image.BOX)

alpha = small.getchannel("A").point(lambda v: 255 if v > 128 else 0)
rgb = small.convert("RGB")

if a.palette:
    pal = Image.open(a.palette).convert("RGB").quantize(colors=256)
    q = rgb.quantize(palette=pal, dither=Image.Dither.NONE)
else:
    q = rgb.quantize(colors=a.colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)

res = q.convert("RGBA")
res.putalpha(alpha)
res.save(a.out)

if a.preview > 1:
    big = res.resize((nw * a.preview, nh * a.preview), Image.NEAREST)
    big.save(a.out.replace(".png", f"@{a.preview}x.png"))

used = len([c for _, c in res.getcolors(nw * nh) if c[3]])
print(f"{a.out}: {nw}x{nh}, {used} colors")
