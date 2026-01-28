import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';

interface EnumOption {
  value: string;
  label: string;
}

export default function UsersPage() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
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
    } finally {
      setLoading(false);
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
      } else {
        if (!formData.password) {
          alert('Password is required for new users');
          return;
        }
        await api.createUser(dataToSend);
      }
      setShowModal(false);
      loadData();
    } catch (error: any) {
      alert(error.message || 'Failed to save user');
    }
  };

  const handleDeactivate = async (id: string) => {
    if (!confirm('Are you sure you want to deactivate this user?')) return;

    try {
      await api.deleteUser(id);
      loadData();
    } catch (error: any) {
      alert(error.message || 'Failed to deactivate user');
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
        <button onClick={openCreateModal} className="btn btn-primary">
          + New User
        </button>
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

      {/* Users Table */}
      <div className="card">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="spinner"></div>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No users found.</div>
        ) : (
          <>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
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
                    <tr key={u.id}>
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
                      <td>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => openEditModal(u)}
                            className="text-blue-600 hover:text-blue-700"
                          >
                            Edit
                          </button>
                          {u.id !== user?.id && u.isActive && (
                            <button
                              onClick={() => handleDeactivate(u.id)}
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4 my-8">
            <h3 className="text-lg font-semibold mb-4">
              {editingUser ? 'Edit User' : 'Create New User'}
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">First Name *</label>
                <input
                  type="text"
                  className="input"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label">Last Name *</label>
                <input
                  type="text"
                  className="input"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label">Email *</label>
                <input
                  type="email"
                  className="input"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  disabled={!!editingUser}
                />
              </div>
              <div>
                <label className="label">{editingUser ? 'New Password' : 'Password *'}</label>
                <input
                  type="password"
                  className="input"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder={editingUser ? 'Leave blank to keep current' : ''}
                />
              </div>
              <div>
                <label className="label">Role *</label>
                <select
                  className="input"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  required
                >
                  {userRoles.map((role) => (
                    <option key={role.value} value={role.value}>{role.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Specialty</label>
                <select
                  className="input"
                  value={formData.specialty}
                  onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                >
                  <option value="">None</option>
                  {specialties.map((specialty) => (
                    <option key={specialty.id} value={specialty.name}>{specialty.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">NPI Number</label>
                <input
                  type="text"
                  className="input"
                  value={formData.npiNumber}
                  onChange={(e) => setFormData({ ...formData, npiNumber: e.target.value })}
                />
              </div>
              <div>
                <label className="label">License Number</label>
                <input
                  type="text"
                  className="input"
                  value={formData.licenseNumber}
                  onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <label className="label">Phone</label>
                <input
                  type="tel"
                  className="input"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 mt-6 pt-4 border-t">
              <button onClick={() => setShowModal(false)} className="btn btn-secondary">
                Cancel
              </button>
              <button onClick={handleSave} className="btn btn-primary">
                {editingUser ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
