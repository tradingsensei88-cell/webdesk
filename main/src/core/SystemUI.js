// ═══════════════════════════════════════════════════
// NexusOS — Menu Bar, Spotlight, Control Center,
// Notifications, Launchpad, Mission Control
// ═══════════════════════════════════════════════════
import { openWindow, closeWindow, minimizeWindow, getOpenWindows, getFocusedWindowId, showDesktop } from './WindowManager.js';
import { APP_REGISTRY, getApp } from './AppRegistry.js';
import { storage } from './StorageManager.js';
import { sound } from './SoundManager.js';

// ── Menu Bar ────────────────────────────────────── 
let menuOpen = false;
let batteryLevel = 99;
let batteryInterval;

export function initMenuBar() {
  updateClock();
  setInterval(updateClock, 1000);

  batteryLevel = storage.get('batteryLevel') || 99;
  batteryInterval = setInterval(() => {
    batteryLevel = Math.max(1, batteryLevel - 0.05);
    storage.set('batteryLevel', batteryLevel);
    updateBattery();
  }, 3000);
  updateBattery();

  // Apple menu
  document.getElementById('menu-apple').addEventListener('click', (e) => {
    showDropdown(e.currentTarget, [
      { label: 'About NexusOS', action: () => showToast('ℹ️', 'About NexusOS', 'Version 1.0 — Built with ❤️') },
      { label: 'System Preferences...', action: () => openWindow('settings') },
      'divider',
      { label: 'Sleep', action: () => {} },
      { label: 'Restart', action: () => location.reload() },
      { label: 'Shut Down', action: () => { document.body.style.transition = 'opacity 1s'; document.body.style.opacity = '0'; } },
    ]);
  });

  // App menus
  document.querySelectorAll('.menu-item[data-menu]').forEach(item => {
    item.addEventListener('click', (e) => {
      const menu = e.currentTarget.dataset.menu;
      const menus = {
        file: [
          { label: 'New Window', shortcut: '⌘N', action: () => { const wid = getFocusedWindowId(); const w = getOpenWindows().get(wid); if (w) openWindow(w.appId, { allowMultiple: true }); } },
          { label: 'Close Window', shortcut: '⌘W', action: () => { const wid = getFocusedWindowId(); if (wid) closeWindow(wid); } },
          'divider', { label: 'Save', shortcut: '⌘S', disabled: true },
        ],
        edit: [
          { label: 'Undo', shortcut: '⌘Z', disabled: true },
          { label: 'Redo', shortcut: '⌘⇧Z', disabled: true },
          'divider', { label: 'Cut', shortcut: '⌘X', disabled: true },
          { label: 'Copy', shortcut: '⌘C', disabled: true },
          { label: 'Paste', shortcut: '⌘V', disabled: true },
          { label: 'Select All', shortcut: '⌘A', disabled: true },
        ],
        view: [
          { label: 'Show Desktop', shortcut: 'F11', action: () => showDesktop(true) },
          'divider', { label: 'Enter Full Screen', shortcut: '⌘⌃F', disabled: true },
        ],
        window: [
          { label: 'Minimize', shortcut: '⌘M', action: () => { const wid = getFocusedWindowId(); if (wid) minimizeWindow(wid); } },
          { label: 'Zoom', action: () => {} },
          'divider', { label: 'Bring All to Front' },
        ],
        help: [
          { label: 'NexusOS Help', disabled: true },
          { label: 'Keyboard Shortcuts', action: () => showToast('⌨️', 'Shortcuts', '⌘+Space: Spotlight\n⌘+Tab: App Switch\n⌘+W: Close') },
        ],
      };
      showDropdown(e.currentTarget, menus[menu] || []);
    });
  });

  // Control Center
  document.getElementById('menu-control-center').addEventListener('click', toggleControlCenter);

  // Spotlight
  document.getElementById('menu-spotlight').addEventListener('click', toggleSpotlight);

  // Volume
  document.getElementById('menu-volume').addEventListener('click', (e) => {
    e.stopPropagation();
    togglePopover('volume-popover', e.currentTarget);
  });
  document.getElementById('volume-slider').addEventListener('input', (e) => {
    sound.volume = parseInt(e.target.value);
  });

  // Clock → Calendar
  document.getElementById('menu-clock').addEventListener('click', (e) => {
    e.stopPropagation();
    renderCalendar();
    togglePopover('calendar-popover', e.currentTarget);
  });

  // Notification Center
  document.getElementById('menu-notifications').addEventListener('click', toggleNotificationCenter);

  // Close dropdowns on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.menu-dropdown') && !e.target.closest('.menu-item') && !e.target.closest('.menu-icon')) {
      hideDropdown();
    }
    if (!e.target.closest('.context-menu')) {
      document.getElementById('context-menu')?.classList.add('hidden');
    }
    if (!e.target.closest('.popover') && !e.target.closest('.menu-icon')) {
      document.querySelectorAll('.popover').forEach(p => p.classList.add('hidden'));
    }
    if (!e.target.closest('.control-center') && !e.target.closest('#menu-control-center')) {
      document.getElementById('control-center')?.classList.add('hidden');
    }
  });
}

