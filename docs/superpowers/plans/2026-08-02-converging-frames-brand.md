# Converging Frames Brand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the approved three-frame W identity into the portfolio header and PWA assets, then serve the site locally for visual review.

**Architecture:** Keep the current W path unchanged. Inline the primary three-frame SVG in the header so CSS variables can adapt it to the site's manual light/dark theme and animate convergence on hover/focus. Keep the favicon as a single W and generate raster manifest icons from dedicated SVG sources.

**Tech Stack:** Static HTML, CSS, inline SVG, ImageMagick, Python HTTP server.

## Global Constraints

- The primary resting mark has two blue traces behind one dominant W.
- The existing W path geometry must not change.
- Favicon sizes below 32 px use one W only.
- Motion uses transform/opacity, does not loop, and respects `prefers-reduced-motion`.
- Light colors: ink `#171816`, accent `#1746d1`, paper `#f5f3ed`.
- Dark colors: ink `#eae7dd`, accent `#8fa9ff`, paper `#171613`.
- Do not commit until the user approves the local visual result.

---

### Task 1: Header mark and interaction

**Files:**
- Modify: `index.html` (header wordmark)
- Modify: `style.css` (mark layout, theme colors, convergence motion)
- Modify: `brand-mark.svg` (static primary mark for reuse)

**Interfaces:**
- Consumes: existing CSS variables `--ink`, `--accent`, motion tokens, and the original W path.
- Produces: `.brand-mark`, `.brand-trace-back`, `.brand-trace-mid`, and `.brand-final` visual states.

- [ ] **Step 1: Record the current failing asset check**

Run:

```bash
python3 - <<'PY'
from pathlib import Path
html = Path('index.html').read_text()
css = Path('style.css').read_text()
assert 'class="brand-mark"' in html
assert '.brand-trace-back' in css
assert '.brand-trace-mid' in css
PY
```

Expected: FAIL because the header still references `brand-mark.svg` through an `<img>` and no frame classes exist.

- [ ] **Step 2: Inline the approved mark in the header**

Replace the header image with an accessible decorative SVG inside the existing labeled home link:

```html
<svg class="brand-mark" viewBox="0 0 95 64" aria-hidden="true" focusable="false">
  <path class="brand-trace brand-trace-back" d="M3 5h12l14 27 9-21h4l9 21L65 5h12L53 59 40 34 27 59Z"/>
  <path class="brand-trace brand-trace-mid" d="M3 5h12l14 27 9-21h4l9 21L65 5h12L53 59 40 34 27 59Z"/>
  <path class="brand-final" d="M3 5h12l14 27 9-21h4l9 21L65 5h12L53 59 40 34 27 59Z"/>
</svg>
```

- [ ] **Step 3: Add static offsets, theme colors, and interaction**

Add CSS that keeps the final W at `translateX(15px)`, the middle trace at `8px`, and the back trace at `0`; on hover/focus, move traces to `15px`, fade them out, then restore the resting state. Set `transition: transform 600ms var(--ease-decel), opacity 600ms var(--ease-decel)` and disable it inside the existing reduced-motion media query.

- [ ] **Step 4: Update reusable `brand-mark.svg`**

Use a `0 0 95 64` viewBox with the same three path instances, exact offsets, light colors, and a `prefers-color-scheme: dark` fallback for contexts outside the page.

- [ ] **Step 5: Run the asset check**

Run the Python check from Step 1.

Expected: PASS.

### Task 2: Favicon and manifest assets

**Files:**
- Preserve: `favicon.svg` (single W)
- Modify: `img/icon.png`
- Modify: `img/icon-192.png`
- Verify: `site.webmanifest`

**Interfaces:**
- Consumes: simplified W for 32 px and primary three-frame mark for 192 px.
- Produces: raster assets referenced by the manifest and apple-touch icon.

- [ ] **Step 1: Verify current icons fail the identity check**

Run:

```bash
python3 - <<'PY'
from PIL import Image
for path, size in [('img/icon.png', (32, 32)), ('img/icon-192.png', (192, 192))]:
    assert Image.open(path).size == size
print('Dimensions pass; visual replacement still required')
PY
```

Expected: dimensions pass, but the files still show the legacy graduation cap/blue square.

- [ ] **Step 2: Generate the 32 px simplified icon**

Render the existing single-W `favicon.svg` onto a transparent 32x32 canvas using ImageMagick, preserving padding and crisp edges.

- [ ] **Step 3: Generate the 192 px primary icon**

Render the three-frame SVG on an opaque `#f5f3ed` 192x192 canvas with the complete traces inside the safe area.

- [ ] **Step 4: Verify dimensions and manifest references**

Run:

```bash
python3 - <<'PY'
import json
from pathlib import Path
from PIL import Image
manifest = json.loads(Path('site.webmanifest').read_text())
assert Image.open('img/icon.png').size == (32, 32)
assert Image.open('img/icon-192.png').size == (192, 192)
assert {icon['src'] for icon in manifest['icons']} == {'img/icon.png', 'img/icon-192.png'}
PY
```

Expected: PASS.

### Task 3: Local visual verification

**Files:**
- Verify: `index.html`, `style.css`, `favicon.svg`, `brand-mark.svg`, manifest icons.

**Interfaces:**
- Consumes: completed static assets and header interaction.
- Produces: an approved browser-rendered result; no commit yet.

- [ ] **Step 1: Validate static references and JSON-LD**

Run the existing local-reference and JSON-LD validation used for the SEO/GEO work. Expected: two valid JSON-LD blocks and no missing local references.

- [ ] **Step 2: Start the local site**

Run:

```bash
python3 -m http.server 8080
```

Expected: portfolio available at `http://localhost:8080/`.

- [ ] **Step 3: Browser review**

Check light/dark themes, header at desktop/mobile widths, hover/focus convergence, favicon legibility, and reduced-motion behavior. The resting header must show three frames and must not shift navigation.

- [ ] **Step 4: User acceptance gate**

Share the local URL and wait for the user's visual approval before preparing a commit message.
