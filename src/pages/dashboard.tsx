import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import Link from 'next/link';

interface DashboardStats {
  totalNotes: number;
  draftNotes: number;
  pendingCosign: number;
  recentRecordings: number;
}

export default function Dashboard() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>({
    totalNotes: 0,
    draftNotes: 0,
    pendingCosign: 0,
    recentRecordings: 0,
  });
  const [recentNotes, setRecentNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadDashboardData();
    }
  }, [isAuthenticated]);

  const loadDashboardData = async () => {
    try {
      const [notesData, recordingsData] = await Promise.all([
        api.getNotes({ limit: '5' }),
        api.getRecordings({ limit: '5' }),
      ]);

      setRecentNotes(notesData.notes || []);
      setStats({
        totalNotes: notesData.pagination?.total || 0,
        draftNotes: notesData.notes?.filter((n: any) => n.status === 'DRAFT').length || 0,
        pendingCosign: notesData.notes?.filter((n: any) => n.status === 'PENDING_COSIGN').length || 0,
        recentRecordings: recordingsData.pagination?.total || 0,
      });
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {user?.firstName}!
        </h1>
        <p className="text-gray-600">
          Here's what's happening with your documentation today.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="card">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Notes</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalNotes}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-yellow-100">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Draft Notes</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.draftNotes}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-orange-100">
              <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Pending Co-sign</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.pendingCosign}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Recordings</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.recentRecordings}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-4">
            <Link href="/notes/new" className="btn btn-primary text-center">
              New Note
            </Link>
            <Link href="/recordings" className="btn btn-outline text-center">
              Start Recording
            </Link>
            <Link href="/templates" className="btn btn-outline text-center">
              View Templates
            </Link>
            <Link href="/notes" className="btn btn-outline text-center">
              All Notes
            </Link>
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">AI Features</h2>
          <div className="space-y-3">
            <div className="flex items-center p-3 bg-blue-50 rounded-lg">
              <div className="p-2 bg-blue-100 rounded-lg mr-3">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-gray-900">AI Transcription</p>
                <p className="text-sm text-gray-600">Real-time speech-to-text</p>
              </div>
            </div>

            <div className="flex items-center p-3 bg-green-50 rounded-lg">
              <div className="p-2 bg-green-100 rounded-lg mr-3">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-gray-900">AI Medical Coding</p>
                <p className="text-sm text-gray-600">Suggest CPT/ICD codes</p>
              </div>
            </div>

            <div className="flex items-center p-3 bg-purple-50 rounded-lg">
              <div className="p-2 bg-purple-100 rounded-lg mr-3">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-gray-900">AI Quality Check</p>
                <p className="text-sm text-gray-600">Flag missing elements</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Notes */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Notes</h2>
          <Link href="/notes" className="text-blue-600 hover:text-blue-700 text-sm">
            View all
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="spinner"></div>
          </div>
        ) : recentNotes.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No notes yet. Create your first note to get started.
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {recentNotes.map((note) => (
                  <tr key={note.id}>
                    <td>
                      <div className="font-medium text-gray-900">{note.patientName}</div>
                      <div className="text-gray-500 text-xs">{note.patientId}</div>
                    </td>
                    <td>
                      <span className="badge badge-blue">{note.noteType}</span>
                    </td>
                    <td>
                      <span className={`badge ${
                        note.status === 'SIGNED' ? 'badge-green' :
                        note.status === 'DRAFT' ? 'badge-yellow' :
                        note.status === 'PENDING_COSIGN' ? 'badge-yellow' :
                        'badge-gray'
                      }`}>
                        {note.status}
                      </span>
                    </td>
                    <td className="text-gray-500">
                      {new Date(note.encounterDate).toLocaleDateString()}
                    </td>
                    <td>
                      <Link
                        href={`/notes/${note.id}`}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}
