// ═══════════════════════════════════════════════════
// NexusOS — Storage Manager (localStorage)
// ═══════════════════════════════════════════════════
const STORAGE_KEY = 'nexusos_state';

const DEFAULTS = {
  userName: '',
  accentColor: '#0a84ff',
  wallpaperIndex: 0,
  theme: 'dark',
  volume: 80,
  notes: [{ id: 1, title: 'Welcome', content: 'Welcome to NexusOS! 🎉\n\nThis is your first note. Feel free to edit or create new ones.' }],
  desktopIcons: [],
  windowStates: {},
  screensaver: 'particles',
  isSetupDone: false,
  batteryLevel: 99,
};

class StorageManager {
  constructor() {
    this.state = this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
    } catch (e) { /* ignore */ }
    return { ...DEFAULTS };
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) { /* ignore */ }
  }

  get(key) { return this.state[key]; }

  set(key, value) {
    this.state[key] = value;
    this.save();
  }

  isFirstBoot() { return !this.state.isSetupDone; }

  reset() {
    localStorage.removeItem(STORAGE_KEY);
    this.state = { ...DEFAULTS };
  }
}

export const storage = new StorageManager();
