import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';

export default function SettingsPage() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadSettings();
    }
  }, [isAuthenticated]);

  const loadSettings = async () => {
    try {
      const data = await api.getSettings();
      setSettings(data);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (user?.role !== 'ADMIN') {
      alert('Only administrators can modify settings');
      return;
    }

    setSaving(true);
    try {
      await api.updateSettings(settings);
      alert('Settings saved successfully');
    } catch (error: any) {
      alert(error.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600">System configuration and preferences</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="spinner"></div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Security Settings */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Security & Compliance</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="label">HIPAA Encryption</label>
                <select
                  className="input"
                  value={settings.encryption_enabled || 'true'}
                  onChange={(e) => updateSetting('encryption_enabled', e.target.value)}
                  disabled={user?.role !== 'ADMIN'}
                >
                  <option value="true">Enabled</option>
                  <option value="false">Disabled</option>
                </select>
                <p className="text-sm text-gray-500 mt-1">
                  Enable encryption for all patient data
                </p>
              </div>

              <div>
                <label className="label">Session Timeout (minutes)</label>
                <input
                  type="number"
                  className="input"
                  value={settings.session_timeout || '30'}
                  onChange={(e) => updateSetting('session_timeout', e.target.value)}
                  disabled={user?.role !== 'ADMIN'}
                />
                <p className="text-sm text-gray-500 mt-1">
                  Auto logout after inactivity
                </p>
              </div>

              <div>
                <label className="label">Password Expiry (days)</label>
                <input
                  type="number"
                  className="input"
                  value={settings.password_expiry_days || '90'}
                  onChange={(e) => updateSetting('password_expiry_days', e.target.value)}
                  disabled={user?.role !== 'ADMIN'}
                />
                <p className="text-sm text-gray-500 mt-1">
                  Force password change after period
                </p>
              </div>

              <div>
                <label className="label">Max Login Attempts</label>
                <input
                  type="number"
                  className="input"
                  value={settings.max_login_attempts || '5'}
                  onChange={(e) => updateSetting('max_login_attempts', e.target.value)}
                  disabled={user?.role !== 'ADMIN'}
                />
                <p className="text-sm text-gray-500 mt-1">
                  Account lockout threshold
                </p>
              </div>
            </div>
          </div>

          {/* Documentation Settings */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Documentation</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="label">Auto-save Interval (seconds)</label>
                <input
                  type="number"
                  className="input"
                  value={settings.auto_save_interval || '30'}
                  onChange={(e) => updateSetting('auto_save_interval', e.target.value)}
                  disabled={user?.role !== 'ADMIN'}
                />
                <p className="text-sm text-gray-500 mt-1">
                  How often to auto-save drafts
                </p>
              </div>

              <div>
                <label className="label">Default Note Template</label>
                <input
                  type="text"
                  className="input"
                  value={settings.default_note_template || ''}
                  onChange={(e) => updateSetting('default_note_template', e.target.value)}
                  disabled={user?.role !== 'ADMIN'}
                  placeholder="Template ID"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Default template for new notes
                </p>
              </div>
            </div>
          </div>

          {/* AI Settings */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">AI Features</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="label">AI Transcription</label>
                <select
                  className="input"
                  value={settings.ai_transcription_enabled || 'true'}
                  onChange={(e) => updateSetting('ai_transcription_enabled', e.target.value)}
                  disabled={user?.role !== 'ADMIN'}
                >
                  <option value="true">Enabled</option>
                  <option value="false">Disabled</option>
                </select>
                <p className="text-sm text-gray-500 mt-1">
                  Enable speech-to-text transcription
                </p>
              </div>

              <div>
                <label className="label">AI Medical Coding</label>
                <select
                  className="input"
                  value={settings.ai_coding_enabled || 'true'}
                  onChange={(e) => updateSetting('ai_coding_enabled', e.target.value)}
                  disabled={user?.role !== 'ADMIN'}
                >
                  <option value="true">Enabled</option>
                  <option value="false">Disabled</option>
                </select>
                <p className="text-sm text-gray-500 mt-1">
                  Enable automatic CPT/ICD code suggestions
                </p>
              </div>
            </div>
          </div>

          {/* HIPAA Compliance Info */}
          <div className="card bg-blue-50">
            <h2 className="text-lg font-semibold mb-4 flex items-center">
              <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              HIPAA Compliance
            </h2>
            <div className="space-y-3 text-sm text-gray-700">
              <p>This system is configured for HIPAA compliance:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>All data is encrypted at rest and in transit (AES-256)</li>
                <li>Access controls enforce role-based permissions</li>
                <li>Audit logs track all data access and modifications</li>
                <li>Session management prevents unauthorized access</li>
                <li>Automatic logout after inactivity</li>
                <li>Password policies enforce strong credentials</li>
              </ul>
            </div>
          </div>

          {/* Save Button */}
          {user?.role === 'ADMIN' && (
            <div className="flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn btn-primary"
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}
