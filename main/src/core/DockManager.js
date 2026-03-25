import { APP_REGISTRY } from './AppRegistry.js';
import { openWindow, restoreByAppId } from './WindowManager.js';
import { sound } from './SoundManager.js';
import { storage } from './StorageManager.js';

const DEFAULT_DOCK_APPS = [
  'finder', 'terminal', 'browser', 'notes', 'music', 'weather', 'photos', 
  'calculator', 'texteditor', 'editor', 'converter', 'transcripter', 'settings'
];
let dockApps = storage.get('dockApps') || DEFAULT_DOCK_APPS;

export function initDock() {
  const dock = document.getElementById('dock');
  if (!dock) return;

  dock.innerHTML = '';
  dockApps.forEach((appId, i) => {
    const app = APP_REGISTRY.find(a => a.id === appId);
    if (!app) return;
    
    // Add separator every few items for style if original logic is preferred,
    // or just let it be a clean list. The user had specifically placed separators:
    if (i === 3 || i === 7) {
      const sep = document.createElement('div');
      sep.className = 'dock-separator';
      dock.appendChild(sep);
    }

    const item = document.createElement('div');
    item.className = 'dock-item';
    item.dataset.app = appId;
    item.innerHTML = `
      <div class="dock-icon">${app.icon.includes('.') ? `<img src="${app.icon}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;">` : app.icon}</div>
      <div class="dock-dot"></div>
      <div class="dock-tooltip">${app.name}</div>
    `;
    item.addEventListener('click', () => {
      sound.dockClick();
      item.classList.add('bounce');
      setTimeout(() => item.classList.remove('bounce'), 600);
      if (!restoreByAppId(appId)) openWindow(appId);
    });

    // Right-click to unpin
    item.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      import('./SystemUI.js').then(ui => {
        ui.showContextMenu(e.clientX, e.clientY, [
          { label: `Unpin ${app.name}`, action: () => unpinApp(appId) }
        ]);
      });
    });

    dock.appendChild(item);
  });

  // Trash at end
  const sep2 = document.createElement('div');
  sep2.className = 'dock-separator';
  dock.appendChild(sep2);
  const trashItem = document.createElement('div');
  trashItem.className = 'dock-item';
  trashItem.dataset.app = 'trash';
  trashItem.innerHTML = `<div class="dock-icon">🗑️</div><div class="dock-dot"></div><div class="dock-tooltip">Trash</div>`;
  trashItem.addEventListener('click', () => { sound.dockClick(); });
  dock.appendChild(trashItem);
}

export function pinApp(appId) {
  if (dockApps.includes(appId)) return;
  dockApps.push(appId);
  storage.set('dockApps', dockApps);
  initDock();
  sound.notification();
}

export function unpinApp(appId) {
  dockApps = dockApps.filter(id => id !== appId);
  storage.set('dockApps', dockApps);
  initDock();
  sound.dockClick();
}
