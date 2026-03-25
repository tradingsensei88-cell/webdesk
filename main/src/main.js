// ═══════════════════════════════════════════════════
// NexusOS — Main Entry Point
// ═══════════════════════════════════════════════════
import './styles/main.css';
import './styles/boot.css';
import './styles/wallpaper.css';
import './styles/shell.css';
import './styles/components.css';
import './styles/apps.css';

import { storage } from './core/StorageManager.js';
import { sound } from './core/SoundManager.js';
import { startBootSequence } from './core/BootSequence.js';
import { initDock } from './core/DockManager.js';
import { openWindow, closeWindow, minimizeWindow, getFocusedWindowId, showDesktop } from './core/WindowManager.js';
import { initMenuBar, toggleSpotlight, toggleLaunchpad, toggleMissionControl, showAppSwitcher, cycleAppSwitcher, commitAppSwitcher, isAppSwitcherOpen, showToast, toggleControlCenter } from './core/SystemUI.js';
import { initDesktop } from './core/DesktopManager.js';
import { initScreensaver } from './core/Screensaver.js';

// Apply saved settings
function applySettings() {
  const theme = storage.get('theme') || 'dark';
  document.documentElement.dataset.theme = theme;

  const accent = storage.get('accentColor');
  if (accent) document.documentElement.style.setProperty('--accent', accent);

  const wpIdx = storage.get('wallpaperIndex') || 0;
  const wpClasses = ['wallpaper-aurora', 'wallpaper-sunset', 'wallpaper-glacier', 'wallpaper-void', 'wallpaper-sonoma', 'wallpaper-neon'];
  const wp = document.getElementById('wallpaper');
  const wpVideo = document.getElementById('wallpaper-video');

  if (wpIdx >= 6) {
    if (wp) wp.style.opacity = '0';
    if (wpVideo) {
      wpVideo.src = `/${wpIdx - 5}.mp4`;
      wpVideo.classList.remove('hidden');
    }
  } else {
    if (wpVideo) wpVideo.classList.add('hidden');
    if (wp) {
      wp.style.opacity = '1';
      wp.className = 'wallpaper ' + (wpClasses[wpIdx] || wpClasses[0]);
    }
  }
}

// Desktop cascade animation
function desktopCascade() {
  const desktop = document.getElementById('desktop');
  desktop.classList.remove('hidden');

  // Unblur wallpaper
  const wp = document.getElementById('wallpaper');
  const wpVideo = document.getElementById('wallpaper-video');
  const bg = (storage.get('wallpaperIndex') || 0) >= 6 ? wpVideo : wp;
  if (bg) {
    bg.style.filter = 'blur(20px)';
    requestAnimationFrame(() => {
      bg.style.transition = 'filter 600ms var(--smooth), opacity 800ms';
      bg.style.filter = 'blur(0)';
    });
  }

  // Dock slide up
  const dock = document.getElementById('dock-wrapper');
  dock.style.transform = 'translateX(-50%) translateY(100%)';
  dock.style.opacity = '0';
  setTimeout(() => {
    dock.style.transition = 'transform 500ms var(--spring), opacity 400ms';
    dock.style.transform = 'translateX(-50%) translateY(0)';
    dock.style.opacity = '1';
  }, 300);

  // Menu bar slide down
  const menubar = document.getElementById('menu-bar');
  menubar.style.transform = 'translateY(-100%)';
  setTimeout(() => {
    menubar.style.transition = 'transform 400ms var(--decelerate)';
    menubar.style.transform = 'translateY(0)';
  }, 200);

  // Desktop icons stagger
  setTimeout(() => {
    document.querySelectorAll('.desktop-icon').forEach((icon, i) => {
      icon.style.opacity = '0';
      icon.style.transform = 'translateY(10px)';
      setTimeout(() => {
        icon.style.transition = 'opacity 300ms, transform 300ms var(--decelerate)';
        icon.style.opacity = '1';
        icon.style.transform = 'translateY(0)';
      }, i * 80);
    });
  }, 400);

  // Welcome notification
  setTimeout(() => {
    const name = storage.get('userName') || 'User';
    showToast('👋', `Welcome back, ${name}!`, 'NexusOS is ready.', 5000);
  }, 1200);
}

