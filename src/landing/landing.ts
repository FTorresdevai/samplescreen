// Landing page behaviour: animated canvas previews, look switcher, filters, mobile menu.
// The previews are lightweight sketches driven by a fixed 4-bar loop, not the real render engine.

type Look = 'linear' | 'circular' | 'aureola' | 'orbital';
interface Palette { bg: string; a: string; b: string; dim: string }
interface Note { start: number; len: number; pitch: number }
interface Region { x: number; y: number; w: number; h: number }

const LOOKS: { id: Look; name: string; pal: Palette }[] = [
  { id: 'linear', name: 'DAW Linear Roll', pal: { bg: '#141113', a: '#e69d45', b: '#d9ecac', dim: '#2e2629' } },
  { id: 'circular', name: 'Polar Sequencer', pal: { bg: '#1a120e', a: '#c25e38', b: '#f3c299', dim: '#33231b' } },
  { id: 'aureola', name: 'Prismatic Aureole', pal: { bg: '#1e131d', a: '#de8ba9', b: '#f2e1e8', dim: '#3a2638' } },
  { id: 'orbital', name: '3D Celestial Orbit', pal: { bg: '#0e121a', a: '#e2ded6', b: '#9cb2c9', dim: '#232b3a' } },
];

const BPM = 92;
const LOOP = 16; // beats
const P_MIN = 46;
const P_MAX = 73;
const CHORDS = [
  { name: 'E min', tones: [52, 55, 59, 64, 67] },
  { name: 'C maj7', tones: [48, 55, 59, 64, 67] },
  { name: 'G maj', tones: [55, 59, 62, 67, 71] },
  { name: 'D sus4', tones: [50, 57, 62, 67, 69] },
];
const ARP = [1, 2, 3, 4, 3, 2, 3, 4];
const NOTES: Note[] = CHORDS.flatMap((chord, bar) => [
  { start: bar * 4, len: 4, pitch: chord.tones[0] },
  ...ARP.map((tone, i) => ({ start: bar * 4 + i * 0.5, len: i % 3 === 0 ? 1 : 0.5, pitch: chord.tones[tone] })),
]);

const TAU = Math.PI * 2;
const kick = (t: number) => Math.exp(-(t % 1) * 5);
const isActive = (n: Note, t: number) => t >= n.start && t < n.start + n.len;
const pitch01 = (p: number) => (p - P_MIN) / (P_MAX - P_MIN);
const spectrum = (i: number, t: number) =>
  (0.5 + 0.5 * Math.sin(i * 0.9 + t * 3.1)) * (0.5 + 0.5 * Math.sin(i * 0.23 - t * 1.3)) * (0.35 + 0.65 * kick(t));

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

// ── Looks ────────────────────────────────────────────────────────────────────

