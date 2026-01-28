import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import DocsDashboard from '@/components/docs/DocsDashboard';
import DocCard from '@/components/docs/DocCard';
import { api } from '@/lib/api';

export default function DocsPage() {
  const router = useRouter();
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
        recentViews: 0, // Would need analytics
      });
    } catch (error) {
      console.error('Failed to load docs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      await api.deleteDoc(id);
      loadData();
    } catch (error) {
      console.error('Failed to delete doc:', error);
      alert('Failed to delete document');
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

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
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
                  <DocCard key={doc.id} doc={doc} onDelete={handleDelete} />
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
    </Layout>
  );
}
