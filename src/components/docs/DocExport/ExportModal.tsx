import React, { useState } from 'react';
import { api } from '@/lib/api';

interface ExportModalProps {
  docId: string;
  docTitle: string;
  onClose: () => void;
}

const exportFormats = [
  {
    id: 'MARKDOWN',
    name: 'Markdown',
    extension: '.md',
    description: 'Raw markdown file',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    id: 'HTML',
    name: 'HTML',
    extension: '.html',
    description: 'Standalone web page',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
  },
  {
    id: 'DOCX',
    name: 'Word Document',
    extension: '.docx',
    description: 'Microsoft Word format',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    id: 'PDF',
    name: 'PDF',
    extension: '.pdf',
    description: 'Print to PDF (opens print dialog)',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
      </svg>
    ),
  },
];

export default function ExportModal({ docId, docTitle, onClose }: ExportModalProps) {
  const [exporting, setExporting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async (format: string) => {
    setExporting(format);
    setError(null);

    try {
      let response;

      switch (format) {
        case 'MARKDOWN':
          response = await api.exportDoc(docId, 'MARKDOWN');
          downloadFile(response.content, response.filename, 'text/markdown');
          break;

        case 'HTML':
          response = await api.exportDocToHtml(docId);
          downloadFile(response.content, response.filename, 'text/html');
          break;

        case 'DOCX':
          response = await api.exportDocToDocx(docId);
          const byteCharacters = atob(response.content);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: response.contentType });
          downloadBlob(blob, response.filename);
          break;

        case 'PDF':
          response = await api.exportDocToPdf(docId);
          const win = window.open('', '_blank');
          if (win) {
            win.document.write(response.html);
            win.document.close();
            setTimeout(() => win.print(), 500);
          }
          break;
      }

      onClose();
    } catch (err: any) {
      setError(err.message || 'Export failed');
    } finally {
      setExporting(null);
    }
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    downloadBlob(blob, filename);
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Export Document</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          Export "<span className="font-medium">{docTitle}</span>" to:
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="space-y-2">
          {exportFormats.map((format) => (
            <button
              key={format.id}
              onClick={() => handleExport(format.id)}
              disabled={exporting !== null}
              className={`w-full flex items-center p-4 border rounded-lg transition-colors ${
                exporting === format.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              } disabled:opacity-50`}
            >
              <div className={`p-2 rounded-lg mr-4 ${
                exporting === format.id ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
              }`}>
                {exporting === format.id ? (
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                ) : (
                  format.icon
                )}
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-900">
                  {format.name}
                  <span className="text-gray-400 font-normal ml-1">{format.extension}</span>
                </p>
                <p className="text-sm text-gray-500">{format.description}</p>
              </div>
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          className="w-full mt-4 px-4 py-2 text-gray-600 hover:text-gray-800"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