function drawLinear(ctx: CanvasRenderingContext2D, { x, y, w, h }: Region, t: number, pal: Palette) {
  const ppb = w / 8; // pixels per beat
  const headX = x + w * 0.3;
  ctx.lineWidth = Math.max(1, w / 500);
  for (let b = Math.floor(t - 3); b < t + 7; b++) {
    const gx = headX + (b - t) * ppb;
    if (gx < x || gx > x + w) continue;
    ctx.strokeStyle = pal.dim;
    ctx.globalAlpha = b % 4 === 0 ? 1 : 0.45;
    ctx.beginPath();
    ctx.moveTo(gx, y);
    ctx.lineTo(gx, y + h);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const rowH = (h * 0.84) / (P_MAX - P_MIN);
  for (const n of NOTES) {
    for (const shift of [-LOOP, 0, LOOP]) {
      const nx = headX + (n.start + shift - t) * ppb;
      const nw = n.len * ppb - ppb * 0.06;
      if (nx + nw < x || nx > x + w) continue;
      const on = shift === 0 && isActive(n, t);
      ctx.fillStyle = on ? pal.a : nx < headX ? pal.a : pal.b;
      ctx.globalAlpha = on ? 1 : nx < headX ? 0.35 : 0.75;
      rounded(ctx, nx, y + h * 0.92 - pitch01(n.pitch) * h * 0.84, nw, rowH * 1.6, rowH * 0.5);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = pal.b;
  ctx.fillRect(headX - w / 400, y, w / 200, h);
}

function drawCircular(ctx: CanvasRenderingContext2D, { x, y, w, h }: Region, t: number, pal: Palette) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const R = Math.min(w, h) * 0.44;
  ctx.strokeStyle = pal.dim;
  ctx.lineWidth = R * 0.008;
  for (let i = 1; i <= 6; i++) {
    ctx.beginPath();
    ctx.arc(cx, cy, (R * i) / 6, 0, TAU);
    ctx.stroke();
  }
  ctx.lineCap = 'round';
  ctx.lineWidth = R * 0.04;
  for (const n of NOTES) {
    const a0 = (n.start / LOOP) * TAU - Math.PI / 2;
    const a1 = a0 + ((n.len - 0.12) / LOOP) * TAU;
    const on = isActive(n, t);
    ctx.strokeStyle = on ? pal.b : pal.a;
    ctx.globalAlpha = on ? 1 : 0.6;
    ctx.beginPath();
    ctx.arc(cx, cy, R * (0.3 + 0.66 * pitch01(n.pitch)), a0, a1);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const needle = (t / LOOP) * TAU - Math.PI / 2;
  ctx.strokeStyle = pal.b;
  ctx.lineWidth = R * 0.012;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(needle) * R * 1.04, cy + Math.sin(needle) * R * 1.04);
  ctx.stroke();
  ctx.fillStyle = pal.a;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.12 * (1 + 0.25 * kick(t)), 0, TAU);
  ctx.fill();
}

function drawAureola(ctx: CanvasRenderingContext2D, { x, y, w, h }: Region, t: number, pal: Palette) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const R = Math.min(w, h) * 0.46;
  const inner = R * 0.42 * (1 + 0.06 * kick(t));
  ctx.lineCap = 'round';
  ctx.lineWidth = R * 0.022;
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * TAU;
    const len = R * (0.08 + 0.45 * spectrum(i, t));
    ctx.strokeStyle = i % 2 ? pal.a : pal.b;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * inner * 1.12, cy + Math.sin(a) * inner * 1.12);
    ctx.lineTo(cx + Math.cos(a) * (inner * 1.12 + len), cy + Math.sin(a) * (inner * 1.12 + len));
    ctx.stroke();
  }
  // Shockwave on every beat
  ctx.globalAlpha = 1 - (t % 1);
  ctx.strokeStyle = pal.b;
  ctx.lineWidth = R * 0.01;
  ctx.beginPath();
  ctx.arc(cx, cy, inner + (t % 1) * R * 0.6, 0, TAU);
  ctx.stroke();
  // One harmonic ring per sounding note
  ctx.lineWidth = R * 0.014;
  for (const n of NOTES) {
    if (!isActive(n, t)) continue;
    ctx.globalAlpha = 1 - (t - n.start) / n.len;
    ctx.strokeStyle = pal.a;
    ctx.beginPath();
    ctx.arc(cx, cy, inner * (0.25 + 0.7 * pitch01(n.pitch)), 0, TAU);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = pal.b;
  ctx.lineWidth = R * 0.02;
  ctx.beginPath();
  ctx.arc(cx, cy, inner, 0, TAU);
  ctx.stroke();
}

