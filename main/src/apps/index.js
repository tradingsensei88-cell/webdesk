// ═══════════════════════════════════════════════════
// NexusOS — App Content Renderers
// ═══════════════════════════════════════════════════
import { storage } from '../core/StorageManager.js';
import { sound } from '../core/SoundManager.js';
import { openWindow } from '../core/WindowManager.js';
import { getApp } from '../core/AppRegistry.js';

export function renderApp(appId, container, winObj) {
  const renderers = { 
    finder: renderFinder, terminal: renderTerminal, notes: renderNotes,
    calculator: renderCalculator, settings: renderSettings, browser: renderBrowser,
    photos: renderPhotos, weather: renderWeather, music: renderMusic, texteditor: renderTextEditor,
    editor: renderIframeApp, converter: renderIframeApp, transcripter: renderIframeApp
  };
  const render = renderers[appId];
  if (render) render(container, winObj, appId);
  else container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-secondary)">App not implemented</div>`;
}

function renderIframeApp(el, winObj, appId) {
  const app = getApp(appId);
  if (!app || !app.url) {
    el.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text-secondary)">App configuration missing</div>`;
    return;
  }
  el.innerHTML = `<iframe src="${app.url}" style="width:100%;height:100%;border:none" sandbox="allow-same-origin allow-scripts allow-forms allow-downloads allow-popups allow-popups-to-escape-sandbox"></iframe>`;
}

// ── Finder ─────────────────────────────────────── 
function renderFinder(el) {
  const fileSystem = {
    'Desktop': [
      { name: 'Documents', type: 'folder', icon: '📁' },
      { name: 'Photos', type: 'folder', icon: '📁' },
      { name: 'readme.md', type: 'file', icon: '📄', size: '2.4 KB' },
      { name: 'notes.txt', type: 'file', icon: '📄', size: '1.1 KB' },
    ],
    'Documents': [
      { name: 'Resume.pdf', type: 'file', icon: '📕', size: '340 KB' },
      { name: 'Project', type: 'folder', icon: '📁' },
      { name: 'budget.xlsx', type: 'file', icon: '📊', size: '45 KB' },
    ],
    'Downloads': [
      { name: 'image.png', type: 'file', icon: '🖼️', size: '1.2 MB' },
      { name: 'setup.dmg', type: 'file', icon: '💿', size: '52 MB' },
      { name: 'song.mp3', type: 'file', icon: '🎵', size: '4.8 MB' },
    ],
    'Applications': [
      { name: 'Terminal.app', type: 'app', icon: '⬛' },
      { name: 'Notes.app', type: 'app', icon: '📝' },
      { name: 'Calculator.app', type: 'app', icon: '🧮' },
      { name: 'Safari.app', type: 'app', icon: '🌐' },
      { name: 'Editor.app', type: 'app', icon: '📝' },
      { name: 'Converter.app', type: 'app', icon: '🔄' },
      { name: 'Transcripter.app', type: 'app', icon: '🎤' },
    ],
  };
  let currentDir = 'Desktop';
  let viewMode = 'grid';

  function render() {
    const files = fileSystem[currentDir] || [];
    el.innerHTML = `<div class="finder-app">
      <div class="finder-sidebar">
        <div class="fs-section">Favorites</div>
        ${['Desktop', 'Documents', 'Downloads', 'Applications'].map(d =>
      `<div class="fs-item${d === currentDir ? ' active' : ''}" data-dir="${d}"><span class="fsi-icon">📁</span>${d}</div>`
    ).join('')}
      </div>
      <div class="finder-main">
        <div class="finder-toolbar">
          <button class="toolbar-btn${viewMode === 'grid' ? ' active' : ''}" data-view="grid">☷</button>
          <button class="toolbar-btn${viewMode === 'list' ? ' active' : ''}" data-view="list">☰</button>
        </div>
        <div class="finder-content ${viewMode}">
          ${viewMode === 'grid'
      ? files.map(f => `<div class="finder-file" data-name="${f.name}" data-type="${f.type}"><div class="ff-icon">${f.icon}</div><div class="ff-name">${f.name}</div></div>`).join('')
      : files.map(f => `<div class="finder-list-item" data-name="${f.name}" data-type="${f.type}"><span>${f.icon}</span><span style="flex:1">${f.name}</span><span style="font-size:11px;color:var(--text-secondary)">${f.size || '--'}</span></div>`).join('')
    }
        </div>
        <div class="finder-breadcrumb">📁 ${currentDir} — ${files.length} items</div>
      </div>
    </div>`;

    el.querySelectorAll('.fs-item').forEach(item => {
      item.addEventListener('click', () => { currentDir = item.dataset.dir; render(); });
    });
    el.querySelectorAll('[data-view]').forEach(btn => {
      btn.addEventListener('click', () => { viewMode = btn.dataset.view; render(); });
    });
    el.querySelectorAll('.finder-file, .finder-list-item').forEach(file => {
      file.addEventListener('click', () => {
        el.querySelectorAll('.finder-file, .finder-list-item').forEach(f => f.classList.remove('selected'));
        file.classList.add('selected');
      });
      file.addEventListener('dblclick', () => {
        if (file.dataset.type === 'folder' && fileSystem[file.dataset.name]) {
          currentDir = file.dataset.name; render();
        }
      });
    });
  }
  render();
}

