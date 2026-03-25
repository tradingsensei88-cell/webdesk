// ═══════════════════════════════════════════════════
// NexusOS — Window Manager
// ═══════════════════════════════════════════════════
import { sound } from './SoundManager.js';
import { getApp } from './AppRegistry.js';
import { storage } from './StorageManager.js';
import { renderApp } from '../apps/index.js';

let zCounter = 100;
const openWindows = new Map(); // id -> { el, appId, state, ... }
let focusedWindowId = null;

// Expose for other modules
export function getOpenWindows() { return openWindows; }
export function getFocusedWindowId() { return focusedWindowId; }

export function openWindow(appId, opts = {}) {
  const app = getApp(appId);
  if (!app) return;
  const existingWin = [...openWindows.values()].find(w => w.appId === appId && !w.minimized);
  if (existingWin && !opts.allowMultiple) { focusWindow(existingWin.id); return existingWin.id; }

  const winId = `win-${appId}-${Date.now()}`;
  const saved = storage.get('windowStates')?.[appId];
  const w = saved?.width || app.defaultWidth;
  const h = saved?.height || app.defaultHeight;
  const x = saved?.x ?? (window.innerWidth / 2 - w / 2 + (openWindows.size % 5) * 24);
  const y = saved?.y ?? (60 + (openWindows.size % 5) * 24);

  const el = document.createElement('div');
  el.className = 'app-window opening';
  el.id = winId;
  el.dataset.appId = appId;
  el.style.cssText = `width:${w}px;height:${h}px;left:${x}px;top:${y}px;z-index:${++zCounter}`;

  el.innerHTML = `
    <div class="titlebar" data-win="${winId}">
      <div class="traffic-lights">
        <div class="traffic-light tl-close" data-action="close" title="Close">×</div>
        <div class="traffic-light tl-maximize" data-action="maximize" title="Maximize">⤢</div>
        <div class="traffic-light tl-minimize" data-action="minimize" title="Minimize">−</div>
      </div>
      <span class="win-title">${app.name}</span>
    </div>
    <div class="win-content" id="content-${winId}"></div>
    <div class="resize-handle n"></div><div class="resize-handle s"></div>
    <div class="resize-handle e"></div><div class="resize-handle w"></div>
    <div class="resize-handle nw"></div><div class="resize-handle ne"></div>
    <div class="resize-handle sw"></div><div class="resize-handle se"></div>
  `;

  document.getElementById('windows-container').appendChild(el);

  const winObj = { id: winId, appId, el, minimized: false, maximized: false, prevBounds: null };
  openWindows.set(winId, winObj);

  // Render app content
  renderApp(appId, document.getElementById(`content-${winId}`), winObj);

  // Bind events
  setupWindowDrag(el, winId);
  setupWindowResize(el, winId);
  setupTrafficLights(el, winId);
  el.addEventListener('mousedown', () => focusWindow(winId));

  focusWindow(winId);
  sound.windowOpen();
  updateDockIndicators();
  updateMenuBarAppName();

  // Remove opening class after anim
  setTimeout(() => el.classList.remove('opening'), 320);

  return winId;
}

export function closeWindow(winId) {
  const win = openWindows.get(winId);
  if (!win) return;
  win.el.classList.add('closing');
  sound.windowClose();
  setTimeout(() => {
    win.el.remove();
    openWindows.delete(winId);
    if (focusedWindowId === winId) {
      focusedWindowId = null;
      const remaining = [...openWindows.values()].filter(w => !w.minimized);
      if (remaining.length) focusWindow(remaining[remaining.length - 1].id);
    }
    updateDockIndicators();
    updateMenuBarAppName();
  }, 200);
}

export function minimizeWindow(winId) {
  const win = openWindows.get(winId);
  if (!win || win.minimized) return;
  // Animate to dock
  const dockItem = document.querySelector(`.dock-item[data-app="${win.appId}"]`);
  if (dockItem) {
    const dockRect = dockItem.getBoundingClientRect();
    const winRect = win.el.getBoundingClientRect();
    const dx = dockRect.left + dockRect.width / 2 - (winRect.left + winRect.width / 2);
    const dy = dockRect.top + dockRect.height / 2 - (winRect.top + winRect.height / 2);
    win.el.style.transition = 'transform 280ms var(--accelerate), opacity 280ms var(--accelerate)';
    win.el.style.transform = `translate(${dx}px, ${dy}px) scale(0.1)`;
    win.el.style.opacity = '0';
  }
  win.minimized = true;
  setTimeout(() => {
    win.el.style.display = 'none';
    win.el.style.transition = '';
    win.el.style.transform = '';
    win.el.style.opacity = '';
  }, 280);
  if (focusedWindowId === winId) {
    focusedWindowId = null;
    const remaining = [...openWindows.values()].filter(w => !w.minimized && w.id !== winId);
    if (remaining.length) focusWindow(remaining[remaining.length - 1].id);
    else updateMenuBarAppName();
  }
}

export function restoreWindow(winId) {
  const win = openWindows.get(winId);
  if (!win || !win.minimized) return;
  win.minimized = false;
  win.el.style.display = '';
  win.el.classList.add('opening');
  focusWindow(winId);
  setTimeout(() => win.el.classList.remove('opening'), 320);
}

