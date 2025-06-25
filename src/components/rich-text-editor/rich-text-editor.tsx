'use client';

import React, { useRef, useImperativeHandle, forwardRef, useState } from 'react';
import JoditEditor from './JoditEditorNoSSR';

// Define the ref type for the RichTextEditor component
export type RichTextEditorHandle = {
  getContent: () => string;
  setContent: (content: string) => void;
};

type RichTextEditorProps = {
  initialContent?: string;
};

const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(({ initialContent = '' }, ref) => {
  const editorRef = useRef<any>(null); // Use 'any' to avoid type error

  useImperativeHandle(ref, () => ({
    getContent: () => editorRef.current?.value || '',
    setContent: (newContent: string) => {
      if (editorRef.current) {
        editorRef.current.value = newContent;
      }
    }
  }));

  return (
    <JoditEditor
      ref={editorRef}
      value={initialContent} // Only set initial value
      config={{
        readonly: false,
        height: 300,
        toolbarSticky: false,
        toolbarAdaptive: false,
        showCharsCounter: false,
        showWordsCounter: false,
        showXPathInStatusbar: false,
        askBeforePasteHTML: false,
        askBeforePasteFromWord: false,
        buttons: [
          'bold', 'italic', 'underline', 'strikethrough', '|',
          'ul', 'ol', '|',
          'outdent', 'indent', '|',
          'font', 'fontsize', 'brush', 'paragraph', '|',
          'image', 'table', 'link', '|',
          'align', 'undo', 'redo', '|',
          'hr', 'eraser', 'copyformat', '|',
          'fullsize'
        ]
      }}
    />
  );
});

RichTextEditor.displayName = 'RichTextEditor';
export default RichTextEditor;