// ── Terminal ───────────────────────────────────── 
function renderTerminal(el) {
  let history = [];
  let histIdx = -1;
  let cwd = '~';
  const user = storage.get('userName') || 'admin';

  const termFS = {
    '~': ['Documents', 'Desktop', 'Downloads', '.bashrc'],
    '~/Documents': ['resume.pdf', 'notes.txt', 'project'],
    '~/Desktop': ['screenshot.png'],
    '~/Downloads': ['file.zip', 'image.jpg'],
  };

  el.innerHTML = `<div class="terminal-app">
    <div class="term-tabs"><div class="term-tab active"><span>Terminal</span><span class="tab-close">×</span></div><div class="term-tab-add">+</div></div>
    <div class="term-output" id="term-out-${el.id}"></div>
    <div class="term-input-line">
      <span class="prompt-text" id="term-prompt-${el.id}">${user}@nexusos <span class="path">${cwd}</span> %</span>
      <input class="term-input" id="term-input-${el.id}" autofocus spellcheck="false">
    </div>
  </div>`;

  const output = el.querySelector(`#term-out-${el.id}`);
  const input = el.querySelector(`#term-input-${el.id}`);
  const promptEl = el.querySelector(`#term-prompt-${el.id}`);

  function print(text, cls = '') {
    const line = document.createElement('div');
    if (cls) line.className = cls;
    line.textContent = text;
    output.appendChild(line);
    output.scrollTop = output.scrollHeight;
  }

  function printHTML(html) {
    const d = document.createElement('div');
    d.innerHTML = html;
    output.appendChild(d);
    output.scrollTop = output.scrollHeight;
  }

  print(`NexusOS Terminal v1.0 — Type 'help' for commands.\n`);

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const cmd = input.value.trim();
      input.value = '';
      if (cmd) { history.push(cmd); histIdx = history.length; }
      printHTML(`<span class="prompt">${user}@nexusos</span> <span class="path">${cwd}</span> % ${cmd}`);
      execCommand(cmd);
    } else if (e.key === 'ArrowUp') {
      if (histIdx > 0) { histIdx--; input.value = history[histIdx]; }
    } else if (e.key === 'ArrowDown') {
      if (histIdx < history.length - 1) { histIdx++; input.value = history[histIdx]; }
      else { histIdx = history.length; input.value = ''; }
    }
  });

  // Focus on click
  el.addEventListener('click', () => input.focus());

  function execCommand(cmd) {
    const parts = cmd.split(/\s+/);
    const c = parts[0].toLowerCase();
    const arg = parts.slice(1).join(' ');

    switch (c) {
      case 'help':
        print('Available commands: ls, pwd, cd, echo, date, clear, neofetch, whoami, uname, cat, history, open, help');
        break;
      case 'ls':
        const files = termFS[cwd] || [];
        print(files.join('  ') || '(empty)');
        break;
      case 'pwd': print(cwd.replace('~', '/Users/' + user)); break;
      case 'cd':
        if (!arg || arg === '~') { cwd = '~'; }
        else if (arg === '..') { cwd = cwd.includes('/') ? cwd.substring(0, cwd.lastIndexOf('/')) || '~' : '~'; }
        else {
          const newPath = cwd === '~' ? '~/' + arg : cwd + '/' + arg;
          if (termFS[newPath]) cwd = newPath;
          else print(`cd: no such directory: ${arg}`, 'error');
        }
        promptEl.innerHTML = `${user}@nexusos <span class="path">${cwd}</span> %`;
        break;
      case 'echo': print(arg); break;
      case 'date': print(new Date().toString()); break;
      case 'clear': output.innerHTML = ''; break;
      case 'whoami': print(user); break;
      case 'uname': print('NexusOS 1.0.0 Darwin Kernel Version 23.0.0'); break;
      case 'cat':
        if (arg === '.bashrc') print('export PATH="/usr/local/bin:$PATH"\nalias ll="ls -la"');
        else if (arg) print(`cat: ${arg}: No such file or directory`, 'error');
        break;
      case 'history': history.forEach((h, i) => print(`  ${i + 1}  ${h}`)); break;
      case 'neofetch':
        printHTML(`<pre style="color:#32d74b">
   ████████   ${user}@nexusos
  ██      ██  ──────────────
  ██  ▓▓  ██  OS: NexusOS 1.0
  ██      ██  Host: Browser
   ████████   Kernel: Web
    ██  ██    Uptime: ${Math.floor(performance.now() / 60000)} mins
     ████     Shell: nexush
              Terminal: NexusTerm
              CPU: JavaScript V8
              Memory: ${navigator.deviceMemory || '8'}GB
</pre>`);
        break;
      case 'open':
        if (arg) { openWindow(arg.toLowerCase()); print(`Opening ${arg}...`); }
        else print('Usage: open <appname>', 'error');
        break;
      default:
        print(`nexush: command not found: ${c}`, 'error');
    }
  }
}

