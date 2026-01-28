import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import Link from 'next/link';

interface EnumOption {
  value: string;
  label: string;
}

export default function NotesPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [noteTypes, setNoteTypes] = useState<EnumOption[]>([]);
  const [noteStatuses, setNoteStatuses] = useState<EnumOption[]>([]);
  const [filters, setFilters] = useState({
    status: '',
    noteType: '',
    search: '',
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

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
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this note?')) return;

    try {
      await api.deleteNote(id);
      loadNotes();
    } catch (error: any) {
      alert(error.message || 'Failed to delete note');
    }
  };

  const getStatusLabel = (value: string) => {
    return noteStatuses.find(s => s.value === value)?.label || value;
  };

  const getNoteTypeLabel = (value: string) => {
    return noteTypes.find(t => t.value === value)?.label || value;
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notes</h1>
          <p className="text-gray-600">Manage your clinical documentation</p>
        </div>
        <Link href="/notes/new" className="btn btn-primary">
          + New Note
        </Link>
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

      {/* Notes Table */}
      <div className="card">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="spinner"></div>
          </div>
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
                    <tr key={note.id}>
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
                      <td>
                        <div className="flex space-x-2">
                          <Link
                            href={`/notes/${note.id}`}
                            className="text-blue-600 hover:text-blue-700"
                          >
                            View
                          </Link>
                          {note.status === 'DRAFT' && (
                            <>
                              <Link
                                href={`/notes/${note.id}/edit`}
                                className="text-green-600 hover:text-green-700"
                              >
                                Edit
                              </Link>
                              <button
                                onClick={() => handleDelete(note.id)}
                                className="text-red-600 hover:text-red-700"
                              >
                                Delete
                              </button>
                            </>
                          )}
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
    </Layout>
  );
}
