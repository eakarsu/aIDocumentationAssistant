import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';

export default function EditNotePage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const { id } = router.query;
  const [note, setNote] = useState<any>(null);
  const [content, setContent] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated && id) {
      loadNote();
    }
  }, [isAuthenticated, id]);

  useEffect(() => {
    // Auto-save every 30 seconds
    if (Object.keys(content).length > 0) {
      autoSaveTimer.current = setInterval(() => {
        handleAutoSave();
      }, 30000);
    }

    return () => {
      if (autoSaveTimer.current) {
        clearInterval(autoSaveTimer.current);
      }
    };
  }, [content]);

  const loadNote = async () => {
    try {
      const data = await api.getNote(id as string);
      setNote(data);
      setContent(data.content || {});
    } catch (error) {
      console.error('Failed to load note:', error);
      router.push('/notes');
    } finally {
      setLoading(false);
    }
  };

  const handleAutoSave = async () => {
    try {
      await api.updateNote(id as string, { content });
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateNote(id as string, { content });
      router.push(`/notes/${id}`);
    } catch (error: any) {
      alert(error.message || 'Failed to save note');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndSign = async () => {
    if (!confirm('Are you sure you want to save and sign this note? This action cannot be undone.')) return;

    setSaving(true);
    try {
      await api.updateNote(id as string, { content });
      await api.signNote(id as string);
      router.push(`/notes/${id}`);
    } catch (error: any) {
      alert(error.message || 'Failed to save and sign note');
    } finally {
      setSaving(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await handleTranscription(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
      alert('Failed to access microphone. Please ensure you have granted permission.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleTranscription = async (blob: Blob) => {
    setTranscribing(true);
    try {
      const formData = new FormData();
      formData.append('file', blob, 'recording.webm');
      formData.append('noteId', id as string);
      formData.append('type', 'AUDIO');

      const response = await fetch('/api/recordings', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');

      const recording = await response.json();
      const transcription = await api.transcribeRecording(recording.id);

      // Structure the transcription if template exists
      if (note?.template?.sections) {
        const structured = await api.structureNote(id as string, transcription.transcription);
        setContent(prev => ({ ...prev, ...structured.content }));
      }
    } catch (error) {
      console.error('Transcription failed:', error);
      alert('Failed to transcribe recording');
    } finally {
      setTranscribing(false);
    }
  };

  const handleContentChange = (sectionId: string, value: string) => {
    setContent(prev => ({ ...prev, [sectionId]: value }));
  };

  if (isLoading || !isAuthenticated || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!note) {
    return (
      <Layout>
        <div className="text-center py-8">Note not found</div>
      </Layout>
    );
  }

  const templateSections = note.template?.sections || [];

  return (
    <Layout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Edit Note</h1>
          <p className="text-gray-600">
            {note.patientName} - {note.noteType} - {new Date(note.encounterDate).toLocaleDateString()}
          </p>
        </div>

        <div className="flex items-center space-x-4">
          {/* Recording Controls */}
          <div className="flex items-center space-x-2">
            {isRecording ? (
              <button
                onClick={stopRecording}
                className="btn btn-danger flex items-center"
              >
                <span className="w-3 h-3 bg-white rounded-full animate-pulse mr-2"></span>
                Stop Recording
              </button>
            ) : (
              <button
                onClick={startRecording}
                disabled={transcribing}
                className="btn btn-outline flex items-center"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                {transcribing ? 'Transcribing...' : 'Record'}
              </button>
            )}
          </div>

          {/* Save Controls */}
          <button
            onClick={() => router.push(`/notes/${id}`)}
            className="btn btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn btn-outline"
          >
            {saving ? 'Saving...' : 'Save Draft'}
          </button>
          <button
            onClick={handleSaveAndSign}
            disabled={saving}
            className="btn btn-success"
          >
            Save & Sign
          </button>
        </div>
      </div>

      {/* Template Info */}
      <div className="card mb-6 bg-blue-50">
        <div className="flex items-center">
          <div className="p-2 bg-blue-100 rounded-lg mr-3">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <p className="font-medium text-gray-900">Template: {note.template?.name}</p>
            <p className="text-sm text-gray-600">Auto-saving every 30 seconds</p>
          </div>
        </div>
      </div>

      {/* Note Editor */}
      <div className="card">
        <div className="space-y-6">
          {templateSections.length > 0 ? (
            templateSections.map((section: any) => (
              <div key={section.id}>
                <label className="label flex items-center">
                  {section.name}
                  {section.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                {section.type === 'textarea' || section.type === 'text' ? (
                  <textarea
                    className="input min-h-[120px]"
                    placeholder={`Enter ${section.name.toLowerCase()}...`}
                    value={content[section.id] || ''}
                    onChange={(e) => handleContentChange(section.id, e.target.value)}
                  />
                ) : section.type === 'vitals' ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {['BP', 'HR', 'Temp', 'RR', 'SpO2', 'Weight', 'Height'].map((vital) => (
                      <div key={vital}>
                        <label className="text-xs text-gray-500">{vital}</label>
                        <input
                          type="text"
                          className="input"
                          placeholder={vital}
                          value={(content[section.id] as any)?.[vital.toLowerCase()] || ''}
                          onChange={(e) => {
                            const currentVitals = typeof content[section.id] === 'object'
                              ? content[section.id]
                              : {};
                            handleContentChange(section.id, JSON.stringify({
                              ...currentVitals,
                              [vital.toLowerCase()]: e.target.value
                            }));
                          }}
                        />
                      </div>
                    ))}
                  </div>
                ) : section.type === 'date' ? (
                  <input
                    type="date"
                    className="input"
                    value={content[section.id] || ''}
                    onChange={(e) => handleContentChange(section.id, e.target.value)}
                  />
                ) : (
                  <textarea
                    className="input min-h-[100px]"
                    placeholder={`Enter ${section.name.toLowerCase()}...`}
                    value={content[section.id] || ''}
                    onChange={(e) => handleContentChange(section.id, e.target.value)}
                  />
                )}
              </div>
            ))
          ) : (
            <div className="text-gray-500">
              No template sections defined. Add content freely below.
            </div>
          )}

          {/* Free-form content if no template */}
          {templateSections.length === 0 && (
            <div>
              <label className="label">Note Content</label>
              <textarea
                className="input min-h-[300px]"
                placeholder="Enter your clinical documentation..."
                value={content['freeform'] || ''}
                onChange={(e) => handleContentChange('freeform', e.target.value)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Recordings */}
      {note.recordings?.length > 0 && (
        <div className="card mt-6">
          <h2 className="text-lg font-semibold mb-4">Recordings</h2>
          <div className="space-y-2">
            {note.recordings.map((recording: any) => (
              <div key={recording.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-gray-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                  <div>
                    <p className="font-medium">{recording.fileName}</p>
                    <p className="text-sm text-gray-500">
                      {recording.duration ? `${Math.floor(recording.duration / 60)}:${(recording.duration % 60).toString().padStart(2, '0')}` : 'Processing...'}
                    </p>
                  </div>
                </div>
                <span className={`badge ${
                  recording.status === 'COMPLETED' ? 'badge-green' :
                  recording.status === 'FAILED' ? 'badge-red' :
                  'badge-yellow'
                }`}>
                  {recording.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Layout>
  );
}
