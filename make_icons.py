#!/usr/bin/env python3
"""Generate JUN brand PWA icons (pure stdlib, no PIL): purple gradient rounded
square with a white J monogram (stem + bottom hook)."""
import zlib, struct, math, os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'icons')
os.makedirs(OUT, exist_ok=True)


def write_png(path, size, rows):
    def chunk(typ, data):
        return (struct.pack('>I', len(data)) + typ + data
                + struct.pack('>I', zlib.crc32(typ + data) & 0xffffffff))
    raw = b''.join(b'\x00' + row for row in rows)
    png = (b'\x89PNG\r\n\x1a\n'
           + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0))
           + chunk(b'IDAT', zlib.compress(raw, 9))
           + chunk(b'IEND', b''))
    with open(path, 'wb') as f:
        f.write(png)


def seg_dist(px, py, ax, ay, bx, by):
    vx, vy = bx - ax, by - ay
    wx, wy = px - ax, py - ay
    denom = vx * vx + vy * vy
    if denom == 0:
        return math.sqrt(wx * wx + wy * wy)
    t = max(0.0, min(1.0, (wx * vx + wy * vy) / denom))
    dx, dy = px - (ax + t * vx), py - (ay + t * vy)
    return math.sqrt(dx * dx + dy * dy)


def in_j(x, y, S, scale):
    """J monogram: stem segment + bottom hook arc (fractions of size)."""
    w = 0.09 * scale * S / 2.0
    stem = seg_dist(x, y, 0.585 * S, 0.25 * S, 0.585 * S, 0.585 * S) <= w
    cx, cy, r = 0.455 * S, 0.585 * S, 0.13 * scale * S
    dx, dy = x - cx, y - cy
    d = math.sqrt(dx * dx + dy * dy)
    ang = math.atan2(dy, dx)  # -pi..pi, bottom half is 0..pi (y grows down)
    if 0.0 <= ang <= math.pi:
        arc = abs(d - r) <= w
    else:
        arc = min(seg_dist(x, y, cx + r, cy, cx + r, cy),
                  seg_dist(x, y, cx - r, cy, cx - r, cy)) <= w
    return stem or arc


def in_tile(x, y, S, radius_frac):
    rx = radius_frac * S
    hx, hy = S / 2.0, S / 2.0
    qx, qy = abs(x - hx) - (hx - rx), abs(y - hy) - (hy - rx)
    if qx > 0 and qy > 0:
        return math.sqrt(qx * qx + qy * qy) <= rx
    return (qx <= 0 and qy <= 0) or qx <= 0 or qy <= 0


def render(size, maskable, ss=3):
    S = size
    scale = 0.86 if maskable else 1.0
    radius = 0.0 if maskable else 0.24
    g1, g2 = (139, 92, 246), (76, 29, 149)  # diagonal gradient
    rows = []
    for y in range(size):
        row = bytearray()
        for x in range(size):
            r = g = b = a = 0
            for sy in range(ss):
                for sx in range(ss):
                    px = x + (sx + 0.5) / ss
                    py = y + (sy + 0.5) / ss
                    if not in_tile(px, py, S, radius):
                        continue
                    a += 1
                    t = (px + py) / (2.0 * S)
                    if in_j(px, py, S, scale):
                        r += 255; g += 255; b += 255
                    else:
                        r += int(g1[0] * (1 - t) + g2[0] * t)
                        g += int(g1[1] * (1 - t) + g2[1] * t)
                        b += int(g1[2] * (1 - t) + g2[2] * t)
            n = ss * ss
            row += bytes((r // n if a else 0, g // n if a else 0, b // n if a else 0, 255 * a // n))
        rows.append(bytes(row))
    return rows


for name, size, maskable in [
    ('icon-192.png', 192, False),
    ('icon-512.png', 512, False),
    ('icon-512-maskable.png', 512, True),
    ('apple-touch-icon.png', 180, True),
]:
    write_png(os.path.join(OUT, name), size, render(size, maskable))
    print('generated', name)