// ── Notes ──────────────────────────────────────── 
function renderNotes(el) {
  let notes = storage.get('notes') || [{ id: 1, title: 'Welcome', content: 'Welcome to NexusOS!' }];
  let activeId = notes[0]?.id;

  function render() {
    const active = notes.find(n => n.id === activeId) || notes[0];
    el.innerHTML = `<div class="notes-app">
      <div class="notes-sidebar">
        <div class="notes-sidebar-header"><span class="ns-title">Notes</span><span class="ns-add" id="note-add">+</span></div>
        <div class="notes-list">${notes.map(n => `
          <div class="note-item${n.id === activeId ? ' active' : ''}" data-id="${n.id}">
            <div class="ni-title">${n.title || 'Untitled'}</div>
            <div class="ni-preview">${(n.content || '').substring(0, 40)}</div>
          </div>`).join('')}
        </div>
      </div>
      <div class="notes-editor">
        <textarea id="note-textarea" placeholder="Start typing...">${active?.content || ''}</textarea>
      </div>
    </div>`;

    el.querySelector('#note-add').addEventListener('click', () => {
      const newNote = { id: Date.now(), title: 'New Note', content: '' };
      notes.unshift(newNote);
      activeId = newNote.id;
      saveNotes();
      render();
    });

    el.querySelectorAll('.note-item').forEach(item => {
      item.addEventListener('click', () => { activeId = parseInt(item.dataset.id); render(); });
    });

    const textarea = el.querySelector('#note-textarea');
    textarea?.addEventListener('input', () => {
      if (active) {
        active.content = textarea.value;
        active.title = textarea.value.split('\n')[0].substring(0, 30) || 'Untitled';
        saveNotes();
      }
    });
    textarea?.focus();
  }

  function saveNotes() { storage.set('notes', notes); }
  render();
}

