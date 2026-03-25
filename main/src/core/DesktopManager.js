// ═══════════════════════════════════════════════════
// NexusOS — Desktop Manager (icons, selection)
// ═══════════════════════════════════════════════════
import { openWindow } from './WindowManager.js';

const defaultIcons = [
  { id: 'desk-hd', name: 'Macintosh HD', icon: '💾', app: null },
  { id: 'desk-docs', name: 'Documents', icon: '📁', app: 'finder' },
  { id: 'desk-readme', name: 'readme.md', icon: '📄', app: 'texteditor' },
];

export function initDesktop() {
  const container = document.getElementById('desktop-icons');
  if (!container) return;

  container.innerHTML = defaultIcons.map(ic => `
    <div class="desktop-icon" data-id="${ic.id}" data-app="${ic.app || ''}">
      <div class="icon-img">${ic.icon}</div>
      <div class="icon-label">${ic.name}</div>
    </div>
  `).join('');

  // Click to select, double-click to open
  container.querySelectorAll('.desktop-icon').forEach(icon => {
    icon.addEventListener('click', (e) => {
      e.stopPropagation();
      container.querySelectorAll('.desktop-icon').forEach(i => i.classList.remove('selected'));
      icon.classList.add('selected');
    });
    icon.addEventListener('dblclick', () => {
      const appId = icon.dataset.app;
      if (appId) openWindow(appId);
    });
  });

  // Click desktop to deselect
  document.getElementById('desktop').addEventListener('click', (e) => {
    if (!e.target.closest('.desktop-icon') && !e.target.closest('.app-window') && !e.target.closest('.dock') && !e.target.closest('.menu-bar')) {
      container.querySelectorAll('.desktop-icon').forEach(i => i.classList.remove('selected'));
    }
  });

  // Rubber-band selection
  initRubberBand(container);
}

function initRubberBand(container) {
  const desktop = document.getElementById('desktop');
  const rect = document.getElementById('selection-rect');
  let selecting = false, startX, startY;

  desktop.addEventListener('mousedown', (e) => {
    if (e.target.closest('.app-window') || e.target.closest('.dock') || e.target.closest('.menu-bar') || e.target.closest('.desktop-icon') || e.button !== 0) return;
    selecting = true;
    startX = e.clientX;
    startY = e.clientY;
    rect.style.left = startX + 'px';
    rect.style.top = startY + 'px';
    rect.style.width = '0';
    rect.style.height = '0';
  });

  document.addEventListener('mousemove', (e) => {
    if (!selecting) return;
    const x = Math.min(e.clientX, startX);
    const y = Math.min(e.clientY, startY);
    const w = Math.abs(e.clientX - startX);
    const h = Math.abs(e.clientY - startY);
    rect.classList.remove('hidden');
    rect.style.left = x + 'px'; rect.style.top = y + 'px';
    rect.style.width = w + 'px'; rect.style.height = h + 'px';

    // Highlight icons within rect
    const selRect = { x, y, w, h };
    container.querySelectorAll('.desktop-icon').forEach(icon => {
      const ir = icon.getBoundingClientRect();
      const intersects = !(ir.right < selRect.x || ir.left > selRect.x + selRect.w || ir.bottom < selRect.y || ir.top > selRect.y + selRect.h);
      icon.classList.toggle('selected', intersects);
    });
  });

  document.addEventListener('mouseup', () => {
    if (!selecting) return;
    selecting = false;
    rect.classList.add('hidden');
  });
}
