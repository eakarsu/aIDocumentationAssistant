import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ToastContext';
import api from '@/lib/api';
import Link from 'next/link';
import DetailModal from '@/components/DetailModal';
import ConfirmDialog from '@/components/ConfirmDialog';
import { TableSkeleton } from '@/components/SkeletonLoader';

interface EnumOption {
  value: string;
  label: string;
}

export default function NotesPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const { addToast } = useToast();
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [noteTypes, setNoteTypes] = useState<EnumOption[]>([]);
  const [noteStatuses, setNoteStatuses] = useState<EnumOption[]>([]);
  const [filters, setFilters] = useState({
    status: (router.query.status as string) || '',
    noteType: '',
    search: '',
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  // Row detail modal
  const [selectedNote, setSelectedNote] = useState<any>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Single delete confirm
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadEnums();
      loadNotes();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (router.query.status) {
      setFilters(prev => ({ ...prev, status: router.query.status as string }));
    }
  }, [router.query.status]);

  useEffect(() => {
    if (isAuthenticated) {
      loadNotes();
    }
  }, [filters, pagination.page]);

  const loadEnums = async () => {
    try {
      const response = await fetch('/api/enums');
      const data = await response.json();
      setNoteTypes(data.NoteType || []);
      setNoteStatuses(data.NoteStatus || []);
    } catch (error) {
      console.error('Failed to load enums:', error);
    }
  };

  const loadNotes = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      };

      if (filters.status) params.status = filters.status;
      if (filters.noteType) params.noteType = filters.noteType;
      if (filters.search) params.search = filters.search;

      const data = await api.getNotes(params);
      setNotes(data.notes || []);
      setPagination(prev => ({ ...prev, ...data.pagination }));
    } catch (error) {
      console.error('Failed to load notes:', error);
      addToast('Failed to load notes', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Row click handler
  const handleRowClick = (note: any) => {
    setSelectedNote(note);
    setShowDetailModal(true);
  };

  const handleEdit = () => {
    if (selectedNote) {
      setShowDetailModal(false);
      router.push(`/notes/${selectedNote.id}/edit`);
    }
  };

  const handleDeleteFromModal = () => {
    if (selectedNote) {
      setNoteToDelete(selectedNote.id);
      setShowDetailModal(false);
      setShowDeleteConfirm(true);
    }
  };

  const handleConfirmDelete = async () => {
    if (!noteToDelete) return;
    try {
      await api.deleteNote(noteToDelete);
      addToast('Note deleted successfully', 'success');
      setShowDeleteConfirm(false);
      setNoteToDelete(null);
      loadNotes();
    } catch (error: any) {
      addToast(error.message || 'Failed to delete note', 'error');
    }
  };

  // Bulk operations
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === notes.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(notes.map((n) => n.id)));
    }
  };

  const handleBulkDelete = async () => {
    try {
      const result = await api.bulkDelete('notes', Array.from(selectedIds));
      addToast(`Deleted ${result.deletedCount} notes`, 'success');
      setSelectedIds(new Set());
      setShowBulkDeleteConfirm(false);
      loadNotes();
    } catch (error: any) {
      addToast(error.message || 'Bulk delete failed', 'error');
    }
  };

  const handleBulkStatusUpdate = async (status: string) => {
    try {
      const result = await api.bulkUpdate('notes', Array.from(selectedIds), { status });
      addToast(`Updated ${result.updatedCount} notes to ${status}`, 'success');
      setSelectedIds(new Set());
      loadNotes();
    } catch (error: any) {
      addToast(error.message || 'Bulk update failed', 'error');
    }
  };

  const handleExportCsv = async () => {
    try {
      const response = await api.exportCsv('notes');
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'notes_export.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      addToast('Notes exported to CSV', 'success');
    } catch (error: any) {
      addToast('CSV export failed', 'error');
    }
  };

  const getStatusLabel = (value: string) => noteStatuses.find(s => s.value === value)?.label || value;
  const getNoteTypeLabel = (value: string) => noteTypes.find(t => t.value === value)?.label || value;

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notes</h1>
          <p className="text-gray-600">Manage your clinical documentation</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExportCsv} className="btn btn-outline text-sm">
            Export CSV
          </button>
          <Link href="/notes/new" className="btn btn-primary">
            + New Note
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="label">Search</label>
            <input
              type="text"
              className="input"
              placeholder="Patient name or ID..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && loadNotes()}
            />
          </div>

          <div>
            <label className="label">Note Type</label>
            <select
              className="input"
              value={filters.noteType}
              onChange={(e) => setFilters({ ...filters, noteType: e.target.value })}
            >
              <option value="">All Types</option>
              {noteTypes.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Status</label>
            <select
              className="input"
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            >
              <option value="">All Statuses</option>
              {noteStatuses.map((status) => (
                <option key={status.value} value={status.value}>{status.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setFilters({ status: '', noteType: '', search: '' });
                setPagination(prev => ({ ...prev, page: 1 }));
              }}
              className="btn btn-secondary w-full"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="card mb-4 bg-blue-50 border border-blue-200">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-800">
              {selectedIds.size} note{selectedIds.size > 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
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
                Set Pending Review
              </button>
              <button
                onClick={() => setShowBulkDeleteConfirm(true)}
                className="px-3 py-1.5 text-xs font-medium bg-red-100 hover:bg-red-200 text-red-800 rounded-lg"
              >
                Delete Selected
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="px-3 py-1.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg"
              >
                Clear Selection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notes Table */}
      <div className="card">
        {loading ? (
          <TableSkeleton rows={8} columns={7} />
        ) : notes.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No notes found. Create your first note to get started.
          </div>
        ) : (
          <>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th className="w-10">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === notes.length && notes.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th>Patient</th>
                    <th>Type</th>
                    <th>Template</th>
                    <th>Status</th>
                    <th>Author</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {notes.map((note) => (
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
                        <span className="badge badge-blue">{getNoteTypeLabel(note.noteType)}</span>
                      </td>
                      <td className="text-gray-500 text-sm">
                        {note.template?.name || '-'}
                      </td>
                      <td>
                        <span className={`badge ${
                          note.status === 'SIGNED' ? 'badge-green' :
                          note.status === 'DRAFT' ? 'badge-yellow' :
                          note.status === 'PENDING_COSIGN' ? 'badge-yellow' :
                          note.status === 'LOCKED' ? 'badge-gray' :
                          'badge-gray'
                        }`}>
                          {getStatusLabel(note.status)}
                        </span>
                      </td>
                      <td className="text-gray-500 text-sm">
                        {note.author?.firstName} {note.author?.lastName}
                      </td>
                      <td className="text-gray-500">
                        {new Date(note.encounterDate).toLocaleDateString()}
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="flex space-x-2">
                          <Link
                            href={`/notes/${note.id}`}
                            className="text-blue-600 hover:text-blue-700"
                          >
                            View
                          </Link>
                          <Link
                            href={`/notes/${note.id}/edit`}
                            className="text-green-600 hover:text-green-700"
                          >
                            Edit
                          </Link>
                          <button
                            onClick={() => {
                              setNoteToDelete(note.id);
                              setShowDeleteConfirm(true);
                            }}
                            className="text-red-600 hover:text-red-700"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="text-sm text-gray-500">
                Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                {pagination.total} results
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                  disabled={pagination.page === 1}
                  className="btn btn-secondary disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  disabled={pagination.page >= pagination.totalPages}
                  className="btn btn-secondary disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Detail Modal */}
      <DetailModal
        isOpen={showDetailModal}
        title="Note Details"
        fields={selectedNote ? [
          { label: 'Patient Name', value: selectedNote.patientName },
          { label: 'Patient ID', value: selectedNote.patientId },
          { label: 'Note Type', value: <span className="badge badge-blue">{getNoteTypeLabel(selectedNote.noteType)}</span> },
          { label: 'Status', value: (
            <span className={`badge ${
              selectedNote.status === 'SIGNED' ? 'badge-green' :
              selectedNote.status === 'DRAFT' ? 'badge-yellow' : 'badge-gray'
            }`}>{getStatusLabel(selectedNote.status)}</span>
          )},
          { label: 'Template', value: selectedNote.template?.name || 'None' },
          { label: 'Author', value: selectedNote.author ? `${selectedNote.author.firstName} ${selectedNote.author.lastName}` : 'N/A' },
          { label: 'Encounter Date', value: new Date(selectedNote.encounterDate).toLocaleDateString() },
          { label: 'Created', value: new Date(selectedNote.createdAt).toLocaleString() },
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
