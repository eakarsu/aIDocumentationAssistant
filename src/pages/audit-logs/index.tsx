import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ToastContext';
import DetailModal from '@/components/DetailModal';
import { TableSkeleton } from '@/components/SkeletonLoader';
import api from '@/lib/api';

interface EnumOption {
  value: string;
  label: string;
}

export default function AuditLogsPage() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const [logs, setLogs] = useState<any[]>([]);
  const [auditActions, setAuditActions] = useState<EnumOption[]>([]);
  const [entityTypes, setEntityTypes] = useState<EnumOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    action: '',
    entityType: '',
    startDate: '',
    endDate: '',
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });

  // Detail modal
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (!isLoading && isAuthenticated && !['ADMIN', 'AUDITOR'].includes(user?.role || '')) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, isLoading, user, router]);

  useEffect(() => {
    if (isAuthenticated && ['ADMIN', 'AUDITOR'].includes(user?.role || '')) {
      loadEnums();
      loadLogs();
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (isAuthenticated && ['ADMIN', 'AUDITOR'].includes(user?.role || '')) {
      loadLogs();
    }
  }, [filters, pagination.page]);

  const loadEnums = async () => {
    try {
      const response = await fetch('/api/enums');
      const data = await response.json();
      setAuditActions(data.AuditAction || []);
      setEntityTypes(data.EntityType || []);
    } catch (error) {
      console.error('Failed to load enums:', error);
    }
  };

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      };
      if (filters.action) params.action = filters.action;
      if (filters.entityType) params.entityType = filters.entityType;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;

      const data = await api.getAuditLogs(params);
      setLogs(data.logs || []);
      setPagination(prev => ({ ...prev, ...data.pagination }));
    } catch (error) {
      console.error('Failed to load audit logs:', error);
      showToast('Failed to load audit logs', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getActionLabel = (value: string) => {
    return auditActions.find(a => a.value === value)?.label || value;
  };

  const getEntityTypeLabel = (value: string) => {
    return entityTypes.find(e => e.value === value)?.label || value;
  };

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case 'CREATE': return 'badge-green';
      case 'READ': return 'badge-blue';
      case 'UPDATE': return 'badge-yellow';
      case 'DELETE': return 'badge-red';
      case 'SIGN':
      case 'COSIGN': return 'badge-green';
      case 'ACCESS_DENIED': return 'badge-red';
      case 'LOGIN':
      case 'LOGOUT': return 'badge-gray';
      default: return 'badge-gray';
    }
  };

  const handleRowClick = (log: any) => {
    setSelectedLog(log);
    setShowDetailModal(true);
  };

  const handleExportCsv = async () => {
    try {
      const params: Record<string, string> = { type: 'audit-logs' };
      if (filters.action) params.action = filters.action;
      if (filters.entityType) params.entityType = filters.entityType;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;

      const queryString = new URLSearchParams(params).toString();
      const response = await fetch(`/api/export/csv?${queryString}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      showToast('Audit logs exported successfully', 'success');
    } catch (error) {
      showToast('Failed to export audit logs', 'error');
    }
  };

  const getDetailFields = (log: any) => {
    const fields: { label: string; value: string }[] = [
      { label: 'Timestamp', value: new Date(log.timestamp).toLocaleString() },
      { label: 'User', value: log.user ? `${log.user.firstName} ${log.user.lastName}` : 'System' },
      { label: 'Email', value: log.user?.email || 'N/A' },
      { label: 'Action', value: getActionLabel(log.action) },
      { label: 'Entity Type', value: getEntityTypeLabel(log.entityType) },
      { label: 'Entity ID', value: log.entityId || 'N/A' },
      { label: 'IP Address', value: log.ipAddress || 'N/A' },
      { label: 'User Agent', value: log.userAgent || 'N/A' },
    ];

    if (log.oldValues) {
      fields.push({ label: 'Old Values', value: JSON.stringify(log.oldValues, null, 2) });
    }
    if (log.newValues) {
      fields.push({ label: 'New Values', value: JSON.stringify(log.newValues, null, 2) });
    }

    fields.push({ label: 'Log ID', value: log.id });

    return fields;
  };

  if (isLoading || !isAuthenticated || !['ADMIN', 'AUDITOR'].includes(user?.role || '')) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <Layout>
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
          <p className="text-gray-600">Track all system access and modifications for HIPAA compliance</p>
        </div>
        <button onClick={handleExportCsv} className="btn btn-secondary flex items-center">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="label">Action</label>
            <select
              className="input"
              value={filters.action}
              onChange={(e) => setFilters({ ...filters, action: e.target.value })}
            >
              <option value="">All Actions</option>
              {auditActions.map((action) => (
                <option key={action.value} value={action.value}>{action.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Entity Type</label>
            <select
              className="input"
              value={filters.entityType}
              onChange={(e) => setFilters({ ...filters, entityType: e.target.value })}
            >
              <option value="">All Types</option>
              {entityTypes.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Start Date</label>
            <input
              type="date"
              className="input"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            />
          </div>
          <div>
            <label className="label">End Date</label>
            <input
              type="date"
              className="input"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => setFilters({ action: '', entityType: '', startDate: '', endDate: '' })}
              className="btn btn-secondary w-full"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="card">
        {loading ? (
          <TableSkeleton rows={10} columns={6} />
        ) : logs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No audit logs found.</div>
        ) : (
          <>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>User</th>
                    <th>Action</th>
                    <th>Entity</th>
                    <th>Details</th>
                    <th>IP Address</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {logs.map((log) => (
                    <tr
                      key={log.id}
                      onClick={() => handleRowClick(log)}
                      className="cursor-pointer hover:bg-blue-50 transition-colors"
                    >
                      <td className="text-gray-500 text-sm">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td>
                        {log.user ? (
                          <div>
                            <div className="font-medium text-gray-900">
                              {log.user.firstName} {log.user.lastName}
                            </div>
                            <div className="text-gray-500 text-xs">{log.user.email}</div>
                          </div>
                        ) : (
                          <span className="text-gray-400">System</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${getActionBadgeColor(log.action)}`}>
                          {getActionLabel(log.action)}
                        </span>
                      </td>
                      <td>
                        <div className="text-gray-900">{getEntityTypeLabel(log.entityType)}</div>
                        <div className="text-gray-500 text-xs font-mono">{log.entityId}</div>
                      </td>
                      <td className="max-w-xs">
                        {log.oldValues || log.newValues ? (
                          <span className="text-blue-600 text-sm">View Details</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="text-gray-500 text-sm font-mono">
                        {log.ipAddress || '-'}
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

      {/* Compliance Info */}
      <div className="card mt-6 bg-green-50">
        <h2 className="text-lg font-semibold mb-2 flex items-center text-green-800">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          HIPAA Audit Trail
        </h2>
        <p className="text-sm text-green-700">
          This audit log maintains a complete record of all system access and data modifications
          as required by HIPAA Security Rule (45 CFR 164.312(b)). Logs are retained for 6 years
          and include user identification, timestamps, and details of all actions performed.
        </p>
      </div>

      {/* Detail Modal - read-only for audit logs */}
      {showDetailModal && selectedLog && (
        <DetailModal
          isOpen={true}
          title={`Audit Log: ${getActionLabel(selectedLog.action)} ${getEntityTypeLabel(selectedLog.entityType)}`}
          fields={getDetailFields(selectedLog)}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedLog(null);
          }}
        />
      )}
    </Layout>
  );
}
