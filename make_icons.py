#!/usr/bin/env python3
"""PWA icons: rounded deep-purple tile with a white 壹. Same mark as the top bar."""
import os
from PIL import Image, ImageDraw, ImageFont

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'icons')
FONT = os.path.expanduser('~/.local/share/fonts/NotoSansSC-VF.ttf')
os.makedirs(OUT, exist_ok=True)


def gradient(size):
    img = Image.new('RGBA', (size, size))
    px = img.load()
    c1 = (139, 92, 246)
    c2 = (76, 29, 149)
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2.0 * (size - 1))
            px[x, y] = tuple(int(c1[i] * (1 - t) + c2[i] * t) for i in range(3)) + (255,)
    return img


def render(size, maskable):
    tile = gradient(size)
    if not maskable:
        mask = Image.new('L', (size, size), 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, size - 1, size - 1), radius=int(size * 0.24), fill=255)
        bg = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        bg.paste(tile, mask=mask)
        tile = bg
    font = ImageFont.truetype(FONT, int(size * (0.46 if maskable else 0.52)))
    font.set_variation_by_name('SemiBold')
    draw = ImageDraw.Draw(tile)
    text = '壹'
    box = draw.textbbox((0, 0), text, font=font)
    tw, th = box[2] - box[0], box[3] - box[1]
    x = (size - tw) / 2 - box[0]
    y = (size - th) / 2 - box[1]
    draw.text((x, y + size * 0.01), text, font=font, fill=(255, 255, 255, 255))
    shine = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shine)
    sd.ellipse((-size * 0.2, -size * 0.55, size * 1.2, size * 0.55), fill=(255, 255, 255, 70))
    tile = Image.alpha_composite(tile, shine)
    ring = ImageDraw.Draw(tile)
    pad = max(2, size // 48)
    if maskable:
        ring.rounded_rectangle((pad, pad, size - 1 - pad, size - 1 - pad), radius=int(size * 0.08), outline=(255, 255, 255, 56), width=max(1, size // 128))
    else:
        ring.rounded_rectangle((pad, pad, size - 1 - pad, size - 1 - pad), radius=int(size * 0.22), outline=(255, 255, 255, 56), width=max(1, size // 128))
    return tile


for name, size, maskable in [
    ('icon-192.png', 192, False),
    ('icon-512.png', 512, False),
    ('icon-512-maskable.png', 512, True),
    ('apple-touch-icon.png', 180, True),
]:
    render(size, maskable).save(os.path.join(OUT, name))
    print('generated', name)
