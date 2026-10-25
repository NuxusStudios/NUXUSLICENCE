# Accessibility review — CivicPass

Target: **WCAG 2.1 AA** and the platform guidelines (iOS/Android). A government
app in Ontario should also meet **AODA** expectations.

## Built-in support (verify on device)

- **Labels & roles**: interactive elements pass `accessibilityLabel` / `accessibilityRole`
  (buttons, links, tabs, checkboxes, the PIN pad announces progress, the signature
  pad is labelled). Section titles use `accessibilityRole="header"`.
- **Reduce Transparency**: the `Glass` material falls back to a solid, bordered
  surface when the OS "Reduce Transparency" setting is on, so the glassmorphism
  never costs legibility. `useReduceTransparency()` drives this.
- **Dynamic type**: text uses the shared `type` scale; verify it scales with OS
  font-size settings and that layouts reflow (the bento/quick grids wrap).
- **Hit targets**: tab icons, chips, list rows and the PIN keys are ≥44px.
- **Bilingual**: every string is EN/FR via `useI18n` (`tr`/`pick`), including
  accessibility labels.
- **Motion**: hero/pulse animations are decorative; honour "Reduce Motion" (see gaps).

## Contrast — the glass re-skin needs a pass

Frosted panels over an ambient canvas can lower text contrast. Required checks:

- [ ] Body and muted text over glass panels hit 4.5:1 (3:1 for large text) in **both**
      dark and light themes. Tune `glass` wash opacity or text tokens if any fail.
- [ ] Status colours (danger/warning/success) over tinted panels meet 4.5:1.
- [ ] The gradient anchor/CTA white text over the lightest gradient stop meets 4.5:1.
- [ ] "Valid/Expired" pills and the red expiry status on document tiles.

## Gaps to close

- [ ] Wire **Reduce Motion**: skip the lamp-beam / pulse-border / tile scale animations
      when `AccessibilityInfo.isReduceMotionEnabled()` is set.
- [ ] Screen-reader walkthrough (VoiceOver + TalkBack) of the core flows:
      sign in → wallet → present a credential → pay a ticket → book an appointment.
- [ ] Focus order and the "skip to content" affordance on the web build.
- [ ] Automated axe/contrast check wired into the e2e run.
- [ ] Confirm the document tiles' colour tint is never the *only* signal (status
      also carries an icon + text — good; keep that rule).

## How to test

- iOS: VoiceOver, Larger Text, Reduce Transparency, Reduce Motion, Increase Contrast.
- Android: TalkBack, Font size & Display size, Remove animations.
- Web demo: keyboard-only traversal + an axe DevTools scan.
