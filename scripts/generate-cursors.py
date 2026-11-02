"""
Generate DevTrack's pixel-art cursors.

Each sprite is an ASCII grid: K = outline, W = body, . = transparent.
Body pixels are shaded automatically for a bevelled, lit-from-top-left look
(highlight on edges facing up/left, accent shadow on edges facing down/right),
and a soft drop shadow is cast one art-pixel down and right.

Writes 1x (2 screen px per art pixel) and 2x (4 px) PNGs to public/cursors/.
Run: python scripts/generate-cursors.py
"""

from pathlib import Path
from PIL import Image

OUT = Path(__file__).resolve().parent.parent / "public" / "cursors"

OUTLINE = (11, 16, 32, 255)
HIGHLIGHT = (255, 255, 255, 255)
FACE = (226, 235, 255, 255)
SHADOW = (107, 168, 255, 255)  # --accent
DROP = (0, 0, 0, 90)

SPRITES = {
    "arrow": [
        "K.........",
        "KK........",
        "KWK.......",
        "KWWK......",
        "KWWWK.....",
        "KWWWWK....",
        "KWWWWWK...",
        "KWWWWWWK..",
        "KWWWWWWWK.",
        "KWWWWWKKKK",
        "KWWKWWK...",
        "KWK.KWWK..",
        "KK..KWWK..",
        "K....KWWK.",
        ".....KWWK.",
        "......KK..",
    ],
    "pointer": [
        "....KK.......",
        "...KWWK......",
        "...KWWK......",
        "...KWWK......",
        "...KWWKKK....",
        "...KWWKWWKKK.",
        ".KKKWWKWWKWWK",
        "KWWKWWWWWWWWK",
        "KWWWWWWWWWWWK",
        ".KWWWWWWWWWWK",
        ".KWWWWWWWWWK.",
        "..KWWWWWWWWK.",
        "..KWWWWWWWK..",
        "...KKKKKKK...",
    ],
}


def shade(grid):
    h, w = len(grid), len(grid[0])

    def at(x, y):
        return grid[y][x] if 0 <= x < w and 0 <= y < h else "."

    px = {}
    for y in range(h):
        for x in range(w):
            c = grid[y][x]
            if c == "K":
                px[(x, y)] = OUTLINE
            elif c == "W":
                if at(x - 1, y) == "K" or at(x, y - 1) == "K":
                    px[(x, y)] = HIGHLIGHT
                elif at(x + 1, y) == "K" or at(x, y + 1) == "K":
                    px[(x, y)] = SHADOW
                else:
                    px[(x, y)] = FACE
    for (x, y) in list(px):
        if (x + 1, y + 1) not in px:
            px.setdefault((x + 1, y + 1), DROP)
    return px


def render(name, grid, scale, canvas):
    img = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    for (x, y), color in shade(grid).items():
        for dy in range(scale):
            for dx in range(scale):
                X, Y = x * scale + dx, y * scale + dy
                if X < canvas and Y < canvas:
                    img.putpixel((X, Y), color)
    return img


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for name, grid in SPRITES.items():
        render(name, grid, 2, 32).save(OUT / f"{name}.png")
        render(name, grid, 4, 64).save(OUT / f"{name}@2x.png")
        print("wrote", name)
