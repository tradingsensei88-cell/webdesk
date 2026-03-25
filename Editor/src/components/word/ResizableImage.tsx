import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import { useState, useRef, useCallback } from 'react';

// React component for the resizable image node view
function ResizableImageView({ node, updateAttributes, selected }: any) {
  const [resizing, setResizing] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const img = imgRef.current;
    if (!img) return;
    startXRef.current = e.clientX;
    startWidthRef.current = img.offsetWidth;
    setResizing(true);

    const onMouseMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startXRef.current;
      const newWidth = Math.max(50, startWidthRef.current + delta);
      if (img) {
        img.style.width = `${newWidth}px`;
        img.style.height = 'auto';
      }
    };

    const onMouseUp = (ev: MouseEvent) => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      setResizing(false);
      const delta = ev.clientX - startXRef.current;
      const finalWidth = Math.max(50, startWidthRef.current + delta);
      updateAttributes({ width: finalWidth });
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [updateAttributes]);

  const width = node.attrs.width;

  return (
    <NodeViewWrapper className="resizable-image-wrapper" data-drag-handle>
      <div
        style={{
          display: 'inline-block',
          position: 'relative',
          lineHeight: 0,
          maxWidth: '100%',
        }}
      >
        <img
          ref={imgRef}
          src={node.attrs.src}
          alt={node.attrs.alt || ''}
          title={node.attrs.title || undefined}
          style={{
            width: width ? `${width}px` : undefined,
            height: 'auto',
            maxWidth: '100%',
            display: 'block',
            outline: selected ? '2px solid var(--accent, #4F7EF7)' : 'none',
            outlineOffset: '2px',
            borderRadius: '4px',
            cursor: 'default',
          }}
          draggable={false}
        />
        {selected && (
          <>
            {/* Corner resize handles */}
            {['se', 'sw', 'ne', 'nw'].map((corner) => {
              const style: React.CSSProperties = {
                position: 'absolute',
                width: 10,
                height: 10,
                background: 'var(--accent, #4F7EF7)',
                border: '2px solid white',
                borderRadius: 2,
                zIndex: 10,
                cursor: corner === 'se' || corner === 'nw' ? 'nwse-resize' : 'nesw-resize',
              };
              if (corner.includes('s')) style.bottom = -5;
              if (corner.includes('n')) style.top = -5;
              if (corner.includes('e')) style.right = -5;
              if (corner.includes('w')) style.left = -5;

              return (
                <div
                  key={corner}
                  style={style}
                  onMouseDown={handleMouseDown}
                />
              );
            })}
            {/* Width indicator while resizing */}
            {resizing && (
              <div style={{
                position: 'absolute',
                bottom: -24,
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'var(--bg-elevated, #2A2D3A)',
                color: 'var(--text-primary, #EEF0F8)',
                fontSize: 10,
                padding: '2px 6px',
                borderRadius: 4,
                fontFamily: 'var(--font-mono)',
                whiteSpace: 'nowrap',
                zIndex: 20,
              }}>
                {imgRef.current?.offsetWidth}px
              </div>
            )}
          </>
        )}
      </div>
    </NodeViewWrapper>
  );
}

// TipTap extension for resizable images
const ResizableImage = Node.create({
  name: 'image',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
      title: { default: null },
      width: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'img[src]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const attrs: Record<string, any> = { ...HTMLAttributes };
    if (attrs.width) {
      attrs.style = `width: ${attrs.width}px; height: auto;`;
    }
    return ['img', mergeAttributes(attrs)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView);
  },

  addCommands() {
    return {
      setImage: (options: { src: string; alt?: string; title?: string; width?: number }) => ({ commands }: any) => {
        return commands.insertContent({
          type: this.name,
          attrs: options,
        });
      },
    };
  },
});

export default ResizableImage;
