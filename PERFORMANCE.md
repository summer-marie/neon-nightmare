# Neon Nightmare — Performance Notes

## Why ctx.filter Was Removed
`ctx.filter` (e.g. `contrast()`, `blur()`) on a Canvas 2D context
triggers full software rasterization of the entire canvas on every
animation frame. At 60fps this causes severe frame drops and screen
freezes especially on integrated GPUs and lower-end hardware.
It was removed from drawFrame() entirely.
Never use ctx.filter inside a requestAnimationFrame loop.

## Canvas Performance Rules for This Project

### DO
- Use `ctx.shadowBlur` and `ctx.shadowColor` for glow effects —
  these are GPU-accelerated in most browsers
- Use `ctx.globalAlpha` for transparency — cheap operation
- Use `requestAnimationFrame` for all animation — already in place
- Use `Float32Array` for smoothing buffers — already in place
  for barSmooth, avoids garbage collection pressure
- Use `ctx.save()` and `ctx.restore()` only when needed —
  currently used correctly in drawBars() for clipping only
- Keep analyser.fftSize at 1024 or lower — already set correctly
- Keep analyser.smoothingTimeConstant between 0.7-0.9 —
  already set to 0.82

### AVOID
- `ctx.filter` inside any animation loop — causes full repaint
- `ctx.getImageData()` inside animation loop — extremely slow
- Creating new gradient objects every frame for static elements —
  cache them outside the loop if the colors do not change
- Calling `ctx.save()` / `ctx.restore()` more than necessary —
  each pair has overhead
- Large `ctx.shadowBlur` values (above 40) on many elements
  per frame — reduce if frame rate drops
- String concatenation inside hot loops — use template literals
  or pre-built strings

## Current Known Glitch Sources
- Large shadowBlur values on every bar in drawBars() can stress
  lower-end GPUs when particle count is high — reduce particle
  count or lower bass sensitivity if glitching occurs
- The barSmooth Float32Array is 64 elements and allocated once —
  this is correct and will not cause GC pressure
- If glitching occurs: lower Particle Count slider to under 60,
  lower Bass Sensitivity to under 2.0, switch visual mode to
  Bars only instead of Bars + Rings

## Browser Recommendations
- Chrome or Edge perform best for Canvas 2D with shadowBlur
- Firefox may show lower frame rates with high shadowBlur counts
- Safari has known Canvas 2D shadow performance issues —
  reduce particle count if using Safari

## Future Optimization Options (Not Yet Implemented)
- Offscreen canvas for particle layer (OffscreenCanvas API)
- Cache repeated gradient objects outside the draw loop
- Use `will-change: transform` on the canvas element in CSS
  to hint GPU compositing
- Reduce fftSize to 512 for lower-end devices
