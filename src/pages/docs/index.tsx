import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import DocsDashboard from '@/components/docs/DocsDashboard';
import DocCard from '@/components/docs/DocCard';
import { useToast } from '@/components/ToastContext';
import DetailModal from '@/components/DetailModal';
import ConfirmDialog from '@/components/ConfirmDialog';
import { CardSkeleton } from '@/components/SkeletonLoader';
import { api } from '@/lib/api';

export default function DocsPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'dashboard' | 'list'>('dashboard');
  const [docs, setDocs] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalDocs: 0,
    publishedDocs: 0,
    draftDocs: 0,
    recentViews: 0,
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [filters, setFilters] = useState({
    status: '',
    category: '',
    search: '',
  });

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Detail modal
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Confirm dialog
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'delete' | 'bulkDelete'>('delete');
  const [deleteTargetId, setDeleteTargetId] = useState<string>('');

  useEffect(() => {
    loadData();
  }, [router.query]);

  useEffect(() => {
    if (router.query.category || router.query.status || router.query.search) {
      setView('list');
      setFilters({
        status: (router.query.status as string) || '',
        category: (router.query.category as string) || '',
        search: (router.query.search as string) || '',
      });
    }
  }, [router.query]);

  const loadData = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {
        page: String(pagination.page),
        limit: String(pagination.limit),
      };

      if (filters.status) params.status = filters.status;
      if (filters.category) params.categoryId = filters.category;
      if (filters.search) params.search = filters.search;

      const [docsResponse, categoriesResponse] = await Promise.all([
        api.getDocs(params),
        api.getDocCategories(),
      ]);

      setDocs(docsResponse.docs);
      setPagination(docsResponse.pagination);
      setCategories(categoriesResponse);

      // Calculate stats
      const allDocs = await api.getDocs({ limit: '1000' });
      setStats({
        totalDocs: allDocs.pagination.total,
        publishedDocs: allDocs.docs.filter((d: any) => d.status === 'PUBLISHED').length,
        draftDocs: allDocs.docs.filter((d: any) => d.status === 'DRAFT').length,
        recentViews: 0,
      });
    } catch (error) {
      console.error('Failed to load docs:', error);
      showToast('Failed to load documents', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Bulk selection
  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === docs.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(docs.map(d => d.id));
    }
  };

  // Delete handlers
  const handleDelete = (id: string) => {
    setDeleteTargetId(id);
    setConfirmAction('delete');
    setShowConfirm(true);
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    setConfirmAction('bulkDelete');
    setShowConfirm(true);
  };

  const handleConfirmDelete = async () => {
    setShowConfirm(false);
    try {
      if (confirmAction === 'delete') {
        await api.deleteDoc(deleteTargetId);
        showToast('Document deleted successfully', 'success');
      } else if (confirmAction === 'bulkDelete') {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/bulk/delete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ type: 'docs', ids: selectedIds }),
        });
        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Bulk delete failed');
        }
        showToast(`${selectedIds.length} document(s) deleted`, 'success');
        setSelectedIds([]);
      }

      if (showDetailModal) {
        setShowDetailModal(false);
        setSelectedDoc(null);
      }
      loadData();
    } catch (error: any) {
      showToast(error.message || 'Failed to delete', 'error');
    }
  };

  // Row/card click
  const handleDocClick = (doc: any) => {
    setSelectedDoc(doc);
    setShowDetailModal(true);
  };

  const handleEditFromModal = () => {
    if (selectedDoc) {
      router.push(`/docs/${selectedDoc.id}/edit`);
    }
  };

  const handleDeleteFromModal = () => {
    if (selectedDoc) {
      setDeleteTargetId(selectedDoc.id);
      setConfirmAction('delete');
      setShowConfirm(true);
    }
  };

  // CSV Export
  const handleExportCsv = async () => {
    try {
      const params: Record<string, string> = { type: 'docs' };
      if (filters.status) params.status = filters.status;
      if (filters.category) params.categoryId = filters.category;
      if (filters.search) params.search = filters.search;

      const queryString = new URLSearchParams(params).toString();
      const response = await fetch(`/api/export/csv?${queryString}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `docs-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      showToast('Documents exported successfully', 'success');
    } catch (error) {
      showToast('Failed to export documents', 'error');
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.category) params.set('category', filters.category);
    if (filters.search) params.set('search', filters.search);
    router.push(`/docs?${params.toString()}`);
  };

  const getDetailFields = (doc: any) => {
    const fields: { label: string; value: string }[] = [
      { label: 'Title', value: doc.title },
      { label: 'Slug', value: doc.slug || 'N/A' },
      { label: 'Status', value: doc.status },
      { label: 'Visibility', value: doc.visibility || 'N/A' },
      { label: 'Author', value: doc.author ? `${doc.author.firstName} ${doc.author.lastName}` : 'N/A' },
      { label: 'Category', value: doc.category?.name || 'Uncategorized' },
      { label: 'Tags', value: doc.tags?.map((t: any) => t.tag?.name || t.name).join(', ') || 'None' },
      { label: 'Reading Time', value: doc.readingTime ? `${doc.readingTime} min` : 'N/A' },
      { label: 'Excerpt', value: doc.excerpt || 'No excerpt' },
      { label: 'Comments', value: String(doc._count?.comments ?? 0) },
      { label: 'Versions', value: String(doc._count?.versions ?? 0) },
      { label: 'Published', value: doc.publishedAt ? new Date(doc.publishedAt).toLocaleString() : 'Not published' },
      { label: 'Updated', value: new Date(doc.updatedAt).toLocaleString() },
      { label: 'ID', value: doc.id },
    ];
    return fields;
  };

  if (loading && docs.length === 0) {
    return (
      <Layout>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Documentation</h1>
          <p className="text-gray-600 mt-1">Manage your documentation library</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Documentation</h1>
            <p className="text-gray-600 mt-1">Manage your documentation library</p>
          </div>
          <div className="flex items-center space-x-3">
            <button onClick={handleExportCsv} className="btn btn-secondary flex items-center">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export CSV
            </button>
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setView('dashboard')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  view === 'dashboard' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => setView('list')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  view === 'list' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                List
              </button>
            </div>
            <button
              onClick={() => router.push('/docs/new')}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Document
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 flex items-center justify-between">
          <span className="text-blue-800 font-medium">
            {selectedIds.length} document(s) selected
          </span>
          <div className="flex space-x-2">
            <button
              onClick={handleBulkDelete}
              className="btn btn-danger text-sm"
            >
              Delete Selected
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="btn btn-secondary text-sm"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {view === 'dashboard' ? (
        <DocsDashboard
          stats={stats}
          recentDocs={docs.slice(0, 5)}
          categories={categories}
        />
      ) : (
        <div className="space-y-6">
          {/* Filters */}
          <div className="bg-white rounded-lg shadow p-4">
            <form onSubmit={handleSearch} className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <input
                  type="text"
                  placeholder="Search documents..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Status</option>
                <option value="DRAFT">Draft</option>
                <option value="IN_REVIEW">In Review</option>
                <option value="PUBLISHED">Published</option>
                <option value="ARCHIVED">Archived</option>
              </select>
              <select
                value={filters.category}
                onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
              <button
                type="submit"
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Filter
              </button>
              {(filters.status || filters.category || filters.search) && (
                <button
                  type="button"
                  onClick={() => {
                    setFilters({ status: '', category: '', search: '' });
                    router.push('/docs');
                  }}
                  className="px-4 py-2 text-gray-500 hover:text-gray-700"
                >
                  Clear
                </button>
              )}
            </form>
          </div>

          {/* Select All */}
          {docs.length > 0 && (
            <div className="flex items-center px-1">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedIds.length === docs.length && docs.length > 0}
                  onChange={toggleSelectAll}
                  className="rounded border-gray-300 text-blue-600 mr-2"
                />
                <span className="text-sm text-gray-600">Select All</span>
              </label>
            </div>
          )}

          {/* Document Grid */}
          {docs.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <svg className="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No documents found</h3>
              <p className="text-gray-500 mb-4">
                {filters.search || filters.status || filters.category
                  ? 'Try adjusting your filters'
                  : 'Get started by creating your first document'}
              </p>
              <button
                onClick={() => router.push('/docs/new')}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create Document
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {docs.map((doc) => (
                  <div key={doc.id} className="relative">
                    {/* Checkbox */}
                    <div className="absolute top-3 left-3 z-10">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(doc.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleSelect(doc.id);
                        }}
                        className="rounded border-gray-300 text-blue-600"
                      />
                    </div>
                    {/* Clickable overlay */}
                    <div
                      onClick={() => handleDocClick(doc)}
                      className="cursor-pointer"
                    >
                      <DocCard doc={doc} onDelete={handleDelete} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex justify-center items-center space-x-2">
                  <button
                    onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                    disabled={pagination.page === 1}
                    className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-600">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                    disabled={pagination.page === pagination.totalPages}
                    className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedDoc && (
        <DetailModal
          title={`Document: ${selectedDoc.title}`}
          fields={getDetailFields(selectedDoc)}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedDoc(null);
          }}
          onEdit={handleEditFromModal}
          onDelete={handleDeleteFromModal}
        />
      )}

      {/* Confirm Dialog */}
      {showConfirm && (
        <ConfirmDialog
          title={confirmAction === 'bulkDelete'
            ? `Delete ${selectedIds.length} Document(s)?`
            : 'Delete Document?'
          }
          message={confirmAction === 'bulkDelete'
            ? `Are you sure you want to delete ${selectedIds.length} selected document(s)? This action cannot be undone.`
            : 'Are you sure you want to delete this document? This action cannot be undone.'
          }
          variant="danger"
          confirmLabel="Delete"
          onConfirm={handleConfirmDelete}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </Layout>
  );
}
