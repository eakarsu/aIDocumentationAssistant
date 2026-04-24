import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ToastContext';
import api from '@/lib/api';
import DetailModal from '@/components/DetailModal';
import ConfirmDialog from '@/components/ConfirmDialog';
import { TableSkeleton } from '@/components/SkeletonLoader';

interface EnumOption {
  value: string;
  label: string;
}

export default function UsersPage() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const { addToast } = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [specialties, setSpecialties] = useState<any[]>([]);
  const [userRoles, setUserRoles] = useState<EnumOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ role: '', specialty: '', search: '' });
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'PROVIDER',
    specialty: '',
    npiNumber: '',
    licenseNumber: '',
    phone: '',
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  // Row detail modal
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Confirm dialog
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [userToDeactivate, setUserToDeactivate] = useState<string | null>(null);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (!isLoading && isAuthenticated && user?.role !== 'ADMIN') {
      router.push('/dashboard');
    }
  }, [isAuthenticated, isLoading, user, router]);

  useEffect(() => {
    if (isAuthenticated && user?.role === 'ADMIN') {
      loadEnums();
      loadData();
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (isAuthenticated && user?.role === 'ADMIN') {
      loadData();
    }
  }, [filters, pagination.page]);

  const loadEnums = async () => {
    try {
      const response = await fetch('/api/enums?type=UserRole');
      const data = await response.json();
      setUserRoles(data);
    } catch (error) {
      console.error('Failed to load enums:', error);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      };
      if (filters.role) params.role = filters.role;
      if (filters.specialty) params.specialty = filters.specialty;
      if (filters.search) params.search = filters.search;

      const [usersData, specialtiesData] = await Promise.all([
        api.getUsers(params),
        api.getSpecialties(),
      ]);
      setUsers(usersData.users || []);
      setPagination(prev => ({ ...prev, ...usersData.pagination }));
      setSpecialties(specialtiesData);
    } catch (error) {
      console.error('Failed to load data:', error);
      addToast('Failed to load users', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Row click handler
  const handleRowClick = (u: any) => {
    setSelectedUser(u);
    setShowDetailModal(true);
  };

  // Edit from detail modal
  const handleEditFromModal = () => {
    if (selectedUser) {
      setShowDetailModal(false);
      openEditModal(selectedUser);
    }
  };

  // Deactivate from detail modal
  const handleDeleteFromModal = () => {
    if (selectedUser) {
      setUserToDeactivate(selectedUser.id);
      setShowDetailModal(false);
      setShowDeleteConfirm(true);
    }
  };

  const openCreateModal = () => {
    setEditingUser(null);
    setFormData({
      email: '',
      password: '',
      firstName: '',
      lastName: '',
      role: 'PROVIDER',
      specialty: '',
      npiNumber: '',
      licenseNumber: '',
      phone: '',
    });
    setShowModal(true);
  };

  const openEditModal = (userData: any) => {
    setEditingUser(userData);
    setFormData({
      email: userData.email,
      password: '',
      firstName: userData.firstName,
      lastName: userData.lastName,
      role: userData.role,
      specialty: userData.specialty || '',
      npiNumber: userData.npiNumber || '',
      licenseNumber: userData.licenseNumber || '',
      phone: userData.phone || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      const dataToSend = { ...formData };
      if (!dataToSend.password) {
        delete (dataToSend as any).password;
      }

      if (editingUser) {
        await api.updateUser(editingUser.id, dataToSend);
        addToast('User updated successfully', 'success');
      } else {
        if (!formData.password) {
          addToast('Password is required for new users', 'warning');
          return;
        }
        await api.createUser(dataToSend);
        addToast('User created successfully', 'success');
      }
      setShowModal(false);
      loadData();
    } catch (error: any) {
      addToast(error.message || 'Failed to save user', 'error');
    }
  };

  // Confirm deactivate
  const handleConfirmDeactivate = async () => {
    if (!userToDeactivate) return;
    try {
      await api.deleteUser(userToDeactivate);
      addToast('User deactivated successfully', 'success');
      setShowDeleteConfirm(false);
      setUserToDeactivate(null);
      loadData();
    } catch (error: any) {
      addToast(error.message || 'Failed to deactivate user', 'error');
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
    if (selectedIds.size === users.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(users.filter(u => u.id !== user?.id).map((u) => u.id)));
    }
  };

  // Bulk delete
  const handleBulkDelete = async () => {
    try {
      const result = await api.bulkDelete('users', Array.from(selectedIds));
      addToast(`Deactivated ${result.deletedCount} users`, 'success');
      setSelectedIds(new Set());
      setShowBulkDeleteConfirm(false);
      loadData();
    } catch (error: any) {
      addToast(error.message || 'Bulk operation failed', 'error');
    }
  };

  // Bulk role update
  const handleBulkRoleUpdate = async (role: string) => {
    try {
      const result = await api.bulkUpdate('users', Array.from(selectedIds), { role });
      addToast(`Updated ${result.updatedCount} users to ${role}`, 'success');
      setSelectedIds(new Set());
      loadData();
    } catch (error: any) {
      addToast(error.message || 'Bulk update failed', 'error');
    }
  };

  // CSV Export
  const handleExportCsv = async () => {
    try {
      const response = await api.exportCsv('users');
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'users_export.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      addToast('Users exported to CSV', 'success');
    } catch (error: any) {
      addToast('CSV export failed', 'error');
    }
  };

  const getRoleLabel = (value: string) => {
    return userRoles.find(r => r.value === value)?.label || value;
  };

  if (isLoading || !isAuthenticated || user?.role !== 'ADMIN') {
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
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-gray-600">Manage healthcare provider accounts</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExportCsv} className="btn btn-outline text-sm">
            Export CSV
          </button>
          <button onClick={openCreateModal} className="btn btn-primary">
            + New User
          </button>
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
              placeholder="Name or email..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && loadData()}
            />
          </div>
          <div>
            <label className="label">Role</label>
            <select
              className="input"
              value={filters.role}
              onChange={(e) => setFilters({ ...filters, role: e.target.value })}
            >
              <option value="">All Roles</option>
              {userRoles.map((role) => (
                <option key={role.value} value={role.value}>{role.label}</option>
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
              onClick={() => setFilters({ role: '', specialty: '', search: '' })}
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
              {selectedIds.size} user{selectedIds.size > 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => handleBulkRoleUpdate('PROVIDER')}
                className="px-3 py-1.5 text-xs font-medium bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-lg"
              >
                Set Provider
              </button>
              <button
                onClick={() => handleBulkRoleUpdate('NURSE')}
                className="px-3 py-1.5 text-xs font-medium bg-green-100 hover:bg-green-200 text-green-800 rounded-lg"
              >
                Set Nurse
              </button>
              <button
                onClick={() => setShowBulkDeleteConfirm(true)}
                className="px-3 py-1.5 text-xs font-medium bg-red-100 hover:bg-red-200 text-red-800 rounded-lg"
              >
                Deactivate Selected
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

      {/* Users Table */}
      <div className="card">
        {loading ? (
          <TableSkeleton rows={8} columns={8} />
        ) : users.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No users found.</div>
        ) : (
          <>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th className="w-10">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === users.filter(u => u.id !== user?.id).length && users.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Specialty</th>
                    <th>Status</th>
                    <th>Last Login</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((u) => (
                    <tr
                      key={u.id}
                      className="cursor-pointer hover:bg-blue-50 transition-colors"
                      onClick={() => handleRowClick(u)}
                    >
                      <td onClick={(e) => e.stopPropagation()}>
                        {u.id !== user?.id && (
                          <input
                            type="checkbox"
                            checked={selectedIds.has(u.id)}
                            onChange={() => toggleSelect(u.id)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        )}
                      </td>
                      <td>
                        <div className="flex items-center">
                          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium mr-3">
                            {u.firstName?.charAt(0)}{u.lastName?.charAt(0)}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">
                              {u.firstName} {u.lastName}
                            </div>
                            {u.npiNumber && (
                              <div className="text-gray-500 text-xs">NPI: {u.npiNumber}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="text-gray-500">{u.email}</td>
                      <td>
                        <span className={`badge ${
                          u.role === 'ADMIN' ? 'badge-red' :
                          u.role === 'PROVIDER' ? 'badge-blue' :
                          'badge-gray'
                        }`}>
                          {getRoleLabel(u.role)}
                        </span>
                      </td>
                      <td className="text-gray-500">{u.specialty || '-'}</td>
                      <td>
                        <span className={`badge ${u.isActive ? 'badge-green' : 'badge-red'}`}>
                          {u.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="text-gray-500">
                        {u.lastLogin ? new Date(u.lastLogin).toLocaleString() : 'Never'}
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => openEditModal(u)}
                            className="text-blue-600 hover:text-blue-700"
                          >
                            Edit
                          </button>
                          {u.id !== user?.id && u.isActive && (
                            <button
                              onClick={() => {
                                setUserToDeactivate(u.id);
                                setShowDeleteConfirm(true);
                              }}
                              className="text-red-600 hover:text-red-700"
                            >
                              Deactivate
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

      {/* Detail Modal */}
      <DetailModal
        isOpen={showDetailModal}
        title="User Details"
        fields={selectedUser ? [
          { label: 'Name', value: `${selectedUser.firstName} ${selectedUser.lastName}` },
          { label: 'Email', value: selectedUser.email },
          { label: 'Role', value: <span className={`badge ${selectedUser.role === 'ADMIN' ? 'badge-red' : selectedUser.role === 'PROVIDER' ? 'badge-blue' : 'badge-gray'}`}>{getRoleLabel(selectedUser.role)}</span> },
          { label: 'Status', value: <span className={`badge ${selectedUser.isActive ? 'badge-green' : 'badge-red'}`}>{selectedUser.isActive ? 'Active' : 'Inactive'}</span> },
          { label: 'Specialty', value: selectedUser.specialty || 'None' },
          { label: 'NPI Number', value: selectedUser.npiNumber || 'N/A' },
          { label: 'License Number', value: selectedUser.licenseNumber || 'N/A' },
          { label: 'Phone', value: selectedUser.phone || 'N/A' },
          { label: 'Email Verified', value: selectedUser.emailVerified ? 'Yes' : 'No' },
          { label: 'Last Login', value: selectedUser.lastLogin ? new Date(selectedUser.lastLogin).toLocaleString() : 'Never' },
          { label: 'Created', value: new Date(selectedUser.createdAt).toLocaleString() },
          { label: 'User ID', value: selectedUser.id },
        ] : []}
        onClose={() => setShowDetailModal(false)}
        onEdit={handleEditFromModal}
        onDelete={selectedUser?.id !== user?.id ? handleDeleteFromModal : undefined}
      />

      {/* Deactivate Confirm */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Deactivate User"
        message="Are you sure you want to deactivate this user? They will no longer be able to log in."
        confirmLabel="Deactivate"
        variant="danger"
        onConfirm={handleConfirmDeactivate}
        onCancel={() => { setShowDeleteConfirm(false); setUserToDeactivate(null); }}
      />

      {/* Bulk Delete Confirm */}
      <ConfirmDialog
        isOpen={showBulkDeleteConfirm}
        title="Deactivate Selected Users"
        message={`Are you sure you want to deactivate ${selectedIds.size} selected users?`}
        confirmLabel={`Deactivate ${selectedIds.size} Users`}
        variant="danger"
        onConfirm={handleBulkDelete}
        onCancel={() => setShowBulkDeleteConfirm(false)}
      />

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4 my-8">
            <h3 className="text-lg font-semibold mb-4">
              {editingUser ? 'Edit User' : 'Create New User'}
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">First Name *</label>
                <input type="text" className="input" value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} required />
              </div>
              <div>
                <label className="label">Last Name *</label>
                <input type="text" className="input" value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} required />
              </div>
              <div>
                <label className="label">Email *</label>
                <input type="email" className="input" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required disabled={!!editingUser} />
              </div>
              <div>
                <label className="label">{editingUser ? 'New Password' : 'Password *'}</label>
                <input type="password" className="input" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} placeholder={editingUser ? 'Leave blank to keep current' : ''} />
              </div>
              <div>
                <label className="label">Role *</label>
                <select className="input" value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })} required>
                  {userRoles.map((role) => (
                    <option key={role.value} value={role.value}>{role.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Specialty</label>
                <select className="input" value={formData.specialty} onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}>
                  <option value="">None</option>
                  {specialties.map((specialty) => (
                    <option key={specialty.id} value={specialty.name}>{specialty.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">NPI Number</label>
                <input type="text" className="input" value={formData.npiNumber} onChange={(e) => setFormData({ ...formData, npiNumber: e.target.value })} />
              </div>
              <div>
                <label className="label">License Number</label>
                <input type="text" className="input" value={formData.licenseNumber} onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })} />
              </div>
              <div className="col-span-2">
                <label className="label">Phone</label>
                <input type="tel" className="input" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
              </div>
            </div>

            <div className="flex justify-end space-x-2 mt-6 pt-4 border-t">
              <button onClick={() => setShowModal(false)} className="btn btn-secondary">Cancel</button>
              <button onClick={handleSave} className="btn btn-primary">{editingUser ? 'Update' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
