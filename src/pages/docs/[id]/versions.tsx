import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '@/components/Layout';
import { api } from '@/lib/api';
import { diffLines, Change } from 'diff';

interface Version {
  id: string;
  version: number;
  title: string;
  content: string;
  changelog?: string;
  createdAt: string;
  createdBy: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export default function VersionsPage() {
  const router = useRouter();
  const { id } = router.query;
  const [doc, setDoc] = useState<any>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);
  const [compareVersion, setCompareVersion] = useState<Version | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const loadData = async () => {
    try {
      const [docData, versionsData] = await Promise.all([
        api.getDoc(id as string),
        api.getDocVersions(id as string),
      ]);
      setDoc(docData);
      setVersions(versionsData.versions);

      if (versionsData.versions.length > 0) {
        setSelectedVersion(versionsData.versions[0]);
        if (versionsData.versions.length > 1) {
          setCompareVersion(versionsData.versions[1]);
        }
      }
    } catch (error) {
      console.error('Failed to load versions:', error);
      router.push('/docs');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (version: Version) => {
    if (!confirm(`Are you sure you want to restore version ${version.version}? This will create a new version.`)) {
      return;
    }

    setRestoring(true);
    try {
      await api.restoreDocVersion(id as string, version.version);
      router.push(`/docs/${id}`);
    } catch (error) {
      console.error('Failed to restore version:', error);
      alert('Failed to restore version');
    } finally {
      setRestoring(false);
    }
  };

  const getDiff = (): Change[] => {
    if (!selectedVersion || !compareVersion) return [];
    return diffLines(compareVersion.content, selectedVersion.content);
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
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center space-x-4">
            <Link
              href={`/docs/${id}`}
              className="p-2 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Version History</h1>
              <p className="text-gray-600 mt-1">{doc?.title}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Version List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Versions</h2>
                <p className="text-sm text-gray-500">{versions.length} versions</p>
              </div>
              <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
                {versions.map((version) => (
                  <button
                    key={version.id}
                    onClick={() => setSelectedVersion(version)}
                    className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
                      selectedVersion?.id === version.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          Version {version.version}
                          {version.version === versions[0]?.version && (
                            <span className="ml-2 px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded">
                              Current
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {version.createdBy.firstName} {version.createdBy.lastName}
                        </p>
                        {version.changelog && (
                          <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                            {version.changelog}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-gray-400">
                        {new Date(version.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Version Content */}
          <div className="lg:col-span-2">
            {selectedVersion && (
              <div className="bg-white rounded-lg shadow">
                <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      Version {selectedVersion.version}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {selectedVersion.changelog || 'No change description'}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {showDiff ? (
                      <button
                        onClick={() => setShowDiff(false)}
                        className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded"
                      >
                        View Content
                      </button>
                    ) : (
                      <button
                        onClick={() => setShowDiff(true)}
                        disabled={versions.length < 2}
                        className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50"
                      >
                        Show Diff
                      </button>
                    )}
                    {selectedVersion.version !== versions[0]?.version && (
                      <button
                        onClick={() => handleRestore(selectedVersion)}
                        disabled={restoring}
                        className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                      >
                        {restoring ? 'Restoring...' : 'Restore'}
                      </button>
                    )}
                  </div>
                </div>

                {showDiff && compareVersion ? (
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <select
                        value={compareVersion.id}
                        onChange={(e) => {
                          const v = versions.find(v => v.id === e.target.value);
                          if (v) setCompareVersion(v);
                        }}
                        className="px-3 py-1.5 border border-gray-300 rounded text-sm"
                      >
                        {versions
                          .filter(v => v.id !== selectedVersion.id)
                          .map(v => (
                            <option key={v.id} value={v.id}>
                              Compare with v{v.version}
                            </option>
                          ))}
                      </select>
                      <span className="text-sm text-gray-500">
                        v{compareVersion.version} → v{selectedVersion.version}
                      </span>
                    </div>

                    <div className="border rounded-lg overflow-hidden">
                      <pre className="p-4 text-sm overflow-x-auto">
                        {getDiff().map((part, index) => (
                          <span
                            key={index}
                            className={
                              part.added ? 'bg-green-100 text-green-800' :
                              part.removed ? 'bg-red-100 text-red-800' :
                              'text-gray-700'
                            }
                          >
                            {part.value}
                          </span>
                        ))}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div className="p-4">
                    <div className="mb-4">
                      <h3 className="text-sm font-medium text-gray-700">{selectedVersion.title}</h3>
                    </div>
                    <pre className="bg-gray-50 p-4 rounded-lg overflow-x-auto text-sm text-gray-700 whitespace-pre-wrap">
                      {selectedVersion.content}
                    </pre>
                  </div>
                )}

                <div className="p-4 bg-gray-50 border-t border-gray-200 text-sm text-gray-500">
                  <p>
                    Created by {selectedVersion.createdBy.firstName} {selectedVersion.createdBy.lastName} on{' '}
                    {new Date(selectedVersion.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