function updateClock() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  document.getElementById('menu-time').textContent = `${h}:${m}`;
}

function updateBattery() {
  const pct = Math.round(batteryLevel);
  const pctEl = document.getElementById('battery-pct');
  const fillEl = document.getElementById('battery-fill');
  if (pctEl) pctEl.textContent = pct + '%';
  if (fillEl) {
    fillEl.style.width = (pct / 100 * 15) + 'px';
    fillEl.style.fill = pct < 20 ? 'var(--danger)' : 'currentColor';
  }
}

function showDropdown(anchor, items) {
  const dd = document.getElementById('menu-dropdown');
  const rect = anchor.getBoundingClientRect();
  dd.style.left = rect.left + 'px';
  dd.style.top = (rect.bottom + 2) + 'px';
  dd.innerHTML = items.map(item => {
    if (item === 'divider') return '<div class="dropdown-divider"></div>';
    return `<div class="dropdown-item${item.disabled ? ' disabled' : ''}" data-idx="${items.indexOf(item)}">
      <span>${item.label}</span>
      ${item.shortcut ? `<span class="shortcut">${item.shortcut}</span>` : ''}
    </div>`;
  }).join('');
  dd.classList.remove('hidden');
  dd.querySelectorAll('.dropdown-item:not(.disabled)').forEach((el, i) => {
    el.addEventListener('click', () => {
      const itemData = items.filter(x => x !== 'divider')[i];
      if (itemData?.action) itemData.action();
      hideDropdown();
    });
  });
  menuOpen = true;
}

function hideDropdown() {
  document.getElementById('menu-dropdown')?.classList.add('hidden');
  menuOpen = false;
}

export function showContextMenu(x, y, items) {
  const cm = document.getElementById('context-menu');
  if (!cm) return;
  cm.style.left = x + 'px';
  cm.style.top = y + 'px';
  cm.innerHTML = items.map(item => {
    if (item === 'divider') return '<div class="ctx-divider"></div>';
    return `<div class="ctx-item${item.disabled ? ' disabled' : ''}" data-idx="${items.indexOf(item)}">
      <span>${item.label}</span>
      ${item.shortcut ? `<span class="shortcut">${item.shortcut}</span>` : ''}
    </div>`;
  }).join('');
  cm.classList.remove('hidden');

  const filteredItems = items.filter(x => x !== 'divider');
  cm.querySelectorAll('.ctx-item:not(.disabled)').forEach((el, i) => {
    el.onclick = (e) => {
      e.stopPropagation();
      const itemData = filteredItems[i];
      if (itemData?.action) itemData.action();
      cm.classList.add('hidden');
    };
  });
}

function togglePopover(id, anchor) {
  const pop = document.getElementById(id);
  if (pop.classList.contains('hidden')) {
    const rect = anchor.getBoundingClientRect();
    pop.style.right = (window.innerWidth - rect.right) + 'px';
    pop.style.top = (rect.bottom + 6) + 'px';
    pop.style.left = 'auto';
    document.querySelectorAll('.popover').forEach(p => p.classList.add('hidden'));
    pop.classList.remove('hidden');
  } else {
    pop.classList.add('hidden');
  }
}

function renderCalendar() {
  const el = document.getElementById('calendar-content');
  const now = new Date();
  const year = now.getFullYear(), month = now.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  let html = `<div class="cal-header"><span>${monthNames[month]} ${year}</span></div><div class="cal-grid">`;
  ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].forEach(d => html += `<div class="cal-day-name">${d}</div>`);
  for (let i = 0; i < firstDay; i++) html += '<div class="cal-day"></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = d === now.getDate() ? ' today' : '';
    html += `<div class="cal-day${isToday}">${d}</div>`;
  }
  html += '</div>';
  el.innerHTML = html;
}