// ── Calculator ─────────────────────────────────── 
function renderCalculator(el) {
  let display = '0';
  let prev = null;
  let op = null;
  let fresh = true;

  function render() {
    el.innerHTML = `<div class="calc-app">
      <div class="calc-display">${display}</div>
      <div class="calc-buttons">
        <button class="calc-btn fn" data-a="clear">AC</button>
        <button class="calc-btn fn" data-a="negate">±</button>
        <button class="calc-btn fn" data-a="percent">%</button>
        <button class="calc-btn op" data-a="÷">÷</button>
        <button class="calc-btn" data-a="7">7</button>
        <button class="calc-btn" data-a="8">8</button>
        <button class="calc-btn" data-a="9">9</button>
        <button class="calc-btn op" data-a="×">×</button>
        <button class="calc-btn" data-a="4">4</button>
        <button class="calc-btn" data-a="5">5</button>
        <button class="calc-btn" data-a="6">6</button>
        <button class="calc-btn op" data-a="-">−</button>
        <button class="calc-btn" data-a="1">1</button>
        <button class="calc-btn" data-a="2">2</button>
        <button class="calc-btn" data-a="3">3</button>
        <button class="calc-btn op" data-a="+">+</button>
        <button class="calc-btn zero" data-a="0">0</button>
        <button class="calc-btn" data-a=".">.</button>
        <button class="calc-btn op" data-a="=">=</button>
      </div>
    </div>`;
    el.querySelectorAll('.calc-btn').forEach(btn => {
      btn.addEventListener('click', () => handleCalc(btn.dataset.a));
    });
  }

  function handleCalc(a) {
    if (a >= '0' && a <= '9') {
      if (fresh) { display = a; fresh = false; }
      else display = display === '0' ? a : display + a;
    } else if (a === '.') {
      if (!display.includes('.')) display += '.';
      fresh = false;
    } else if (a === 'clear') {
      display = '0'; prev = null; op = null; fresh = true;
    } else if (a === 'negate') {
      display = String(-parseFloat(display));
    } else if (a === 'percent') {
      display = String(parseFloat(display) / 100);
    } else if (a === '=') {
      if (prev !== null && op) {
        display = String(calc(prev, parseFloat(display), op));
        prev = null; op = null;
      }
      fresh = true;
    } else {
      if (prev !== null && op && !fresh) {
        display = String(calc(prev, parseFloat(display), op));
      }
      prev = parseFloat(display); op = a; fresh = true;
    }
    render();
  }

  function calc(a, b, o) {
    if (o === '+') return a + b;
    if (o === '-' || o === '−') return a - b;
    if (o === '×') return a * b;
    if (o === '÷') return b !== 0 ? a / b : 'Error';
    return b;
  }

  render();
}

