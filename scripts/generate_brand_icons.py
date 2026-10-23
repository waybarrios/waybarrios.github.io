"""Export a circular favicon from the selected W in brand-mark.svg.

Run with: python scripts/generate_brand_icons.py
Requires ImageMagick and Pillow. All asset references are versioned automatically.
"""

import copy
import hashlib
import io
import json
import re
import shutil
import subprocess
import xml.etree.ElementTree as ET
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SVG_NAMESPACE = "http://www.w3.org/2000/svg"
ET.register_namespace("", SVG_NAMESPACE)


def asset_version(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()[:12]


def update_references():
    manifest_path = ROOT / "site.webmanifest"
    manifest = json.loads(manifest_path.read_text())
    for icon in manifest["icons"]:
        path = icon["src"].split("?")[0]
        icon["src"] = f"{path}?v={asset_version(ROOT / path)}"
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")

    versions = {
        path: asset_version(ROOT / path)
        for path in ["favicon.svg", "img/icon-192.png", "site.webmanifest"]
    }
    pages = [
        ROOT / "index.html",
        ROOT / "404.html",
        ROOT / "research/index.html",
        ROOT / "open-source/index.html",
        *sorted((ROOT / "projects").glob("*/index.html")),
        *sorted((ROOT / "brand").glob("*.html")),
    ]
    for page in pages:
        source = page.read_text()
        if 'rel="icon"' not in source:
            source = source.replace(
                "</title>",
                '</title>\n  <link rel="icon" type="image/svg+xml" href="/favicon.svg">',
                1,
            )
        for path, version in versions.items():
            source = re.sub(
                rf"{re.escape(path)}(?:\?v=[^\"\s<>]+)?",
                f"{path}?v={version}",
                source,
            )
        page.write_text(source)


def main():
    source = ET.parse(ROOT / "brand-mark.svg").getroot()
    line = source.find(f"{{{SVG_NAMESPACE}}}polyline")
    if line is None:
        raise ValueError("brand-mark.svg must contain the selected W polyline")

    svg = ET.Element(
        f"{{{SVG_NAMESPACE}}}svg",
        {"viewBox": "0 0 64 64", "role": "img", "aria-labelledby": "title"},
    )
    ET.SubElement(svg, "title", {"id": "title"}).text = "Wayner Barrios W favicon"
    ET.SubElement(svg, "circle", {"cx": "32", "cy": "32", "r": "32", "fill": "#000"})
    mark = copy.deepcopy(line)
    mark.attrib.pop("class", None)
    mark.set("stroke", "#fff")
    mark.set("transform", "translate(3.2 3.2) scale(.9)")
    svg.append(mark)
    ET.indent(svg, space="  ")
    favicon = ET.tostring(svg, encoding="unicode") + "\n"
    (ROOT / "favicon.svg").write_text(favicon)
    (ROOT / "brand/w-trace-circle.svg").write_text(favicon)

    converter = shutil.which("magick") or shutil.which("convert")
    if not converter:
        raise RuntimeError("ImageMagick is required to export the SVG favicon")
    raster = subprocess.run(
        [converter, "-background", "none", "-density", "1536", str(ROOT / "favicon.svg"), "-resize", "1024x1024", "png:-"],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    with Image.open(io.BytesIO(raster.stdout)) as rendered:
        image = rendered.convert("RGBA")
    image.resize((32, 32), Image.Resampling.LANCZOS).save(ROOT / "img/icon.png")
    image.resize((192, 192), Image.Resampling.LANCZOS).save(ROOT / "img/icon-192.png")
    image.resize((256, 256), Image.Resampling.LANCZOS).save(
        ROOT / "img/icon.ico",
        sizes=[(size, size) for size in [16, 24, 32, 48, 64, 128, 256]],
    )
    update_references()


if __name__ == "__main__":
    main()
