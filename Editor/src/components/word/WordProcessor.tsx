import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle as TextStyleExt } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import ResizableImage from './ResizableImage';
import { PageBreak } from './PageBreak';
import Link from '@tiptap/extension-link';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import Placeholder from '@tiptap/extension-placeholder';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import FontFamily from '@tiptap/extension-font-family';
import {
  Bold, Italic, UnderlineIcon, Strikethrough, Subscript as SubIcon, Superscript as SupIcon,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, RemoveFormatting,
  Image, Image as ImageIcon, Link2, Table as TableIcon, Minus,
  Heading1, Heading2, Heading3,
  Quote,
  Eye,
  Search, CheckCheck, BookOpen,
  Download, Copy, History, ZoomIn, ZoomOut, Printer,
  ChevronDown, X,
  Undo2, Redo2
} from 'lucide-react';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { useApp } from '../../App';
import type { PageSettings, VersionSnapshot } from '../../types';

const FONTS = ['DM Sans', 'Playfair Display', 'Georgia', 'Arial', 'Times New Roman', 'Courier New', 'Verdana', 'Trebuchet MS'];
const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64, 72, 96];
const LINE_SPACINGS = [1.0, 1.15, 1.5, 2.0];

type ToolbarTab = 'home' | 'insert' | 'layout' | 'review' | 'view';

// FontSize extension
const FontSize = TextStyleExt.extend({
  addGlobalAttributes() {
    return [{
      types: ['textStyle'],
      attributes: {
        fontSize: {
          default: null,
          parseHTML: (el: HTMLElement) => el.style.fontSize?.replace('px', '') || null,
          renderHTML: (attrs: Record<string, any>) => {
            if (!attrs.fontSize) return {};
            return { style: `font-size: ${attrs.fontSize}px` };
          },
        },
      },
    }];
  },
});

