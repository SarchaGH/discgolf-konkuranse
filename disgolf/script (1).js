const arrangement = new Date('2026-09-16T11:30:00+02:00');
const nedtelling = document.querySelector('#nedtelling');

function oppdaterNedtelling() {
  const igjen = arrangement - new Date();
  if (igjen <= 0) {
    nedtelling.textContent = 'Konkurransen er i gang!';
    return;
  }
  const dager = Math.floor(igjen / 86400000);
  const timer = Math.floor((igjen % 86400000) / 3600000);
  const minutter = Math.floor((igjen % 3600000) / 60000);
  const sekunder = Math.floor((igjen % 60000) / 1000);
  nedtelling.textContent = `${dager} d ${timer} t ${minutter} min ${sekunder} sek`;
}
oppdaterNedtelling();
setInterval(oppdaterNedtelling, 1000);

/* ===================== MINIBANE-SPILLET ===================== */

const lerret = document.querySelector('#spill-lerret');
const ctx = lerret.getContext('2d');
const startKnapp = document.querySelector('#spill-start');
const status = document.querySelector('#spill-status');
const elHull = document.querySelector('#spill-hull');
const elPar = document.querySelector('#spill-par');
const elKast = document.querySelector('#spill-kast');
const elVind = document.querySelector('#spill-vind');
const elVindPil = document.querySelector('#spill-vind-pil');

const HULLER = [
  { navn: 'Hull 1', par: 2, kurvX: 0.86, harVind: false, tre: null },
  { navn: 'Hull 2', par: 3, kurvX: 0.92, harVind: true, tre: { x: 0.46, hoyde: 0.40, radius: 0.055 } },
  { navn: 'Hull 3', par: 3, kurvX: 0.95, harVind: true, tre: { x: 0.58, hoyde: 0.42, radius: 0.05 } },
];
const MAKS_VIND_ANDEL = 0.07; // andel av bredden, som akselerasjon

let BREDDE = 0, HOYDE = 0, bakkeY = 0, discStartX = 0, discStartY = 0, discRadius = 0, maksDrag = 0, fangRadius = 0;
let TYNGDEKRAFT = 0, MAKS_HASTIGHET = 0;

