# Visual Verification Notes

## 2026-08-18 — Night-stage low-light refinement

The 375×812 `?visual-check` view after the first dimming pass retained clear HUD, mosquito, koban, sleeper, and item-tray elements, but the tatami still read brighter than the requested night mood. The next lighting pass therefore further reduces the moon-glow layers and lowers the night-stage backdrop brightness to 0.58, while preserving contrast for interactive game elements.
