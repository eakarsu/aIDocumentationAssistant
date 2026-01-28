import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';

export default function ProfilePage() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    specialty: '',
    npiNumber: '',
    licenseNumber: '',
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [specialties, setSpecialties] = useState<any[]>([]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated && user) {
      loadProfile();
      loadSpecialties();
    }
  }, [isAuthenticated, user]);

  const loadProfile = async () => {
    try {
      const data = await api.getUser(user!.id);
      setProfile(data);
      setFormData({
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone || '',
        specialty: data.specialty || '',
        npiNumber: data.npiNumber || '',
        licenseNumber: data.licenseNumber || '',
      });
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSpecialties = async () => {
    try {
      const data = await api.getSpecialties();
      setSpecialties(data);
    } catch (error) {
      console.error('Failed to load specialties:', error);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await api.updateUser(user!.id, formData);
      alert('Profile updated successfully');
      loadProfile();
    } catch (error: any) {
      alert(error.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 8) {
      alert('Password must be at least 8 characters');
      return;
    }

    setSaving(true);
    try {
      await api.updateUser(user!.id, { password: passwordData.newPassword });
      alert('Password changed successfully');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      alert(error.message || 'Failed to change password');
    } finally {
      setSaving(false);
    }
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
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
          <p className="text-gray-600">Manage your account settings</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="spinner"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Profile Header */}
            <div className="card">
              <div className="flex items-center">
                <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-2xl font-bold mr-6">
                  {profile?.firstName?.charAt(0)}{profile?.lastName?.charAt(0)}
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    {profile?.firstName} {profile?.lastName}
                  </h2>
                  <p className="text-gray-600">{profile?.email}</p>
                  <div className="flex items-center space-x-2 mt-2">
                    <span className="badge badge-blue">{profile?.role}</span>
                    {profile?.specialty && (
                      <span className="badge badge-gray">{profile?.specialty}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Personal Information */}
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">Personal Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">First Name</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Last Name</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input
                    type="tel"
                    className="input"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
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
                      <option key={specialty.id} value={specialty.name}>
                        {specialty.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end mt-4 pt-4 border-t">
                <button
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="btn btn-primary"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>

            {/* Professional Information */}
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">Professional Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">NPI Number</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.npiNumber}
                    onChange={(e) => setFormData({ ...formData, npiNumber: e.target.value })}
                    placeholder="10-digit NPI"
                  />
                </div>
                <div>
                  <label className="label">License Number</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.licenseNumber}
                    onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                    placeholder="State license number"
                  />
                </div>
              </div>

              <div className="flex justify-end mt-4 pt-4 border-t">
                <button
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="btn btn-primary"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>

            {/* Change Password */}
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">Change Password</h2>
              <div className="space-y-4">
                <div>
                  <label className="label">Current Password</label>
                  <input
                    type="password"
                    className="input"
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">New Password</label>
                  <input
                    type="password"
                    className="input"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    placeholder="At least 8 characters"
                  />
                </div>
                <div>
                  <label className="label">Confirm New Password</label>
                  <input
                    type="password"
                    className="input"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex justify-end mt-4 pt-4 border-t">
                <button
                  onClick={handleChangePassword}
                  disabled={saving || !passwordData.newPassword || !passwordData.confirmPassword}
                  className="btn btn-primary"
                >
                  {saving ? 'Changing...' : 'Change Password'}
                </button>
              </div>
            </div>

            {/* Account Info */}
            <div className="card bg-gray-50">
              <h2 className="text-lg font-semibold mb-4">Account Information</h2>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Email</dt>
                  <dd className="font-medium">{profile?.email}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Role</dt>
                  <dd className="font-medium">{profile?.role}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Account Status</dt>
                  <dd>
                    <span className={`badge ${profile?.isActive ? 'badge-green' : 'badge-red'}`}>
                      {profile?.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Member Since</dt>
                  <dd className="font-medium">
                    {new Date(profile?.createdAt).toLocaleDateString()}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Last Login</dt>
                  <dd className="font-medium">
                    {profile?.lastLogin
                      ? new Date(profile?.lastLogin).toLocaleString()
                      : 'Never'}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
