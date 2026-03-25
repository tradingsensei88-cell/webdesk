import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import {
  FileType, Sun, Moon, HelpCircle,
  X, CheckCircle, AlertCircle, Info, AlertTriangle, Upload
} from 'lucide-react';
import { useToast } from './hooks/useToast';
import WordProcessor from './components/word/WordProcessor';
import type { Theme, Toast } from './types';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface AppContextType {
  theme: Theme;
  toggleTheme: () => void;
  addToast: (message: string, type?: Toast['type']) => void;
  docTitle: string;
  setDocTitle: (t: string) => void;
  importPdfContent: (html: string, title?: string) => void;
  onPdfImport: ((html: string, title?: string) => void) | null;
  setOnPdfImport: (fn: ((html: string, title?: string) => void) | null) => void;
}

export const AppContext = createContext<AppContextType>(null!);
export const useApp = () => useContext(AppContext);

const TOAST_ICONS = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

// Extract text + images from PDF and convert to HTML preserving formatting
async function pdfToHtml(data: ArrayBuffer): Promise<{ html: string; title: string }> {
  const bytes = new Uint8Array(data);
  const pdf = await pdfjsLib.getDocument({ data: bytes.slice() }).promise;
  const parts: string[] = [];
  let firstLine = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    try {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 1.5 });
      const textContent = await page.getTextContent();
      const styles = textContent.styles as Record<string, any>;

      // ---- RENDER PAGE to canvas ----
      let renderCanvas: HTMLCanvasElement | null = null;
      try {
        renderCanvas = document.createElement('canvas');
        renderCanvas.width = viewport.width;
        renderCanvas.height = viewport.height;
        const renderCtx = renderCanvas.getContext('2d')!;
        await page.render({ canvasContext: renderCtx, viewport } as any).promise;
      } catch (e) {
        console.warn('Page render failed for page', i, e);
      }

      // ---- EXTRACT IMAGES from page objects ----
      const extractedImages: string[] = [];
      if (renderCanvas) {
        try {
          const ops = await page.getOperatorList();
          const imgNames = new Set<string>();
          for (let k = 0; k < ops.fnArray.length; k++) {
            if (ops.fnArray[k] === pdfjsLib.OPS.paintImageXObject) {
              const name = ops.argsArray[k]?.[0];
              if (name && typeof name === 'string') imgNames.add(name);
            }
          }

          for (const imgName of imgNames) {
            try {
              let imgObj: any = null;

              // Try multiple ways to get the image object
              try { imgObj = (page as any).objs.getData(imgName); } catch { }

              if (!imgObj) {
                try {
                  const internal = (page as any).objs._objects || (page as any).objs.objs;
                  if (internal) {
                    const entry = internal.get?.(imgName) || internal[imgName];
                    if (entry) imgObj = entry.data || entry;
                  }
                } catch { }
              }

              if (!imgObj) {
                imgObj = await new Promise<any>((resolve) => {
                  const t = setTimeout(() => resolve(null), 1000);
                  try {
                    (page as any).objs.get(imgName, (d: any) => { clearTimeout(t); resolve(d); });
                  } catch { clearTimeout(t); resolve(null); }
                });
              }

              if (!imgObj) continue;

              let dataUrl = '';
              if (imgObj instanceof ImageBitmap || (imgObj.bitmap && imgObj.bitmap instanceof ImageBitmap)) {
                const bmp = imgObj instanceof ImageBitmap ? imgObj : imgObj.bitmap;
                const c = document.createElement('canvas');
                c.width = bmp.width; c.height = bmp.height;
                c.getContext('2d')!.drawImage(bmp, 0, 0);
                dataUrl = c.toDataURL('image/png');
              } else if (imgObj instanceof HTMLImageElement || imgObj instanceof HTMLCanvasElement) {
                const c = document.createElement('canvas');
                c.width = imgObj.width; c.height = imgObj.height;
                c.getContext('2d')!.drawImage(imgObj, 0, 0);
                dataUrl = c.toDataURL('image/png');
              } else if (imgObj.data && imgObj.width && imgObj.height) {
                const c = document.createElement('canvas');
                c.width = imgObj.width; c.height = imgObj.height;
                const ctx2 = c.getContext('2d')!;
                const id = ctx2.createImageData(imgObj.width, imgObj.height);
                const src = imgObj.data; const dst = id.data;
                const px = imgObj.width * imgObj.height;
                if (src.length >= px * 4) { dst.set(src.subarray(0, dst.length)); }
                else if (src.length >= px * 3) {
                  for (let p = 0, q = 0; p < src.length && q < dst.length; p += 3, q += 4) {
                    dst[q] = src[p]; dst[q + 1] = src[p + 1]; dst[q + 2] = src[p + 2]; dst[q + 3] = 255;
                  }
                }
                ctx2.putImageData(id, 0, 0);
                dataUrl = c.toDataURL('image/png');
              } else if (imgObj.src) {
                dataUrl = imgObj.src;
              }

              if (dataUrl && dataUrl.length > 200) extractedImages.push(dataUrl);
            } catch (err) {
              console.warn('Failed to extract image:', imgName, err);
            }
          }
        } catch {
          console.warn('Operator list failed for page', i);
        }
      }

      // ---- EXTRACT LINK ANNOTATIONS ----
      let linkAnnotations: { rect: number[]; url: string }[] = [];
      try {
        const annotations = await page.getAnnotations();
        linkAnnotations = annotations
          .filter((a: any) => a.subtype === 'Link' && a.url)
          .map((a: any) => ({ rect: a.rect, url: a.url }));
      } catch { /* no annotations */ }

      // ---- EXTRACT TEXT ----
      interface TextRun { str: string; x: number; fontSize: number; fontName: string; isBold: boolean; isItalic: boolean; color: string | null; width: number; }
      interface TextLine { y: number; maxFontSize: number; runs: TextRun[]; }

      const lines: TextLine[] = [];
      let currentLine: TextLine | null = null;

      // Group items into lines based on pure Y coordinate
      for (const item of textContent.items) {
        if (!('str' in item)) continue;
        const ti = item as any;
        const text = ti.str as string;
        if (text.length === 0) continue;

        const x = Math.round(ti.transform[4]);
        const y = Math.round(ti.transform[5]);
        const fontSize = Math.round(Math.abs(ti.transform[0])) || 12;
        const fontName = ti.fontName || '';
        const styleInfo = styles[fontName] || {};
        const fontFamily = (styleInfo.fontFamily || fontName || '').replace(/,.*/g, '');
        const width = ti.width || (text.length * (fontSize * 0.5));

        const nameUpper = (fontName + ' ' + fontFamily).toUpperCase();
        const isBold = nameUpper.includes('BOLD') || nameUpper.includes('BLACK') || nameUpper.includes('HEAVY');
        const isItalic = nameUpper.includes('ITALIC') || nameUpper.includes('OBLIQUE');

        let color: string | null = null;
        if (ti.color && Array.isArray(ti.color) && ti.color.length >= 3) {
          const [r, g, b] = ti.color.map((c: number) => Math.round(c * 255));
          if (!(r === 0 && g === 0 && b === 0)) color = `rgb(${r},${g},${b})`;
        }

        const run: TextRun = { str: text, x, fontSize, fontName: cleanFontName(fontFamily), isBold, isItalic, color, width };

        // Stricter Y tolerance so closely packed lines (code paragraphs) don't merge
        const yTolerance = Math.max(2, fontSize * 0.25);

        // Look for a line that this belongs to
        let foundLine = false;
        for (const line of lines) {
          if (Math.abs(y - line.y) <= yTolerance) {
            line.runs.push(run);
            line.maxFontSize = Math.max(line.maxFontSize, run.fontSize);
            foundLine = true;
            break;
          }
        }
        if (!foundLine) {
          lines.push({ y, maxFontSize: run.fontSize, runs: [run] });
        }
      }

      // Sort lines from top to bottom (Y descending in PDF coordinates usually)
      lines.sort((a, b) => b.y - a.y);

      // Convert lines to HTML
      let pageHasText = false;
      for (const line of lines) {
        // Sort runs left to right
        line.runs.sort((a, b) => a.x - b.x);

        let lineText = '';
        let runsHtml = '';
        let lastEndX = -1;

        for (const run of line.runs) {
          // Calculate gap between this run and the end of the last run
          if (lastEndX !== -1) {
            const gap = run.x - lastEndX;
            if (gap > run.fontSize * 0.8) {
              const spaceCount = Math.max(1, Math.round(gap / (run.fontSize * 0.4)));
              const spaces = '&nbsp;'.repeat(spaceCount);
              runsHtml += spaces;
              lineText += ' '.repeat(spaceCount);
            } else if (gap > 0 && !run.str.startsWith(' ') && !lineText.endsWith(' ')) {
              runsHtml += ' ';
              lineText += ' ';
            }
          }
          lastEndX = run.x + run.width;

          lineText += run.str;

          const ss: string[] = [];
          if (run.fontSize && run.fontSize !== 12) ss.push(`font-size: ${run.fontSize}px`);
          if (run.fontName && !['default', 'sans-serif', 'serif'].includes(run.fontName.toLowerCase())) ss.push(`font-family: '${run.fontName}', sans-serif`);
          if (run.color) ss.push(`color: ${run.color}`);

          let h = escapeHtml(run.str);
          if (run.isBold) h = `<strong>${h}</strong>`;
          if (run.isItalic) h = `<em>${h}</em>`;
          if (ss.length > 0) h = `<span style="${ss.join('; ')}">${h}</span>`;
          runsHtml += h;
        }

        lineText = lineText.trim();
        if (!lineText) continue;
        pageHasText = true;
        if (!firstLine) firstLine = lineText;

        // Auto-detect URLs and wrap as links
        const finalHtml = linkifyHtml(runsHtml, lineText, linkAnnotations);

        const maxFs = line.maxFontSize;
        if (maxFs >= 24) parts.push(`<h1>${finalHtml}</h1>`);
        else if (maxFs >= 20) parts.push(`<h2>${finalHtml}</h2>`);
        else if (maxFs >= 16) parts.push(`<h3>${finalHtml}</h3>`);
        else parts.push(`<p>${finalHtml}</p>`);
      }

      // Add extracted images after text
      for (const src of extractedImages) {
        parts.push(`<img src="${src}" alt="PDF image" style="max-width: 100%; height: auto;" />`);
      }

      // Fallback: if very little or no text was extracted, render page as image
      if (!pageHasText && extractedImages.length === 0 && renderCanvas) {
        try {
          const pageImgUrl = renderCanvas.toDataURL('image/png');
          if (pageImgUrl && pageImgUrl.length > 200) {
            parts.push(`<img src="${pageImgUrl}" alt="Page ${i}" style="max-width: 100%; height: auto;" />`);
          }
        } catch (e) {
          console.warn('Fallback page render failed for page', i, e);
        }
      }

      if (i < pdf.numPages) parts.push('<div data-type="page-break">&nbsp;</div>');

    } catch (pageErr) {
      console.warn(`Error processing page ${i}, skipping:`, pageErr);
      // Even on error, try to render the page as an image
      try {
        const page = await pdf.getPage(i);
        const vp = page.getViewport({ scale: 1.5 });
        const c = document.createElement('canvas');
        c.width = vp.width; c.height = vp.height;
        const ctx = c.getContext('2d')!;
        await page.render({ canvasContext: ctx, viewport: vp } as any).promise;
        const fallbackUrl = c.toDataURL('image/png');
        if (fallbackUrl && fallbackUrl.length > 200) {
          parts.push(`<img src="${fallbackUrl}" alt="Page ${i}" style="max-width: 100%; height: auto;" />`);
        }
      } catch {
        parts.push(`<p><em>[Page ${i} could not be processed]</em></p>`);
      }
    }
  }

  return {
    html: parts.join('\n') || '<p>No content could be extracted from this PDF.</p>',
    title: firstLine.slice(0, 60) || 'Imported PDF',
  };
}