// ── Settings ───────────────────────────────────── 
function renderSettings(el) {
  let activeSection = 'general';
  const sections = [
    { id: 'general', icon: '⚙️', name: 'General' },
    { id: 'appearance', icon: '🎨', name: 'Appearance' },
    { id: 'wallpaper', icon: '🖼️', name: 'Wallpaper' },
    { id: 'screensaver', icon: '💻', name: 'Screen Saver' },
    { id: 'notifications', icon: '🔔', name: 'Notifications' },
    { id: 'users', icon: '👤', name: 'Users & Groups' },
  ];

  function render() {
    el.innerHTML = `<div class="settings-app">
      <div class="settings-sidebar">${sections.map(s =>
      `<div class="settings-item${s.id === activeSection ? ' active' : ''}" data-s="${s.id}"><span class="si-icon">${s.icon}</span>${s.name}</div>`
    ).join('')}</div>
      <div class="settings-content" id="settings-pane"></div>
    </div>`;
    renderPane();
    el.querySelectorAll('.settings-item').forEach(item => {
      item.addEventListener('click', () => { activeSection = item.dataset.s; render(); });
    });
  }

  function renderPane() {
    const pane = el.querySelector('#settings-pane');
    const theme = document.documentElement.dataset.theme;
    const accent = storage.get('accentColor') || '#0a84ff';
    const wpIdx = storage.get('wallpaperIndex') || 0;
    const wpNames = ['Aurora', 'Sunset Dunes', 'Glacier', 'Void', 'Sonoma Hills', 'Neon City', 'Video 1', 'Video 2', 'Video 3', 'Video 4'];
    const colors = ['#0a84ff', '#bf5af2', '#ff375f', '#ff9f0a', '#30d158', '#64d2ff', '#ffd60a', '#ac8e68'];

    const panes = {
      general: `<h2>General</h2>
        <div class="settings-row"><span class="sr-label">User Name</span><span>${storage.get('userName') || 'Admin'}</span></div>
        <div class="settings-row"><span class="sr-label">Version</span><span>NexusOS 1.0.0</span></div>`,
      appearance: `<h2>Appearance</h2>
        <div class="settings-group">
          <label>Theme</label>
          <div class="settings-row"><span class="sr-label">Dark Mode</span><div class="toggle${theme === 'dark' ? ' on' : ''}" id="toggle-dark"></div></div>
        </div>
        <div class="settings-group">
          <label>Accent Color</label>
          <div class="accent-swatches">${colors.map(c =>
        `<button class="color-swatch${c === accent ? ' active' : ''}" data-color="${c}" style="background:${c}"></button>`
      ).join('')}</div>
        </div>`,
      wallpaper: `<h2>Wallpaper</h2>
        <div class="setup-wallpapers">${wpNames.map((name, i) =>
        `<div class="wallpaper-thumb${i === wpIdx ? ' active' : ''}" data-wallpaper="${i}">
           <div class="wp-preview ${i < 6 ? 'wp-' + ['aurora', 'sunset', 'glacier', 'void', 'sonoma', 'neon'][i] : ''}" ${i >= 6 ? 'style="background:#222;color:#fff;display:flex;align-items:center;justify-content:center;font-size:24px"' : ''}>${i >= 6 ? '▶️' : ''}</div>
           <span>${name}</span>
         </div>`
      ).join('')}</div>`,
      screensaver: `<h2>Screen Saver</h2>
        <div class="settings-row"><span class="sr-label">Style</span><span>${storage.get('screensaver') || 'particles'}</span></div>
        <div class="settings-row"><span class="sr-label">Activate after</span><span>60 seconds</span></div>`,
      notifications: `<h2>Notifications</h2>
        <div class="settings-row"><span class="sr-label">Allow Notifications</span><div class="toggle on" id="toggle-notif"></div></div>`,
      users: `<h2>Users & Groups</h2>
        <div style="display:flex;align-items:center;gap:16px;margin-top:12px">
          <div style="width:64px;height:64px;border-radius:50%;background:var(--hover-bg);display:flex;align-items:center;justify-content:center;font-size:28px">👤</div>
          <div><div style="font-size:16px;font-weight:600">${storage.get('userName') || 'Admin'}</div><div style="font-size:12px;color:var(--text-secondary)">Administrator</div></div>
        </div>`,
    };
    pane.innerHTML = panes[activeSection] || '';

    // Dark mode toggle
    pane.querySelector('#toggle-dark')?.addEventListener('click', function () {
      this.classList.toggle('on');
      const isDark = this.classList.contains('on');
      document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
      storage.set('theme', isDark ? 'dark' : 'light');
    });

    // Accent color
    pane.querySelectorAll('.color-swatch').forEach(swatch => {
      swatch.addEventListener('click', () => {
        pane.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
        const color = swatch.dataset.color;
        document.documentElement.style.setProperty('--accent', color);
        storage.set('accentColor', color);
      });
    });

    // Wallpaper
    pane.querySelectorAll('.wallpaper-thumb').forEach(thumb => {
      thumb.addEventListener('click', () => {
        pane.querySelectorAll('.wallpaper-thumb').forEach(t => t.classList.remove('active'));
        thumb.classList.add('active');
        const idx = parseInt(thumb.dataset.wallpaper);
        storage.set('wallpaperIndex', idx);
        setWallpaper(idx);
      });
    });
  }

  render();
}

function setWallpaper(idx) {
  const classes = ['wallpaper-aurora', 'wallpaper-sunset', 'wallpaper-glacier', 'wallpaper-void', 'wallpaper-sonoma', 'wallpaper-neon'];
  const wp = document.getElementById('wallpaper');
  const wpVideo = document.getElementById('wallpaper-video');
  const canvas = document.getElementById('wallpaper-canvas');

  if (idx >= 6) {
    if (wp) wp.style.opacity = '0';
    if (canvas) canvas.style.display = 'none';
    if (wpVideo) {
      wpVideo.src = `/${idx - 5}.mp4`;
      wpVideo.classList.remove('hidden');
    }
  } else {
    if (wpVideo) wpVideo.classList.add('hidden');
    if (wp) {
      wp.style.opacity = '0';
      setTimeout(() => {
        wp.className = 'wallpaper ' + (classes[idx] || classes[0]);
        wp.style.opacity = '1';
      }, 400);
    }
    if (idx === 3) initVoidCanvas(canvas);
    else if (canvas) { canvas.style.display = 'none'; }
  }
}

