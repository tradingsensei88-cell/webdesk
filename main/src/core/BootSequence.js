// ═══════════════════════════════════════════════════
// NexusOS — Boot Sequence, Lock Screen, Setup
// ═══════════════════════════════════════════════════
import { storage } from './StorageManager.js';
import { sound } from './SoundManager.js';

export function startBootSequence(onComplete) {
  const bootScreen = document.getElementById('boot-screen');
  const lockScreen = document.getElementById('lock-screen');
  const setupWizard = document.getElementById('setup-wizard');

  // Phase 1: Boot screen for 2.5s
  setTimeout(() => {
    bootScreen.style.transition = 'opacity 400ms';
    bootScreen.style.opacity = '0';
    setTimeout(() => {
      bootScreen.classList.add('hidden');

      if (storage.isFirstBoot()) {
        showSetupWizard(setupWizard, () => showLockScreen(lockScreen, onComplete));
      } else {
        showLockScreen(lockScreen, onComplete);
      }
    }, 400);
  }, 2500);
}

function showSetupWizard(wizard, onDone) {
  wizard.classList.remove('hidden');
  const step1 = document.getElementById('setup-step-1');
  const step2 = document.getElementById('setup-step-2');
  const nameInput = document.getElementById('setup-name');
  const colorsEl = document.getElementById('setup-colors');
  const wallpapersEl = document.getElementById('setup-wallpapers');

  let selectedColor = '#0a84ff';
  let selectedWallpaper = 0;

  // Accent color selection
  colorsEl.addEventListener('click', (e) => {
    const swatch = e.target.closest('.color-swatch');
    if (!swatch) return;
    colorsEl.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
    swatch.classList.add('active');
    selectedColor = swatch.dataset.color;
    document.documentElement.style.setProperty('--accent', selectedColor);
  });

  // Step 1 → Step 2
  document.getElementById('setup-next-1').addEventListener('click', () => {
    const name = nameInput.value.trim() || 'Admin';
    storage.set('userName', name);
    storage.set('accentColor', selectedColor);
    step1.classList.add('hidden');
    step2.classList.remove('hidden');
  });

  // Wallpaper selection
  wallpapersEl.addEventListener('click', (e) => {
    const thumb = e.target.closest('.wallpaper-thumb');
    if (!thumb) return;
    wallpapersEl.querySelectorAll('.wallpaper-thumb').forEach(t => t.classList.remove('active'));
    thumb.classList.add('active');
    selectedWallpaper = parseInt(thumb.dataset.wallpaper);
  });

  // Finish setup
  document.getElementById('setup-finish').addEventListener('click', () => {
    storage.set('wallpaperIndex', selectedWallpaper);
    storage.set('isSetupDone', true);
    wizard.style.transition = 'opacity 400ms';
    wizard.style.opacity = '0';
    setTimeout(() => { wizard.classList.add('hidden'); onDone(); }, 400);
  });
}

function showLockScreen(lockScreen, onComplete) {
  lockScreen.classList.remove('hidden');
  updateLockTime();
  const timeInterval = setInterval(updateLockTime, 1000);

  const lockContent = lockScreen.querySelector('.lock-content');
  const lockLogin = document.getElementById('lock-login');
  const lockUsername = document.getElementById('lock-username');
  const lockPassword = document.getElementById('lock-password');
  const lockSubmit = document.getElementById('lock-submit');

  lockUsername.textContent = storage.get('userName') || 'Admin';

  lockContent.addEventListener('click', () => {
    lockContent.classList.add('hidden');
    lockLogin.classList.remove('hidden');
    lockPassword.focus();
  });

  function doLogin() {
    clearInterval(timeInterval);
    lockLogin.style.transition = 'transform 300ms var(--accelerate), opacity 300ms';
    lockLogin.style.transform = 'scale(0.9)';
    lockLogin.style.opacity = '0';
    sound.loginSuccess();

    setTimeout(() => {
      lockScreen.style.transition = 'opacity 500ms';
      lockScreen.style.opacity = '0';
      setTimeout(() => {
        lockScreen.classList.add('hidden');
        onComplete();
      }, 500);
    }, 300);
  }

  lockSubmit.addEventListener('click', doLogin);
  lockPassword.addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
}

function updateLockTime() {
  const now = new Date();
  const timeEl = document.getElementById('lock-time');
  const dateEl = document.getElementById('lock-date');
  if (timeEl) timeEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  if (dateEl) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    dateEl.textContent = `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}`;
  }
}
