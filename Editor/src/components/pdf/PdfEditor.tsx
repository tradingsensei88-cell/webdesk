import { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { Canvas as FabricCanvas, Rect, Circle, Textbox, Line, PencilBrush, FabricImage, type TPointerEventInfo } from 'fabric';
import {
  MousePointer2, Hand, ZoomIn, ZoomOut, Type, Image, Square, CircleIcon,
  ArrowRight, Pen, StickyNote, Highlighter, Strikethrough, Underline,
  Plus, Trash2, RotateCw, RotateCcw, Upload, Download, Undo2, Redo2,
  ChevronLeft, Maximize, Columns, CheckSquare, TextCursorInput,
  Copy, ArrowUp, ArrowDown,
} from 'lucide-react';
import { useApp } from '../../App';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface PageData {
  pageNum: number;
  rotation: number;
  fabricObjects: string | null;
}

type PdfToolId = 'select' | 'hand' | 'text' | 'image' | 'rect' | 'circle' |
  'arrow' | 'pen' | 'note' | 'highlight' | 'strikethrough' | 'underline' |
  'input' | 'checkbox';

export default function PdfEditor() {
  const { addToast, docTitle } = useApp();
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [pages, setPages] = useState<PageData[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [activeTool, setActiveTool] = useState<PdfToolId>('select');
  const [fabricCanvases, setFabricCanvases] = useState<Map<number, FabricCanvas>>(new Map());
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const [showThumbnails, setShowThumbnails] = useState(true);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; pageNum: number } | null>(null);

  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const thumbnailRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const pageCanvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const fabricContainerRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());

  // Keyboard shortcuts for PDF tools
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return;

      const keyMap: Record<string, PdfToolId> = {
        v: 'select', h: 'hand', t: 'text', p: 'pen',
        r: 'rect', c: 'circle', a: 'arrow', i: 'image', n: 'note',
      };

      if (keyMap[e.key.toLowerCase()] && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setActiveTool(keyMap[e.key.toLowerCase()]);
      }

      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      }
      if (e.ctrlKey && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undoStack, redoStack]);

  // Load PDF
  const loadPdf = useCallback(async (data: ArrayBuffer) => {
    setLoading(true);
    setError(null);
    try {
      const bytes = new Uint8Array(data);
      setPdfBytes(bytes);
      const doc = await pdfjsLib.getDocument({ data: bytes.slice() }).promise;
      setPdfDoc(doc);
      setPageCount(doc.numPages);
      const pagesData: PageData[] = [];
      for (let i = 1; i <= doc.numPages; i++) {
        pagesData.push({ pageNum: i, rotation: 0, fabricObjects: null });
      }
      setPages(pagesData);
      setCurrentPage(1);
      addToast('PDF loaded successfully', 'success');
    } catch (err) {
      setError('PDF failed to load — check the file and try again.');
      addToast('Failed to load PDF', 'error');
    }
    setLoading(false);
  }, [addToast]);

  // File upload handler
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => loadPdf(reader.result as ArrayBuffer);
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  }, [loadPdf]);

  // Drag and drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type === 'application/pdf') {
      const reader = new FileReader();
      reader.onload = () => loadPdf(reader.result as ArrayBuffer);
      reader.readAsArrayBuffer(file);
    } else {
      addToast('Please drop a PDF file', 'warning');
    }
  }, [loadPdf, addToast]);

  // Render a single PDF page to canvas
  const renderPage = useCallback(async (pageNum: number, canvas: HTMLCanvasElement, scale: number) => {
    if (!pdfDoc) return;
    const page = await pdfDoc.getPage(pageNum);
    const pageData = pages[pageNum - 1];
    const viewport = page.getViewport({ scale, rotation: pageData?.rotation || 0 });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;
    await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
  }, [pdfDoc, pages]);

  // Render thumbnails
  useEffect(() => {
    if (!pdfDoc) return;
    pages.forEach((_, idx) => {
      const canvas = thumbnailRefs.current.get(idx + 1);
      if (canvas) renderPage(idx + 1, canvas, 0.2);
    });
  }, [pdfDoc, pages, renderPage]);

  // Render visible pages
  useEffect(() => {
    if (!pdfDoc) return;
    const scale = zoom / 100;
    pages.forEach((_, idx) => {
      const canvas = pageCanvasRefs.current.get(idx + 1);
      if (canvas) renderPage(idx + 1, canvas, scale);
    });
  }, [pdfDoc, pages, zoom, renderPage]);

  // Initialize Fabric.js canvases
  useEffect(() => {
    if (!pdfDoc) return;
    const newCanvases = new Map<number, FabricCanvas>();

    pages.forEach((_, idx) => {
      const pageNum = idx + 1;
      const el = fabricContainerRefs.current.get(pageNum);
      if (!el) return;

      // Skip if already initialized
      if (fabricCanvases.has(pageNum)) {
        newCanvases.set(pageNum, fabricCanvases.get(pageNum)!);
        return;
      }

      const pdfCanvas = pageCanvasRefs.current.get(pageNum);
      if (!pdfCanvas) return;

      const fc = new FabricCanvas(el, {
        width: pdfCanvas.width || 595,
        height: pdfCanvas.height || 842,
        selection: true,
        backgroundColor: 'transparent',
      });

      fc.on('mouse:down', (opt: TPointerEventInfo) => {
        if (opt.e && (opt.e as MouseEvent).button === 2) {
          setContextMenu({ x: (opt.e as MouseEvent).clientX, y: (opt.e as MouseEvent).clientY, pageNum });
        }
      });

      newCanvases.set(pageNum, fc);
    });

    setFabricCanvases(newCanvases);
  }, [pdfDoc, pages.length]);

  // Update fabric canvas sizes on zoom change
  useEffect(() => {
    fabricCanvases.forEach((fc, pageNum) => {
      const pdfCanvas = pageCanvasRefs.current.get(pageNum);
      if (pdfCanvas) {
        fc.setDimensions({ width: pdfCanvas.width, height: pdfCanvas.height });
      }
    });
  }, [zoom, fabricCanvases]);

  // Tool actions
  const handleCanvasClick = useCallback((pageNum: number, e: React.MouseEvent) => {
    const fc = fabricCanvases.get(pageNum);
    if (!fc) return;

    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    switch (activeTool) {
      case 'text': {
        const text = new Textbox('Edit text here', {
          left: x, top: y, width: 200,
          fontSize: 16, fontFamily: 'DM Sans',
          fill: '#000000',
          editable: true,
        });
        fc.add(text);
        fc.setActiveObject(text);
        saveState();
        break;
      }
      case 'rect': {
        const shape = new Rect({
          left: x, top: y, width: 120, height: 80,
          fill: 'transparent', stroke: '#4F7EF7',
          strokeWidth: 2, rx: 4, ry: 4,
        });
        fc.add(shape);
        saveState();
        break;
      }
      case 'circle': {
        const circle = new Circle({
          left: x, top: y, radius: 50,
          fill: 'transparent', stroke: '#4F7EF7', strokeWidth: 2,
        });
        fc.add(circle);
        saveState();
        break;
      }
      case 'arrow': {
        const line = new Line([x, y, x + 120, y], {
          stroke: '#4F7EF7', strokeWidth: 2,
        });
        fc.add(line);
        saveState();
        break;
      }
      case 'note': {
        const note = new Rect({
          left: x, top: y, width: 140, height: 100,
          fill: '#FBBF24', stroke: '#D4A017', strokeWidth: 1,
          rx: 4, ry: 4, opacity: 0.9,
        });
        const noteText = new Textbox('Add note...', {
          left: x + 8, top: y + 8, width: 124,
          fontSize: 12, fontFamily: 'DM Sans',
          fill: '#1A1C25', editable: true,
        });
        fc.add(note);
        fc.add(noteText);
        saveState();
        break;
      }
      case 'highlight': {
        const hl = new Rect({
          left: x, top: y, width: 200, height: 20,
          fill: 'rgba(251, 191, 36, 0.35)', stroke: '',
          selectable: true,
        });
        fc.add(hl);
        saveState();
        break;
      }
      case 'input': {
        const inputField = new Rect({
          left: x, top: y, width: 200, height: 28,
          fill: '#FFFFFF', stroke: '#2A2D3A', strokeWidth: 1,
          rx: 3, ry: 3,
        });
        const inputLabel = new Textbox('Text field', {
          left: x + 6, top: y + 5, width: 188,
          fontSize: 12, fontFamily: 'DM Sans', fill: '#6B7080',
        });
        fc.add(inputField);
        fc.add(inputLabel);
        saveState();
        break;
      }
      case 'checkbox': {
        const cb = new Rect({
          left: x, top: y, width: 18, height: 18,
          fill: '#FFFFFF', stroke: '#2A2D3A', strokeWidth: 1.5,
          rx: 3, ry: 3,
        });
        const cbLabel = new Textbox('Checkbox label', {
          left: x + 26, top: y, width: 120,
          fontSize: 13, fontFamily: 'DM Sans', fill: '#1A1C25',
        });
        fc.add(cb);
        fc.add(cbLabel);
        saveState();
        break;
      }
    }

    if (activeTool === 'pen') {
      fc.isDrawingMode = true;
      fc.freeDrawingBrush = new PencilBrush(fc);
      fc.freeDrawingBrush.color = '#4F7EF7';
      fc.freeDrawingBrush.width = 2;
    } else {
      fc.isDrawingMode = false;
    }

    fc.renderAll();
  }, [fabricCanvases, activeTool]);

  // Undo/Redo
  const saveState = useCallback(() => {
    const states: string[] = [];
    fabricCanvases.forEach((fc, num) => {
      states.push(JSON.stringify({ page: num, objects: fc.toJSON() }));
    });
    setUndoStack(prev => [...prev, JSON.stringify(states)]);
    setRedoStack([]);
  }, [fabricCanvases]);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const prev = [...undoStack];
    const last = prev.pop()!;
    setUndoStack(prev);
    setRedoStack(r => [...r, last]);
  }, [undoStack]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const prev = [...redoStack];
    const last = prev.pop()!;
    setRedoStack(prev);
    setUndoStack(u => [...u, last]);
  }, [redoStack]);

  // Page operations
  const rotatePage = useCallback((dir: 'cw' | 'ccw') => {
    setPages(prev => prev.map((p, i) =>
      i === currentPage - 1
        ? { ...p, rotation: (p.rotation + (dir === 'cw' ? 90 : -90) + 360) % 360 }
        : p
    ));
  }, [currentPage]);

  const addBlankPage = useCallback(() => {
    setPages(prev => [...prev, { pageNum: prev.length + 1, rotation: 0, fabricObjects: null }]);
    setPageCount(prev => prev + 1);
    addToast('Blank page added', 'info');
  }, [addToast]);

  const deletePage = useCallback(() => {
    if (pages.length <= 1) {
      addToast('Cannot delete the only page', 'warning');
      return;
    }
    setPages(prev => prev.filter((_, i) => i !== currentPage - 1));
    setPageCount(prev => prev - 1);
    if (currentPage > pages.length - 1) setCurrentPage(pages.length - 1);
    addToast('Page deleted', 'info');
  }, [pages, currentPage, addToast]);

  // Image insert
  const handleImageInsert = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const fc = fabricCanvases.get(currentPage);
      if (!fc) return;
      const imgEl = new window.Image();
      imgEl.onload = () => {
        const fabricImg = new FabricImage(imgEl, {
          left: 100, top: 100,
          scaleX: 200 / imgEl.width,
          scaleY: 200 / imgEl.width,
        });
        fc.add(fabricImg);
        fc.renderAll();
        saveState();
        addToast('Image inserted', 'success');
      };
      imgEl.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, [fabricCanvases, currentPage, saveState, addToast]);

  // Context menu actions
  const handleContextAction = useCallback((action: string) => {
    const fc = fabricCanvases.get(contextMenu?.pageNum || currentPage);
    if (!fc) return;
    const obj = fc.getActiveObject();

    switch (action) {
      case 'delete':
        if (obj) { fc.remove(obj); saveState(); }
        break;
      case 'duplicate':
        if (obj) {
          obj.clone().then((cloned: any) => {
            cloned.set({ left: (cloned.left || 0) + 20, top: (cloned.top || 0) + 20 });
            fc.add(cloned);
            fc.renderAll();
            saveState();
          });
        }
        break;
      case 'bringFront':
        if (obj) { fc.bringObjectToFront(obj); fc.renderAll(); }
        break;
      case 'sendBack':
        if (obj) { fc.sendObjectToBack(obj); fc.renderAll(); }
        break;
    }
    setContextMenu(null);
  }, [fabricCanvases, contextMenu, currentPage, saveState]);

  // Export PDF
  const handleExport = useCallback(async () => {
    if (!pdfBytes) return;
    setExporting(true);
    setExportProgress(0);

    try {
      const exportDoc = await PDFDocument.load(pdfBytes);
      const pdfPages = exportDoc.getPages();
      const font = await exportDoc.embedFont(StandardFonts.Helvetica);

      for (let i = 0; i < pdfPages.length; i++) {
        setExportProgress(((i + 1) / pdfPages.length) * 100);
        const fc = fabricCanvases.get(i + 1);
        if (!fc) continue;

        const page = pdfPages[i];
        const { width, height } = page.getSize();
        const objects = fc.getObjects();

        for (const obj of objects) {
          if (obj instanceof Textbox) {
            const text = obj.text || '';
            const x = obj.left || 0;
            const y = height - (obj.top || 0) - (obj.fontSize || 14);
            page.drawText(text, {
              x: x * (width / (fc.width || width)),
              y: y * (height / (fc.height || height)),
              size: obj.fontSize || 14,
              font,
              color: rgb(0, 0, 0),
            });
          } else if (obj instanceof Rect) {
            const x = (obj.left || 0) * (width / (fc.width || width));
            const y = height - (obj.top || 0) * (height / (fc.height || height)) - (obj.height || 0) * (height / (fc.height || height));
            page.drawRectangle({
              x, y,
              width: (obj.width || 0) * (width / (fc.width || width)),
              height: (obj.height || 0) * (height / (fc.height || height)),
              borderColor: rgb(0.31, 0.49, 0.97),
              borderWidth: obj.strokeWidth || 1,
            });
          }
        }
      }

      const finalBytes = await exportDoc.save();
      const blob = new Blob([new Uint8Array(finalBytes)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${docTitle || 'document'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      addToast('Export ready', 'success');
    } catch (err) {
      addToast('Export failed', 'error');
    }
    setExporting(false);
  }, [pdfBytes, fabricCanvases, addToast, docTitle]);

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [contextMenu]);

  const tools: { id: PdfToolId; icon: any; label: string; shortcut?: string; group: string }[] = [
    { id: 'select', icon: MousePointer2, label: 'Select', shortcut: 'V', group: 'Edit' },
    { id: 'hand', icon: Hand, label: 'Pan', shortcut: 'H', group: 'View' },
    { id: 'text', icon: Type, label: 'Text Box', shortcut: 'T', group: 'Insert' },
    { id: 'image', icon: Image, label: 'Image', shortcut: 'I', group: 'Insert' },
    { id: 'rect', icon: Square, label: 'Rectangle', shortcut: 'R', group: 'Insert' },
    { id: 'circle', icon: CircleIcon, label: 'Circle', shortcut: 'C', group: 'Insert' },
    { id: 'arrow', icon: ArrowRight, label: 'Arrow', shortcut: 'A', group: 'Insert' },
    { id: 'pen', icon: Pen, label: 'Pen', shortcut: 'P', group: 'Insert' },
    { id: 'note', icon: StickyNote, label: 'Sticky Note', shortcut: 'N', group: 'Insert' },
    { id: 'highlight', icon: Highlighter, label: 'Highlight', group: 'Annotate' },
    { id: 'strikethrough', icon: Strikethrough, label: 'Strikethrough', group: 'Annotate' },
    { id: 'underline', icon: Underline, label: 'Underline', group: 'Annotate' },
    { id: 'input', icon: TextCursorInput, label: 'Text Field', group: 'Form' },
    { id: 'checkbox', icon: CheckSquare, label: 'Checkbox', group: 'Form' },
  ];

  const toolGroups = ['View', 'Edit', 'Insert', 'Annotate', 'Form'];

  // ===== RENDER =====
  return (
    <>
      {/* Sidebar */}
      <aside className="sidebar" role="toolbar" aria-label="PDF Tools">
        {showThumbnails && pdfDoc ? (
          <div className="thumbnail-strip">
            <button className="icon-btn sm" onClick={() => setShowThumbnails(false)} aria-label="Hide thumbnails" style={{ alignSelf: 'flex-end' }}>
              <ChevronLeft size={14} />
            </button>
            {pages.map((_, idx) => (
              <div
                key={idx}
                className={`thumbnail-item ${currentPage === idx + 1 ? 'active' : ''}`}
                onClick={() => {
                  setCurrentPage(idx + 1);
                  const el = document.getElementById(`pdf-page-${idx + 1}`);
                  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
              >
                <canvas
                  ref={el => { if (el) thumbnailRefs.current.set(idx + 1, el); }}
                  style={{ width: '100%', height: 'auto' }}
                />
                <span className="thumbnail-num">{idx + 1}</span>
              </div>
            ))}
          </div>
        ) : (
          <>
            {pdfDoc && (
              <button className="icon-btn sm" onClick={() => setShowThumbnails(true)} aria-label="Show thumbnails" style={{ marginBottom: 4 }}>
                <Columns size={16} />
              </button>
            )}
            {toolGroups.map(group => (
              <div key={group}>
                <div className="sidebar-section-label">{group}</div>
                {tools.filter(t => t.group === group).map(tool => {
                  const Icon = tool.icon;
                  return (
                    <div className="tooltip-wrapper" key={tool.id}>
                      <button
                        className={`icon-btn ${activeTool === tool.id ? 'active' : ''}`}
                        onClick={() => {
                          if (tool.id === 'image') {
                            imageInputRef.current?.click();
                          } else {
                            setActiveTool(tool.id);
                          }
                        }}
                        aria-label={`${tool.label}${tool.shortcut ? ` [${tool.shortcut}]` : ''}`}
                      >
                        <Icon size={18} />
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </>
        )}
      </aside>

      {/* Toolbar */}
      <div className="toolbar" role="toolbar" aria-label="PDF Toolbar">
        <div className="toolbar-group">
          <button className="icon-btn" onClick={handleUndo} disabled={undoStack.length === 0} aria-label="Undo [Ctrl+Z]">
            <Undo2 size={16} />
          </button>
          <button className="icon-btn" onClick={handleRedo} disabled={redoStack.length === 0} aria-label="Redo [Ctrl+Y]">
            <Redo2 size={16} />
          </button>
        </div>
        <div className="toolbar-divider" />
        <div className="toolbar-group">
          <button className="icon-btn" onClick={() => setZoom(z => Math.max(25, z - 25))} aria-label="Zoom out">
            <ZoomOut size={16} />
          </button>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 40, textAlign: 'center', fontFamily: 'var(--font-mono)' }}>{zoom}%</span>
          <button className="icon-btn" onClick={() => setZoom(z => Math.min(400, z + 25))} aria-label="Zoom in">
            <ZoomIn size={16} />
          </button>
          <button className="icon-btn" onClick={() => setZoom(100)} aria-label="Fit to page">
            <Maximize size={16} />
          </button>
        </div>
        <div className="toolbar-divider" />
        <div className="toolbar-group">
          <button className="icon-btn" onClick={() => rotatePage('ccw')} disabled={!pdfDoc} aria-label="Rotate counter-clockwise">
            <RotateCcw size={16} />
          </button>
          <button className="icon-btn" onClick={() => rotatePage('cw')} disabled={!pdfDoc} aria-label="Rotate clockwise">
            <RotateCw size={16} />
          </button>
        </div>
        <div className="toolbar-divider" />
        <div className="toolbar-group">
          <button className="icon-btn" onClick={addBlankPage} aria-label="Add blank page">
            <Plus size={16} />
          </button>
          <button className="icon-btn" onClick={deletePage} disabled={!pdfDoc || pageCount <= 1} aria-label="Delete page">
            <Trash2 size={16} />
          </button>
        </div>
        <div style={{ flex: 1 }} />
        <div className="toolbar-group">
          <button className="icon-btn" onClick={() => fileInputRef.current?.click()} aria-label="Upload PDF">
            <Upload size={16} />
          </button>
          <button className="btn btn-primary" onClick={handleExport} disabled={!pdfDoc || exporting} style={{ fontSize: 12, padding: '5px 14px' }}>
            <Download size={14} />
            {exporting ? 'Processing…' : 'Export PDF'}
          </button>
        </div>
      </div>

      {/* Canvas Area */}
      <div
        className="canvas-area"
        ref={canvasAreaRef}
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => setContextMenu(null)}
      >
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: 60 }}>
            <div className="skeleton" style={{ width: 400, height: 550 }} />
            <span style={{ color: 'var(--text-muted)' }}>Loading PDF…</span>
          </div>
        )}

        {error && (
          <div className="error-state">
            <div className="error-state-icon"><Upload size={48} /></div>
            <div className="error-state-title">Could not load PDF</div>
            <div className="error-state-message">{error}</div>
            <button className="btn btn-primary" onClick={() => fileInputRef.current?.click()}>Try again</button>
          </div>
        )}

        {!pdfDoc && !loading && !error && (
          <div
            className="drop-zone"
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }}
            onDragLeave={e => e.currentTarget.classList.remove('drag-over')}
          >
            <div className="drop-zone-icon"><Upload size={48} /></div>
            <div className="drop-zone-title">Drop a PDF here or click to upload</div>
            <div className="drop-zone-subtitle">Supports .pdf files up to 50MB</div>
          </div>
        )}

        {pdfDoc && pages.map((_pageData, idx) => {
          const pageNum = idx + 1;
          return (
            <div key={pageNum} id={`pdf-page-${pageNum}`} className="pdf-page-wrapper" style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center', marginBottom: `${16 * zoom / 100}px` }}>
              <canvas
                ref={el => { if (el) pageCanvasRefs.current.set(pageNum, el); }}
                className="pdf-page-canvas"
              />
              <canvas
                ref={el => { if (el) fabricContainerRefs.current.set(pageNum, el); }}
                className="pdf-fabric-overlay"
                onClick={e => handleCanvasClick(pageNum, e)}
                onContextMenu={e => {
                  e.preventDefault();
                  setContextMenu({ x: e.clientX, y: e.clientY, pageNum });
                }}
              />
              <div className="pdf-page-number">Page {pageNum} of {pages.length}</div>
            </div>
          );
        })}

        {exporting && (
          <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px 24px', boxShadow: 'var(--shadow-md)', display: 'flex', alignItems: 'center', gap: 12, zIndex: 100, minWidth: 260 }}>
            <span style={{ fontSize: 13 }}>Processing…</span>
            <div className="progress-bar" style={{ flex: 1 }}>
              <div className="progress-bar-fill" style={{ width: `${exportProgress}%` }} />
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{Math.round(exportProgress)}%</span>
          </div>
        )}
      </div>

      {/* Properties Panel */}
      <aside className="properties-panel">
        <div className="property-section">
          <div className="property-section-title">Document</div>
          {pdfDoc ? (
            <>
              <div className="property-row">
                <span className="property-label">Pages</span>
                <span style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{pages.length}</span>
              </div>
              <div className="property-row">
                <span className="property-label">Current Page</span>
                <span style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{currentPage}</span>
              </div>
              <div className="property-row">
                <span className="property-label">Zoom</span>
                <span style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{zoom}%</span>
              </div>
            </>
          ) : (
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No document loaded. Upload a PDF to get started.</p>
          )}
        </div>
        <div className="property-section">
          <div className="property-section-title">Active Tool</div>
          <p style={{ fontSize: 13, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{activeTool}</p>
        </div>
        {pdfDoc && (
          <div className="property-section">
            <div className="property-section-title">Page Actions</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button className="btn btn-secondary" onClick={addBlankPage} style={{ fontSize: 12, justifyContent: 'flex-start' }}>
                <Plus size={14} /> Add Blank Page
              </button>
              <button className="btn btn-secondary" onClick={() => rotatePage('cw')} style={{ fontSize: 12, justifyContent: 'flex-start' }}>
                <RotateCw size={14} /> Rotate CW
              </button>
              <button className="btn btn-secondary" onClick={deletePage} style={{ fontSize: 12, justifyContent: 'flex-start' }}>
                <Trash2 size={14} /> Delete Page
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Status Bar */}
      <footer className="statusbar">
        <div className="statusbar-left">
          {pdfDoc && (
            <>
              <span className="statusbar-item">Page {currentPage} of {pages.length}</span>
              <span className="statusbar-item">{activeTool}</span>
            </>
          )}
        </div>
        <div className="statusbar-right">
          <div className="zoom-slider-container">
            <ZoomOut size={12} />
            <input
              type="range"
              className="zoom-slider"
              min={25}
              max={400}
              step={25}
              value={zoom}
              onChange={e => setZoom(Number(e.target.value))}
              aria-label="Zoom level"
            />
            <ZoomIn size={12} />
            <span style={{ fontFamily: 'var(--font-mono)', minWidth: 36 }}>{zoom}%</span>
          </div>
        </div>
      </footer>

      {/* Hidden inputs */}
      <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleFileUpload} style={{ display: 'none' }} />
      <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageInsert} style={{ display: 'none' }} />

      {/* Context Menu */}
      {contextMenu && (
        <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
          <button className="context-menu-item" onClick={() => handleContextAction('duplicate')}>
            <Copy size={14} /> Duplicate <span className="shortcut-hint">Ctrl+D</span>
          </button>
          <button className="context-menu-item" onClick={() => handleContextAction('delete')}>
            <Trash2 size={14} /> Delete <span className="shortcut-hint">Del</span>
          </button>
          <div className="context-menu-divider" />
          <button className="context-menu-item" onClick={() => handleContextAction('bringFront')}>
            <ArrowUp size={14} /> Bring to Front
          </button>
          <button className="context-menu-item" onClick={() => handleContextAction('sendBack')}>
            <ArrowDown size={14} /> Send to Back
          </button>
        </div>
      )}
    </>
  );
}
