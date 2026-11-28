"""Generate the PWA icon set using Pillow; run from any working directory."""

from pathlib import Path

from PIL import Image, ImageDraw


PROJECT_ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR = PROJECT_ROOT / "frontend" / "icons"
GREEN = "#176b52"
PALE = "#f3f7f4"


def make_icon(size: int) -> Image.Image:
    image = Image.new("RGB", (size, size), GREEN)
    draw = ImageDraw.Draw(image)

    # Keep the mark well inside the central safe area for maskable launchers.
    center = size / 2
    radius = size * 0.36
    draw.ellipse(
        (center - radius, center - radius, center + radius, center + radius),
        fill=PALE,
    )

    # A bold geometric W suggests Waste and remains legible at small sizes.
    points = [
        (size * 0.30, size * 0.39),
        (size * 0.40, size * 0.64),
        (size * 0.50, size * 0.43),
        (size * 0.60, size * 0.64),
        (size * 0.70, size * 0.39),
    ]
    draw.line(points, fill=GREEN, width=max(5, size // 11), joint="curve")
    return image


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for size, filename in (
        (192, "icon-192.png"),
        (512, "icon-512.png"),
        (512, "icon-512-maskable.png"),
    ):
        make_icon(size).save(OUTPUT_DIR / filename, format="PNG", optimize=True)
    print(f"PWA icons created in: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
