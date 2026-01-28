import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '@/components/Layout';
import { api } from '@/lib/api';

export default function RepositoryDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const [repository, setRepository] = useState<any>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [filter, setFilter] = useState({ language: '', search: '' });

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const loadData = async () => {
    try {
      const [repoData, filesData] = await Promise.all([
        api.getRepository(id as string),
        api.getRepositoryFiles(id as string),
      ]);
      setRepository(repoData);
      setFiles(filesData.files);
    } catch (error) {
      console.error('Failed to load repository:', error);
      router.push('/docs/repositories');
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = async () => {
    try {
      const params: Record<string, string> = {};
      if (filter.language) params.language = filter.language;
      if (filter.search) params.search = filter.search;

      const filesData = await api.getRepositoryFiles(id as string, params);
      setFiles(filesData.files);
    } catch (error) {
      console.error('Failed to filter files:', error);
    }
  };

  const languages = Array.from(new Set(files.map(f => f.language)));

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
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center space-x-4">
            <Link
              href="/docs/repositories"
              className="p-2 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{repository?.name}</h1>
              <p className="text-gray-600">{repository?.fullName}</p>
            </div>
          </div>
        </div>

        {/* Repository Info */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500">Provider</p>
              <p className="font-medium">{repository?.provider}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Branch</p>
              <p className="font-medium">{repository?.branch}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Parsed Files</p>
              <p className="font-medium">{repository?._count?.parsedFiles || 0}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Last Sync</p>
              <p className="font-medium">
                {repository?.lastSyncAt
                  ? new Date(repository.lastSyncAt).toLocaleString()
                  : 'Never'}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* File List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">Parsed Files</h2>
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Search files..."
                    value={filter.search}
                    onChange={(e) => setFilter({ ...filter, search: e.target.value })}
                    onKeyPress={(e) => e.key === 'Enter' && handleFilter()}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  />
                  <select
                    value={filter.language}
                    onChange={(e) => {
                      setFilter({ ...filter, language: e.target.value });
                      setTimeout(handleFilter, 0);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  >
                    <option value="">All Languages</option>
                    {languages.map((lang) => (
                      <option key={lang} value={lang}>{lang}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="divide-y divide-gray-200 max-h-[500px] overflow-y-auto">
                {files.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    <p>No parsed files yet.</p>
                    <p className="text-sm mt-1">Sync the repository to parse code files.</p>
                  </div>
                ) : (
                  files.map((file) => (
                    <button
                      key={file.id}
                      onClick={() => setSelectedFile(file)}
                      className={`w-full text-left p-3 hover:bg-gray-50 ${
                        selectedFile?.id === file.id ? 'bg-blue-50' : ''
                      }`}
                    >
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {file.filePath}
                      </p>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                          {file.language}
                        </span>
                        {file.lineCount && (
                          <span className="text-xs text-gray-400">
                            {file.lineCount} lines
                          </span>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* File Details */}
          <div className="lg:col-span-2">
            {selectedFile ? (
              <div className="bg-white rounded-lg shadow">
                <div className="p-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">
                    {selectedFile.filePath}
                  </h2>
                  <p className="text-sm text-gray-500">
                    Parsed: {new Date(selectedFile.parsedAt).toLocaleString()}
                  </p>
                </div>
                <div className="p-4">
                  {/* Functions */}
                  {selectedFile.functions?.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-sm font-semibold text-gray-700 mb-3">
                        Functions ({selectedFile.functions.length})
                      </h3>
                      <div className="space-y-3">
                        {selectedFile.functions.map((func: any, idx: number) => (
                          <div key={idx} className="border border-gray-200 rounded p-3">
                            <p className="font-mono text-sm text-blue-600">
                              {func.name}
                            </p>
                            {func.description && (
                              <p className="text-sm text-gray-600 mt-1">
                                {func.description}
                              </p>
                            )}
                            {func.params?.length > 0 && (
                              <div className="mt-2">
                                <p className="text-xs text-gray-500">Parameters:</p>
                                <ul className="text-xs text-gray-600 ml-4">
                                  {func.params.map((p: any, i: number) => (
                                    <li key={i}>
                                      <code>{p.name}</code>: {p.type} - {p.description}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Classes */}
                  {selectedFile.classes?.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-sm font-semibold text-gray-700 mb-3">
                        Classes ({selectedFile.classes.length})
                      </h3>
                      <div className="space-y-2">
                        {selectedFile.classes.map((cls: any, idx: number) => (
                          <div key={idx} className="border border-gray-200 rounded p-3">
                            <p className="font-mono text-sm text-purple-600">
                              {cls.name}
                            </p>
                            {cls.description && (
                              <p className="text-sm text-gray-600 mt-1">
                                {cls.description}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Interfaces */}
                  {selectedFile.interfaces?.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-sm font-semibold text-gray-700 mb-3">
                        Interfaces ({selectedFile.interfaces.length})
                      </h3>
                      <div className="space-y-2">
                        {selectedFile.interfaces.map((iface: any, idx: number) => (
                          <div key={idx} className="border border-gray-200 rounded p-3">
                            <p className="font-mono text-sm text-green-600">
                              {iface.name}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!selectedFile.functions?.length &&
                   !selectedFile.classes?.length &&
                   !selectedFile.interfaces?.length && (
                    <p className="text-gray-500 text-center py-8">
                      No documented items found in this file.
                    </p>
                  )}
                </div>
              </div>
            ) : (
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
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <p className="text-gray-500">Select a file to view its documentation</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
