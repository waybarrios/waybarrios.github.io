import hashlib
import re
import subprocess
import tempfile
import unittest
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
PAPER_DARK = (23, 22, 19)
PAPER_LIGHT = (245, 243, 237)


def relative_luminance(rgb):
    channels = []
    for value in rgb:
        channel = value / 255
        channels.append(channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4)
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]


def contrast_ratio(first, second):
    lighter, darker = sorted((relative_luminance(first), relative_luminance(second)), reverse=True)
    return (lighter + 0.05) / (darker + 0.05)


def render_page(dark=False):
    source = (ROOT / "index.html").read_text()
    if dark:
        source = source.replace('<html lang="en">', '<html lang="en" data-theme="dark">', 1)

    page = ROOT / ".brand-render-test.html"
    page.write_text(source)
    try:
        with tempfile.TemporaryDirectory(dir=ROOT) as temp_dir:
            screenshot = Path(temp_dir) / "page.png"
            profile = Path(temp_dir) / "profile"
            profile.mkdir()
            subprocess.run(
                [
                    "firefox",
                    "--headless",
                    "--no-remote",
                    "--profile",
                    str(profile),
                    "--screenshot",
                    str(screenshot),
                    "--window-size",
                    "1200,300",
                    page.as_uri(),
                ],
                check=True,
                cwd=ROOT,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=30,
            )
            return Image.open(screenshot).convert("RGB").copy()
    finally:
        page.unlink(missing_ok=True)


class BrandTests(unittest.TestCase):
    def test_stylesheet_url_changes_with_css_content(self):
        css_hash = hashlib.sha256((ROOT / "style.css").read_bytes()).hexdigest()[:12]
        html = (ROOT / "index.html").read_text()
        stylesheet = re.search(r'href="(style\.css\?v=[^"]+)"', html)

        self.assertIsNotNone(stylesheet, "page must include a versioned stylesheet URL")
        self.assertEqual(stylesheet.group(1), f"style.css?v={css_hash}")

    def assert_logo_visible(self, dark):
        image = render_page(dark=dark)
        # The 1120px header is centered in a 1200px viewport, placing the mark near x=40.
        crop = image.crop((38, 14, 115, 78))
        background = PAPER_DARK if dark else PAPER_LIGHT
        visible_pixels = sum(
            contrast_ratio(pixel, background) >= 3 for pixel in crop.get_flattened_data()
        )
        self.assertGreater(
            visible_pixels,
            100,
            f"expected a visible header mark in {'dark' if dark else 'light'} mode, got {visible_pixels} contrasting pixels",
        )

    def test_header_logo_is_visible_in_light_mode(self):
        self.assert_logo_visible(dark=False)

    def test_header_logo_is_visible_in_dark_mode(self):
        self.assert_logo_visible(dark=True)

    def test_manifest_icons_use_converging_frames_identity(self):
        small = Image.open(ROOT / "img/icon.png").convert("RGBA")
        large = Image.open(ROOT / "img/icon-192.png").convert("RGBA")

        self.assertEqual(small.size, (32, 32))
        self.assertEqual(large.size, (192, 192))

        small_ink = sum(
            alpha > 128 and red < 55 and green < 55 and blue < 55
            for red, green, blue, alpha in small.get_flattened_data()
        )
        self.assertGreater(small_ink, 30, "32px icon must use the simplified ink W")

        large_pixels = list(large.get_flattened_data())
        large_ink = sum(
            alpha > 128 and red < 55 and green < 55 and blue < 55
            for red, green, blue, alpha in large_pixels
        )
        large_blue = sum(
            alpha > 128 and blue > red * 1.5 and blue > green * 1.2
            for red, green, blue, alpha in large_pixels
        )
        corner = large.getpixel((0, 0))[:3]

        self.assertGreater(large_ink, 800, "192px icon must contain the dominant final W")
        self.assertGreater(large_blue, 800, "192px icon must contain the two observation traces")
        self.assertTrue(
            all(abs(actual - expected) <= 3 for actual, expected in zip(corner, PAPER_LIGHT)),
            f"192px icon must use the paper background, got {corner}",
        )


if __name__ == "__main__":
    unittest.main()
