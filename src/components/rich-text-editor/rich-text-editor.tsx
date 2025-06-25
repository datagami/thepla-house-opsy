'use client';

import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import Quill from "quill";

// Define the ref type for the RichTextEditor component
export type RichTextEditorHandle = {
  getContent: () => string;
};

type RichTextEditorProps = {
  initialContent?: string;
};

const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(({ initialContent }, ref) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<Quill>(null);

  useEffect(() => {
    let isMounted = true;
    const loadQuill = async () => {
      const Quill = (await import('quill')).default;
      // @ts-expect-error expected error
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
          quillInstance.clipboard.dangerouslyPasteHTML(initialContent);
        }
      }
    };

    loadQuill();

    return () => {
      isMounted = false;
    };
  }, []);

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