export default function WordProcessor() {
  const { addToast, docTitle, setOnPdfImport } = useApp();
  const [activeTab, setActiveTab] = useState<ToolbarTab>('home');
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [matchCount, setMatchCount] = useState(0);
  const [pageSettings, setPageSettings] = useState<PageSettings>({
    size: 'a4', orientation: 'portrait',
    margins: { top: 25.4, bottom: 25.4, left: 25.4, right: 25.4 },
    columns: 1,
  });
  const [trackChanges, setTrackChanges] = useState(false);
  const [showToc, setShowToc] = useState(false);
  const [printPreview, setPrintPreview] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [snapshots, setSnapshots] = useState<VersionSnapshot[]>(() => {
    try { return JSON.parse(localStorage.getItem('docforge-snapshots') || '[]'); } catch { return []; }
  });
  const [showSnapshots, setShowSnapshots] = useState(false);
  const [showTablePicker, setShowTablePicker] = useState(false);
  const [tablePickerHover, setTablePickerHover] = useState({ rows: 0, cols: 0 });
  const [tablePickerPos, setTablePickerPos] = useState<{ top: number; left: number } | null>(null);
  const [textColor, setTextColor] = useState('#EEF0F8');
  const [highlightColor, setHighlightColor] = useState('#FBBF24');
  const [lineSpacing, setLineSpacing] = useState(1.5);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');


  const imageInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
        strike: false,
        link: false,
        underline: false,
      } as any),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      FontSize,
      Color,
      Highlight.configure({ multicolor: true }),
      ResizableImage,
      PageBreak,
      Link.configure({ openOnClick: false }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      Placeholder.configure({ placeholder: 'Start typing your document…' }),
      Subscript,
      Superscript,
      FontFamily,
    ],
    content: '<h1>Welcome to DocForge</h1><p>Start writing your document here. Use the toolbar above to format text, insert images, tables, and more.</p>',
    editorProps: {
      attributes: {
        class: 'tiptap-editor',
        spellcheck: 'true',
      },
    },
  });

  // Auto-save to localStorage
  useEffect(() => {
    if (!editor) return;
    const interval = setInterval(() => {
      const html = editor.getHTML();
      localStorage.setItem('docforge-word-content', html);
    }, 30000);
    return () => clearInterval(interval);
  }, [editor]);

  // Restore content
  useEffect(() => {
    if (!editor) return;
    const saved = localStorage.getItem('docforge-word-content');
    if (saved && saved.length > 50) {
      editor.commands.setContent(saved);
    }
  }, [editor]);

  // Register PDF import handler
  useEffect(() => {
    if (!editor) return;
    setOnPdfImport(() => (html: string, _title?: string) => {
      editor.commands.setContent(html);
    });
    return () => setOnPdfImport(null);
  }, [editor, setOnPdfImport]);



  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'h') {
        e.preventDefault();
        setShowFindReplace(s => !s);
      }
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        setShowLinkModal(true);
      }
      if (e.ctrlKey && e.key === '\\') {
        e.preventDefault();
        editor?.chain().focus().unsetAllMarks().run();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [editor]);

  // Find text
  useEffect(() => {
    if (!findText || !editor) { setMatchCount(0); return; }
    const content = editor.getText();
    const regex = new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const matches = content.match(regex);
    setMatchCount(matches?.length || 0);
  }, [findText, editor]);

  const handleReplace = useCallback(() => {
    if (!editor || !findText) return;
    const { state } = editor;
    const { from, to } = state.selection;
    const selectedText = state.doc.textBetween(from, to);
    if (selectedText.toLowerCase() === findText.toLowerCase()) {
      editor.chain().focus().insertContent(replaceText).run();
      addToast('Replaced', 'success');
    }
  }, [editor, findText, replaceText, addToast]);

  const handleReplaceAll = useCallback(() => {
    if (!editor || !findText) return;
    const html = editor.getHTML();
    const regex = new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const newHtml = html.replace(regex, replaceText);
    editor.commands.setContent(newHtml);
    addToast(`Replaced all occurrences`, 'success');
  }, [editor, findText, replaceText, addToast]);

  // Image insert
  const handleImageInsert = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    const reader = new FileReader();
    reader.onload = () => {
      editor.chain().focus().insertContent({ type: 'image', attrs: { src: reader.result as string } }).run();
      addToast('Image inserted', 'success');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, [editor, addToast]);

  // Insert table
  const handleInsertTable = useCallback((rows: number, cols: number) => {
    if (!editor) return;
    editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
    setShowTablePicker(false);
    addToast(`${rows}×${cols} table inserted`, 'success');
  }, [editor, addToast]);

  // Insert link
  const handleInsertLink = useCallback(() => {
    if (!editor || !linkUrl) return;
    editor.chain().focus().setLink({ href: linkUrl }).run();
    setShowLinkModal(false);
    setLinkUrl('');
    addToast('Link added', 'success');
  }, [editor, linkUrl, addToast]);

  // Export DOCX
  const handleExportDocx = useCallback(async () => {
    if (!editor) return;
    try {
      const json = editor.getJSON();
      const paragraphs: Paragraph[] = [];

      const processNode = (node: any) => {
        if (node.type === 'heading') {
          const level = node.attrs?.level || 1;
          const headingLevelMap: Record<number, typeof HeadingLevel[keyof typeof HeadingLevel]> = {
            1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_2,
            3: HeadingLevel.HEADING_3, 4: HeadingLevel.HEADING_4,
            5: HeadingLevel.HEADING_5, 6: HeadingLevel.HEADING_6,
          };
          const textRuns = (node.content || []).map((c: any) => {
            const marks = c.marks || [];
            return new TextRun({
              text: c.text || '',
              bold: marks.some((m: any) => m.type === 'bold'),
              italics: marks.some((m: any) => m.type === 'italic'),
              underline: marks.some((m: any) => m.type === 'underline') ? {} : undefined,
              size: level === 1 ? 32 : level === 2 ? 26 : 22,
            });
          });
          paragraphs.push(new Paragraph({ heading: headingLevelMap[level], children: textRuns }));
        } else if (node.type === 'paragraph') {
          const textRuns = (node.content || []).map((c: any) => {
            const marks = c.marks || [];
            return new TextRun({
              text: c.text || '',
              bold: marks.some((m: any) => m.type === 'bold'),
              italics: marks.some((m: any) => m.type === 'italic'),
              underline: marks.some((m: any) => m.type === 'underline') ? {} : undefined,
              strike: marks.some((m: any) => m.type === 'strike'),
              color: marks.find((m: any) => m.type === 'textStyle')?.attrs?.color?.replace('#', '') || undefined,
            });
          });
          paragraphs.push(new Paragraph({
            children: textRuns.length ? textRuns : [new TextRun('')],
            alignment: node.attrs?.textAlign === 'center' ? 'center' as any :
              node.attrs?.textAlign === 'right' ? 'right' as any :
                node.attrs?.textAlign === 'justify' ? 'both' as any : undefined,
          }));
        } else if (node.type === 'bulletList' || node.type === 'orderedList') {
          (node.content || []).forEach((li: any) => {
            (li.content || []).forEach((p: any) => {
              const textRuns = (p.content || []).map((c: any) =>
                new TextRun({ text: c.text || '' })
              );
              paragraphs.push(new Paragraph({
                children: textRuns,
                bullet: node.type === 'bulletList' ? { level: 0 } : undefined,
                numbering: node.type === 'orderedList' ? { reference: 'default', level: 0 } : undefined,
              }));
            });
          });
        }
      };

      (json.content || []).forEach(processNode);

      const doc = new Document({
        sections: [{ properties: {}, children: paragraphs }],
      });

      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${docTitle || 'document'}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addToast('DOCX exported', 'success');
    } catch {
      addToast('DOCX export failed', 'error');
    }
  }, [editor, addToast, docTitle]);

  // Export PDF via hidden iframe (avoids pop-up blockers)
  const handleExportPdf = useCallback(() => {
    if (!editor) return;
    const content = editor.getHTML();

    // Remove any previous print iframe
    const existingFrame = document.getElementById('docforge-print-frame');
    if (existingFrame) existingFrame.remove();

    const iframe = document.createElement('iframe');
    iframe.id = 'docforge-print-frame';
    iframe.style.cssText = 'position:fixed;top:-10000px;left:-10000px;width:210mm;height:297mm;border:none;';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
      addToast('Could not create print frame', 'error');
      iframe.remove();
      return;
    }

    iframeDoc.open();
    iframeDoc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${docTitle || 'Document'}</title>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@400;600;700&display=swap" />
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'DM Sans', sans-serif;
            font-size: 14px;
            line-height: 1.7;
            color: #1A1C25;
            padding: 20mm 15mm;
          }
          h1 { font-family: 'Playfair Display', serif; font-size: 32px; font-weight: 700; margin-bottom: 0.5em; }
          h2 { font-family: 'Playfair Display', serif; font-size: 24px; font-weight: 600; margin-bottom: 0.5em; }
          h3 { font-size: 20px; font-weight: 600; margin-bottom: 0.5em; }
          p { margin-bottom: 0.7em; }
          table { border-collapse: collapse; width: 100%; }
          td, th { border: 1px solid #ccc; padding: 8px; }
          img { max-width: 100%; height: auto; }
          blockquote { border-left: 3px solid #4F7EF7; padding-left: 16px; font-style: italic; color: #555; }
          @page { margin: 0; size: A4; }
        </style>
      </head>
      <body>${content}</body>
      </html>
    `);
    iframeDoc.close();

    const waitForImagesAndPrint = async () => {
      try {
        const images = Array.from(iframeDoc.images);
        const imagePromises = images.map(img => {
          if (img.complete) return Promise.resolve();
          return new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve; // Continue even if one image fails
          });
        });

        // Wait up to 3 seconds for all images to completely load
        await Promise.race([
          Promise.all(imagePromises),
          new Promise(resolve => setTimeout(resolve, 3000))
        ]);

        if (iframeDoc.fonts && iframeDoc.fonts.ready) {
          await iframeDoc.fonts.ready;
        }

        // Add a tiny delay for final rendering cycle
        setTimeout(() => {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          setTimeout(() => iframe.remove(), 2000);
        }, 100);
      } catch (err) {
        console.error('Print failed:', err);
        addToast('Print failed — try again', 'error');
        iframe.remove();
      }
    };

    waitForImagesAndPrint();
    addToast('Preparing PDF…', 'info');
  }, [editor, addToast, docTitle]);

  // Copy HTML
  const handleCopyHtml = useCallback(() => {
    if (!editor) return;
    navigator.clipboard.writeText(editor.getHTML());
    addToast('Copied as HTML', 'success');
  }, [editor, addToast]);

  // Version snapshot
  const handleSnapshot = useCallback(() => {
    if (!editor) return;
    const snapshot: VersionSnapshot = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      content: editor.getHTML(),
      title: docTitle,
    };
    const updated = [snapshot, ...snapshots].slice(0, 5);
    setSnapshots(updated);
    localStorage.setItem('docforge-snapshots', JSON.stringify(updated));
    addToast('Version snapshot saved', 'success');
  }, [editor, snapshots, docTitle, addToast]);

  const restoreSnapshot = useCallback((snap: VersionSnapshot) => {
    if (!editor) return;
    editor.commands.setContent(snap.content);
    setShowSnapshots(false);
    addToast('Snapshot restored', 'success');
  }, [editor, addToast]);

  // Word/char count
  const stats = useMemo(() => {
    if (!editor) return { words: 0, chars: 0, pages: 1 };
    const text = editor.getText();
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    return { words, chars: text.length, pages: Math.max(1, Math.ceil(words / 250)) };
  }, [editor?.getText()]);

  // TOC
  const tocItems = useMemo(() => {
    if (!editor) return [];
    const items: { level: number; text: string; pos: number }[] = [];
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'heading' && node.attrs.level <= 3) {
        items.push({ level: node.attrs.level, text: node.textContent, pos });
      }
    });
    return items;
  }, [editor?.state.doc]);

  if (!editor) return null;

  const pageWidth = pageSettings.size === 'a4' ? '210mm' : '8.5in';
  const pageHeight = pageSettings.size === 'a4' ? '297mm' : '11in';

  const tabItems: { id: ToolbarTab; label: string }[] = [
    { id: 'home', label: 'Home' },
    { id: 'insert', label: 'Insert' },
    { id: 'layout', label: 'Layout' },
    { id: 'review', label: 'Review' },
    { id: 'view', label: 'View' },
  ];

  return (
    <>
      {/* Sidebar */}
      <aside className="sidebar" role="toolbar" aria-label="Word Processor Tools">
        <div className="sidebar-section-label">Format</div>
        <button className={`icon-btn ${editor.isActive('bold') ? 'active' : ''}`} onClick={() => editor.chain().focus().toggleBold().run()} aria-label="Bold [Ctrl+B]"><Bold size={18} /></button>
        <button className={`icon-btn ${editor.isActive('italic') ? 'active' : ''}`} onClick={() => editor.chain().focus().toggleItalic().run()} aria-label="Italic [Ctrl+I]"><Italic size={18} /></button>
        <button className={`icon-btn ${editor.isActive('underline') ? 'active' : ''}`} onClick={() => editor.chain().focus().toggleUnderline().run()} aria-label="Underline [Ctrl+U]"><UnderlineIcon size={18} /></button>

        <div className="sidebar-section-label">Insert</div>
        <button className="icon-btn" onClick={() => imageInputRef.current?.click()} aria-label="Insert Image"><Image size={18} /></button>
        <button className="icon-btn" onClick={() => { setActiveTab('insert'); setShowTablePicker(true); }} aria-label="Insert Table"><TableIcon size={18} /></button>
        <button className="icon-btn" onClick={() => setShowLinkModal(true)} aria-label="Insert Link [Ctrl+K]"><Link2 size={18} /></button>

        <div className="sidebar-section-label">Heading</div>
        {[1, 2, 3].map(level => {
          const icons = [Heading1, Heading2, Heading3];
          const Icon = icons[level - 1];
          return (
            <button
              key={level}
              className={`icon-btn ${editor.isActive('heading', { level }) ? 'active' : ''}`}
              onClick={() => editor.chain().focus().toggleHeading({ level: level as 1 | 2 | 3 }).run()}
              aria-label={`Heading ${level}`}
            ><Icon size={18} /></button>
          );
        })}
      </aside>

      {/* Toolbar */}
      <div className="toolbar" role="toolbar" aria-label="Word Processor Toolbar">
        <div className="toolbar-tabs">
          {tabItems.map(tab => (
            <button
              key={tab.id}
              className={`toolbar-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >{tab.label}</button>
          ))}
        </div>

        <div className="ribbon-toolbar">
          {activeTab === 'home' && (
            <>
              <div className="ribbon-group">
                <button className="icon-btn sm" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} aria-label="Undo"><Undo2 size={15} /></button>
                <button className="icon-btn sm" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} aria-label="Redo"><Redo2 size={15} /></button>
              </div>
              <div className="ribbon-group">
                <select
                  className="font-select"
                  value={editor.getAttributes('textStyle').fontFamily || 'DM Sans'}
                  onChange={e => editor.chain().focus().setFontFamily(e.target.value).run()}
                  aria-label="Font family"
                >
                  {FONTS.map(f => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
                </select>
                <select
                  className="font-size-input"
                  value={editor.getAttributes('textStyle').fontSize || '14'}
                  onChange={e => editor.chain().focus().setMark('textStyle', { fontSize: e.target.value }).run()}
                  aria-label="Font size"
                >
                  {FONT_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="ribbon-group">
                <button className={`icon-btn sm ${editor.isActive('bold') ? 'active' : ''}`} onClick={() => editor.chain().focus().toggleBold().run()} aria-label="Bold"><Bold size={15} /></button>
                <button className={`icon-btn sm ${editor.isActive('italic') ? 'active' : ''}`} onClick={() => editor.chain().focus().toggleItalic().run()} aria-label="Italic"><Italic size={15} /></button>
                <button className={`icon-btn sm ${editor.isActive('underline') ? 'active' : ''}`} onClick={() => editor.chain().focus().toggleUnderline().run()} aria-label="Underline"><UnderlineIcon size={15} /></button>
                <button className={`icon-btn sm ${editor.isActive('strike') ? 'active' : ''}`} onClick={() => editor.chain().focus().toggleStrike().run()} aria-label="Strikethrough"><Strikethrough size={15} /></button>
                <button className={`icon-btn sm ${editor.isActive('subscript') ? 'active' : ''}`} onClick={() => editor.chain().focus().toggleSubscript().run()} aria-label="Subscript"><SubIcon size={15} /></button>
                <button className={`icon-btn sm ${editor.isActive('superscript') ? 'active' : ''}`} onClick={() => editor.chain().focus().toggleSuperscript().run()} aria-label="Superscript"><SupIcon size={15} /></button>
              </div>
              <div className="ribbon-group">
                <div style={{ position: 'relative', display: 'inline-flex' }}>
                  <input type="color" value={textColor} onChange={e => { setTextColor(e.target.value); editor.chain().focus().setColor(e.target.value).run(); }} style={{ width: 24, height: 24, border: 'none', cursor: 'pointer', background: 'transparent' }} aria-label="Text color" />
                </div>
                <div style={{ position: 'relative', display: 'inline-flex' }}>
                  <input type="color" value={highlightColor} onChange={e => { setHighlightColor(e.target.value); editor.chain().focus().toggleHighlight({ color: e.target.value }).run(); }} style={{ width: 24, height: 24, border: 'none', cursor: 'pointer', background: 'transparent' }} aria-label="Highlight color" />
                </div>
              </div>
              <div className="ribbon-group">
                <button className={`icon-btn sm ${editor.isActive({ textAlign: 'left' }) ? 'active' : ''}`} onClick={() => editor.chain().focus().setTextAlign('left').run()} aria-label="Align left"><AlignLeft size={15} /></button>
                <button className={`icon-btn sm ${editor.isActive({ textAlign: 'center' }) ? 'active' : ''}`} onClick={() => editor.chain().focus().setTextAlign('center').run()} aria-label="Align center"><AlignCenter size={15} /></button>
                <button className={`icon-btn sm ${editor.isActive({ textAlign: 'right' }) ? 'active' : ''}`} onClick={() => editor.chain().focus().setTextAlign('right').run()} aria-label="Align right"><AlignRight size={15} /></button>
                <button className={`icon-btn sm ${editor.isActive({ textAlign: 'justify' }) ? 'active' : ''}`} onClick={() => editor.chain().focus().setTextAlign('justify').run()} aria-label="Justify"><AlignJustify size={15} /></button>
              </div>
              <div className="ribbon-group">
                <select
                  className="select-input"
                  value={lineSpacing}
                  onChange={e => setLineSpacing(Number(e.target.value))}
                  aria-label="Line spacing"
                  style={{ width: 52 }}
                >
                  {LINE_SPACINGS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="ribbon-group">
                <button className={`icon-btn sm ${editor.isActive('bulletList') ? 'active' : ''}`} onClick={() => editor.chain().focus().toggleBulletList().run()} aria-label="Bullet list"><List size={15} /></button>
                <button className={`icon-btn sm ${editor.isActive('orderedList') ? 'active' : ''}`} onClick={() => editor.chain().focus().toggleOrderedList().run()} aria-label="Numbered list"><ListOrdered size={15} /></button>
              </div>
              <div className="ribbon-group">
                <button className="icon-btn sm" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} aria-label="Clear formatting"><RemoveFormatting size={15} /></button>
              </div>
            </>
          )}

          {activeTab === 'insert' && (
            <>
              <div className="ribbon-group">
                <button className="btn btn-ghost" onClick={() => imageInputRef.current?.click()} style={{ fontSize: 12 }}>
                  <Image size={15} /> Image
                </button>
              </div>
              <div className="ribbon-group">
                <button
                  className="btn btn-ghost"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setTablePickerPos({ top: rect.bottom + 4, left: rect.left });
                    setShowTablePicker(s => !s);
                  }}
                  style={{ fontSize: 12 }}
                >
                  <TableIcon size={15} /> Table <ChevronDown size={12} />
                </button>
              </div>
              <div className="ribbon-group">
                <button className="btn btn-ghost" onClick={() => setShowLinkModal(true)} style={{ fontSize: 12 }}>
                  <Link2 size={15} /> Link
                </button>
              </div>
              <div className="ribbon-group">
                <button className="btn btn-ghost" onClick={() => editor.chain().focus().setHorizontalRule().run()} style={{ fontSize: 12 }}>
                  <Minus size={15} /> Horizontal Rule
                </button>
                <button className="btn btn-ghost" onClick={() => (editor.chain().focus() as any).setPageBreak().run()} style={{ fontSize: 12, marginLeft: 4 }}>
                  Page Break
                </button>
              </div>
              <div className="ribbon-group">
                {[1, 2, 3, 4, 5, 6].map(level => (
                  <button
                    key={level}
                    className={`icon-btn sm ${editor.isActive('heading', { level }) ? 'active' : ''}`}
                    onClick={() => editor.chain().focus().toggleHeading({ level: level as 1|2|3|4|5|6 }).run()}
                    aria-label={`Heading ${level}`}
                  >
                    <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>H{level}</span>
                  </button>
                ))}
              </div>
              <div className="ribbon-group">
                <button className={`icon-btn sm ${editor.isActive('blockquote') ? 'active' : ''}`} onClick={() => editor.chain().focus().toggleBlockquote().run()} aria-label="Blockquote"><Quote size={15} /></button>
              </div>
            </>
          )}

          {activeTab === 'layout' && (
            <>
              <div className="ribbon-group">
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 6 }}>Size</span>
                <select className="select-input" value={pageSettings.size} onChange={e => setPageSettings(ps => ({ ...ps, size: e.target.value as 'a4' | 'letter' }))} aria-label="Page size">
                  <option value="a4">A4</option>
                  <option value="letter">Letter</option>
                </select>
              </div>
              <div className="ribbon-group">
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 6 }}>Orientation</span>
                <select className="select-input" value={pageSettings.orientation} onChange={e => setPageSettings(ps => ({ ...ps, orientation: e.target.value as 'portrait' | 'landscape' }))} aria-label="Orientation">
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </select>
              </div>
              <div className="ribbon-group">
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 6 }}>Margins (mm)</span>
                {(['top', 'bottom', 'left', 'right'] as const).map(side => (
                  <div key={side} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <label style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{side[0].toUpperCase()}</label>
                    <input
                      type="number"
                      className="property-input"
                      style={{ width: 44 }}
                      value={pageSettings.margins[side]}
                      onChange={e => setPageSettings(ps => ({
                        ...ps, margins: { ...ps.margins, [side]: Number(e.target.value) }
                      }))}
                      aria-label={`${side} margin`}
                    />
                  </div>
                ))}
              </div>
              <div className="ribbon-group">
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 6 }}>Columns</span>
                {[1, 2, 3].map(c => (
                  <button
                    key={c}
                    className={`icon-btn sm ${pageSettings.columns === c ? 'active' : ''}`}
                    onClick={() => setPageSettings(ps => ({ ...ps, columns: c as 1 | 2 | 3 }))}
                    aria-label={`${c} column${c > 1 ? 's' : ''}`}
                  >
                    <span style={{ fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{c}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {activeTab === 'review' && (
            <>
              <div className="ribbon-group">
                <button className={`btn ${trackChanges ? 'btn-primary' : 'btn-ghost'}`} onClick={() => { setTrackChanges(t => !t); addToast(trackChanges ? 'Track changes off' : 'Track changes on', 'info'); }} style={{ fontSize: 12 }}>
                  <CheckCheck size={15} /> Track Changes
                </button>
              </div>
              <div className="ribbon-group">
                <button className="btn btn-ghost" onClick={() => setShowFindReplace(s => !s)} style={{ fontSize: 12 }}>
                  <Search size={15} /> Find & Replace
                </button>
              </div>
            </>
          )}

          {activeTab === 'view' && (
            <>
              <div className="ribbon-group">
                <button className={`btn ${printPreview ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setPrintPreview(p => !p)} style={{ fontSize: 12 }}>
                  <Eye size={15} /> Print Preview
                </button>
              </div>
              <div className="ribbon-group">
                <button className={`btn ${showToc ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setShowToc(t => !t)} style={{ fontSize: 12 }}>
                  <BookOpen size={15} /> Table of Contents
                </button>
              </div>
              <div className="ribbon-group">
                <button className="icon-btn sm" onClick={() => setZoom(z => Math.max(50, z - 10))} aria-label="Zoom out"><ZoomOut size={15} /></button>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', minWidth: 36, textAlign: 'center' }}>{zoom}%</span>
                <button className="icon-btn sm" onClick={() => setZoom(z => Math.min(200, z + 10))} aria-label="Zoom in"><ZoomIn size={15} /></button>
              </div>
            </>
          )}
        </div>

        {/* Export buttons (always visible) */}
        <div className="toolbar-group" style={{ marginLeft: 'auto' }}>
          <button className="btn btn-ghost" onClick={handleExportDocx} style={{ fontSize: 12 }}><Download size={14} /> DOCX</button>
          <button className="btn btn-ghost" onClick={handleExportPdf} style={{ fontSize: 12 }}><Printer size={14} /> PDF</button>
          <button className="btn btn-ghost" onClick={handleCopyHtml} style={{ fontSize: 12 }}><Copy size={14} /> HTML</button>
          <button className="btn btn-ghost" onClick={handleSnapshot} style={{ fontSize: 12 }}><History size={14} /></button>
        </div>
      </div>

      {/* Canvas Area */}
      <div className="canvas-area" style={{ position: 'relative' }}>
        {showFindReplace && (
          <div className="find-replace-bar">
            <div className="find-replace-row">
              <input className="find-replace-input" placeholder="Find…" value={findText} onChange={e => setFindText(e.target.value)} aria-label="Find text" autoFocus />
              <span className="match-count">{matchCount} found</span>
              <button className="icon-btn sm" onClick={() => setShowFindReplace(false)} aria-label="Close find"><X size={14} /></button>
            </div>
            <div className="find-replace-row">
              <input className="find-replace-input" placeholder="Replace with…" value={replaceText} onChange={e => setReplaceText(e.target.value)} aria-label="Replace text" />
              <button className="btn btn-ghost" onClick={handleReplace} style={{ fontSize: 11, padding: '4px 8px' }}>Replace</button>
              <button className="btn btn-ghost" onClick={handleReplaceAll} style={{ fontSize: 11, padding: '4px 8px' }}>All</button>
            </div>
          </div>
        )}

        {showToc && tocItems.length > 0 && (
          <div style={{ position: 'absolute', left: 16, top: 16, width: 220, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 12, zIndex: 30, boxShadow: 'var(--shadow-md)', maxHeight: '80%', overflowY: 'auto' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>Table of Contents</div>
            {tocItems.map((item, i) => (
              <button
                key={i}
                style={{
                  display: 'block', width: '100%', textAlign: 'left', padding: '4px 0',
                  paddingLeft: (item.level - 1) * 12, background: 'none', border: 'none',
                  color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer',
                }}
                onClick={() => {
                  editor.chain().focus().setTextSelection(item.pos).run();
                  // scroll to the element
                  const domNode = editor.view.domAtPos(item.pos);
                  (domNode.node as HTMLElement)?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
                }}
              >
                {item.text || '(untitled)'}
              </button>
            ))}
          </div>
        )}

        <div className="word-page-container" style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}>
          <div
            className="word-page"
            style={{
              width: pageSettings.orientation === 'landscape' ? pageHeight : pageWidth,
              minHeight: pageSettings.orientation === 'landscape' ? pageWidth : pageHeight,
            }}
          >
            <div
              className="word-page-inner"
              style={{
                padding: `${pageSettings.margins.top}mm ${pageSettings.margins.right}mm ${pageSettings.margins.bottom}mm ${pageSettings.margins.left}mm`,
                columnCount: pageSettings.columns > 1 ? pageSettings.columns : undefined,
                columnGap: '20px',
                lineHeight: lineSpacing,
              }}
            >
              <EditorContent editor={editor} />
            </div>
          </div>
        </div>
      </div>

      {/* Properties Panel */}
      <aside className="properties-panel">
        <div className="property-section">
          <div className="property-section-title">Document Info</div>
          <div className="property-row"><span className="property-label">Words</span><span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{stats.words}</span></div>
          <div className="property-row"><span className="property-label">Characters</span><span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{stats.chars}</span></div>
          <div className="property-row"><span className="property-label">Est. Pages</span><span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{stats.pages}</span></div>
        </div>
        <div className="property-section">
          <div className="property-section-title">Page Setup</div>
          <div className="property-row"><span className="property-label">Size</span><span style={{ fontSize: 13, color: 'var(--text-primary)', textTransform: 'uppercase' }}>{pageSettings.size}</span></div>
          <div className="property-row"><span className="property-label">Orientation</span><span style={{ fontSize: 13, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{pageSettings.orientation}</span></div>
          <div className="property-row"><span className="property-label">Columns</span><span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{pageSettings.columns}</span></div>
        </div>
        {snapshots.length > 0 && (
          <div className="property-section">
            <div className="property-section-title">Version History</div>
            <button className="btn btn-ghost" onClick={() => setShowSnapshots(s => !s)} style={{ fontSize: 12, width: '100%', justifyContent: 'flex-start' }}>
              <History size={14} /> {snapshots.length} snapshot{snapshots.length !== 1 ? 's' : ''}
            </button>
            {showSnapshots && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {snapshots.map(s => (
                  <button key={s.id} className="btn btn-secondary" onClick={() => restoreSnapshot(s)} style={{ fontSize: 11, justifyContent: 'flex-start' }}>
                    {new Date(s.timestamp).toLocaleString()}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {trackChanges && (
          <div className="property-section">
            <div className="property-section-title">Track Changes</div>
            <p style={{ fontSize: 12, color: 'var(--success)' }}>● Active — changes are being tracked</p>
          </div>
        )}
      </aside>

      {/* Status Bar */}
      <footer className="statusbar">
        <div className="statusbar-left">
          <span className="statusbar-item">{stats.words} words</span>
          <span className="statusbar-item">{stats.chars} characters</span>
          <span className="statusbar-item">~{stats.pages} page{stats.pages !== 1 ? 's' : ''}</span>
        </div>
        <div className="statusbar-right">
          {trackChanges && <span className="statusbar-item" style={{ color: 'var(--success)' }}>Track Changes ON</span>}
          <div className="zoom-slider-container">
            <ZoomOut size={12} />
            <input type="range" className="zoom-slider" min={50} max={200} step={5} value={zoom} onChange={e => setZoom(Number(e.target.value))} aria-label="Zoom" />
            <ZoomIn size={12} />
            <span style={{ fontFamily: 'var(--font-mono)', minWidth: 36 }}>{zoom}%</span>
          </div>
        </div>
      </footer>

      {/* Hidden inputs */}
      <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageInsert} style={{ display: 'none' }} />

      {/* Link Modal */}
      {showLinkModal && (
        <div className="modal-overlay" onClick={() => setShowLinkModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ minWidth: 360 }}>
            <div className="modal-header">
              <span className="modal-title">Insert Link</span>
              <button className="icon-btn" onClick={() => setShowLinkModal(false)} aria-label="Close"><X size={18} /></button>
            </div>
            <div className="modal-body">
              <input
                className="find-replace-input"
                placeholder="https://example.com"
                value={linkUrl}
                onChange={e => setLinkUrl(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleInsertLink(); }}
                autoFocus
                style={{ width: '100%' }}
                aria-label="URL"
              />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowLinkModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleInsertLink}>Insert</button>
            </div>
          </div>
        </div>
      )}

      {/* Version Snapshots Modal */}
      {showSnapshots && (
        <div className="modal-overlay" onClick={() => setShowSnapshots(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Version Snapshots</span>
              <button className="icon-btn" onClick={() => setShowSnapshots(false)} aria-label="Close"><X size={18} /></button>
            </div>
            <div className="modal-body">
              {snapshots.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No snapshots yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {snapshots.map(s => (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-base)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{s.title}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(s.timestamp).toLocaleString()}</div>
                      </div>
                      <button className="btn btn-secondary" onClick={() => restoreSnapshot(s)} style={{ fontSize: 11 }}>Restore</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {showTablePicker && tablePickerPos && (
        <div style={{ position: 'fixed', top: tablePickerPos.top, left: tablePickerPos.left, zIndex: 10000, background: '#252526', border: '1px solid #444', borderRadius: '4px', padding: '10px 14px', boxShadow: '0 8px 32px rgba(0,0,0,0.6)', width: 'auto', minWidth: 200 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: tablePickerHover.rows > 0 ? 'var(--accent)' : '#fff', marginBottom: 12, fontFamily: 'Segoe UI, sans-serif' }}>
            {tablePickerHover.rows > 0 ? `${tablePickerHover.rows}x${tablePickerHover.cols} Table` : 'Insert Table'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 20px)', gap: '2px', marginBottom: 12 }}>
            {Array.from({ length: 48 }, (_, i) => {
              const row = Math.floor(i / 8) + 1;
              const col = (i % 8) + 1;
              const isHovered = row <= tablePickerHover.rows && col <= tablePickerHover.cols;
              return (
                <div
                  key={i}
                  style={{
                    width: 20, height: 20, border: '1px solid #555',
                    background: isHovered ? 'var(--accent-dim)' : '#fff',
                    borderColor: isHovered ? 'var(--accent)' : '#555',
                    cursor: 'pointer', transition: 'all 0.1s'
                  }}
                  onMouseEnter={() => setTablePickerHover({ rows: row, cols: col })}
                  onClick={() => handleInsertTable(row, col)}
                />
              );
            })}
          </div>
          <div style={{ borderTop: '1px solid #444', margin: '0 -14px', padding: '10px 14px 0 14px' }}>
            <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', padding: '6px 8px', fontSize: 13, color: '#fff', gap: 10 }} onClick={() => handleInsertTable(3, 3)}>
              <TableIcon size={16} /> <span>Insert Table...</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
