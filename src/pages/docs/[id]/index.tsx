import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '@/components/Layout';
import { api } from '@/lib/api';
import { marked } from 'marked';

export default function ViewDocPage() {
  const router = useRouter();
  const { id } = router.query;
  const [doc, setDoc] = useState<any>(null);
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [showExportModal, setShowExportModal] = useState(false);

  useEffect(() => {
    if (id) {
      loadDoc();
    }
  }, [id]);

  const loadDoc = async () => {
    try {
      const data = await api.getDoc(id as string);
      setDoc(data);
      // Parse markdown to HTML
      const html = await marked(data.content);
      setHtmlContent(html);
    } catch (error) {
      console.error('Failed to load doc:', error);
      router.push('/docs');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: string) => {
    try {
      let response;

      if (format === 'MARKDOWN') {
        response = await api.exportDoc(id as string, format);
        downloadFile(response.content, response.filename, 'text/markdown');
      } else if (format === 'HTML') {
        response = await api.exportDocToHtml(id as string);
        downloadFile(response.content, response.filename, 'text/html');
      } else if (format === 'DOCX') {
        response = await api.exportDocToDocx(id as string);
        // Convert base64 to blob
        const byteCharacters = atob(response.content);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: response.contentType });
        downloadBlob(blob, response.filename);
      } else if (format === 'PDF') {
        response = await api.exportDocToPdf(id as string);
        // Open HTML in new window for printing
        const win = window.open('', '_blank');
        if (win) {
          win.document.write(response.html);
          win.document.close();
          setTimeout(() => win.print(), 500);
        }
      }

      setShowExportModal(false);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed');
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

  const handlePublish = async () => {
    if (!confirm('Are you sure you want to publish this document?')) return;

    try {
      await api.publishDoc(id as string, { visibility: 'PUBLIC' });
      loadDoc();
    } catch (error) {
      console.error('Publish failed:', error);
      alert('Failed to publish document');
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  if (!doc) {
    return (
      <Layout>
        <div className="text-center py-12">
          <h2 className="text-xl font-medium text-gray-900">Document not found</h2>
          <Link href="/docs" className="text-blue-600 hover:underline mt-2 inline-block">
            Back to documents
          </Link>
        </div>
      </Layout>
    );
  }

  const statusColors: Record<string, string> = {
    DRAFT: 'bg-yellow-100 text-yellow-800',
    IN_REVIEW: 'bg-blue-100 text-blue-800',
    PUBLISHED: 'bg-green-100 text-green-800',
    ARCHIVED: 'bg-gray-100 text-gray-800',
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link
                href="/docs"
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
              <div>
                <div className="flex items-center space-x-3">
                  <h1 className="text-2xl font-bold text-gray-900">{doc.title}</h1>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[doc.status]}`}>
                    {doc.status}
                  </span>
                </div>
                <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                  <span>By {doc.author.firstName} {doc.author.lastName}</span>
                  {doc.category && (
                    <span className="flex items-center">
                      {doc.category.color && (
                        <span
                          className="w-2 h-2 rounded-full mr-1"
                          style={{ backgroundColor: doc.category.color }}
                        />
                      )}
                      {doc.category.name}
                    </span>
                  )}
                  {doc.readingTime && <span>{doc.readingTime} min read</span>}
                  <span>Updated {new Date(doc.updatedAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {doc.status === 'DRAFT' && (
                <button
                  onClick={handlePublish}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Publish
                </button>
              )}
              <button
                onClick={() => setShowExportModal(true)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Export
              </button>
              <Link
                href={`/docs/${doc.id}/edit`}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Edit
              </Link>
            </div>
          </div>
        </div>

        {/* Tags */}
        {doc.tags?.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {doc.tags.map(({ tag }: any) => (
              <Link
                key={tag.id}
                href={`/docs?tag=${tag.slug}`}
                className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm hover:bg-blue-100"
              >
                {tag.name}
              </Link>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="bg-white rounded-lg shadow">
          <article
            className="prose prose-blue max-w-none p-8"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
        </div>

        {/* Metadata */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Version History</h3>
            <p className="text-2xl font-semibold text-gray-900">{doc._count?.versions || 1}</p>
            <Link
              href={`/docs/${doc.id}/versions`}
              className="text-sm text-blue-600 hover:underline mt-2 inline-block"
            >
              View history
            </Link>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Comments</h3>
            <p className="text-2xl font-semibold text-gray-900">{doc._count?.comments || 0}</p>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Collaborators</h3>
            <p className="text-2xl font-semibold text-gray-900">{doc._count?.collaborators || 0}</p>
          </div>
        </div>

        {/* Export Modal */}
        {showExportModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Export Document</h2>
              <div className="space-y-3">
                <button
                  onClick={() => handleExport('MARKDOWN')}
                  className="w-full p-3 text-left border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <span className="font-medium">Markdown (.md)</span>
                  <p className="text-sm text-gray-500">Raw markdown file</p>
                </button>
                <button
                  onClick={() => handleExport('HTML')}
                  className="w-full p-3 text-left border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <span className="font-medium">HTML (.html)</span>
                  <p className="text-sm text-gray-500">Standalone web page</p>
                </button>
                <button
                  onClick={() => handleExport('DOCX')}
                  className="w-full p-3 text-left border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <span className="font-medium">Word (.docx)</span>
                  <p className="text-sm text-gray-500">Microsoft Word document</p>
                </button>
                <button
                  onClick={() => handleExport('PDF')}
                  className="w-full p-3 text-left border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <span className="font-medium">PDF</span>
                  <p className="text-sm text-gray-500">Print to PDF</p>
                </button>
              </div>
              <button
                onClick={() => setShowExportModal(false)}
                className="w-full mt-4 px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
