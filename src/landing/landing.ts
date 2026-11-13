// Landing page: builds one card per registered mode, starts the hero video, then the live card previews.
// The previews use the app's real render code (./preview.ts), loaded after first paint.
import { MODE_MANIFESTS } from '../modes/registry';

for (const grid of document.querySelectorAll<HTMLElement>('.looks')) {
  for (const m of MODE_MANIFESTS.filter((x) => x.kind === grid.dataset.kind)) {
    const card = document.createElement('a');
    card.className = 'look';
    card.href = `app.html?model=${encodeURIComponent(m.id)}`;
    const thumb = document.createElement('div');
    thumb.className = 'look__thumb';
    const canvas = document.createElement('canvas');
    canvas.dataset.mode = m.id;
    canvas.setAttribute('aria-hidden', 'true');
    thumb.append(canvas);
    const name = document.createElement('h4');
    name.textContent = m.name;
    const text = document.createElement('p');
    text.textContent = m.description;
    card.append(thumb, name, text);
    grid.append(card);
  }
}

// Hero video: the poster paints first; the clip only downloads and plays after load, and never with reduced motion.
const heroVideo = document.querySelector<HTMLVideoElement>('#hero-video');
if (heroVideo && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const toggle = document.querySelector<HTMLButtonElement>('.video-toggle');
  const play = () => {
    heroVideo.preload = 'auto';
    heroVideo.play().then(() => { if (toggle) toggle.hidden = false; }).catch(() => { /* autoplay blocked: poster stays */ });
  };
  // Looping motion needs a way to stop it (WCAG 2.2.2).
  toggle?.addEventListener('click', () => {
    if (heroVideo.paused) heroVideo.play().catch(() => {}); else heroVideo.pause();
    toggle.textContent = heroVideo.paused ? 'Play video' : 'Pause video';
  });
  if (document.readyState === 'complete') play(); else addEventListener('load', play, { once: true });
}

import('./preview').then((p) => p.startPreviews()).catch((err) => console.warn('[landing] previews unavailable', err));
