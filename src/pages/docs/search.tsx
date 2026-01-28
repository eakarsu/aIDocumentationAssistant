import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '@/components/Layout';
import { api } from '@/lib/api';

export default function SearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [filters, setFilters] = useState({
    category: '',
    status: '',
    author: '',
  });
  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    loadCategories();
    if (router.query.q) {
      setQuery(router.query.q as string);
      handleSearch(router.query.q as string);
    }
  }, [router.query.q]);

  const loadCategories = async () => {
    try {
      const data = await api.getDocCategories({ flat: 'true' });
      setCategories(data);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const handleSearch = async (searchQuery?: string) => {
    const q = searchQuery || query;
    if (!q || q.length < 2) {
      alert('Please enter at least 2 characters');
      return;
    }

    setLoading(true);
    setSearched(true);

    try {
      const params: Record<string, string> = {
        q,
        page: String(pagination.page),
        limit: String(pagination.limit),
      };

      if (filters.category) params.category = filters.category;
      if (filters.status) params.status = filters.status;
      if (filters.author) params.author = filters.author;

      const data = await api.searchDocs(params);
      setResults(data.docs);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/docs/search?q=${encodeURIComponent(query)}`);
  };

  const statusColors: Record<string, string> = {
    DRAFT: 'bg-yellow-100 text-yellow-800',
    IN_REVIEW: 'bg-blue-100 text-blue-800',
    PUBLISHED: 'bg-green-100 text-green-800',
    ARCHIVED: 'bg-gray-100 text-gray-800',
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Search Documentation</h1>
          <p className="text-gray-600 mt-1">Search across all your documents</p>
        </div>

        {/* Search Form */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <form onSubmit={handleSubmit}>
            <div className="flex space-x-4">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search documents..."
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <svg
                  className="absolute left-3 top-3.5 w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Searching...' : 'Search'}
              </button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-4 mt-4">
              <select
                value={filters.category}
                onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>

              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">All Status</option>
                <option value="DRAFT">Draft</option>
                <option value="IN_REVIEW">In Review</option>
                <option value="PUBLISHED">Published</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>
          </form>
        </div>

        {/* Results */}
        {searched && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-600">
                {pagination.total} result{pagination.total !== 1 ? 's' : ''} found
                {query && <span> for "<strong>{query}</strong>"</span>}
              </p>
            </div>

            {results.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <svg
                  className="w-12 h-12 mx-auto text-gray-400 mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No results found</h3>
                <p className="text-gray-500">Try different keywords or adjust your filters</p>
              </div>
            ) : (
              <div className="space-y-4">
                {results.map((doc) => (
                  <Link
                    key={doc.id}
                    href={`/docs/${doc.id}`}
                    className="block bg-white rounded-lg shadow hover:shadow-md transition-shadow p-5"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3
                        className="text-lg font-semibold text-gray-900"
                        dangerouslySetInnerHTML={{ __html: doc.highlightedTitle }}
                      />
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[doc.status]}`}>
                        {doc.status}
                      </span>
                    </div>

                    {doc.highlightedExcerpt && (
                      <p
                        className="text-sm text-gray-600 mb-3 line-clamp-2"
                        dangerouslySetInnerHTML={{ __html: doc.highlightedExcerpt }}
                      />
                    )}

                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <span>{doc.author.firstName} {doc.author.lastName}</span>
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
                      <span>{new Date(doc.updatedAt).toLocaleDateString()}</span>
                    </div>

                    {doc.tags?.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {doc.tags.slice(0, 5).map(({ tag }: any) => (
                          <span
                            key={tag.id}
                            className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs"
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            )}

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex justify-center items-center space-x-2 mt-6">
                <button
                  onClick={() => {
                    setPagination({ ...pagination, page: pagination.page - 1 });
                    handleSearch();
                  }}
                  disabled={pagination.page === 1}
                  className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => {
                    setPagination({ ...pagination, page: pagination.page + 1 });
                    handleSearch();
                  }}
                  disabled={pagination.page === pagination.totalPages}
                  className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}

        {/* Search Tips */}
        {!searched && (
          <div className="bg-blue-50 rounded-lg p-6">
            <h3 className="text-lg font-medium text-blue-900 mb-2">Search Tips</h3>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>Search by document title, content, or excerpt</li>
              <li>Use filters to narrow down results by category or status</li>
              <li>Minimum 2 characters required for search</li>
            </ul>
          </div>
        )}
      </div>

      <style jsx>{`
        mark {
          background-color: #fef08a;
          padding: 0 2px;
          border-radius: 2px;
        }
      `}</style>
    </Layout>
  );
}
