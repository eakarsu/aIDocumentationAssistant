const getToken = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('token');
  }
  return null;
};

async function fetchApi(endpoint: string, options: RequestInit = {}) {
  const token = getToken();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    fetchApi('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  logout: () => fetchApi('/api/auth/logout', { method: 'POST' }),

  getMe: () => fetchApi('/api/auth/me'),

  register: (data: { email: string; password: string; firstName: string; lastName: string; role?: string; specialty?: string; phone?: string }) =>
    fetchApi('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  forgotPassword: (email: string) =>
    fetchApi('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, newPassword: string) =>
    fetchApi('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    }),

  verifyEmail: (token: string) =>
    fetchApi('/api/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),

  // CSV Export
  exportCsv: (type: string) => {
    const token = getToken();
    return fetch(`/api/export/csv?type=${type}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },

  // Bulk Operations
  bulkDelete: (type: string, ids: string[]) =>
    fetchApi('/api/bulk/delete', {
      method: 'POST',
      body: JSON.stringify({ type, ids }),
    }),

  bulkUpdate: (type: string, ids: string[], data: Record<string, any>) =>
    fetchApi('/api/bulk/update', {
      method: 'PUT',
      body: JSON.stringify({ type, ids, data }),
    }),

  // Users
  getUsers: (params?: Record<string, string>) =>
    fetchApi(`/api/users?${new URLSearchParams(params || {})}`),

  getUser: (id: string) => fetchApi(`/api/users/${id}`),

  createUser: (data: any) =>
    fetchApi('/api/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateUser: (id: string, data: any) =>
    fetchApi(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteUser: (id: string) =>
    fetchApi(`/api/users/${id}`, { method: 'DELETE' }),

  // Notes
  getNotes: (params?: Record<string, string>) =>
    fetchApi(`/api/notes?${new URLSearchParams(params || {})}`),

  getNote: (id: string) => fetchApi(`/api/notes/${id}`),

  createNote: (data: any) =>
    fetchApi('/api/notes', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateNote: (id: string, data: any) =>
    fetchApi(`/api/notes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteNote: (id: string) =>
    fetchApi(`/api/notes/${id}`, { method: 'DELETE' }),

  signNote: (id: string) =>
    fetchApi(`/api/notes/${id}/sign`, { method: 'POST' }),

  requestCosign: (id: string, signerId: string) =>
    fetchApi(`/api/notes/${id}/cosign`, {
      method: 'POST',
      body: JSON.stringify({ signerId }),
    }),

  respondCosign: (id: string, action: string, comments?: string) =>
    fetchApi(`/api/notes/${id}/cosign`, {
      method: 'PUT',
      body: JSON.stringify({ action, comments }),
    }),

  // Comments
  getComments: (noteId: string) => fetchApi(`/api/notes/${noteId}/comments`),

  addComment: (noteId: string, content: string, parentId?: string) =>
    fetchApi(`/api/notes/${noteId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content, parentId }),
    }),

  resolveComment: (noteId: string, commentId: string, isResolved: boolean) =>
    fetchApi(`/api/notes/${noteId}/comments`, {
      method: 'PUT',
      body: JSON.stringify({ commentId, isResolved }),
    }),

  // Amendments
  getAmendments: (noteId: string) => fetchApi(`/api/notes/${noteId}/amendments`),

  createAmendment: (noteId: string, reason: string, newContent: any) =>
    fetchApi(`/api/notes/${noteId}/amendments`, {
      method: 'POST',
      body: JSON.stringify({ reason, newContent }),
    }),

  // AI Features
  summarizeNote: (id: string) =>
    fetchApi(`/api/notes/${id}/ai/summarize`, { method: 'POST' }),

  suggestCodes: (id: string) =>
    fetchApi(`/api/notes/${id}/ai/codes`, { method: 'POST' }),

  qualityCheck: (id: string) =>
    fetchApi(`/api/notes/${id}/ai/quality`, { method: 'POST' }),

  structureNote: (id: string, transcription: string) =>
    fetchApi(`/api/notes/${id}/ai/structure`, {
      method: 'POST',
      body: JSON.stringify({ transcription }),
    }),

  // Templates
  getTemplates: (params?: Record<string, string>) =>
    fetchApi(`/api/templates?${new URLSearchParams(params || {})}`),

  getTemplate: (id: string) => fetchApi(`/api/templates/${id}`),

  createTemplate: (data: any) =>
    fetchApi('/api/templates', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateTemplate: (id: string, data: any) =>
    fetchApi(`/api/templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteTemplate: (id: string) =>
    fetchApi(`/api/templates/${id}`, { method: 'DELETE' }),

  // Recordings
  getRecordings: (params?: Record<string, string>) =>
    fetchApi(`/api/recordings?${new URLSearchParams(params || {})}`),

  transcribeRecording: (id: string) =>
    fetchApi(`/api/recordings/${id}/transcribe`, { method: 'POST' }),

  // Integrations
  getIntegrations: () => fetchApi('/api/integrations'),

  getIntegration: (id: string) => fetchApi(`/api/integrations/${id}`),

  updateIntegration: (id: string, data: any) =>
    fetchApi(`/api/integrations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Specialties
  getSpecialties: () => fetchApi('/api/specialties'),

  // Medical Codes
  getCodes: (params?: Record<string, string>) =>
    fetchApi(`/api/codes?${new URLSearchParams(params || {})}`),

  // Audit Logs
  getAuditLogs: (params?: Record<string, string>) =>
    fetchApi(`/api/audit-logs?${new URLSearchParams(params || {})}`),

  // Settings
  getSettings: () => fetchApi('/api/settings'),

  updateSettings: (data: any) =>
    fetchApi('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // ==================== DOCUMENTATION MODULE ====================

  // Documents
  getDocs: (params?: Record<string, string>) =>
    fetchApi(`/api/docs?${new URLSearchParams(params || {})}`),

  getDoc: (id: string) => fetchApi(`/api/docs/${id}`),

  createDoc: (data: any) =>
    fetchApi('/api/docs', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateDoc: (id: string, data: any) =>
    fetchApi(`/api/docs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteDoc: (id: string) =>
    fetchApi(`/api/docs/${id}`, { method: 'DELETE' }),

  publishDoc: (id: string, data: any) =>
    fetchApi(`/api/docs/${id}/publish`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Document Versions
  getDocVersions: (docId: string, params?: Record<string, string>) =>
    fetchApi(`/api/docs/${docId}/versions?${new URLSearchParams(params || {})}`),

  restoreDocVersion: (docId: string, versionNumber: number) =>
    fetchApi(`/api/docs/${docId}/versions`, {
      method: 'POST',
      body: JSON.stringify({ versionNumber }),
    }),

  // Document Comments
  getDocComments: (docId: string) => fetchApi(`/api/docs/${docId}/comments`),

  addDocComment: (docId: string, data: any) =>
    fetchApi(`/api/docs/${docId}/comments`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateDocComment: (docId: string, commentId: string, data: any) =>
    fetchApi(`/api/docs/${docId}/comments`, {
      method: 'PUT',
      body: JSON.stringify({ commentId, ...data }),
    }),

  deleteDocComment: (docId: string, commentId: string) =>
    fetchApi(`/api/docs/${docId}/comments`, {
      method: 'DELETE',
      body: JSON.stringify({ commentId }),
    }),

  // Document Export
  exportDoc: (docId: string, format: string) =>
    fetchApi(`/api/docs/${docId}/export`, {
      method: 'POST',
      body: JSON.stringify({ format }),
    }),

  exportDocToPdf: (docId: string, options?: any) =>
    fetchApi('/api/docs/export/pdf', {
      method: 'POST',
      body: JSON.stringify({ docId, options }),
    }),

  exportDocToHtml: (docId: string, options?: any) =>
    fetchApi('/api/docs/export/html', {
      method: 'POST',
      body: JSON.stringify({ docId, options }),
    }),

  exportDocToDocx: (docId: string) =>
    fetchApi('/api/docs/export/docx', {
      method: 'POST',
      body: JSON.stringify({ docId }),
    }),

  // Document Templates
  getDocTemplates: (params?: Record<string, string>) =>
    fetchApi(`/api/docs/templates?${new URLSearchParams(params || {})}`),

  getDocTemplate: (id: string) => fetchApi(`/api/docs/templates/${id}`),

  createDocTemplate: (data: any) =>
    fetchApi('/api/docs/templates', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateDocTemplate: (id: string, data: any) =>
    fetchApi(`/api/docs/templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteDocTemplate: (id: string) =>
    fetchApi(`/api/docs/templates/${id}`, { method: 'DELETE' }),

  // Document Categories
  getDocCategories: (params?: Record<string, string>) =>
    fetchApi(`/api/docs/categories?${new URLSearchParams(params || {})}`),

  getDocCategory: (id: string) => fetchApi(`/api/docs/categories/${id}`),

  createDocCategory: (data: any) =>
    fetchApi('/api/docs/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateDocCategory: (id: string, data: any) =>
    fetchApi(`/api/docs/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteDocCategory: (id: string) =>
    fetchApi(`/api/docs/categories/${id}`, { method: 'DELETE' }),

  // Document Tags
  getDocTags: (params?: Record<string, string>) =>
    fetchApi(`/api/docs/tags?${new URLSearchParams(params || {})}`),

  createDocTag: (data: any) =>
    fetchApi('/api/docs/tags', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteDocTag: (tagId: string) =>
    fetchApi('/api/docs/tags', {
      method: 'DELETE',
      body: JSON.stringify({ tagId }),
    }),

  // Document Search
  searchDocs: (params: Record<string, string>) =>
    fetchApi(`/api/docs/search?${new URLSearchParams(params)}`),

  // Repositories
  getRepositories: () => fetchApi('/api/docs/repositories'),

  getRepository: (id: string) => fetchApi(`/api/docs/repositories/${id}`),

  createRepository: (data: any) =>
    fetchApi('/api/docs/repositories', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateRepository: (id: string, data: any) =>
    fetchApi(`/api/docs/repositories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteRepository: (id: string) =>
    fetchApi(`/api/docs/repositories/${id}`, { method: 'DELETE' }),

  syncRepository: (id: string) =>
    fetchApi(`/api/docs/repositories/${id}/sync`, { method: 'POST' }),

  getRepositoryFiles: (id: string, params?: Record<string, string>) =>
    fetchApi(`/api/docs/repositories/${id}/files?${new URLSearchParams(params || {})}`),

  // JSDoc Parser
  parseJSDoc: (data: any) =>
    fetchApi('/api/docs/parse/jsdoc', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

export default api;