function initVoidCanvas(canvas) {
  canvas.style.display = 'block';
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const stars = Array.from({ length: 200 }, () => ({
    x: Math.random() * canvas.width, y: Math.random() * canvas.height,
    r: Math.random() * 1.5 + 0.3, speed: Math.random() * 0.3 + 0.05,
    alpha: Math.random()
  }));
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    stars.forEach(s => {
      s.alpha += (Math.random() - 0.5) * 0.02;
      s.alpha = Math.max(0.1, Math.min(1, s.alpha));
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${s.alpha})`;
      ctx.fill();
      s.y += s.speed;
      if (s.y > canvas.height) { s.y = 0; s.x = Math.random() * canvas.width; }
    });
    requestAnimationFrame(draw);
  }
  draw();
}

// ── Browser ────────────────────────────────────── 
function renderBrowser(el) {
  el.innerHTML = `<div class="browser-app">
    <div class="browser-toolbar">
      <button class="browser-nav-btn" id="br-back">←</button>
      <button class="browser-nav-btn" id="br-fwd">→</button>
      <button class="browser-nav-btn" id="br-reload">↻</button>
      <input class="browser-url" id="br-url" value="https://www.example.com" placeholder="Search or enter URL">
      <button class="browser-nav-btn" id="br-go">→</button>
    </div>
    <div class="browser-view" id="br-view">
      <div style="padding:40px;text-align:center;color:#333">
        <h1 style="font-size:32px;margin-bottom:8px">NexusBrowse</h1>
        <p style="color:#666">Enter a URL and press Enter to browse.</p>
        <p style="color:#999;font-size:12px;margin-top:8px">Note: Most websites block iframe embedding due to security policies.</p>
      </div>
    </div>
  </div>`;
  const urlInput = el.querySelector('#br-url');
  const view = el.querySelector('#br-view');
  function navigate() {
    let url = urlInput.value.trim();
    if (!url.startsWith('http')) url = 'https://' + url;
    urlInput.value = url;
    view.innerHTML = `<iframe src="${url}" sandbox="allow-same-origin allow-scripts allow-forms"></iframe>`;
  }
  el.querySelector('#br-go').addEventListener('click', navigate);
  urlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') navigate(); });
  el.querySelector('#br-reload').addEventListener('click', navigate);
}

// ── Photos ─────────────────────────────────────── 
function renderPhotos(el) {
  const photos = [
    { gradient: 'linear-gradient(135deg, #667eea, #764ba2)', label: 'Mountain Sunset' },
    { gradient: 'linear-gradient(135deg, #f093fb, #f5576c)', label: 'Cherry Blossoms' },
    { gradient: 'linear-gradient(135deg, #4facfe, #00f2fe)', label: 'Ocean Waves' },
    { gradient: 'linear-gradient(135deg, #43e97b, #38f9d7)', label: 'Forest Trail' },
    { gradient: 'linear-gradient(135deg, #fa709a, #fee140)', label: 'Desert Dunes' },
  ];
  let idx = 0;
  function render() {
    el.innerHTML = `<div class="photo-app">
      <div class="photo-img" style="width:80%;height:80%;border-radius:8px;background:${photos[idx].gradient};display:flex;align-items:center;justify-content:center;font-size:48px;color:rgba(255,255,255,0.3)">📷</div>
      <button class="photo-nav prev">‹</button>
      <button class="photo-nav next">›</button>
      <div class="photo-counter">${photos[idx].label} — ${idx + 1}/${photos.length}</div>
    </div>`;
    el.querySelector('.prev').addEventListener('click', () => { idx = (idx - 1 + photos.length) % photos.length; render(); });
    el.querySelector('.next').addEventListener('click', () => { idx = (idx + 1) % photos.length; render(); });
  }
  render();
}

// ── Weather ────────────────────────────────────── 
function renderWeather(el) {
  const hours = Array.from({ length: 12 }, (_, i) => {
    const h = (new Date().getHours() + i) % 24;
    return { time: `${h}:00`, temp: Math.round(60 + Math.random() * 15), icon: ['☀️', '⛅', '🌤️', '☁️'][Math.floor(Math.random() * 4)] };
  });
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => ({
    day: d, low: Math.round(52 + Math.random() * 8), high: Math.round(68 + Math.random() * 12),
    icon: ['☀️', '⛅', '🌧️', '⛈️', '🌤️'][Math.floor(Math.random() * 5)]
  }));

  el.innerHTML = `<div class="weather-app" style="background:linear-gradient(180deg,#2a5298 0%,#1e3c72 100%)">
    <div class="weather-hero">
      <div class="weather-icon-anim">☀️</div>
      <div class="weather-temp">68°</div>
      <div class="weather-condition">Mostly Sunny</div>
      <div class="weather-city">San Francisco, CA</div>
    </div>
    <div class="weather-hourly">${hours.map(h => `
      <div class="weather-hour"><div class="wh-time">${h.time}</div><div class="wh-icon">${h.icon}</div><div class="wh-temp">${h.temp}°</div></div>
    `).join('')}</div>
    <div class="weather-daily">${days.map(d => `
      <div class="wd-row">
        <div class="wd-day">${d.day}</div>
        <div class="wd-icon">${d.icon}</div>
        <div class="wd-range">
          <div class="wd-low">${d.low}°</div>
          <div class="wd-bar"><div class="wd-bar-fill" style="left:${(d.low - 50) / 40 * 100}%;width:${(d.high - d.low) / 40 * 100}%"></div></div>
          <div class="wd-high">${d.high}°</div>
        </div>
      </div>
    `).join('')}</div>
  </div>`;
}

// ── Music ──────────────────────────────────────── 
function renderMusic(el) {
  const tracks = [
    { title: 'Digital Dreams', artist: 'NexusBeats', dur: '3:45' },
    { title: 'Midnight Protocol', artist: 'CyberWave', dur: '4:12' },
    { title: 'Neon Horizon', artist: 'SynthPulse', dur: '3:28' },
    { title: 'Cloud Architecture', artist: 'DataFlow', dur: '5:01' },
    { title: 'Binary Sunset', artist: 'PixelDrift', dur: '3:56' },
  ];
  let playing = false, currentTrack = 0, progress = 0;
  let interval;
  const arts = [
    'linear-gradient(135deg, #667eea, #764ba2)',
    'linear-gradient(135deg, #f093fb, #f5576c)',
    'linear-gradient(135deg, #4facfe, #00f2fe)',
    'linear-gradient(135deg, #43e97b, #38f9d7)',
    'linear-gradient(135deg, #fa709a, #fee140)',
  ];

  function render() {
    el.innerHTML = `<div class="music-app">
      <div class="music-art${playing ? ' playing' : ''}" style="background:${arts[currentTrack]}">🎵</div>
      <div class="music-info"><div class="mi-title">${tracks[currentTrack].title}</div><div class="mi-artist">${tracks[currentTrack].artist}</div></div>
      <div class="music-progress">
        <div class="mp-bar"><div class="mp-fill" style="width:${progress}%"></div></div>
        <div class="mp-times"><span>${formatTime(progress * 2.4)}</span><span>${tracks[currentTrack].dur}</span></div>
      </div>
      <div class="music-controls">
        <button class="music-btn" id="m-prev">⏮</button>
        <button class="music-btn play-btn" id="m-play">${playing ? '⏸' : '▶'}</button>
        <button class="music-btn" id="m-next">⏭</button>
      </div>
      <div class="music-visualizer" id="music-viz">${Array.from({ length: 24 }, () =>
      `<div class="bar" style="height:${playing ? Math.random() * 20 + 4 : 4}px"></div>`
    ).join('')}</div>
      <div class="music-playlist">${tracks.map((t, i) => `
        <div class="music-track${i === currentTrack ? ' active' : ''}" data-idx="${i}">
          <span class="mt-num">${i + 1}</span>
          <div class="mt-info"><div class="mt-title">${t.title}</div><div class="mt-artist">${t.artist}</div></div>
          <span class="mt-dur">${t.dur}</span>
        </div>`).join('')}
      </div>
    </div>`;

    el.querySelector('#m-play').addEventListener('click', () => { playing = !playing; togglePlayback(); render(); });
    el.querySelector('#m-prev').addEventListener('click', () => { currentTrack = (currentTrack - 1 + tracks.length) % tracks.length; progress = 0; render(); });
    el.querySelector('#m-next').addEventListener('click', () => { currentTrack = (currentTrack + 1) % tracks.length; progress = 0; render(); });
    el.querySelectorAll('.music-track').forEach(track => {
      track.addEventListener('click', () => { currentTrack = parseInt(track.dataset.idx); progress = 0; playing = true; togglePlayback(); render(); });
    });
  }

  function togglePlayback() {
    clearInterval(interval);
    if (playing) {
      interval = setInterval(() => {
        progress = Math.min(100, progress + 0.5);
        const fill = el.querySelector('.mp-fill');
        if (fill) fill.style.width = progress + '%';
        const timeEl = el.querySelector('.mp-times span');
        if (timeEl) timeEl.textContent = formatTime(progress * 2.4);
        // Visualizer
        el.querySelectorAll('.music-visualizer .bar').forEach(bar => {
          bar.style.height = (Math.random() * 20 + 4) + 'px';
        });
        if (progress >= 100) { currentTrack = (currentTrack + 1) % tracks.length; progress = 0; render(); }
      }, 200);
    }
  }

  function formatTime(secs) {
    const m = Math.floor(secs / 60), s = Math.floor(secs % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  render();
}

// ── Text Editor ────────────────────────────────── 
function renderTextEditor(el) {
  let content = '// Welcome to TextEdit\n// Start coding here...\n\nfunction hello() {\n  console.log("Hello, NexusOS!");\n}\n\nhello();\n';
  let showFind = false;

  function render() {
    const lines = content.split('\n');
    el.innerHTML = `<div class="editor-app">
      <div class="editor-toolbar">
        <button class="toolbar-btn" id="ed-new">New</button>
        <button class="toolbar-btn" id="ed-save">💾 Save</button>
        <button class="toolbar-btn" id="ed-find">🔍 Find</button>
      </div>
      ${showFind ? `<div class="editor-find">
        <input type="text" id="ed-find-input" placeholder="Find...">
        <input type="text" id="ed-replace-input" placeholder="Replace...">
        <button class="toolbar-btn" id="ed-find-close">×</button>
      </div>` : ''}
      <div class="editor-body">
        <div class="editor-gutter">${lines.map((_, i) => i + 1).join('\n')}</div>
        <textarea class="editor-textarea" id="ed-textarea" spellcheck="false">${content}</textarea>
      </div>
      <div class="editor-status">
        <span>Ln ${lines.length}, Col 1</span>
        <span>${wordCount(content)} words</span>
      </div>
    </div>`;

    const textarea = el.querySelector('#ed-textarea');
    textarea.addEventListener('input', () => {
      content = textarea.value;
      el.querySelector('.editor-gutter').textContent = content.split('\n').map((_, i) => i + 1).join('\n');
      const wc = el.querySelector('.editor-status span:last-child');
      if (wc) wc.textContent = wordCount(content) + ' words';
    });
    textarea.addEventListener('scroll', () => {
      el.querySelector('.editor-gutter').scrollTop = textarea.scrollTop;
    });

    el.querySelector('#ed-save')?.addEventListener('click', () => {
      const blob = new Blob([content], { type: 'text/plain' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'document.txt';
      a.click();
    });
    el.querySelector('#ed-new')?.addEventListener('click', () => { content = ''; render(); });
    el.querySelector('#ed-find')?.addEventListener('click', () => { showFind = !showFind; render(); });
    el.querySelector('#ed-find-close')?.addEventListener('click', () => { showFind = false; render(); });
  }

  function wordCount(text) { return text.trim() ? text.trim().split(/\s+/).length : 0; }
  render();
}