// ── Spotlight ───────────────────────────────────── 
let spotlightOpen = false;

export function toggleSpotlight() {
  const overlay = document.getElementById('spotlight-overlay');
  const input = document.getElementById('spotlight-input');
  if (spotlightOpen) {
    overlay.classList.add('hidden');
    spotlightOpen = false;
    return;
  }
  overlay.classList.remove('hidden');
  spotlightOpen = true;
  input.value = '';
  input.focus();
  document.getElementById('spotlight-results').classList.add('hidden');

  input.oninput = () => {
    const q = input.value.trim().toLowerCase();
    const results = document.getElementById('spotlight-results');
    if (!q) { results.classList.add('hidden'); return; }
    results.classList.remove('hidden');
    let html = '';
    const matchedApps = APP_REGISTRY.filter(a => a.name.toLowerCase().includes(q));
    if (matchedApps.length) {
      html += '<div class="spotlight-category">Applications</div>';
      matchedApps.forEach(a => {
        html += `<div class="spotlight-item" data-app="${a.id}"><span class="si-icon">${a.icon.includes('.') ? `<img src="${a.icon}" style="width:100%;height:100%;object-fit:contain;">` : a.icon}</span><span class="si-name">${a.name}</span></div>`;
      });
    }
    // Calculator
    try {
      const mathResult = Function('"use strict"; return (' + input.value + ')')();
      if (typeof mathResult === 'number' && !isNaN(mathResult)) {
        html += '<div class="spotlight-category">Calculator</div>';
        html += `<div class="spotlight-item"><span class="si-icon">🧮</span><span class="si-name">= ${mathResult}</span></div>`;
      }
    } catch (e) { /* not math */ }
    html += '<div class="spotlight-category">Web Search</div>';
    html += `<div class="spotlight-item" data-search="${q}"><span class="si-icon">🔍</span><span class="si-name">Search Google for "${input.value}"</span></div>`;
    results.innerHTML = html;

    results.querySelectorAll('.spotlight-item[data-app]').forEach(el => {
      el.addEventListener('click', () => { openWindow(el.dataset.app); toggleSpotlight(); });
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const appId = el.dataset.app;
        const app = getApp(appId);
        import('./DockManager.js').then(dm => {
          const menuItems = [
            { label: `Open ${app.name}`, action: () => { openWindow(appId); toggleSpotlight(); } },
            'divider'
          ];
          if (appId !== 'trash') {
            menuItems.push({ label: `Pin to Dock`, action: () => dm.pinApp(appId) });
          }
          showContextMenu(e.clientX, e.clientY, menuItems);
        });
      });
    });
  };

  overlay.addEventListener('click', (e) => { if (e.target === overlay) toggleSpotlight(); });
}

// ── Control Center ──────────────────────────────── 
let ccStates = { wifi: true, bluetooth: true, airdrop: false, darkMode: true };

export function toggleControlCenter() {
  const cc = document.getElementById('control-center');
  if (cc.classList.contains('hidden')) {
    ccStates.darkMode = document.documentElement.dataset.theme === 'dark';
    renderControlCenter();
    cc.classList.remove('hidden');
  } else {
    cc.classList.add('hidden');
  }
}