function linkifyHtml(html: string, plainText: string, annotations: { rect: number[]; url: string }[]): string {
  // Check annotation links
  for (const ann of annotations) {
    if (plainText.includes(ann.url)) {
      const escaped = escapeHtml(ann.url);
      return html.replace(escaped, `<a href="${escaped}" target="_blank" style="color: #2E8B57; text-decoration: underline;">${escaped}</a>`);
    }
  }
  // Linkify bare URLs
  const urlRe = /(https?:\/\/[^\s<>&"]+)/g;
  let m; const urls: string[] = [];
  while ((m = urlRe.exec(plainText)) !== null) urls.push(m[1]);
  let result = html;
  for (const u of urls) {
    const eu = escapeHtml(u);
    result = result.replace(eu, `<a href="${eu}" target="_blank" style="color: #2E8B57; text-decoration: underline;">${eu}</a>`);
  }
  return result;
}

function cleanFontName(name: string): string {
  return name.replace(/^[A-Z]{6}\+/, '').replace(/-(Bold|Italic|Regular|Medium|Light|Heavy|Black|Oblique|BoldItalic|Semibold|Thin|ExtraLight|ExtraBold)/gi, '').replace(/,?(Bold|Italic|Regular)/gi, '').trim() || 'sans-serif';
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export default function App() {
  const [theme, setTheme] = useState<Theme>(() =>
    (localStorage.getItem('docforge-theme') as Theme) || 'dark'
  );
  const [docTitle, setDocTitle] = useState('Untitled Document');
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [importingPdf, setImportingPdf] = useState(false);
  const [onPdfImport, setOnPdfImport] = useState<((html: string, title?: string) => void) | null>(null);
  const { toasts, addToast, removeToast } = useToast();
  const fileInputRef = useCallback((node: HTMLInputElement | null) => {
    if (node) node.setAttribute('accept', '.pdf');
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('docforge-theme', next);
      return next;
    });
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Auto-save timer
  useEffect(() => {
    const interval = setInterval(() => {
      setLastSaved(new Date());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && !(e.target as HTMLElement)?.isContentEditable) {
          e.preventDefault();
          setShowShortcuts(s => !s);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Import PDF handler
  const importPdfContent = useCallback(async (file: File) => {
    setImportingPdf(true);
    addToast('Converting PDF to editable document…', 'info');

    try {
      const buffer = await file.arrayBuffer();
      const { html, title } = await pdfToHtml(buffer);

      if (onPdfImport) {
        onPdfImport(html, title);
      }

      setDocTitle(title);
      addToast('PDF imported successfully! You can now edit and export as DOCX.', 'success');
    } catch (err) {
      console.error('PDF import error:', err);
      addToast('Failed to import PDF — the file may be corrupted or image-based.', 'error');
    }

    setImportingPdf(false);
  }, [addToast, onPdfImport]);

  const handlePdfUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      importPdfContent(file);
    }
    e.target.value = '';
  }, [importPdfContent]);

  const timeSinceSave = lastSaved
    ? `Auto-saved ${Math.floor((Date.now() - lastSaved.getTime()) / 1000)}s ago`
    : null;

  const pdfFileInputId = 'pdf-import-input';

  const ctx: AppContextType = {
    theme, toggleTheme,
    addToast, docTitle, setDocTitle,
    importPdfContent: (html: string, title?: string) => {
      if (onPdfImport) onPdfImport(html, title);
    },
    onPdfImport, setOnPdfImport,
  };

  return (
    <AppContext.Provider value={ctx}>
      <div className="desktop-banner">
        📱 For the full DocForge experience, use a desktop or tablet (landscape).
      </div>
      <div className="app-layout">
        {/* ===== TOPBAR ===== */}
        <header className="topbar" role="banner">
          <div className="topbar-logo" style={{ pointerEvents: 'none' }}>
            <img src="/logo.png" alt="DocForge Logo" style={{ height: 125, width: 'auto', objectFit: 'contain' }} />
          </div>

          <div style={{ marginLeft: 16 }}>
            <label
              htmlFor={pdfFileInputId}
              className="btn btn-secondary"
              style={{ fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Upload size={14} />
              {importingPdf ? 'Converting…' : 'Import PDF'}
            </label>
            <input
              id={pdfFileInputId}
              type="file"
              accept=".pdf"
              onChange={handlePdfUpload}
              style={{ display: 'none' }}
            />
          </div>

          <div className="topbar-center">
            <input
              className="doc-title-input"
              value={docTitle}
              onChange={e => setDocTitle(e.target.value)}
              aria-label="Document title"
              spellCheck={false}
            />
          </div>
          <div className="topbar-actions">
            {timeSinceSave && (
              <span className="autosave-indicator">
                <span className="dot" />
                {timeSinceSave}
              </span>
            )}
            <button className="icon-btn" onClick={toggleTheme} aria-label="Toggle theme">
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              className="icon-btn"
              onClick={() => setShowShortcuts(true)}
              aria-label="Keyboard shortcuts"
            >
              <HelpCircle size={18} />
            </button>
          </div>
        </header>

        {/* ===== WORD PROCESSOR (ONLY MODULE) ===== */}
        <WordProcessor />
      </div>

      {/* ===== TOASTS ===== */}
      <div className="toast-container" role="status" aria-live="polite">
        {toasts.map(t => {
          const Icon = TOAST_ICONS[t.type];
          return (
            <div key={t.id} className={`toast ${t.type}`}>
              <Icon size={16} />
              <span>{t.message}</span>
              <button className="icon-btn sm" onClick={() => removeToast(t.id)} aria-label="Dismiss">
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>

      {/* ===== SHORTCUTS MODAL ===== */}
      {showShortcuts && (
        <div className="modal-overlay" onClick={() => setShowShortcuts(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} role="dialog" aria-label="Keyboard shortcuts">
            <div className="modal-header">
              <span className="modal-title">Keyboard Shortcuts</span>
              <button className="icon-btn" onClick={() => setShowShortcuts(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div className="shortcuts-grid">
                {SHORTCUTS.map(s => (
                  <div className="shortcut-item" key={s.label}>
                    <span className="shortcut-label">{s.label}</span>
                    <span className="shortcut-keys">
                      {s.keys.map((k, i) => <span className="kbd" key={i}>{k}</span>)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </AppContext.Provider>
  );
}

const SHORTCUTS = [
  { label: 'Undo', keys: ['Ctrl', 'Z'] },
  { label: 'Redo', keys: ['Ctrl', 'Y'] },
  { label: 'Bold', keys: ['Ctrl', 'B'] },
  { label: 'Italic', keys: ['Ctrl', 'I'] },
  { label: 'Underline', keys: ['Ctrl', 'U'] },
  { label: 'Find & Replace', keys: ['Ctrl', 'H'] },
  { label: 'Insert Link', keys: ['Ctrl', 'K'] },
  { label: 'Clear Formatting', keys: ['Ctrl', '\\'] },
  { label: 'Show Shortcuts', keys: ['?'] },
  { label: 'Zoom In', keys: ['Ctrl', '+'] },
  { label: 'Zoom Out', keys: ['Ctrl', '-'] },
];
