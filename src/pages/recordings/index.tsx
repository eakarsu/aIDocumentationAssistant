import { useState, useEffect, useRef } from 'react';
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

export default function RecordingsPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const { addToast } = useToast();
  const [recordings, setRecordings] = useState<any[]>([]);
  const [recordingTypes, setRecordingTypes] = useState<EnumOption[]>([]);
  const [recordingStatuses, setRecordingStatuses] = useState<EnumOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingType, setRecordingType] = useState<string>('AUDIO');
  const [uploading, setUploading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  // Row detail modal
  const [selectedRecording, setSelectedRecording] = useState<any>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Confirm dialog for delete
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [recordingToDelete, setRecordingToDelete] = useState<string | null>(null);

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
      loadEnums();
      loadRecordings();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      loadRecordings();
    }
  }, [pagination.page]);

  const loadEnums = async () => {
    try {
      const response = await fetch('/api/enums');
      const data = await response.json();
      setRecordingTypes(data.RecordingType || []);
      setRecordingStatuses(data.RecordingStatus || []);
    } catch (error) {
      console.error('Failed to load enums:', error);
    }
  };

  const loadRecordings = async () => {
    setLoading(true);
    try {
      const data = await api.getRecordings({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });
      setRecordings(data.recordings || []);
      setPagination(prev => ({ ...prev, ...data.pagination }));
    } catch (error) {
      console.error('Failed to load recordings:', error);
      addToast('Failed to load recordings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      let stream: MediaStream;

      switch (recordingType) {
        case 'VIDEO':
          stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
          break;
        case 'SCREEN':
          stream = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: true });
          break;
        default:
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const mimeType = recordingType === 'AUDIO' ? 'audio/webm' : 'video/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        await uploadRecording(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      addToast('Recording started', 'info');
    } catch (error) {
      console.error('Failed to start recording:', error);
      addToast('Failed to access media device. Please ensure you have granted permission.', 'error');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      addToast('Recording stopped', 'info');
    }
  };

  const uploadRecording = async (blob: Blob) => {
    setUploading(true);
    try {
      const formData = new FormData();
      const fileName = `recording_${new Date().toISOString()}.webm`;
      formData.append('file', blob, fileName);
      formData.append('type', recordingType);

      const response = await fetch('/api/recordings', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');

      addToast('Recording uploaded successfully', 'success');
      loadRecordings();
    } catch (error) {
      console.error('Upload failed:', error);
      addToast('Failed to upload recording', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleTranscribe = async (id: string) => {
    try {
      await api.transcribeRecording(id);
      addToast('Transcription started. Refresh to see results.', 'info');
      loadRecordings();
    } catch (error: any) {
      addToast(error.message || 'Failed to transcribe recording', 'error');
    }
  };

  // Row click handler
  const handleRowClick = (recording: any) => {
    setSelectedRecording(recording);
    setShowDetailModal(true);
  };

  // Delete from modal
  const handleDeleteFromModal = () => {
    if (selectedRecording) {
      setRecordingToDelete(selectedRecording.id);
      setShowDetailModal(false);
      setShowDeleteConfirm(true);
    }
  };

  // Confirm single delete
  const handleConfirmDelete = async () => {
    if (!recordingToDelete) return;
    try {
      await api.bulkDelete('recordings', [recordingToDelete]);
      addToast('Recording deleted successfully', 'success');
      setShowDeleteConfirm(false);
      setRecordingToDelete(null);
      loadRecordings();
    } catch (error: any) {
      addToast(error.message || 'Failed to delete recording', 'error');
    }
  };

  // Bulk selection
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === recordings.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(recordings.map((r) => r.id)));
    }
  };

  // Bulk delete
  const handleBulkDelete = async () => {
    try {
      const result = await api.bulkDelete('recordings', Array.from(selectedIds));
      addToast(`Deleted ${result.deletedCount} recordings`, 'success');
      setSelectedIds(new Set());
      setShowBulkDeleteConfirm(false);
      loadRecordings();
    } catch (error: any) {
      addToast(error.message || 'Bulk delete failed', 'error');
    }
  };

  // CSV Export
  const handleExportCsv = async () => {
    try {
      const response = await api.exportCsv('recordings');
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'recordings_export.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      addToast('Recordings exported to CSV', 'success');
    } catch (error: any) {
      addToast('CSV export failed', 'error');
    }
  };

  const getTypeLabel = (value: string) => {
    return recordingTypes.find(t => t.value === value)?.label || value;
  };

  const getStatusLabel = (value: string) => {
    return recordingStatuses.find(s => s.value === value)?.label || value;
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '-';
    return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number) => {
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
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
          <h1 className="text-2xl font-bold text-gray-900">Recordings</h1>
          <p className="text-gray-600">Audio, video, and screen recordings for documentation</p>
        </div>
        <button onClick={handleExportCsv} className="btn btn-outline text-sm">
          Export CSV
        </button>
      </div>

      {/* Recording Controls */}
      <div className="card mb-6">
        <h2 className="text-lg font-semibold mb-4">New Recording</h2>
        <div className="flex items-center space-x-4">
          <div>
            <label className="label">Recording Type</label>
            <select
              className="input"
              value={recordingType}
              onChange={(e) => setRecordingType(e.target.value)}
              disabled={isRecording}
            >
              {recordingTypes.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          {isRecording ? (
            <button onClick={stopRecording} className="btn btn-danger flex items-center mt-6">
              <span className="w-3 h-3 bg-white rounded-full animate-pulse mr-2"></span>
              Stop Recording
            </button>
          ) : (
            <button
              onClick={startRecording}
              disabled={uploading}
              className="btn btn-primary flex items-center mt-6"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              {uploading ? 'Uploading...' : 'Start Recording'}
            </button>
          )}
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="card mb-4 bg-blue-50 border border-blue-200">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-800">
              {selectedIds.size} recording{selectedIds.size > 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
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

      {/* Recordings List */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Your Recordings</h2>
        {loading ? (
          <TableSkeleton rows={8} columns={8} />
        ) : recordings.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No recordings yet. Start a recording to get started.
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
                        checked={selectedIds.size === recordings.length && recordings.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th>File</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Duration</th>
                    <th>Linked Note</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {recordings.map((recording) => (
                    <tr
                      key={recording.id}
                      className="cursor-pointer hover:bg-blue-50 transition-colors"
                      onClick={() => handleRowClick(recording)}
                    >
                      <td onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(recording.id)}
                          onChange={() => toggleSelect(recording.id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td>
                        <div className="font-medium text-gray-900">{recording.fileName}</div>
                        <div className="text-gray-500 text-xs">{formatFileSize(recording.fileSize)}</div>
                      </td>
                      <td>
                        <span className={`badge ${
                          recording.type === 'AUDIO' ? 'badge-blue' :
                          recording.type === 'VIDEO' ? 'badge-green' :
                          'badge-gray'
                        }`}>
                          {getTypeLabel(recording.type)}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${
                          recording.status === 'COMPLETED' ? 'badge-green' :
                          recording.status === 'FAILED' ? 'badge-red' :
                          'badge-yellow'
                        }`}>
                          {getStatusLabel(recording.status)}
                        </span>
                      </td>
                      <td className="text-gray-500">{formatDuration(recording.duration)}</td>
                      <td>
                        {recording.note ? (
                          <Link
                            href={`/notes/${recording.note.id}`}
                            className="text-blue-600 hover:text-blue-700"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {recording.note.patientName}
                          </Link>
                        ) : (
                          <span className="text-gray-400">Not linked</span>
                        )}
                      </td>
                      <td className="text-gray-500">
                        {new Date(recording.recordedAt).toLocaleString()}
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="flex space-x-2">
                          {recording.status === 'PROCESSING' && (
                            <button
                              onClick={() => handleTranscribe(recording.id)}
                              className="text-blue-600 hover:text-blue-700"
                            >
                              Transcribe
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setRecordingToDelete(recording.id);
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
        title="Recording Details"
        fields={selectedRecording ? [
          { label: 'File Name', value: selectedRecording.fileName },
          { label: 'Type', value: <span className={`badge ${selectedRecording.type === 'AUDIO' ? 'badge-blue' : selectedRecording.type === 'VIDEO' ? 'badge-green' : 'badge-gray'}`}>{getTypeLabel(selectedRecording.type)}</span> },
          { label: 'Status', value: <span className={`badge ${selectedRecording.status === 'COMPLETED' ? 'badge-green' : selectedRecording.status === 'FAILED' ? 'badge-red' : 'badge-yellow'}`}>{getStatusLabel(selectedRecording.status)}</span> },
          { label: 'Duration', value: formatDuration(selectedRecording.duration) },
          { label: 'File Size', value: formatFileSize(selectedRecording.fileSize) },
          { label: 'MIME Type', value: selectedRecording.mimeType },
          { label: 'Recorded At', value: new Date(selectedRecording.recordedAt).toLocaleString() },
          { label: 'Linked Note', value: selectedRecording.note ? selectedRecording.note.patientName : 'Not linked' },
          { label: 'Transcription', value: selectedRecording.transcription ? selectedRecording.transcription.substring(0, 200) + '...' : 'No transcription' },
          { label: 'Recording ID', value: selectedRecording.id },
        ] : []}
        onClose={() => setShowDetailModal(false)}
        onDelete={handleDeleteFromModal}
      />

      {/* Single Delete Confirm */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete Recording"
        message="Are you sure you want to delete this recording? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => { setShowDeleteConfirm(false); setRecordingToDelete(null); }}
      />

      {/* Bulk Delete Confirm */}
      <ConfirmDialog
        isOpen={showBulkDeleteConfirm}
        title="Delete Selected Recordings"
        message={`Are you sure you want to delete ${selectedIds.size} selected recordings? This action cannot be undone.`}
        confirmLabel={`Delete ${selectedIds.size} Recordings`}
        variant="danger"
        onConfirm={handleBulkDelete}
        onCancel={() => setShowBulkDeleteConfirm(false)}
      />
    </Layout>
  );
}