function renderControlCenter() {
  const cc = document.getElementById('control-center');
  const vol = storage.get('volume') || 80;
  cc.innerHTML = `
    <div class="cc-grid">
      <div class="cc-tile${ccStates.wifi ? ' on' : ''}" data-toggle="wifi"><span class="cc-icon">📶</span><span class="cc-label">Wi-Fi</span></div>
      <div class="cc-tile${ccStates.bluetooth ? ' on' : ''}" data-toggle="bluetooth"><span class="cc-icon">🔵</span><span class="cc-label">Bluetooth</span></div>
      <div class="cc-tile${ccStates.airdrop ? ' on' : ''}" data-toggle="airdrop"><span class="cc-icon">📡</span><span class="cc-label">AirDrop</span></div>
      <div class="cc-tile${ccStates.darkMode ? ' on' : ''}" data-toggle="darkMode"><span class="cc-icon">🌙</span><span class="cc-label">Dark Mode</span></div>
    </div>
    <div class="cc-section">
      <div class="cc-section-title">Brightness</div>
      <div class="slider-row"><span>☀️</span><input type="range" class="slider" min="20" max="100" value="100" id="cc-brightness"><span>🔆</span></div>
    </div>
    <div class="cc-section">
      <div class="cc-section-title">Volume</div>
      <div class="slider-row"><span>🔈</span><input type="range" class="slider" min="0" max="100" value="${vol}" id="cc-volume"><span>🔊</span></div>
    </div>
    <div class="cc-section">
      <div class="cc-tile" data-toggle="dnd"><span class="cc-icon">🌙</span><span class="cc-label">Do Not Disturb</span></div>
    </div>
  `;

  cc.querySelectorAll('.cc-tile[data-toggle]').forEach(tile => {
    tile.addEventListener('click', () => {
      const key = tile.dataset.toggle;
      if (key === 'darkMode') {
        ccStates.darkMode = !ccStates.darkMode;
        document.documentElement.dataset.theme = ccStates.darkMode ? 'dark' : 'light';
        storage.set('theme', ccStates.darkMode ? 'dark' : 'light');
      } else {
        ccStates[key] = !ccStates[key];
      }
      tile.classList.toggle('on');
      sound.dockClick();
    });
  });

  document.getElementById('cc-brightness')?.addEventListener('input', (e) => {
    document.body.style.filter = `brightness(${e.target.value}%)`;
  });
  document.getElementById('cc-volume')?.addEventListener('input', (e) => {
    sound.volume = parseInt(e.target.value);
    const volSlider = document.getElementById('volume-slider');
    if (volSlider) volSlider.value = e.target.value;
  });
}

// ── Notification Center ─────────────────────────── 
let ncOpen = false;
const notifications = [];

export function toggleNotificationCenter() {
  const nc = document.getElementById('notification-center');
  if (ncOpen) { nc.classList.add('hidden'); ncOpen = false; return; }
  ncOpen = true;
  renderNotificationCenter();
  nc.classList.remove('hidden');
}

function renderNotificationCenter() {
  const nc = document.getElementById('notification-center');
  const now = new Date();
  nc.innerHTML = `
    <div class="nc-header"><span class="nc-title">Notification Center</span></div>
    <div class="nc-widget">
      <div style="font-size:28px;font-weight:200;margin-bottom:4px">${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</div>
      <div style="font-size:12px;color:var(--text-secondary)">${now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</div>
    </div>
    <div class="nc-widget">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span style="font-weight:600">Weather</span>
        <span style="font-size:12px;color:var(--text-secondary)">San Francisco</span>
      </div>
      <div style="font-size:36px;font-weight:200">68°F</div>
      <div style="font-size:12px;color:var(--text-secondary);margin-top:2px">Partly Cloudy ⛅</div>
    </div>
    <div class="nc-header"><span class="nc-title" style="font-size:14px">Notifications</span><span class="nc-clear" id="nc-clear-all">Clear All</span></div>
    ${notifications.length ? notifications.map((n, i) => `
      <div class="nc-notif">
        <span class="nn-icon">${n.icon}</span>
        <div class="nn-body"><div class="nn-title">${n.title}</div><div class="nn-text">${n.text}</div></div>
        <span class="nn-close" data-ni="${i}">×</span>
      </div>
    `).join('') : '<div style="text-align:center;padding:20px;color:var(--text-tertiary);font-size:13px">No Notifications</div>'}
  `;

  document.getElementById('nc-clear-all')?.addEventListener('click', () => {
    notifications.length = 0;
    renderNotificationCenter();
  });
  nc.querySelectorAll('.nn-close').forEach(btn => {
    btn.addEventListener('click', () => {
      notifications.splice(parseInt(btn.dataset.ni), 1);
      renderNotificationCenter();
    });
  });
}

