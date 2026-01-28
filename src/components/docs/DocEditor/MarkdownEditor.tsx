import React, { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import '@uiw/react-md-editor/markdown-editor.css';
import '@uiw/react-markdown-preview/markdown.css';

// Dynamically import the editor to avoid SSR issues
const MDEditor = dynamic(
  () => import('@uiw/react-md-editor'),
  { ssr: false }
);

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  height?: number;
  preview?: 'edit' | 'live' | 'preview';
}

export default function MarkdownEditor({
  value,
  onChange,
  placeholder = 'Write your documentation here...',
  height = 500,
  preview = 'live',
}: MarkdownEditorProps) {
  const [currentPreview, setCurrentPreview] = useState(preview);

  const handleChange = useCallback((val?: string) => {
    onChange(val || '');
  }, [onChange]);

  return (
    <div className="markdown-editor-container" data-color-mode="light">
      <div className="flex items-center justify-between mb-2 px-2">
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setCurrentPreview('edit')}
            className={`px-3 py-1 text-sm rounded ${
              currentPreview === 'edit'
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => setCurrentPreview('live')}
            className={`px-3 py-1 text-sm rounded ${
              currentPreview === 'live'
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Split
          </button>
          <button
            type="button"
            onClick={() => setCurrentPreview('preview')}
            className={`px-3 py-1 text-sm rounded ${
              currentPreview === 'preview'
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Preview
          </button>
        </div>
        <div className="text-xs text-gray-500">
          {value.split(/\s+/).filter(Boolean).length} words
        </div>
      </div>
      <MDEditor
        value={value}
        onChange={handleChange}
        preview={currentPreview}
        height={height}
        textareaProps={{
          placeholder,
        }}
        previewOptions={{
          style: {
            padding: '16px',
          },
        }}
      />
    </div>
  );
}