function drawOrbital(ctx: CanvasRenderingContext2D, { x, y, w, h }: Region, t: number, pal: Palette) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const R = Math.min(w, h) * 0.46;
  const tilt = -0.35;
  const moonR = R * 0.3 * (1 + 0.03 * kick(t));
  const orbit = (j: number) => ({ rx: R * (0.56 + 0.2 * j), ry: R * (0.56 + 0.2 * j) * 0.3 });
  const dots = (front: boolean) => {
    for (const n of NOTES) {
      const o = orbit(n.pitch % 3);
      const a = (n.start / LOOP) * TAU + t * 0.4;
      if (Math.sin(a) > 0 !== front) continue;
      const ex = Math.cos(a) * o.rx;
      const ey = Math.sin(a) * o.ry;
      const on = isActive(n, t);
      ctx.fillStyle = on ? pal.a : pal.b;
      ctx.globalAlpha = on ? 1 : 0.55;
      ctx.beginPath();
      ctx.arc(cx + ex * Math.cos(tilt) - ey * Math.sin(tilt), cy + ex * Math.sin(tilt) + ey * Math.cos(tilt), R * (on ? 0.035 : 0.016), 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };
  ctx.strokeStyle = pal.dim;
  ctx.lineWidth = R * 0.008;
  for (let j = 0; j < 3; j++) {
    const o = orbit(j);
    ctx.beginPath();
    ctx.ellipse(cx, cy, o.rx, o.ry, tilt, 0, TAU);
    ctx.stroke();
  }
  dots(false);
  const shade = ctx.createRadialGradient(cx - moonR * 0.4, cy - moonR * 0.4, moonR * 0.1, cx, cy, moonR);
  shade.addColorStop(0, pal.a);
  shade.addColorStop(1, pal.dim);
  ctx.fillStyle = shade;
  ctx.beginPath();
  ctx.arc(cx, cy, moonR, 0, TAU);
  ctx.fill();
  dots(true);
}

const DRAW: Record<Look, typeof drawLinear> = {
  linear: drawLinear,
  circular: drawCircular,
  aureola: drawAureola,
  orbital: drawOrbital,
};

function drawLook(ctx: CanvasRenderingContext2D, look: Look, region: Region, t: number, pal: Palette) {
  ctx.save();
  DRAW[look](ctx, region, t, pal);
  ctx.restore();
}

// ── Phone frame: header, console slot, look slot, bottom bar ─────────────────

function drawConsole(ctx: CanvasRenderingContext2D, { x, y, w, h }: Region, t: number, pal: Palette) {
  ctx.fillStyle = '#221d20';
  rounded(ctx, x, y, w, h, 24);
  ctx.fill();
  // Oscilloscope
  const scope = { x: x + 36, y: y + 36, w: 300, h: 190 };
  ctx.fillStyle = '#0f0d0e';
  rounded(ctx, scope.x, scope.y, scope.w, scope.h, 14);
  ctx.fill();
  ctx.strokeStyle = pal.b;
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (let i = 0; i <= 60; i++) {
    const px = scope.x + 16 + ((scope.w - 32) * i) / 60;
    const py = scope.y + scope.h / 2 + Math.sin(i * 0.42 + t * 6) * Math.sin(i * 0.11) * scope.h * 0.36 * (0.3 + 0.7 * kick(t));
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  // Knobs
  for (let i = 0; i < 10; i++) {
    const kx = x + 430 + (i % 5) * 108;
    const ky = y + 84 + Math.floor(i / 5) * 100;
    const a = -2.2 + spectrum(i * 3, t * 0.25) * 4.4;
    ctx.fillStyle = '#0f0d0e';
    ctx.beginPath();
    ctx.arc(kx, ky, 34, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = pal.a;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(kx, ky);
    ctx.lineTo(kx + Math.sin(a) * 26, ky - Math.cos(a) * 26);
    ctx.stroke();
  }
  // Keyboard C3–C5; keys light up with the notes
  const sounding = new Set(NOTES.filter(n => isActive(n, t)).map(n => n.pitch));
  const keysY = y + 270;
  const keysH = h - 306;
  const whites: number[] = [];
  for (let p = 48; p <= 72; p++) if (![1, 3, 6, 8, 10].includes(p % 12)) whites.push(p);
  const kw = (w - 72) / whites.length;
  whites.forEach((p, i) => {
    ctx.fillStyle = sounding.has(p) ? pal.a : '#f3eddf';
    rounded(ctx, x + 36 + i * kw + 2, keysY, kw - 4, keysH, 6);
    ctx.fill();
  });
  whites.forEach((p, i) => {
    if (![0, 2, 5, 7, 9].includes(p % 12) || p === 72) return;
    ctx.fillStyle = sounding.has(p + 1) ? pal.a : '#141113';
    rounded(ctx, x + 36 + (i + 1) * kw - kw * 0.3, keysY, kw * 0.6, keysH * 0.6, 5);
    ctx.fill();
  });
}

function drawPhone(ctx: CanvasRenderingContext2D, pxW: number, pxH: number, look: Look, t: number, pal: Palette) {
  const s = pxW / 1080;
  const H = pxH / s;
  ctx.setTransform(s, 0, 0, s, 0, 0);
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, 1080, H);

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#f3eddf';
  ctx.font = '600 58px "Space Grotesk", sans-serif';
  ctx.fillText('FEELS THE SAME', 60, 120);
  ctx.font = '400 30px "JetBrains Mono", monospace';
  ctx.fillStyle = pal.b;
  ctx.fillText(`${BPM} BPM · E MIN`, 60, 172);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#a89f91';
  ctx.fillText('@YOUR.HANDLE', 1020, 172);
  ctx.textAlign = 'left';

  drawConsole(ctx, { x: 60, y: 215, w: 960, h: 540 }, t, pal);

  const slotH = Math.max(480, H - 795 - 330);
  const slot = { x: 60, y: 795, w: 960, h: slotH };
  ctx.save();
  rounded(ctx, slot.x, slot.y, slot.w, slot.h, 24);
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  ctx.fill();
  ctx.clip();
  drawLook(ctx, look, slot, t, pal);
  ctx.restore();

  const bar = Math.floor(t / 4);
  const baseY = slot.y + slot.h;
  ctx.fillStyle = '#f3eddf';
  ctx.font = 'italic 400 96px "Instrument Serif", serif';
  ctx.fillText(CHORDS[bar].name, 60, baseY + 130);
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = i === bar ? pal.a : pal.dim;
    rounded(ctx, 60 + i * 246, baseY + 180, 222, 12, 6);
    ctx.fill();
  }
  ctx.font = '400 24px "JetBrains Mono", monospace';
  ctx.fillStyle = '#6b6357';
  ctx.fillText('samplescreen · 1080×1920 @ 60 fps', 60, baseY + 250);
}

// ── Wiring ───────────────────────────────────────────────────────────────────

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const hero = document.querySelector<HTMLCanvasElement>('#hero-canvas')!;
const cardCanvases = [...document.querySelectorAll<HTMLCanvasElement>('canvas[data-look]')];
const visible = new Set<HTMLCanvasElement>([hero, ...cardCanvases]);
let heroLook = 0;

function fit(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const w = Math.round(canvas.clientWidth * dpr);
  const h = Math.round(canvas.clientHeight * dpr);
  if (!w || !h) return null;
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  return canvas.getContext('2d');
}

function render(ms: number) {
  const t = reducedMotion ? 5.3 : ((ms / 1000) * BPM / 60) % LOOP;
  if (visible.has(hero)) {
    const ctx = fit(hero);
    if (ctx) drawPhone(ctx, hero.width, hero.height, LOOKS[heroLook].id, t, LOOKS[heroLook].pal);
  }
  for (const canvas of cardCanvases) {
    if (!visible.has(canvas)) continue;
    const look = LOOKS.find(l => l.id === canvas.dataset.look)!;
    const ctx = fit(canvas);
    if (!ctx) continue;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = look.pal.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawLook(ctx, look.id, { x: 0, y: 0, w: canvas.width, h: canvas.height }, t, look.pal);
  }
}

function loop(ms: number) {
  render(ms);
  requestAnimationFrame(loop);
}

if (reducedMotion) {
  render(0);
  addEventListener('resize', () => render(0));
  document.fonts.ready.then(() => render(0));
} else {
  const io = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (e.isIntersecting) visible.add(e.target as HTMLCanvasElement);
      else visible.delete(e.target as HTMLCanvasElement);
    }
  });
  [hero, ...cardCanvases].forEach(c => io.observe(c));
  requestAnimationFrame(loop);
}