export function maximizeWindow(winId) {
  const win = openWindows.get(winId);
  if (!win) return;
  
  win.el.style.transition = 'all 0.35s var(--smooth), z-index 0s';
  
  if (win.maximized) {
    const b = win.prevBounds;
    win.el.style.left = b.x + 'px'; 
    win.el.style.top = b.y + 'px';
    win.el.style.width = b.w + 'px'; 
    win.el.style.height = b.h + 'px';
    win.el.classList.remove('maximized');
    win.maximized = false;
  } else {
    win.prevBounds = { 
      x: win.el.offsetLeft, y: win.el.offsetTop, 
      w: win.el.offsetWidth, h: win.el.offsetHeight 
    };
    win.el.style.left = '0'; 
    win.el.style.top = '28px';
    win.el.style.width = '100%'; 
    win.el.style.height = 'calc(100vh - 28px)';
    win.el.classList.add('maximized');
    win.maximized = true;
  }
  
  setTimeout(() => { if (win.el) win.el.style.transition = ''; }, 360);
}

export function focusWindow(winId) {
  const win = openWindows.get(winId);
  if (!win) return;
  if (win.minimized) { restoreWindow(winId); return; }
  openWindows.forEach((w) => w.el.classList.add('unfocused'));
  win.el.classList.remove('unfocused');
  win.el.style.zIndex = ++zCounter;
  focusedWindowId = winId;
  updateMenuBarAppName();
}

export function shakeWindow(winId) {
  const win = openWindows.get(winId);
  if (!win) return;
  win.el.classList.add('shake');
  sound.error();
  setTimeout(() => win.el.classList.remove('shake'), 400);
}

function setupWindowDrag(el, winId) {
  const titlebar = el.querySelector('.titlebar');
  let startX, startY, origX, origY, dragging = false;
  titlebar.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('traffic-light')) return;
    const win = openWindows.get(winId);
    if (win?.maximized) return;
    dragging = true;
    startX = e.clientX; startY = e.clientY;
    origX = el.offsetLeft; origY = el.offsetTop;
    document.body.style.cursor = 'grabbing';
    e.preventDefault();
  });
  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    el.style.left = (origX + e.clientX - startX) + 'px';
    el.style.top = Math.max(28, origY + e.clientY - startY) + 'px';
  });
  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    document.body.style.cursor = '';
    saveWindowState(winId);
  });
}

function setupWindowResize(el, winId) {
  const handles = el.querySelectorAll('.resize-handle');
  handles.forEach(handle => {
    let startX, startY, origW, origH, origX, origY, dir, resizing = false;
    handle.addEventListener('mousedown', (e) => {
      const win = openWindows.get(winId);
      if (win?.maximized) return;
      resizing = true;
      startX = e.clientX; startY = e.clientY;
      origW = el.offsetWidth; origH = el.offsetHeight;
      origX = el.offsetLeft; origY = el.offsetTop;
      dir = [...handle.classList].find(c => c !== 'resize-handle');
      e.preventDefault(); e.stopPropagation();
    });
    document.addEventListener('mousemove', (e) => {
      if (!resizing) return;
      const dx = e.clientX - startX, dy = e.clientY - startY;
      let nw = origW, nh = origH, nx = origX, ny = origY;
      if (dir.includes('e')) nw = Math.max(300, origW + dx);
      if (dir.includes('w')) { nw = Math.max(300, origW - dx); nx = origX + (origW - nw); }
      if (dir.includes('s')) nh = Math.max(200, origH + dy);
      if (dir.includes('n')) { nh = Math.max(200, origH - dy); ny = origY + (origH - nh); }
      el.style.width = nw + 'px'; el.style.height = nh + 'px';
      el.style.left = nx + 'px'; el.style.top = Math.max(28, ny) + 'px';
    });
    document.addEventListener('mouseup', () => {
      if (!resizing) return;
      resizing = false;
      saveWindowState(winId);
    });
  });
}

function setupTrafficLights(el, winId) {
  el.querySelectorAll('.traffic-light').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = btn.dataset.action;
      if (action === 'close') closeWindow(winId);
      else if (action === 'minimize') minimizeWindow(winId);
      else if (action === 'maximize') maximizeWindow(winId);
    });
  });
}

function saveWindowState(winId) {
  const win = openWindows.get(winId);
  if (!win || win.maximized) return;
  const states = storage.get('windowStates') || {};
  states[win.appId] = {
    x: win.el.offsetLeft, y: win.el.offsetTop,
    width: win.el.offsetWidth, height: win.el.offsetHeight,
  };
  storage.set('windowStates', states);
}

function updateDockIndicators() {
  document.querySelectorAll('.dock-item').forEach(item => {
    const appId = item.dataset.app;
    const running = [...openWindows.values()].some(w => w.appId === appId);
    item.classList.toggle('running', running);
  });
}

export function updateMenuBarAppName() {
  const nameEl = document.getElementById('menu-app-name');
  if (!nameEl) return;
  if (focusedWindowId) {
    const win = openWindows.get(focusedWindowId);
    if (win) { nameEl.textContent = getApp(win.appId)?.name || 'Finder'; return; }
  }
  nameEl.textContent = 'Finder';
}

export function restoreByAppId(appId) {
  const win = [...openWindows.values()].find(w => w.appId === appId);
  if (win) {
    if (win.minimized) restoreWindow(win.id); else focusWindow(win.id);
    return true;
  }
  return false;
}

export function showDesktop(toggle) {
  openWindows.forEach(w => {
    if (toggle) {
      w._wasVisible = !w.minimized;
      if (!w.minimized) { w.el.style.display = 'none'; w.minimized = true; }
    } else if (w._wasVisible) {
      w.minimized = false; w.el.style.display = '';
      w.el.classList.add('opening');
      setTimeout(() => w.el.classList.remove('opening'), 320);
    }
  });
}
