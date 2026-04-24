import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ToastContext';
import api from '@/lib/api';
import DetailModal from '@/components/DetailModal';
import ConfirmDialog from '@/components/ConfirmDialog';
import { CardSkeleton } from '@/components/SkeletonLoader';

interface EnumOption {
  value: string;
  label: string;
}

export default function TemplatesPage() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const { addToast } = useToast();
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

  // Row detail modal
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Confirm dialog for delete
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);

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
      addToast('Failed to load templates', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Card click handler - show detail modal
  const handleCardClick = (template: any) => {
    setSelectedTemplate(template);
    setShowDetailModal(true);
  };

  // Edit from detail modal
  const handleEditFromModal = () => {
    if (selectedTemplate) {
      setShowDetailModal(false);
      openEditModal(selectedTemplate);
    }
  };

  // Delete from detail modal
  const handleDeleteFromModal = () => {
    if (selectedTemplate) {
      setTemplateToDelete(selectedTemplate.id);
      setShowDetailModal(false);
      setShowDeleteConfirm(true);
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
        addToast('Template updated successfully', 'success');
      } else {
        await api.createTemplate(formData);
        addToast('Template created successfully', 'success');
      }
      setShowModal(false);
      loadData();
    } catch (error: any) {
      addToast(error.message || 'Failed to save template', 'error');
    }
  };

  // Confirm single delete
  const handleConfirmDelete = async () => {
    if (!templateToDelete) return;
    try {
      await api.deleteTemplate(templateToDelete);
      addToast('Template deleted successfully', 'success');
      setShowDeleteConfirm(false);
      setTemplateToDelete(null);
      loadData();
    } catch (error: any) {
      addToast(error.message || 'Failed to delete template', 'error');
    }
  };

  // Bulk selection
  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Bulk delete
  const handleBulkDelete = async () => {
    try {
      let deletedCount = 0;
      for (const id of selectedIds) {
        try {
          await api.deleteTemplate(id);
          deletedCount++;
        } catch (e) {
          // skip system templates
        }
      }
      addToast(`Deleted ${deletedCount} templates`, 'success');
      setSelectedIds(new Set());
      setShowBulkDeleteConfirm(false);
      loadData();
    } catch (error: any) {
      addToast(error.message || 'Bulk delete failed', 'error');
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

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="card mb-4 bg-blue-50 border border-blue-200">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-800">
              {selectedIds.size} template{selectedIds.size > 1 ? 's' : ''} selected
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

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)
        ) : templates.length === 0 ? (
          <div className="col-span-full text-center py-8 text-gray-500">
            No templates found.
          </div>
        ) : (
          templates.map((template) => (
            <div
              key={template.id}
              className="card cursor-pointer hover:shadow-lg transition-shadow duration-200 hover:ring-2 hover:ring-blue-300 relative"
              onClick={() => handleCardClick(template)}
            >
              {/* Checkbox */}
              <div className="absolute top-3 right-3" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={selectedIds.has(template.id)}
                  onChange={(e) => { e.stopPropagation(); toggleSelect(template.id, e as any); }}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-start justify-between mb-3 pr-8">
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

              <div className="flex space-x-2" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => openEditModal(template)}
                  className="btn btn-outline text-sm flex-1"
                  disabled={template.isSystem && user?.role !== 'ADMIN'}
                >
                  {template.isSystem && user?.role !== 'ADMIN' ? 'View' : 'Edit'}
                </button>
                {!template.isSystem && (
                  <button
                    onClick={() => {
                      setTemplateToDelete(template.id);
                      setShowDeleteConfirm(true);
                    }}
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

      {/* Detail Modal */}
      <DetailModal
        isOpen={showDetailModal}
        title="Template Details"
        fields={selectedTemplate ? [
          { label: 'Name', value: selectedTemplate.name },
          { label: 'Note Type', value: <span className="badge badge-blue">{getNoteTypeLabel(selectedTemplate.noteType)}</span> },
          { label: 'Description', value: selectedTemplate.description || 'No description' },
          { label: 'Specialty', value: selectedTemplate.specialty || 'General' },
          { label: 'System Template', value: selectedTemplate.isSystem ? 'Yes' : 'No' },
          { label: 'Sections', value: `${Array.isArray(selectedTemplate.sections) ? selectedTemplate.sections.length : 0} sections` },
          { label: 'Section Names', value: Array.isArray(selectedTemplate.sections) ? selectedTemplate.sections.map((s: any) => s.name).join(', ') : 'None' },
          { label: 'Template ID', value: selectedTemplate.id },
        ] : []}
        onClose={() => setShowDetailModal(false)}
        onEdit={handleEditFromModal}
        onDelete={!selectedTemplate?.isSystem ? handleDeleteFromModal : undefined}
      />

      {/* Single Delete Confirm */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete Template"
        message="Are you sure you want to delete this template? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => { setShowDeleteConfirm(false); setTemplateToDelete(null); }}
      />

      {/* Bulk Delete Confirm */}
      <ConfirmDialog
        isOpen={showBulkDeleteConfirm}
        title="Delete Selected Templates"
        message={`Are you sure you want to delete ${selectedIds.size} selected templates? System templates will be skipped.`}
        confirmLabel={`Delete ${selectedIds.size} Templates`}
        variant="danger"
        onConfirm={handleBulkDelete}
        onCancel={() => setShowBulkDeleteConfirm(false)}
      />

      {/* Create/Edit Modal */}
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
