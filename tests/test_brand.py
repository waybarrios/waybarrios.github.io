import hashlib
import re
import subprocess
import tempfile
import unittest
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]


def relative_luminance(rgb):
    channels = []
    for value in rgb:
        channel = value / 255
        channels.append(channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4)
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]


def contrast_ratio(first, second):
    lighter, darker = sorted((relative_luminance(first), relative_luminance(second)), reverse=True)
    return (lighter + 0.05) / (darker + 0.05)


def render_page(width=1200):
    source = (ROOT / "index.html").read_text()

    page = ROOT / ".profile-render-test.html"
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
                    f"{width},900",
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

    def assert_profile_readable(self, width):
        image = render_page(width=width)
        background = (255, 255, 255)
        self.assertEqual(image.getpixel((0, 0)), background)
        visible_pixels = sum(
            contrast_ratio(pixel, background) >= 4.5 for pixel in image.get_flattened_data()
        )
        self.assertGreater(
            visible_pixels,
            1000,
            f"expected readable profile text at {width}px, got {visible_pixels} contrasting pixels",
        )

    def test_profile_is_readable_on_desktop(self):
        self.assert_profile_readable(width=1200)

    def test_profile_is_readable_on_mobile(self):
        self.assert_profile_readable(width=320)

    def test_manifest_icons_use_white_w_on_black_circle(self):
        for name, size in [("icon.png", 32), ("icon-192.png", 192)]:
            with self.subTest(icon=name):
                image = Image.open(ROOT / "img" / name).convert("RGBA")
                self.assertEqual(image.size, (size, size))
                self.assertEqual(image.getpixel((0, 0))[3], 0, "circle corners must be transparent")
                self.assertEqual(image.getpixel((size // 2, size // 8)), (0, 0, 0, 255))
                pixels = list(image.get_flattened_data())
                white = sum(
                    alpha > 128 and red > 230 and green > 230 and blue > 230
                    for red, green, blue, alpha in pixels
                )
                black = sum(
                    alpha > 128 and red < 25 and green < 25 and blue < 25
                    for red, green, blue, alpha in pixels
                )
                self.assertGreater(white, size * size * .015, "the white W must remain visible")
                self.assertGreater(black, size * size * .5, "the circular background must be black")
                self.assertTrue(all(red == green == blue for red, green, blue, _ in pixels))


if __name__ == "__main__":
    unittest.main()
