// ═══════════════════════════════════════════════════
// NexusOS — Screensaver
// ═══════════════════════════════════════════════════
import { storage } from './StorageManager.js';

let idleTimer;
let screensaverActive = false;
let lockTimeout;
const IDLE_MS = 60000;    // 60 seconds
const LOCK_MS = 300000;   // 5 minutes

export function initScreensaver() {
  resetIdleTimer();
  ['mousemove', 'keydown', 'mousedown', 'touchstart'].forEach(evt => {
    document.addEventListener(evt, () => {
      if (screensaverActive) dismissScreensaver();
      resetIdleTimer();
    });
  });
}

function resetIdleTimer() {
  clearTimeout(idleTimer);
  clearTimeout(lockTimeout);
  idleTimer = setTimeout(activateScreensaver, IDLE_MS);
}

function activateScreensaver() {
  screensaverActive = true;
  const ss = document.getElementById('screensaver');
  const canvas = document.getElementById('screensaver-canvas');
  const clockEl = document.getElementById('screensaver-clock');
  ss.classList.remove('hidden');

  const type = storage.get('screensaver') || 'particles';

  if (type === 'particles') {
    renderParticles(canvas);
    clockEl.classList.add('hidden');
  } else if (type === 'clock') {
    canvas.style.display = 'none';
    clockEl.classList.remove('hidden');
    animateFloatingClock(clockEl);
  } else {
    renderGradient(canvas);
    clockEl.classList.add('hidden');
  }

  // Lock after 5 min
  lockTimeout = setTimeout(() => {
    // Show lock screen
    dismissScreensaver();
    document.getElementById('lock-screen').classList.remove('hidden');
  }, LOCK_MS);
}

function dismissScreensaver() {
  screensaverActive = false;
  const ss = document.getElementById('screensaver');
  ss.style.opacity = '0';
  setTimeout(() => {
    ss.classList.add('hidden');
    ss.style.opacity = '';
  }, 500);
}

function renderParticles(canvas) {
  canvas.style.display = 'block';
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles = Array.from({ length: 150 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    vx: (Math.random() - 0.5) * 0.5,
    vy: (Math.random() - 0.5) * 0.5,
    r: Math.random() * 2 + 1,
  }));

  let animId;
  function draw() {
    if (!screensaverActive) { cancelAnimationFrame(animId); return; }
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
      if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fill();
    });

    // Lines
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 100) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(255,255,255,${0.15 * (1 - dist / 100)})`;
          ctx.stroke();
        }
      }
    }
    animId = requestAnimationFrame(draw);
  }
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  draw();
}

function renderGradient(canvas) {
  canvas.style.display = 'block';
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  let t = 0;
  let animId;

  function draw() {
    if (!screensaverActive) { cancelAnimationFrame(animId); return; }
    t += 0.005;
    const grad = ctx.createLinearGradient(
      canvas.width * (0.5 + 0.5 * Math.sin(t)),
      canvas.height * (0.5 + 0.5 * Math.cos(t * 0.7)),
      canvas.width * (0.5 + 0.5 * Math.cos(t * 1.3)),
      canvas.height * (0.5 + 0.5 * Math.sin(t * 0.9))
    );
    grad.addColorStop(0, `hsl(${t * 20 % 360}, 70%, 25%)`);
    grad.addColorStop(0.5, `hsl(${(t * 20 + 120) % 360}, 60%, 30%)`);
    grad.addColorStop(1, `hsl(${(t * 20 + 240) % 360}, 70%, 20%)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    animId = requestAnimationFrame(draw);
  }
  draw();
}

function animateFloatingClock(el) {
  let x = window.innerWidth / 2 - 100, y = window.innerHeight / 2 - 30;
  let vx = 1, vy = 0.7;

  function tick() {
    if (!screensaverActive) return;
    const now = new Date();
    el.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    x += vx; y += vy;
    if (x < 0 || x > window.innerWidth - 250) vx *= -1;
    if (y < 0 || y > window.innerHeight - 80) vy *= -1;
    el.style.left = x + 'px'; el.style.top = y + 'px';
    requestAnimationFrame(tick);
  }
  tick();
}
