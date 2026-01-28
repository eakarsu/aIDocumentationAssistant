import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import Link from 'next/link';

interface EnumOption {
  value: string;
  label: string;
}

export default function RecordingsPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
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
    } catch (error) {
      console.error('Failed to start recording:', error);
      alert('Failed to access media device. Please ensure you have granted permission.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const uploadRecording = async (blob: Blob) => {
    setUploading(true);
    try {
      const formData = new FormData();
      const extension = recordingType === 'AUDIO' ? 'webm' : 'webm';
      const fileName = `recording_${new Date().toISOString()}.${extension}`;
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

      loadRecordings();
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Failed to upload recording');
    } finally {
      setUploading(false);
    }
  };

  const handleTranscribe = async (id: string) => {
    try {
      await api.transcribeRecording(id);
      loadRecordings();
      alert('Transcription started. Refresh to see results.');
    } catch (error: any) {
      alert(error.message || 'Failed to transcribe recording');
    }
  };

  const getTypeLabel = (value: string) => {
    return recordingTypes.find(t => t.value === value)?.label || value;
  };

  const getStatusLabel = (value: string) => {
    return recordingStatuses.find(s => s.value === value)?.label || value;
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

      {/* Recordings List */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Your Recordings</h2>
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="spinner"></div>
          </div>
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
                    <tr key={recording.id}>
                      <td>
                        <div className="font-medium text-gray-900">{recording.fileName}</div>
                        <div className="text-gray-500 text-xs">
                          {(recording.fileSize / 1024 / 1024).toFixed(2)} MB
                        </div>
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
                      <td className="text-gray-500">
                        {recording.duration
                          ? `${Math.floor(recording.duration / 60)}:${(recording.duration % 60).toString().padStart(2, '0')}`
                          : '-'}
                      </td>
                      <td>
                        {recording.note ? (
                          <Link
                            href={`/notes/${recording.note.id}`}
                            className="text-blue-600 hover:text-blue-700"
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
                      <td>
                        <div className="flex space-x-2">
                          {recording.status === 'PROCESSING' && (
                            <button
                              onClick={() => handleTranscribe(recording.id)}
                              className="text-blue-600 hover:text-blue-700"
                            >
                              Transcribe
                            </button>
                          )}
                          {recording.transcription && (
                            <button
                              onClick={() => alert(recording.transcription)}
                              className="text-green-600 hover:text-green-700"
                            >
                              View Transcript
                            </button>
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
