"""Extract the front-view pixel character from the supplied reference sheet."""

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs" / "character-reference.png"
OUTPUT = ROOT / "src" / "renderer" / "assets" / "character-front.png"
PREVIEW = ROOT / "artifacts" / "character-front-preview.png"
CROP = (20, 15, 320, 455)


def flood_exterior(barrier):
    height, width = barrier.shape
    exterior = np.zeros((height, width), dtype=bool)
    queue = deque()

    for x in range(width):
        queue.append((0, x))
        queue.append((height - 1, x))
    for y in range(height):
        queue.append((y, 0))
        queue.append((y, width - 1))

    while queue:
        y, x = queue.popleft()
        if exterior[y, x] or barrier[y, x]:
            continue
        exterior[y, x] = True
        if y > 0:
            queue.append((y - 1, x))
        if y + 1 < height:
            queue.append((y + 1, x))
        if x > 0:
            queue.append((y, x - 1))
        if x + 1 < width:
            queue.append((y, x + 1))
    return exterior


def largest_component(mask):
    height, width = mask.shape
    seen = np.zeros_like(mask)
    largest = []

    for y in range(height):
        for x in range(width):
            if not mask[y, x] or seen[y, x]:
                continue
            queue = deque([(y, x)])
            seen[y, x] = True
            component = []
            while queue:
                cy, cx = queue.popleft()
                component.append((cy, cx))
                for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
                    if 0 <= ny < height and 0 <= nx < width and mask[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        queue.append((ny, nx))
            if len(component) > len(largest):
                largest = component

    result = np.zeros_like(mask)
    for y, x in largest:
        result[y, x] = True
    return result


def main():
    crop = Image.open(SOURCE).convert("RGB").crop(CROP)
    pixels = np.asarray(crop, dtype=np.int16)
    horizontal = np.zeros(pixels.shape[:2], dtype=np.int16)
    vertical = np.zeros_like(horizontal)
    horizontal[:, 1:] = np.max(np.abs(pixels[:, 1:] - pixels[:, :-1]), axis=2)
    vertical[1:, :] = np.max(np.abs(pixels[1:, :] - pixels[:-1, :]), axis=2)
    edges = Image.fromarray(np.uint8(np.maximum(horizontal, vertical) >= 19) * 255)
    barrier = np.asarray(edges.filter(ImageFilter.MaxFilter(3))) > 0
    alpha = largest_component(~flood_exterior(barrier))

    mask = Image.fromarray(np.uint8(alpha) * 255)
    draw = ImageDraw.Draw(mask)
    hair_regions = [
        [
            (178, 21), (199, 21), (213, 28), (220, 43), (227, 59),
            (242, 70), (254, 92), (260, 116), (258, 156), (247, 174),
            (229, 184), (211, 199), (188, 197), (168, 205), (139, 204),
            (117, 198), (100, 185), (85, 174), (76, 155), (78, 117),
            (87, 91), (107, 69), (132, 54), (160, 47), (175, 41),
        ],
        [
            (231, 165), (249, 174), (262, 190), (275, 204), (299, 216),
            (315, 230), (316, 247), (305, 256), (281, 258), (260, 246),
            (240, 226), (218, 210), (205, 195), (211, 179),
        ],
        [
            (102, 174), (120, 185), (137, 199), (126, 209), (108, 220),
            (93, 236), (78, 248), (57, 251), (50, 245), (53, 229),
            (69, 214), (88, 197),
        ],
    ]
    for region in hair_regions:
        draw.polygon([(x - CROP[0], y - CROP[1]) for x, y in region], fill=255)
    alpha = np.asarray(mask) > 0

    sprite = crop.convert("RGBA")
    sprite.putalpha(Image.fromarray(np.uint8(alpha) * 255))
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    sprite.save(OUTPUT)

    checker = Image.new("RGB", crop.size, "#b9dae2")
    checker.paste(sprite, mask=sprite.getchannel("A"))
    PREVIEW.parent.mkdir(parents=True, exist_ok=True)
    checker.save(PREVIEW)
    print(f"saved {OUTPUT}, opaque pixels: {int(alpha.sum())}")


if __name__ == "__main__":
    main()
