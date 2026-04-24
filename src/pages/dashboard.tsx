import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ToastContext';
import api from '@/lib/api';
import Link from 'next/link';
import DetailModal from '@/components/DetailModal';
import ConfirmDialog from '@/components/ConfirmDialog';
import { DashboardSkeleton, CardSkeleton } from '@/components/SkeletonLoader';

interface DashboardStats {
  totalNotes: number;
  draftNotes: number;
  pendingCosign: number;
  recentRecordings: number;
}

export default function Dashboard() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const { addToast } = useToast();
  const [stats, setStats] = useState<DashboardStats>({
    totalNotes: 0,
    draftNotes: 0,
    pendingCosign: 0,
    recentRecordings: 0,
  });
  const [recentNotes, setRecentNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Row detail modal
  const [selectedNote, setSelectedNote] = useState<any>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Confirm dialog for delete
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

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
        api.getNotes({ limit: '10' }),
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
      addToast('Failed to load dashboard data', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Card click handlers - navigate to appropriate section
  const handleCardClick = (section: string) => {
    switch (section) {
      case 'totalNotes':
        router.push('/notes');
        break;
      case 'draftNotes':
        router.push('/notes?status=DRAFT');
        break;
      case 'pendingCosign':
        router.push('/notes?status=PENDING_COSIGN');
        break;
      case 'recordings':
        router.push('/recordings');
        break;
    }
  };

  // Row click handler - show detail modal
  const handleRowClick = (note: any) => {
    setSelectedNote(note);
    setShowDetailModal(true);
  };

  // Edit handler from detail modal
  const handleEdit = () => {
    if (selectedNote) {
      setShowDetailModal(false);
      router.push(`/notes/${selectedNote.id}/edit`);
    }
  };

  // Delete handler from detail modal
  const handleDeleteFromModal = () => {
    if (selectedNote) {
      setNoteToDelete(selectedNote.id);
      setShowDetailModal(false);
      setShowDeleteConfirm(true);
    }
  };

  // Confirm single delete
  const handleConfirmDelete = async () => {
    if (!noteToDelete) return;
    try {
      await api.deleteNote(noteToDelete);
      addToast('Note deleted successfully', 'success');
      setShowDeleteConfirm(false);
      setNoteToDelete(null);
      loadDashboardData();
    } catch (error: any) {
      addToast(error.message || 'Failed to delete note', 'error');
    }
  };

  // Bulk selection
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === recentNotes.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(recentNotes.map((n) => n.id)));
    }
  };

  // Bulk delete
  const handleBulkDelete = async () => {
    try {
      const result = await api.bulkDelete('notes', Array.from(selectedIds));
      addToast(`Deleted ${result.deletedCount} notes`, 'success');
      setSelectedIds(new Set());
      setShowBulkDeleteConfirm(false);
      loadDashboardData();
    } catch (error: any) {
      addToast(error.message || 'Bulk delete failed', 'error');
    }
  };

  // Bulk status update
  const handleBulkStatusUpdate = async (status: string) => {
    try {
      const result = await api.bulkUpdate('notes', Array.from(selectedIds), { status });
      addToast(`Updated ${result.updatedCount} notes to ${status}`, 'success');
      setSelectedIds(new Set());
      loadDashboardData();
    } catch (error: any) {
      addToast(error.message || 'Bulk update failed', 'error');
    }
  };

  // CSV Export
  const handleExportCsv = async (type: string) => {
    try {
      const response = await api.exportCsv(type);
      if (!response.ok) {
        throw new Error('Export failed');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}_export.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      addToast(`${type} exported to CSV successfully`, 'success');
    } catch (error: any) {
      addToast(error.message || 'CSV export failed', 'error');
    }
  };

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner"></div>
      </div>
    );
  }

  if (loading) {
    return (
      <Layout>
        <DashboardSkeleton />
      </Layout>
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

      {/* Stats Grid - Clickable Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div
          className="card cursor-pointer hover:shadow-lg transition-shadow duration-200 hover:ring-2 hover:ring-blue-300"
          onClick={() => handleCardClick('totalNotes')}
        >
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

        <div
          className="card cursor-pointer hover:shadow-lg transition-shadow duration-200 hover:ring-2 hover:ring-yellow-300"
          onClick={() => handleCardClick('draftNotes')}
        >
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

        <div
          className="card cursor-pointer hover:shadow-lg transition-shadow duration-200 hover:ring-2 hover:ring-orange-300"
          onClick={() => handleCardClick('pendingCosign')}
        >
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

        <div
          className="card cursor-pointer hover:shadow-lg transition-shadow duration-200 hover:ring-2 hover:ring-green-300"
          onClick={() => handleCardClick('recordings')}
        >
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

      {/* Quick Actions + AI Features */}
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

          {/* CSV Export buttons */}
          <h3 className="text-sm font-semibold text-gray-700 mt-6 mb-3">Export Data</h3>
          <div className="flex flex-wrap gap-2">
            {['notes', 'recordings', 'docs'].map((type) => (
              <button
                key={type}
                onClick={() => handleExportCsv(type)}
                className="px-3 py-1.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
              >
                Export {type.charAt(0).toUpperCase() + type.slice(1)} CSV
              </button>
            ))}
            {(user?.role === 'ADMIN' || user?.role === 'AUDITOR') && (
              <button
                onClick={() => handleExportCsv('audit-logs')}
                className="px-3 py-1.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
              >
                Export Audit Logs CSV
              </button>
            )}
            {user?.role === 'ADMIN' && (
              <button
                onClick={() => handleExportCsv('users')}
                className="px-3 py-1.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
              >
                Export Users CSV
              </button>
            )}
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

      {/* Recent Notes with bulk operations */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Notes</h2>
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <>
                <span className="text-sm text-gray-500">{selectedIds.size} selected</span>
                <button
                  onClick={() => handleBulkStatusUpdate('DRAFT')}
                  className="px-3 py-1.5 text-xs font-medium bg-yellow-100 hover:bg-yellow-200 text-yellow-800 rounded-lg"
                >
                  Set Draft
                </button>
                <button
                  onClick={() => handleBulkStatusUpdate('PENDING_REVIEW')}
                  className="px-3 py-1.5 text-xs font-medium bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-lg"
                >
                  Set Pending
                </button>
                <button
                  onClick={() => setShowBulkDeleteConfirm(true)}
                  className="px-3 py-1.5 text-xs font-medium bg-red-100 hover:bg-red-200 text-red-800 rounded-lg"
                >
                  Delete Selected
                </button>
              </>
            )}
            <Link href="/notes" className="text-blue-600 hover:text-blue-700 text-sm">
              View all
            </Link>
          </div>
        </div>

        {recentNotes.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No notes yet. Create your first note to get started.
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th className="w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === recentNotes.length && recentNotes.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th>Patient</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {recentNotes.map((note) => (
                  <tr
                    key={note.id}
                    className="cursor-pointer hover:bg-blue-50 transition-colors"
                    onClick={() => handleRowClick(note)}
                  >
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(note.id)}
                        onChange={() => toggleSelect(note.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
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
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-2">
                        <Link
                          href={`/notes/${note.id}`}
                          className="text-blue-600 hover:text-blue-700 text-sm"
                        >
                          View
                        </Link>
                        <Link
                          href={`/notes/${note.id}/edit`}
                          className="text-green-600 hover:text-green-700 text-sm"
                        >
                          Edit
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <DetailModal
        isOpen={showDetailModal}
        title="Note Details"
        fields={selectedNote ? [
          { label: 'Patient Name', value: selectedNote.patientName },
          { label: 'Patient ID', value: selectedNote.patientId },
          { label: 'Note Type', value: <span className="badge badge-blue">{selectedNote.noteType}</span> },
          { label: 'Status', value: (
            <span className={`badge ${
              selectedNote.status === 'SIGNED' ? 'badge-green' :
              selectedNote.status === 'DRAFT' ? 'badge-yellow' :
              'badge-gray'
            }`}>
              {selectedNote.status}
            </span>
          )},
          { label: 'Encounter Date', value: new Date(selectedNote.encounterDate).toLocaleDateString() },
          { label: 'Created', value: new Date(selectedNote.createdAt).toLocaleString() },
          { label: 'Author', value: selectedNote.author ? `${selectedNote.author.firstName} ${selectedNote.author.lastName}` : 'N/A' },
          { label: 'Note ID', value: selectedNote.id },
        ] : []}
        onClose={() => setShowDetailModal(false)}
        onEdit={handleEdit}
        onDelete={handleDeleteFromModal}
      />

      {/* Single Delete Confirm */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete Note"
        message="Are you sure you want to delete this note? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => { setShowDeleteConfirm(false); setNoteToDelete(null); }}
      />

      {/* Bulk Delete Confirm */}
      <ConfirmDialog
        isOpen={showBulkDeleteConfirm}
        title="Delete Selected Notes"
        message={`Are you sure you want to delete ${selectedIds.size} selected notes? This action cannot be undone.`}
        confirmLabel={`Delete ${selectedIds.size} Notes`}
        variant="danger"
        onConfirm={handleBulkDelete}
        onCancel={() => setShowBulkDeleteConfirm(false)}
      />
    </Layout>
  );
}