// ── Toast Notifications ─────────────────────────── 
export function showToast(icon, title, text, duration = 4000) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <span class="t-icon">${icon}</span>
    <div class="t-body"><div class="t-title">${title}</div><div class="t-text">${text}</div></div>
    <span class="t-close">×</span>
  `;
  container.appendChild(toast);
  sound.notification();
  notifications.push({ icon, title, text, time: new Date() });

  let timer = setTimeout(() => dismiss(), duration);
  toast.addEventListener('mouseenter', () => clearTimeout(timer));
  toast.addEventListener('mouseleave', () => { timer = setTimeout(() => dismiss(), 2000); });
  toast.querySelector('.t-close').addEventListener('click', dismiss);

  function dismiss() {
    clearTimeout(timer);
    toast.classList.add('out');
    setTimeout(() => toast.remove(), 300);
  }
}

// ── Launchpad ───────────────────────────────────── 
let launchpadOpen = false;

export function toggleLaunchpad() {
  const lp = document.getElementById('launchpad-overlay');
  if (launchpadOpen) { lp.classList.add('hidden'); launchpadOpen = false; return; }
  launchpadOpen = true;
  lp.classList.remove('hidden');
  const grid = document.getElementById('launchpad-grid');
  grid.innerHTML = APP_REGISTRY.filter(a => a.id !== 'trash').map(app => `
    <div class="launchpad-item" data-app="${app.id}">
      <div class="lp-icon">${app.icon.includes('.') ? `<img src="${app.icon}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;">` : app.icon}</div>
      <div class="lp-name">${app.name}</div>
    </div>
  `).join('');
  grid.querySelectorAll('.launchpad-item').forEach(item => {
    item.addEventListener('click', () => { openWindow(item.dataset.app); toggleLaunchpad(); });
  });

  const search = document.getElementById('launchpad-search');
  search.value = '';
  search.focus();
  search.oninput = () => {
    const q = search.value.toLowerCase();
    grid.querySelectorAll('.launchpad-item').forEach(item => {
      item.style.display = item.querySelector('.lp-name').textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  };

  lp.addEventListener('click', (e) => { if (e.target === lp) toggleLaunchpad(); });
}

// ── Mission Control ─────────────────────────────── 
let missionControlOpen = false;

export function toggleMissionControl() {
  const mc = document.getElementById('mission-control');
  if (missionControlOpen) { mc.classList.add('hidden'); missionControlOpen = false; return; }
  missionControlOpen = true;
  mc.classList.remove('hidden');

  const wins = [...getOpenWindows().values()].filter(w => !w.minimized);
  if (!wins.length) {
    mc.innerHTML = '<div style="color:var(--text-secondary);font-size:16px;margin:auto">No open windows</div>';
    mc.addEventListener('click', (e) => { if (e.target === mc) toggleMissionControl(); }, { once: true });
    return;
  }

  mc.innerHTML = wins.map(w => {
    const app = getApp(w.appId);
    return `<div class="mc-thumb" data-winid="${w.id}" style="width:240px;height:160px;background:var(--glass-bg);display:flex;flex-direction:column;align-items:center;justify-content:center">
      <div style="font-size:48px;margin-bottom:8px">${app?.icon || '📱'}</div>
      <div class="mc-label">${app?.name || 'Window'}</div>
    </div>`;
  }).join('');

  mc.querySelectorAll('.mc-thumb').forEach(thumb => {
    thumb.addEventListener('click', () => {
      const winId = thumb.dataset.winid;
      import('./WindowManager.js').then(wm => wm.focusWindow(winId));
      toggleMissionControl();
    });
  });
  mc.addEventListener('click', (e) => { if (e.target === mc) toggleMissionControl(); });
}

// ── App Switcher ────────────────────────────────── 
let appSwitcherOpen = false;
let switcherIndex = 0;
const switcherApps = [];

export function showAppSwitcher() {
  const wins = [...getOpenWindows().values()];
  // Unique apps
  const seen = new Set();
  switcherApps.length = 0;
  wins.forEach(w => { if (!seen.has(w.appId)) { seen.add(w.appId); switcherApps.push(w); } });
  if (switcherApps.length < 2) return;
  switcherIndex = 1;
  appSwitcherOpen = true;
  renderAppSwitcher();
}

function renderAppSwitcher() {
  const sw = document.getElementById('app-switcher');
  sw.classList.remove('hidden');
  sw.innerHTML = switcherApps.map((w, i) => {
    const app = getApp(w.appId);
    return `<div class="as-item${i === switcherIndex ? ' active' : ''}"><div class="as-icon">${app?.icon || '📱'}</div><div class="as-name">${app?.name || ''}</div></div>`;
  }).join('');
}

export function cycleAppSwitcher() {
  switcherIndex = (switcherIndex + 1) % switcherApps.length;
  renderAppSwitcher();
}

export function commitAppSwitcher() {
  if (!appSwitcherOpen) return;
  appSwitcherOpen = false;
  document.getElementById('app-switcher').classList.add('hidden');
  const w = switcherApps[switcherIndex];
  if (w) { import('./WindowManager.js').then(wm => wm.focusWindow(w.id)); }
}

export function isAppSwitcherOpen() { return appSwitcherOpen; }
