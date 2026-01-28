import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';

interface EnumOption {
  value: string;
  label: string;
}

export default function TemplatesPage() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const [templates, setTemplates] = useState<any[]>([]);
  const [specialties, setSpecialties] = useState<any[]>([]);
  const [noteTypes, setNoteTypes] = useState<EnumOption[]>([]);
  const [fieldTypes, setFieldTypes] = useState<EnumOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ noteType: '', specialty: '' });
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    noteType: 'SOAP',
    specialty: '',
    sections: [] as any[],
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadEnums();
      loadData();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [filters]);

  const loadEnums = async () => {
    try {
      const response = await fetch('/api/enums');
      const data = await response.json();
      setNoteTypes(data.NoteType || []);
      setFieldTypes(data.FieldType || []);
    } catch (error) {
      console.error('Failed to load enums:', error);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [templatesData, specialtiesData] = await Promise.all([
        api.getTemplates(filters.noteType || filters.specialty ? {
          ...(filters.noteType && { noteType: filters.noteType }),
          ...(filters.specialty && { specialty: filters.specialty }),
        } : undefined),
        api.getSpecialties(),
      ]);
      setTemplates(templatesData);
      setSpecialties(specialtiesData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingTemplate(null);
    setFormData({
      name: '',
      description: '',
      noteType: 'SOAP',
      specialty: '',
      sections: [{ id: 'section_1', name: 'Section 1', type: 'TEXTAREA', required: false }],
    });
    setShowModal(true);
  };

  const openEditModal = (template: any) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description || '',
      noteType: template.noteType,
      specialty: template.specialty || '',
      sections: Array.isArray(template.sections) ? template.sections : [],
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      if (editingTemplate) {
        await api.updateTemplate(editingTemplate.id, formData);
      } else {
        await api.createTemplate(formData);
      }
      setShowModal(false);
      loadData();
    } catch (error: any) {
      alert(error.message || 'Failed to save template');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      await api.deleteTemplate(id);
      loadData();
    } catch (error: any) {
      alert(error.message || 'Failed to delete template');
    }
  };

  const addSection = () => {
    const newId = `section_${formData.sections.length + 1}`;
    setFormData({
      ...formData,
      sections: [...formData.sections, { id: newId, name: `Section ${formData.sections.length + 1}`, type: 'TEXTAREA', required: false }],
    });
  };

  const updateSection = (index: number, field: string, value: any) => {
    const updated = [...formData.sections];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, sections: updated });
  };

  const removeSection = (index: number) => {
    const updated = formData.sections.filter((_, i) => i !== index);
    setFormData({ ...formData, sections: updated });
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
          <h1 className="text-2xl font-bold text-gray-900">Templates</h1>
          <p className="text-gray-600">Manage note templates for clinical documentation</p>
        </div>
        <button onClick={openCreateModal} className="btn btn-primary">
          + New Template
        </button>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <label className="label">Specialty</label>
            <select
              className="input"
              value={filters.specialty}
              onChange={(e) => setFilters({ ...filters, specialty: e.target.value })}
            >
              <option value="">All Specialties</option>
              {specialties.map((specialty) => (
                <option key={specialty.id} value={specialty.name}>{specialty.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => setFilters({ noteType: '', specialty: '' })}
              className="btn btn-secondary w-full"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full flex justify-center py-8">
            <div className="spinner"></div>
          </div>
        ) : templates.length === 0 ? (
          <div className="col-span-full text-center py-8 text-gray-500">
            No templates found.
          </div>
        ) : (
          templates.map((template) => (
            <div key={template.id} className="card">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{template.name}</h3>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="badge badge-blue">{getNoteTypeLabel(template.noteType)}</span>
                    {template.isSystem && <span className="badge badge-gray">System</span>}
                  </div>
                </div>
              </div>

              <p className="text-sm text-gray-600 mb-3">{template.description || 'No description'}</p>

              {template.specialty && (
                <p className="text-sm text-gray-500 mb-3">
                  <span className="font-medium">Specialty:</span> {template.specialty}
                </p>
              )}

              <div className="text-sm text-gray-500 mb-4">
                <span className="font-medium">{Array.isArray(template.sections) ? template.sections.length : 0}</span> sections
              </div>

              <div className="flex space-x-2">
                <button
                  onClick={() => openEditModal(template)}
                  className="btn btn-outline text-sm flex-1"
                  disabled={template.isSystem && user?.role !== 'ADMIN'}
                >
                  {template.isSystem && user?.role !== 'ADMIN' ? 'View' : 'Edit'}
                </button>
                {!template.isSystem && (
                  <button
                    onClick={() => handleDelete(template.id)}
                    className="btn btn-danger text-sm"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">
              {editingTemplate ? 'Edit Template' : 'Create New Template'}
            </h3>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Template Name *</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="label">Description</label>
                <textarea
                  className="input"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div>
                <label className="label">Specialty</label>
                <select
                  className="input"
                  value={formData.specialty}
                  onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                >
                  <option value="">General (All Specialties)</option>
                  {specialties.map((specialty) => (
                    <option key={specialty.id} value={specialty.name}>{specialty.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="label mb-0">Sections</label>
                  <button onClick={addSection} className="btn btn-outline text-sm">
                    + Add Section
                  </button>
                </div>

                <div className="space-y-3">
                  {formData.sections.map((section, index) => (
                    <div key={index} className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
                      <input
                        type="text"
                        className="input flex-1"
                        placeholder="Section Name"
                        value={section.name}
                        onChange={(e) => updateSection(index, 'name', e.target.value)}
                      />
                      <select
                        className="input w-32"
                        value={section.type}
                        onChange={(e) => updateSection(index, 'type', e.target.value)}
                      >
                        {fieldTypes.map((type) => (
                          <option key={type.value} value={type.value}>{type.label}</option>
                        ))}
                      </select>
                      <label className="flex items-center space-x-1">
                        <input
                          type="checkbox"
                          checked={section.required}
                          onChange={(e) => updateSection(index, 'required', e.target.checked)}
                        />
                        <span className="text-sm">Required</span>
                      </label>
                      <button
                        onClick={() => removeSection(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-2 mt-6 pt-4 border-t">
              <button onClick={() => setShowModal(false)} className="btn btn-secondary">
                Cancel
              </button>
              <button onClick={handleSave} className="btn btn-primary">
                {editingTemplate ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