function oppdaterGeometri() {
  const rekt = lerret.getBoundingClientRect();
  BREDDE = rekt.width;
  HOYDE = rekt.height;
  const dpr = window.devicePixelRatio || 1;
  lerret.width = Math.max(1, Math.round(BREDDE * dpr));
  lerret.height = Math.max(1, Math.round(HOYDE * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  bakkeY = HOYDE * 0.8;
  discStartX = BREDDE * 0.07;
  discStartY = bakkeY - HOYDE * 0.14;
  discRadius = Math.max(7, HOYDE * 0.045);
  maksDrag = HOYDE * 0.95;
  fangRadius = Math.max(20, BREDDE * 0.035);
  TYNGDEKRAFT = BREDDE * 1.05;
  MAKS_HASTIGHET = BREDDE * 1.0;
}

function treGeometri(hull) {
  if (!hull.tre) return null;
  return { x: hull.tre.x * BREDDE, y: bakkeY - hull.tre.hoyde * HOYDE, r: hull.tre.radius * BREDDE };
}

let spillPagar = false;
let aktivtHull = 0;
let kastPaHull = 0;
let kastPerHull = [];
let vind = 0;
let iFlukt = false;
let drar = false;
let dragNaa = { x: 0, y: 0 };
let treffTreFlagg = false;
const disc = { x: 0, y: 0, vx: 0, vy: 0, rotasjon: 0 };
let partikler = [];

function settNyVind() {
  const hull = HULLER[aktivtHull];
  vind = hull.harVind ? (Math.random() * 2 - 1) * BREDDE * MAKS_VIND_ANDEL : 0;
  const styrke = Math.abs(vind) / BREDDE * 100;
  elVind.textContent = hull.harVind ? `${styrke.toFixed(0)} km/t` : 'stille';
  elVindPil.style.transform = vind < 0 ? 'scaleX(-1)' : 'scaleX(1)';
  elVindPil.style.opacity = hull.harVind ? '1' : '.35';
}

function plasserDiscVedStart() {
  disc.x = discStartX;
  disc.y = discStartY;
  disc.vx = 0;
  disc.vy = 0;
  disc.rotasjon = 0;
  iFlukt = false;
}

function oppdaterHullVisning() {
  const hull = HULLER[aktivtHull];
  elHull.textContent = aktivtHull + 1;
  elPar.textContent = hull.par;
  elKast.textContent = kastPaHull;
}

startKnapp.addEventListener('click', () => {
  aktivtHull = 0;
  kastPaHull = 0;
  kastPerHull = [];
  partikler = [];
  spillPagar = true;
  startKnapp.textContent = 'Spiller …';
  startKnapp.disabled = true;
  oppdaterGeometri();
  oppdaterHullVisning();
  settNyVind();
  plasserDiscVedStart();
  status.textContent = 'Dra disken bakover og slipp for å kaste!';
});

function tilbakestillEtterKast() {
  plasserDiscVedStart();
  settNyVind();
}

function nesteHullEllerSlutt() {
  if (aktivtHull < HULLER.length - 1) {
    aktivtHull += 1;
    kastPaHull = 0;
    oppdaterHullVisning();
    tilbakestillEtterKast();
    status.textContent = 'Kast!';
  } else {
    spillPagar = false;
    const sumKast = kastPerHull.reduce((a, b) => a + b, 0);
    const sumPar = HULLER.reduce((a, h) => a + h.par, 0);
    const diff = sumKast - sumPar;
    let vurdering;
    if (diff <= 0) vurdering = `${Math.abs(diff)} under par — sterkt kastet!`;
    else vurdering = `${diff} over par.`;
    status.textContent = `Runde ferdig! ${sumKast} kast på ${HULLER.length} hull (par ${sumPar}) — ${vurdering}`;
    startKnapp.textContent = 'Spill igjen';
    startKnapp.disabled = false;
  }
}

function skyPartikler(x, y) {
  const farger = ['#b9cf4a', '#ee963e', '#f5f1e7', '#2d6842'];
  for (let i = 0; i < 22; i++) {
    const vinkel = Math.random() * Math.PI * 2;
    const fart = 40 + Math.random() * 130;
    partikler.push({
      x, y,
      vx: Math.cos(vinkel) * fart,
      vy: Math.sin(vinkel) * fart - 60,
      liv: 1,
      farge: farger[i % farger.length],
      storrelse: 3 + Math.random() * 4,
    });
  }
}

function landet() {
  iFlukt = false;
  kastPaHull += 1;
  elKast.textContent = kastPaHull;
  const hull = HULLER[aktivtHull];
  const kurvXAbs = hull.kurvX * BREDDE;
  const iKurven = !treffTreFlagg && Math.abs(disc.x - kurvXAbs) < fangRadius;

  if (iKurven) {
    kastPerHull[aktivtHull] = kastPaHull;
    const meldinger = ['I kurven! ★', 'Perfekt kast! ★', 'Rett i mål! ★'];
    status.textContent = `${meldinger[Math.floor(Math.random() * meldinger.length)]} ${kastPaHull} kast på ${hull.navn.toLowerCase()} (par ${hull.par}).`;
    skyPartikler(kurvXAbs, bakkeY - HOYDE * 0.12);
    setTimeout(nesteHullEllerSlutt, 1300);
  } else {
    status.textContent = treffTreFlagg ? 'Rett i treet — prøv igjen.' : 'Utenfor banen — prøv igjen.';
    treffTreFlagg = false;
    setTimeout(tilbakestillEtterKast, 650);
  }
}

function oppdaterFysikk(dt) {
  disc.vy += TYNGDEKRAFT * dt;
  disc.vx += vind * dt;
  disc.x += disc.vx * dt;
  disc.y += disc.vy * dt;
  disc.rotasjon += disc.vx * dt * 0.012;

  const tre = treGeometri(HULLER[aktivtHull]);
  if (tre) {
    const dx = disc.x - tre.x, dy = disc.y - tre.y;
    const avstand = Math.hypot(dx, dy);
    const grense = tre.r + discRadius * 0.6;
    if (avstand < grense) {
      const ux = dx / (avstand || 1), uy = dy / (avstand || 1);
      disc.x = tre.x + ux * grense;
      disc.y = tre.y + uy * grense;
      disc.vx *= 0.15;
      disc.vy = Math.abs(disc.vy) * 0.2 + 35;
      treffTreFlagg = true;
    }
  }

  if (disc.y + discRadius >= bakkeY) {
    disc.y = bakkeY - discRadius;
    landet();
    return;
  }
  if (disc.x > BREDDE + 60 || disc.x < -60) {
    disc.y = bakkeY - discRadius;
    landet();
  }
}

function kastMedVektor(vx, vy) {
  const lengde = Math.hypot(vx, vy);
  if (lengde < 10) return;
  const kraftAndel = Math.min(1, lengde / maksDrag);
  const retningX = -vx / lengde;
  const retningY = -vy / lengde;
  const hastighet = kraftAndel * MAKS_HASTIGHET;
  disc.vx = retningX * hastighet;
  disc.vy = retningY * hastighet;
  treffTreFlagg = false;
  iFlukt = true;
  status.textContent = 'I luften …';
}

/* --- Dra-og-slipp med mus/touch/penn --- */
function hentPeker(e) {
  const rekt = lerret.getBoundingClientRect();
  return { x: e.clientX - rekt.left, y: e.clientY - rekt.top };
}

lerret.addEventListener('pointerdown', (e) => {
  if (!spillPagar || iFlukt) return;
  const p = hentPeker(e);
  if (Math.hypot(p.x - disc.x, p.y - disc.y) > Math.max(discRadius * 4.5, 36)) return;
  drar = true;
  dragNaa = { x: disc.x, y: disc.y };
  lerret.setPointerCapture(e.pointerId);
});

lerret.addEventListener('pointermove', (e) => {
  if (!drar) return;
  const p = hentPeker(e);
  let vx = p.x - disc.x, vy = p.y - disc.y;
  const lengde = Math.hypot(vx, vy);
  if (lengde > maksDrag) {
    vx = (vx / lengde) * maksDrag;
    vy = (vy / lengde) * maksDrag;
  }
  dragNaa = { x: disc.x + vx, y: disc.y + vy };
});

function avsluttDrag() {
  if (!drar) return;
  drar = false;
  kastMedVektor(dragNaa.x - disc.x, dragNaa.y - disc.y);
}
lerret.addEventListener('pointerup', avsluttDrag);
lerret.addEventListener('pointercancel', avsluttDrag);

lerret.addEventListener('keydown', (e) => {
  if (e.key !== ' ' && e.key !== 'Enter') return;
  e.preventDefault();
  if (!spillPagar || iFlukt) return;
  kastMedVektor(-maksDrag * 0.62, maksDrag * 0.62);
});

/* --- Tegning --- */
function tegnBane() {
  const himmel = ctx.createLinearGradient(0, 0, 0, bakkeY);
  himmel.addColorStop(0, '#8fc3d9');
  himmel.addColorStop(1, '#bfdfc0');
  ctx.fillStyle = himmel;
  ctx.fillRect(0, 0, BREDDE, bakkeY);

  const bakke = ctx.createLinearGradient(0, bakkeY, 0, HOYDE);
  bakke.addColorStop(0, '#6fa446');
  bakke.addColorStop(1, '#4f7d34');
  ctx.fillStyle = bakke;
  ctx.fillRect(0, bakkeY, BREDDE, HOYDE - bakkeY);

  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = '#3d6a2a';
  ctx.lineWidth = Math.max(2, HOYDE * 0.02);
  for (let x = -HOYDE; x < BREDDE + HOYDE; x += HOYDE * 0.22) {
    ctx.beginPath();
    ctx.moveTo(x, bakkeY);
    ctx.lineTo(x + HOYDE * 0.6, HOYDE);
    ctx.stroke();
  }
  ctx.restore();
}

function tegnTre(hull) {
  const tre = treGeometri(hull);
  if (!tre) return;
  ctx.fillStyle = '#5c3c26';
  ctx.fillRect(tre.x - tre.r * 0.13, tre.y, tre.r * 0.26, bakkeY - tre.y);
  ctx.beginPath();
  ctx.fillStyle = '#284f2f';
  ctx.arc(tre.x, tre.y, tre.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.fillStyle = 'rgba(255,255,255,.08)';
  ctx.arc(tre.x - tre.r * 0.3, tre.y - tre.r * 0.3, tre.r * 0.45, 0, Math.PI * 2);
  ctx.fill();
}

function tegnKurv(hull) {
  const x = hull.kurvX * BREDDE;
  const stangTopp = bakkeY - HOYDE * 0.3;
  ctx.strokeStyle = '#98a396';
  ctx.lineWidth = Math.max(2, HOYDE * 0.018);
  ctx.beginPath();
  ctx.moveTo(x, bakkeY);
  ctx.lineTo(x, stangTopp);
  ctx.stroke();

  ctx.strokeStyle = '#c7cdb8';
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(x, stangTopp + HOYDE * 0.02);
    ctx.lineTo(x + i * HOYDE * 0.028, stangTopp + HOYDE * 0.18);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.fillStyle = '#e2a531';
  ctx.strokeStyle = '#c98a22';
  ctx.lineWidth = Math.max(2, HOYDE * 0.02);
  ctx.ellipse(x, stangTopp, HOYDE * 0.13, HOYDE * 0.035, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.strokeStyle = '#c98a22';
  ctx.lineWidth = Math.max(2, HOYDE * 0.014);
  ctx.ellipse(x, stangTopp + HOYDE * 0.08, HOYDE * 0.1, HOYDE * 0.05, 0, Math.PI, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.fillStyle = 'rgba(20,40,25,.35)';
  ctx.ellipse(x, bakkeY + HOYDE * 0.01, HOYDE * 0.14, HOYDE * 0.03, 0, 0, Math.PI * 2);
  ctx.fill();
}

function tegnDisc() {
  ctx.save();
  ctx.translate(disc.x, disc.y);
  ctx.rotate(disc.rotasjon);
  ctx.beginPath();
  ctx.fillStyle = '#ee963e';
  ctx.strokeStyle = '#e85f31';
  ctx.lineWidth = Math.max(2, discRadius * 0.32);
  ctx.ellipse(0, 0, discRadius, discRadius * 0.38, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function tegnSiktelinje() {
  if (!drar) return;
  const vx = dragNaa.x - disc.x, vy = dragNaa.y - disc.y;
  ctx.save();
  ctx.setLineDash([6, 7]);
  ctx.strokeStyle = 'rgba(20,40,25,.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(disc.x, disc.y);
  ctx.lineTo(dragNaa.x, dragNaa.y);
  ctx.stroke();
  ctx.restore();

  let x = disc.x, y = disc.y;
  let simVx = (-vx / (Math.hypot(vx, vy) || 1)) * (Math.min(1, Math.hypot(vx, vy) / maksDrag) * MAKS_HASTIGHET);
  let simVy = (-vy / (Math.hypot(vx, vy) || 1)) * (Math.min(1, Math.hypot(vx, vy) / maksDrag) * MAKS_HASTIGHET);
  const dt = 1 / 40;
  const tre = treGeometri(HULLER[aktivtHull]);
  ctx.fillStyle = 'rgba(20,40,25,.55)';
  for (let i = 0; i < 34; i++) {
    simVy += TYNGDEKRAFT * dt;
    x += simVx * dt;
    y += simVy * dt;
    if (tre && Math.hypot(x - tre.x, y - tre.y) < tre.r) break;
    if (y > bakkeY || x > BREDDE || x < 0) break;
    if (i % 2 === 0) {
      ctx.beginPath();
      ctx.arc(x, y, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function tegnPartikler(dt) {
  partikler = partikler.filter((p) => p.liv > 0);
  for (const p of partikler) {
    p.vy += 260 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.liv -= dt * 0.8;
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.liv);
    ctx.fillStyle = p.farge;
    ctx.fillRect(p.x - p.storrelse / 2, p.y - p.storrelse / 2, p.storrelse, p.storrelse);
    ctx.restore();
  }
}

function tegn(dt) {
  ctx.clearRect(0, 0, BREDDE, HOYDE);
  tegnBane();
  const hull = HULLER[aktivtHull];
  tegnKurv(hull);
  tegnTre(hull);
  if (spillPagar) {
    tegnSiktelinje();
    tegnDisc();
  }
  tegnPartikler(dt);
}

let sisteTid = 0;
function ramme(t) {
  const dt = sisteTid ? Math.min((t - sisteTid) / 1000, 0.032) : 0;
  sisteTid = t;
  if (spillPagar && iFlukt) oppdaterFysikk(dt);
  tegn(dt);
  requestAnimationFrame(ramme);
}

let endringstimer;
function haandterVindusendring() {
  clearTimeout(endringstimer);
  endringstimer = setTimeout(() => {
    oppdaterGeometri();
    if (spillPagar && !iFlukt) plasserDiscVedStart();
  }, 150);
}
window.addEventListener('resize', haandterVindusendring);

oppdaterGeometri();
oppdaterHullVisning();
plasserDiscVedStart();
requestAnimationFrame(ramme);
