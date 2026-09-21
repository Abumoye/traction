#!/usr/bin/env python3
"""
Watermark a property photo with a faint, centered Traction Properties logo.

Every image uploaded for a Traction Properties listing (Houses For Rent,
Houses For Sale, Estate Lands) must carry this watermark before it is
committed to source/static/images/properties/.

Usage:
    python3 scripts/watermark_property_image.py <input_image> <output_image>
    python3 scripts/watermark_property_image.py <input_dir> <output_dir>   # batch mode

The watermark is the Traction Properties logo (source/static/images/
traction-properties-logo.png), scaled to ~45% of the photo's width,
centered, and rendered at low opacity (default 16%) so it reads as a
faint deterrent rather than an obtrusive stamp.
"""
import sys
from pathlib import Path
from PIL import Image

REPO_ROOT = Path(__file__).resolve().parent.parent
LOGO_PATH = REPO_ROOT / "source" / "static" / "images" / "traction-properties-logo.png"
WATERMARK_OPACITY = 0.16  # 0.0-1.0, faint by design
WATERMARK_WIDTH_RATIO = 0.45  # watermark width relative to photo width


def watermark_image(input_path: Path, output_path: Path, opacity: float = WATERMARK_OPACITY) -> None:
    base = Image.open(input_path).convert("RGBA")
    logo = Image.open(LOGO_PATH).convert("RGBA")

    target_w = int(base.width * WATERMARK_WIDTH_RATIO)
    scale = target_w / logo.width
    target_h = int(logo.height * scale)
    logo = logo.resize((target_w, target_h), Image.LANCZOS)

    # Apply faint opacity to the logo's alpha channel.
    alpha = logo.split()[3].point(lambda p: int(p * opacity))
    logo.putalpha(alpha)

    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    x = (base.width - target_w) // 2
    y = (base.height - target_h) // 2
    layer.paste(logo, (x, y), logo)

    watermarked = Image.alpha_composite(base, layer)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    if output_path.suffix.lower() in (".jpg", ".jpeg"):
        watermarked.convert("RGB").save(output_path, quality=90)
    else:
        watermarked.save(output_path)


def main() -> None:
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)

    src = Path(sys.argv[1])
    dst = Path(sys.argv[2])

    if not LOGO_PATH.exists():
        print(f"Watermark source logo not found at {LOGO_PATH}")
        sys.exit(1)

    if src.is_dir():
        dst.mkdir(parents=True, exist_ok=True)
        images = [p for p in sorted(src.iterdir()) if p.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp")]
        if not images:
            print(f"No images found in {src}")
            sys.exit(1)
        for img_path in images:
            out_path = dst / img_path.name
            watermark_image(img_path, out_path)
            print(f"watermarked -> {out_path}")
    else:
        watermark_image(src, dst)
        print(f"watermarked -> {dst}")


if __name__ == "__main__":
    main()
