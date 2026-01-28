import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';

interface EnumOption {
  value: string;
  label: string;
}

const integrationIcons: Record<string, string> = {
  'EHR': '🏥',
  'PRACTICE_MANAGEMENT': '📋',
  'BILLING': '💳',
  'LAB': '🔬',
  'PHARMACY': '💊',
  'IMAGING': '📸',
};

const integrationDescriptions: Record<string, string> = {
  'EHR': 'Epic, Cerner, Athenahealth, etc.',
  'PRACTICE_MANAGEMENT': 'DrChrono, Kareo, etc.',
  'BILLING': 'AdvancedMD, Kareo Billing, etc.',
  'LAB': 'Quest, LabCorp, etc.',
  'PHARMACY': 'Surescripts, RxNorm, etc.',
  'IMAGING': 'PACS systems, etc.',
};

export default function IntegrationsPage() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [integrationTypes, setIntegrationTypes] = useState<EnumOption[]>([]);
  const [integrationStatuses, setIntegrationStatuses] = useState<EnumOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState<any>(null);
  const [formData, setFormData] = useState({
    apiEndpoint: '',
    clientId: '',
    clientSecret: '',
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadEnums();
      loadIntegrations();
    }
  }, [isAuthenticated]);

  const loadEnums = async () => {
    try {
      const response = await fetch('/api/enums');
      const data = await response.json();
      setIntegrationTypes(data.IntegrationType || []);
      setIntegrationStatuses(data.IntegrationStatus || []);
    } catch (error) {
      console.error('Failed to load enums:', error);
    }
  };

  const loadIntegrations = async () => {
    setLoading(true);
    try {
      const data = await api.getIntegrations();
      setIntegrations(data);
    } catch (error) {
      console.error('Failed to load integrations:', error);
    } finally {
      setLoading(false);
    }
  };

  const openConfigModal = (integration: any) => {
    setEditingIntegration(integration);
    setFormData({
      apiEndpoint: integration.configuration?.apiEndpoint || '',
      clientId: integration.configuration?.clientId || '',
      clientSecret: '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!editingIntegration) return;

    try {
      const configuration = {
        apiEndpoint: formData.apiEndpoint,
        clientId: formData.clientId,
      };

      const credentials = formData.clientSecret ? {
        clientSecret: formData.clientSecret,
      } : undefined;

      await api.updateIntegration(editingIntegration.id, {
        configuration,
        credentials,
        status: formData.apiEndpoint && formData.clientId ? 'ACTIVE' : 'INACTIVE',
        isActive: !!(formData.apiEndpoint && formData.clientId),
      });

      setShowModal(false);
      loadIntegrations();
    } catch (error: any) {
      alert(error.message || 'Failed to save integration');
    }
  };

  const handleToggle = async (integration: any) => {
    try {
      await api.updateIntegration(integration.id, {
        isActive: !integration.isActive,
        status: !integration.isActive ? 'ACTIVE' : 'INACTIVE',
      });
      loadIntegrations();
    } catch (error: any) {
      alert(error.message || 'Failed to toggle integration');
    }
  };

  const getTypeLabel = (value: string) => {
    return integrationTypes.find(t => t.value === value)?.label || value;
  };

  const getStatusLabel = (value: string) => {
    return integrationStatuses.find(s => s.value === value)?.label || value;
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
        <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
        <p className="text-gray-600">Connect with EHR, practice management, and billing systems</p>
      </div>

      {/* Integration Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full flex justify-center py-8">
            <div className="spinner"></div>
          </div>
        ) : integrations.length === 0 ? (
          <div className="col-span-full text-center py-8 text-gray-500">
            No integrations configured.
          </div>
        ) : (
          integrations.map((integration) => (
            <div key={integration.id} className="card">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center">
                  <span className="text-3xl mr-3">{integrationIcons[integration.type] || '🔗'}</span>
                  <div>
                    <h3 className="font-semibold text-gray-900">{integration.name}</h3>
                    <p className="text-sm text-gray-500">{getTypeLabel(integration.type)}</p>
                  </div>
                </div>
                <span className={`badge ${
                  integration.status === 'ACTIVE' ? 'badge-green' :
                  integration.status === 'ERROR' ? 'badge-red' :
                  integration.status === 'SYNCING' ? 'badge-yellow' :
                  'badge-gray'
                }`}>
                  {getStatusLabel(integration.status)}
                </span>
              </div>

              <div className="space-y-2 text-sm text-gray-600 mb-4">
                <div className="flex justify-between">
                  <span>Last Sync:</span>
                  <span>
                    {integration.lastSyncAt
                      ? new Date(integration.lastSyncAt).toLocaleString()
                      : 'Never'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className={integration.isActive ? 'text-green-600' : 'text-gray-400'}>
                    {integration.isActive ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>

              {user?.role === 'ADMIN' && (
                <div className="flex space-x-2 pt-4 border-t">
                  <button
                    onClick={() => openConfigModal(integration)}
                    className="btn btn-outline text-sm flex-1"
                  >
                    Configure
                  </button>
                  <button
                    onClick={() => handleToggle(integration)}
                    className={`btn text-sm ${integration.isActive ? 'btn-danger' : 'btn-success'}`}
                  >
                    {integration.isActive ? 'Disable' : 'Enable'}
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Available Integrations Info */}
      <div className="card mt-8">
        <h2 className="text-lg font-semibold mb-4">Supported Systems</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {integrationTypes.map((type) => (
            <div key={type.value} className="flex items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-2xl mr-3">{integrationIcons[type.value] || '🔗'}</span>
              <div>
                <p className="font-medium text-gray-900">{type.label}</p>
                <p className="text-xs text-gray-500">
                  {integrationDescriptions[type.value] || ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Configuration Modal */}
      {showModal && editingIntegration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">
              Configure {editingIntegration.name}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="label">API Endpoint</label>
                <input
                  type="url"
                  className="input"
                  placeholder="https://api.example.com"
                  value={formData.apiEndpoint}
                  onChange={(e) => setFormData({ ...formData, apiEndpoint: e.target.value })}
                />
              </div>

              <div>
                <label className="label">Client ID</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Your client ID"
                  value={formData.clientId}
                  onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                />
              </div>

              <div>
                <label className="label">Client Secret</label>
                <input
                  type="password"
                  className="input"
                  placeholder="Leave blank to keep current"
                  value={formData.clientSecret}
                  onChange={(e) => setFormData({ ...formData, clientSecret: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 mt-6 pt-4 border-t">
              <button onClick={() => setShowModal(false)} className="btn btn-secondary">
                Cancel
              </button>
              <button onClick={handleSave} className="btn btn-primary">
                Save Configuration
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
