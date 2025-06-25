'use client';

import React, { useRef, useMemo } from 'react';
import JoditEditor from './JoditEditorNoSSR';

export type RichTextEditorProps = {
  value: string;
  onChange: (value: string) => void;
  config?: object;
  className?: string;
};

const RichTextEditor = ({ value, onChange, config, className }: RichTextEditorProps) => {
  const editorRef = useRef(null);
  const memoizedConfig = useMemo(() => config || {
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
  }, [config]);

  return (
    <JoditEditor
      ref={editorRef}
      value={value}
      config={memoizedConfig}
      onChange={onChange}
      className={className}
    />
  );
};

export default RichTextEditor;
