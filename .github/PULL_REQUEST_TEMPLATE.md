### 📝 Pull Request Summary
A clear description of the feature, fix, or new screen model introduced by this PR.

---

### 🔗 Linked Issue
Closes #<!-- Replace with issue number, e.g. Closes #12 -->

---

### 📸 Visual Evidence & Verification (MANDATORY)
> All PRs touching UI or Canvas rendering must include screenshots or recordings of the result running at internal **1080×1920 @ 60 FPS**.
- Attach before/after screenshot or recording:

---

### 🛡️ Contributor Safety Checklist
Please verify the following requirements before requesting review:
- [ ] **No Direct Push to `main`:** This PR is created from a dedicated branch (e.g. `feature/...` or `fix/...`).
- [ ] **Zero Core File Pollution:** No modification of global canvas coordinates, bounding boxes, or existing models/synths.
- [ ] **Slot Containment:** New visual model strictly renders within `Slot 2 (y: 795, h: 670)` or synth strictly within `Slot 1 (y: 195, h: 570)`.
- [ ] **Dual Mode Support:** Visual model supports both **Piano/MIDI mode** and **Waveform mode**.
- [ ] **Local Build Passed:** Ran `npm run build` locally with zero TypeScript or Vite errors.
- [ ] **Performance Guaranteed:** Verified smooth 60 FPS playback with zero image instantiation inside the animation loop.
- [ ] **Awaiting Francisco's Review:** I understand only the repository owner (`@FTorresdevai`) has merge permissions into `main`.
