'use client';

import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';

// Define the ref type for the RichTextEditor component
export type RichTextEditorHandle = {
  getContent: () => string;
};

type RichTextEditorProps = {
  initialContent?: string;
};

const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(({ initialContent }, ref) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<any>(null);
  const isContentLoaded = useRef(false);

  console.log(initialContent);

  useEffect(() => {
    let isMounted = true;
    const loadQuill = async () => {
      const Quill = (await import('quill')).default;
      await import('quill/dist/quill.snow.css');
      if (editorRef.current && isMounted && !quillRef.current) {
        const quillInstance = new Quill(editorRef.current, {
          theme: 'snow',
          modules: {
            toolbar: [
              [{ header: [1, 2, 3, false] }],
              ['bold', 'italic', 'underline', 'strike'],
              [{ list: 'ordered' }, { list: 'bullet' }],
              ['link', 'image'],
              ['clean'],
            ],
          },
          placeholder: 'Write something...',
        });
        quillRef.current = quillInstance;
        
        if (initialContent) {
          console.log('inside if');
          quillInstance.clipboard.dangerouslyPasteHTML(initialContent);
        }
      }
    };

    loadQuill();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (quillRef.current && initialContent && !isContentLoaded.current) {
      const delta = quillRef.current.clipboard.convert(initialContent);
      quillRef.current.setContents(delta, 'silent');
      isContentLoaded.current = true;
    }
  }, [initialContent]);

  // Expose the getContent function to the parent component
  useImperativeHandle(ref, () => ({
    getContent: () => {
      if (quillRef.current) {
        return quillRef.current.root.innerHTML; // Return the HTML content
      }
      return '';
    },
  }));

  return <div ref={editorRef} style={{ height: '300px' }} />;
});

RichTextEditor.displayName = 'RichTextEditor';
export default RichTextEditor;