// Keyboard shortcuts
const shownShortcuts = new Set();
function initKeyboardShortcuts() {
  let metaDown = false;

  document.addEventListener('keydown', (e) => {
    // Use Ctrl as Cmd on non-Mac
    const cmd = e.metaKey || e.ctrlKey;

    if (e.key === 'Meta' || e.key === 'Control') metaDown = true;

    if (cmd && e.code === 'Space') { e.preventDefault(); toggleSpotlight(); showShortcutHint('⌘+Space', 'Spotlight'); }
    if (cmd && e.key === 'Tab') { e.preventDefault(); if (!isAppSwitcherOpen()) { showAppSwitcher(); showShortcutHint('⌘+Tab', 'App Switcher'); } else cycleAppSwitcher(); }
    if (cmd && e.key === 'w') { e.preventDefault(); const wid = getFocusedWindowId(); if (wid) closeWindow(wid); }
    if (cmd && e.key === 'm') { e.preventDefault(); const wid = getFocusedWindowId(); if (wid) minimizeWindow(wid); }
    if (e.key === 'F3' || (e.ctrlKey && e.key === 'ArrowUp')) { e.preventDefault(); toggleMissionControl(); }
    if (e.key === 'F11') { e.preventDefault(); showDesktop(true); }
    if (e.key === 'Escape') {
      document.getElementById('spotlight-overlay')?.classList.add('hidden');
      document.getElementById('launchpad-overlay')?.classList.add('hidden');
      document.getElementById('mission-control')?.classList.add('hidden');
      document.getElementById('context-menu')?.classList.add('hidden');
    }
  });

  document.addEventListener('keyup', (e) => {
    if ((e.key === 'Meta' || e.key === 'Control') && isAppSwitcherOpen()) { commitAppSwitcher(); }
    if (e.key === 'Meta' || e.key === 'Control') metaDown = false;
  });

  function showShortcutHint(keys, label) {
    if (shownShortcuts.has(keys)) return;
    shownShortcuts.add(keys);
    showToast('⌨️', 'Keyboard Shortcut', `${keys} — ${label}`, 3000);
  }
}

// Context menu
function initContextMenu() {
  const desktop = document.getElementById('desktop');
  desktop.addEventListener('contextmenu', (e) => {
    if (e.target.closest('.app-window') || e.target.closest('.dock') || e.target.closest('.menu-bar')) return;
    e.preventDefault();
    const ctx = document.getElementById('context-menu');
    ctx.style.left = e.clientX + 'px';
    ctx.style.top = e.clientY + 'px';
    ctx.innerHTML = `
      <div class="ctx-item" data-action="new-folder">📁 New Folder</div>
      <div class="ctx-item" data-action="new-doc">📄 New Document</div>
      <div class="ctx-divider"></div>
      <div class="ctx-item" data-action="wallpaper">🖼️ Change Wallpaper</div>
      <div class="ctx-item" data-action="screenshot">📸 Take Screenshot</div>
      <div class="ctx-divider"></div>
      <div class="ctx-item" data-action="settings">⚙️ System Preferences</div>
    `;
    ctx.classList.remove('hidden');

    ctx.querySelectorAll('.ctx-item').forEach(item => {
      item.addEventListener('click', () => {
        const action = item.dataset.action;
        if (action === 'settings' || action === 'wallpaper') openWindow('settings');
        if (action === 'screenshot') showToast('📸', 'Screenshot', 'Screenshot saved to Desktop');
        ctx.classList.add('hidden');
      });
    });
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.context-menu')) document.getElementById('context-menu')?.classList.add('hidden');
  });
}

// Mouse parallax on wallpaper
function initParallax() {
  document.addEventListener('mousemove', (e) => {
    const wp = document.getElementById('wallpaper');
    if (!wp) return;
    const x = (e.clientX / window.innerWidth - 0.5) * 2;
    const y = (e.clientY / window.innerHeight - 0.5) * 2;
    wp.style.transform = `scale(1.02) translate(${x * -0.5}%, ${y * -0.5}%)`;
  });
}

// ── Init ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  applySettings();

  startBootSequence(() => {
    desktopCascade();
    initDock();
    initMenuBar();
    initDesktop();
    initKeyboardShortcuts();
    initContextMenu();
    initParallax();
    initScreensaver();
  });
});
