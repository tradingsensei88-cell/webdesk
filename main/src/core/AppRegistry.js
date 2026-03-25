// ═══════════════════════════════════════════════════
// NexusOS — App Registry
// ═══════════════════════════════════════════════════
export const APP_REGISTRY = [
  { id: 'finder',     name: 'Finder',       icon: '📁', defaultWidth: 720, defaultHeight: 480 },
  { id: 'terminal',   name: 'Terminal',      icon: '⬛', defaultWidth: 640, defaultHeight: 420 },
  { id: 'notes',      name: 'Notes',         icon: '📝', defaultWidth: 600, defaultHeight: 450 },
  { id: 'calculator', name: 'Calculator',    icon: '🧮', defaultWidth: 260, defaultHeight: 380 },
  { id: 'settings',   name: 'Settings',      icon: '⚙️', defaultWidth: 700, defaultHeight: 500 },
  { id: 'browser',    name: 'Safari',        icon: '🌐', defaultWidth: 900, defaultHeight: 600 },
  { id: 'photos',     name: 'Photos',        icon: '🖼️', defaultWidth: 600, defaultHeight: 450 },
  { id: 'weather',    name: 'Weather',       icon: '🌤️', defaultWidth: 380, defaultHeight: 520 },
  { id: 'music',      name: 'Music',         icon: '🎵', defaultWidth: 360, defaultHeight: 560 },
  { id: 'texteditor', name: 'TextEdit',      icon: '📄', defaultWidth: 680, defaultHeight: 500 },
  { id: 'editor',     name: 'Pdftor',       icon: '/logo1.png', defaultWidth: 800, defaultHeight: 600, url: 'https://pdftor-tools.vercel.app' },
  { id: 'converter',  name: 'Converter',     icon: '/logo3.png', defaultWidth: 600, defaultHeight: 450, url: 'https://converter-tools.vercel.app' },
  { id: 'transcripter', name: 'Transcripter', icon: '/logo2.png', defaultWidth: 800, defaultHeight: 600, url: 'https://transcripter-tools.vercel.app' },
  { id: 'trash',      name: 'Trash',         icon: '🗑️', defaultWidth: 400, defaultHeight: 300 },
];

export function getApp(id) {
  return APP_REGISTRY.find(a => a.id === id);
}
