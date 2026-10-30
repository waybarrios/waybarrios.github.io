# Converging Frames Brand Design

## Context

The portfolio currently uses a distinctive geometric W in `brand-mark.svg` and
`favicon.svg`, while the web manifest still uses unrelated legacy icons: a blue
square and a graduation cap. The W is the strongest existing asset because it
is recognizable, compact, and specific to Wayner Barrios. The redesign should
not replace that silhouette or force a literal AI/network metaphor into it.

## Goal

Build a coherent personal brand around the existing W that communicates a
researcher who turns multimodal observations into working systems. The result
must remain recognizable at browser-tab size and feel appropriate for research,
open source, and systems work.

## Non-Goals

- Do not redraw the W into a network, pipeline, node graph, graduation cap, or
  generic AI symbol.
- Do not add gradients, glows, rounded app-icon styling, or decorative detail
  that disappears below 32 px.
- Do not change the portfolio's light-first editorial palette or typography.
- Do not encode every research topic inside the mark.

## Narrative

The primary mark is called **Converging Frames**.

Three copies of the existing W represent successive observations across video,
image, text, and time. Two blue traces sit behind a final ink W. The traces
communicate incomplete or temporally separated evidence; the dominant W is the
stable form produced when those observations align and become a running system.

The sequence is:

1. Observations
2. Alignment and reasoning
3. Stable system

This connects multimodal/video research with CRYSTAL, MoDA, vLLM-MLX, and DGX
Spark without illustrating any project literally.

## Mark System

### Primary Mark

Use three copies of the existing path without changing its geometry:

```svg
M3 5h12l14 27 9-21h4l9 21L65 5h12L53 59 40 34 27 59Z
```

- Final W: no horizontal offset, full-opacity ink.
- Middle trace: 7 px left of the final W at 38% opacity.
- Back trace: 15 px left of the final W at 16% opacity.
- Preserve the relative offsets when scaling.
- The final W must remain visually dominant in every context.

### Simplified Mark

Use one unmodified W for favicon sizes and any context below 32 px. The traces
must not be compressed into a tiny canvas because they would read as blur rather
than intentional frames.

### Lockup

The header may pair the primary mark with `Wayner Barrios` when more identity is
needed. The existing navigation can continue using the mark alone. A descriptor
such as `Multimodal AI · Research systems` is optional outside the main header,
but must not be baked into the icon asset.

## Color

### Light Theme

- Final W: `#171816` (`--ink`)
- Traces: `#1746d1` (`--accent`) at 38% and 16% opacity
- Background: transparent; previews may use `#f5f3ed` (`--paper`)

### Dark Theme

- Final W: `#eae7dd` (`--ink` in dark mode)
- Traces: `#8fa9ff` (`--accent` in dark mode) at 42% and 20% opacity
- Background: transparent

Opacity is part of the system: traces must never compete with the final W.

## Motion

The static resting state is the three-frame primary mark.

- On pointer hover or keyboard focus, both traces converge toward the final W
  over 500-650 ms using the existing deceleration easing.
- After a short hold, the traces return to their resting offsets.
- The final W does not move; it is the stable reference.
- Do not loop the animation.
- Do not animate on every scroll event.
- With `prefers-reduced-motion: reduce`, render the static three-frame mark with
  no transition.

The motion explains the mark rather than decorating it: separated observations
align into one stable result.

## Asset Mapping

- `brand-mark.svg`: primary three-frame mark, with theme-compatible colors.
- `favicon.svg`: simplified single-W mark with existing light/dark adaptation.
- `img/icon.png` (32x32): regenerated from the simplified mark.
- `img/icon-192.png` (192x192): regenerated from the primary mark with enough
  transparent padding for platform masks.
- `site.webmanifest`: continue referencing the two regenerated PNG assets.
- The existing portrait-based `img/og.jpg` remains unchanged; this mark update
  does not replace the site's social portrait card.

## Accessibility and Robustness

- The home link keeps its existing accessible label; the SVG remains decorative
  inside that labeled link.
- The mark must remain understandable without color: the final W is complete,
  and traces are supplementary.
- The final W must meet at least 3:1 contrast against its immediate background.
- SVG files must remain usable with JavaScript disabled.
- Motion must be transform/opacity only and honor reduced motion.

## Responsive Rules

- 16-31 px: simplified single W.
- 32-47 px: primary mark is allowed only when the available width includes the
  full leftward traces; otherwise use the simplified mark.
- 48 px and above: primary mark.
- Do not crop the left traces inside a square viewBox; expand the viewBox while
  preserving the final W's proportions.

## Anti-Slop Rationale

- The existing silhouette is retained instead of replaced by a fashionable AI
  logo motif.
- The blue traces are grounded in Wayner's actual work with video, multimodal
  observations, and reasoning over time.
- The mark has one narrative device, not a stack of gradients, nodes, glows, or
  micro-details.
- Small-size behavior is intentionally different from large-size behavior.
- The design remains specific to this portfolio and cannot be transplanted to a
  generic AI company without losing its connection to the existing W.

## Acceptance Criteria

- The W is immediately recognizable at 16, 32, 34, 64, and 192 px.
- Header renders correctly in light and dark themes.
- Primary mark shows two distinct blue traces and one dominant final W.
- Favicon uses only the simplified W and is not blurry.
- Header animation converges and returns once per interaction without looping.
- Keyboard focus triggers the same narrative behavior as hover.
- Reduced-motion mode has no mark animation.
- Manifest icons no longer show the legacy blue square or graduation cap.
- No layout shift is introduced in the sticky header.