// Hero look switcher
function setLook(step: number) {
  heroLook = (heroLook + step + LOOKS.length) % LOOKS.length;
  document.querySelector('#look-index')!.textContent = String(heroLook + 1).padStart(2, '0');
  document.querySelector('#look-name')!.textContent = LOOKS[heroLook].name;
  if (reducedMotion) render(0);
}
document.querySelector('#look-prev')!.addEventListener('click', () => setLook(-1));
document.querySelector('#look-next')!.addEventListener('click', () => setLook(1));

// Collection filter
const chips = [...document.querySelectorAll<HTMLButtonElement>('.chip')];
chips.forEach(chip =>
  chip.addEventListener('click', () => {
    chips.forEach(c => c.classList.toggle('is-on', c === chip));
    document.querySelectorAll<HTMLElement>('.card').forEach(card => {
      card.hidden = chip.dataset.filter !== 'all' && card.dataset.kind !== chip.dataset.filter;
    });
    if (reducedMotion) render(0);
  }),
);

// Mobile menu
const toggle = document.querySelector<HTMLButtonElement>('.nav__toggle')!;
const menu = document.querySelector<HTMLElement>('#menu')!;
const setMenu = (open: boolean) => {
  menu.classList.toggle('is-open', open);
  toggle.setAttribute('aria-expanded', String(open));
};
toggle.addEventListener('click', () => setMenu(!menu.classList.contains('is-open')));
menu.addEventListener('click', e => {
  if ((e.target as HTMLElement).closest('a')) setMenu(false);
});

// Marquee: duplicate the strip so the -50% slide loops seamlessly
const marquee = document.querySelector<HTMLElement>('#marquee')!;
marquee.innerHTML += marquee.innerHTML;
