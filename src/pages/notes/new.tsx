import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';

interface EnumOption {
  value: string;
  label: string;
}

export default function NewNotePage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [templates, setTemplates] = useState<any[]>([]);
  const [noteTypes, setNoteTypes] = useState<EnumOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    patientId: '',
    patientName: '',
    encounterDate: new Date().toISOString().split('T')[0],
    noteType: 'SOAP',
    templateId: '',
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadEnums();
      loadTemplates();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    // Filter templates when note type changes
    if (formData.noteType) {
      const filtered = templates.filter(t => t.noteType === formData.noteType);
      if (filtered.length > 0 && !filtered.find(t => t.id === formData.templateId)) {
        setFormData(prev => ({ ...prev, templateId: filtered[0].id }));
      }
    }
  }, [formData.noteType, templates]);

  const loadEnums = async () => {
    try {
      const response = await fetch('/api/enums?type=NoteType');
      const data = await response.json();
      setNoteTypes(data);
    } catch (error) {
      console.error('Failed to load enums:', error);
    }
  };

  const loadTemplates = async () => {
    try {
      const data = await api.getTemplates();
      setTemplates(data);

      // Set default template
      const soapTemplates = data.filter((t: any) => t.noteType === 'SOAP');
      if (soapTemplates.length > 0) {
        setFormData(prev => ({ ...prev, templateId: soapTemplates[0].id }));
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const template = templates.find(t => t.id === formData.templateId);
      const initialContent: Record<string, string> = {};

      if (template?.sections) {
        const sections = Array.isArray(template.sections) ? template.sections : [];
        sections.forEach((section: any) => {
          initialContent[section.id] = '';
        });
      }

      const note = await api.createNote({
        ...formData,
        content: initialContent,
      });

      router.push(`/notes/${note.id}/edit`);
    } catch (error: any) {
      alert(error.message || 'Failed to create note');
    } finally {
      setLoading(false);
    }
  };

  const filteredTemplates = templates.filter(t => t.noteType === formData.noteType);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Create New Note</h1>
          <p className="text-gray-600">Start a new clinical documentation</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="label">Patient ID *</label>
              <input
                type="text"
                className="input"
                placeholder="Enter patient ID"
                value={formData.patientId}
                onChange={(e) => setFormData({ ...formData, patientId: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="label">Patient Name *</label>
              <input
                type="text"
                className="input"
                placeholder="Enter patient name"
                value={formData.patientName}
                onChange={(e) => setFormData({ ...formData, patientName: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="label">Encounter Date *</label>
              <input
                type="date"
                className="input"
                value={formData.encounterDate}
                onChange={(e) => setFormData({ ...formData, encounterDate: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="label">Note Type *</label>
              <select
                className="input"
                value={formData.noteType}
                onChange={(e) => setFormData({ ...formData, noteType: e.target.value })}
                required
              >
                {noteTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Template *</label>
            <select
              className="input"
              value={formData.templateId}
              onChange={(e) => setFormData({ ...formData, templateId: e.target.value })}
              required
            >
              {filteredTemplates.length === 0 ? (
                <option value="">No templates available for this note type</option>
              ) : (
                filteredTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} {template.isSystem && '(System)'}
                  </option>
                ))
              )}
            </select>
            {filteredTemplates.length > 0 && (
              <p className="mt-1 text-sm text-gray-500">
                {templates.find(t => t.id === formData.templateId)?.description}
              </p>
            )}
          </div>

          <div className="flex justify-end space-x-4 pt-4 border-t">
            <button
              type="button"
              onClick={() => router.back()}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !formData.templateId}
              className="btn btn-primary"
            >
              {loading ? 'Creating...' : 'Create Note'}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
