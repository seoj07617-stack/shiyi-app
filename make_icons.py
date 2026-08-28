#!/usr/bin/env python3
"""Generate PWA icons for shiyi-app (pure stdlib, no PIL)."""
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


def render(size, maskable, ss=3):
    """White bg + purple ring/dot (any), or purple gradient bg + white ring/dot (maskable)."""
    S = size * ss
    c = S / 2.0
    scale = 0.8 if maskable else 1.0
    r_out, r_in, r_dot = 0.40 * scale, 0.36 * scale, 0.105 * scale
    purple = (124, 58, 237)
    g_top, g_bot = (167, 139, 250), (109, 40, 217)
    px = bytearray(S * S * 4)
    idx = 0
    for y in range(S):
        t = y / (S - 1.0)
        bg = tuple(int(g_top[i] * (1 - t) + g_bot[i] * t) for i in range(3))
        dy2 = (y - c) * (y - c)
        for x in range(S):
            d = math.sqrt((x - c) * (x - c) + dy2)
            if d <= r_dot * S or (r_in * S <= d <= r_out * S):
                col = (255, 255, 255) if maskable else purple
            else:
                col = bg if maskable else (255, 255, 255)
            px[idx] = col[0]; px[idx+1] = col[1]; px[idx+2] = col[2]; px[idx+3] = 255
            idx += 4
    rows = []
    n = ss * ss
    for y in range(size):
        row = bytearray()
        for x in range(size):
            r = g = b = 0
            for sy in range(ss):
                base = ((y * ss + sy) * S + x * ss) * 4
                for sx in range(ss):
                    i2 = base + sx * 4
                    r += px[i2]; g += px[i2+1]; b += px[i2+2]
            row += bytes((r // n, g // n, b // n, 255))
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
