# Award Icons

Drop SVG files here to add them to the custom award glyph picker.

## Requirements

- File extension: `.svg`
- Filename becomes the icon ID and display name (e.g. `rocket.svg` → "Rocket")
- Viewbox should be `0 0 36 40` to match the built-in glyphs
- Use `currentColor` for stroke/fill so the commissioner's chosen colour is applied
- Stroke width: `1.4`, round linecaps/joins, `fill-opacity="0.15"` for fills

## How it works

The server reads this directory at runtime on each request to `GET /api/award-icons`.
No restart needed — just drop a file in and it appears in the picker immediately.

## Example

```svg
<svg viewBox="0 0 36 40" xmlns="http://www.w3.org/2000/svg">
  <path stroke="currentColor" stroke-width="1.4" fill="none"
    stroke-linecap="round" stroke-linejoin="round"
    fill-opacity="0.15" fill="currentColor"
    d="..." />
</svg>
```
