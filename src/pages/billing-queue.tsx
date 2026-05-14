import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ToastContext';
import api from '@/lib/api';

interface QueueItem {
  id: string;
  status: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  notes: string | null;
  createdAt: string;
  note?: {
    id: string;
    patientName: string;
    patientId: string;
    encounterDate: string;
    noteType: string;
    author?: { firstName: string; lastName: string };
    medicalCodes?: { code: string; codeType: string; description: string; confidence: number; isVerified: boolean }[];
  };
}

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  IN_REVIEW: 'bg-blue-100 text-blue-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  NEEDS_CORRECTION: 'bg-orange-100 text-orange-800',
};

export default function BillingQueuePage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAuth();
  const { showToast } = useToast();

  const [items, setItems] = useState<QueueItem[]>([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<QueueItem | null>(null);
  const [decisionNotes, setDecisionNotes] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/login');
  }, [isAuthenticated, isLoading, router]);

  const load = async (page = 1) => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: '20' };
      if (statusFilter) params.status = statusFilter;
      if (search) params.search = search;
      const data = await api.getBillingQueue(params);
      setItems(data?.data || []);
      setPagination(data?.pagination || { page: 1, totalPages: 1, total: 0 });
    } catch (e: any) {
      showToast(e?.message || 'Failed to load queue', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) load(1);
  }, [isAuthenticated, statusFilter]);

  const decide = async (decision: string) => {
    if (!selected) return;
    setBusy(true);
    try {
      await api.decideBillingItem(selected.id, decision, decisionNotes);
      showToast(`Marked as ${decision}`, 'success');
      setSelected(null);
      setDecisionNotes('');
      load(pagination.page);
    } catch (e: any) {
      showToast(e?.message || 'Decision failed', 'error');
    } finally { setBusy(false); }
  };

  if (!isAuthenticated) return null;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="md:flex md:items-center md:justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Billing Code Review Queue</h1>
          <div className="flex gap-2">
            <input
              placeholder="Search patient..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && load(1)}
              className="px-3 py-1.5 border border-gray-300 rounded text-sm"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded text-sm"
            >
              <option value="">All</option>
              <option value="PENDING">Pending</option>
              <option value="IN_REVIEW">In Review</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="NEEDS_CORRECTION">Needs Correction</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1 bg-white shadow rounded-lg overflow-hidden">
            {loading ? (
              <div className="p-4 text-sm text-gray-400">Loading…</div>
            ) : items.length === 0 ? (
              <div className="p-4 text-sm text-gray-400">No items in queue.</div>
            ) : (
              <ul className="divide-y divide-gray-100 max-h-[70vh] overflow-y-auto">
                {items.map((it) => (
                  <li key={it.id}>
                    <button
                      onClick={() => { setSelected(it); setDecisionNotes(it.notes || ''); }}
                      className={`w-full p-4 text-left hover:bg-blue-50 ${selected?.id === it.id ? 'bg-blue-50' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{it.note?.patientName || '(unknown)'}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${STATUS_BADGE[it.status] || 'bg-gray-100'}`}>{it.status}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {it.note?.noteType} · {it.note?.encounterDate ? new Date(it.note.encounterDate).toLocaleDateString() : '—'}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {it.note?.medicalCodes?.length || 0} suggested codes · added {new Date(it.createdAt).toLocaleDateString()}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {pagination.totalPages > 1 && (
              <div className="p-3 flex justify-center gap-2 border-t bg-gray-50">
                {Array.from({ length: pagination.totalPages }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => load(i + 1)}
                    className={`px-2 py-1 text-xs rounded ${pagination.page === i + 1 ? 'bg-blue-600 text-white' : 'bg-white border'}`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-2 bg-white shadow rounded-lg p-6">
            {selected ? (
              <>
                <h2 className="text-lg font-bold mb-1">{selected.note?.patientName}</h2>
                <p className="text-xs text-gray-500 mb-3">
                  Patient #{selected.note?.patientId} · {selected.note?.noteType} · Author: {selected.note?.author ? `${selected.note.author.firstName} ${selected.note.author.lastName}` : 'unknown'}
                </p>
                <div className="mb-4">
                  <span className={`text-xs px-2 py-0.5 rounded ${STATUS_BADGE[selected.status] || 'bg-gray-100'}`}>{selected.status}</span>
                  {selected.reviewedBy && <span className="text-xs text-gray-500 ml-3">Reviewed by {selected.reviewedBy} at {selected.reviewedAt ? new Date(selected.reviewedAt).toLocaleString() : ''}</span>}
                </div>

                <h3 className="font-semibold text-sm mt-4 mb-2">Suggested Codes ({selected.note?.medicalCodes?.length || 0})</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Conf</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Verified</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {(selected.note?.medicalCodes || []).map((c, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2 font-mono">{c.code}</td>
                          <td className="px-3 py-2">{c.codeType}</td>
                          <td className="px-3 py-2">{c.description}</td>
                          <td className="px-3 py-2">{c.confidence != null ? `${(c.confidence * 100).toFixed(0)}%` : '—'}</td>
                          <td className="px-3 py-2">{c.isVerified ? 'yes' : 'no'}</td>
                        </tr>
                      ))}
                      {(selected.note?.medicalCodes || []).length === 0 && (
                        <tr><td colSpan={5} className="px-3 py-3 text-center text-gray-400">No codes suggested.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-6">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reviewer Notes</label>
                  <textarea
                    value={decisionNotes}
                    onChange={(e) => setDecisionNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    rows={3}
                  />
                </div>

                <div className="flex gap-2 mt-4 flex-wrap">
                  <button onClick={() => decide('APPROVED')} disabled={busy} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-sm">Approve</button>
                  <button onClick={() => decide('REJECTED')} disabled={busy} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 text-sm">Reject</button>
                  <button onClick={() => decide('NEEDS_CORRECTION')} disabled={busy} className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50 text-sm">Needs Correction</button>
                  <button onClick={() => decide('IN_REVIEW')} disabled={busy} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm">Mark In Review</button>
                </div>
              </>
            ) : (
              <p className="text-gray-400">Select a queue item to review codes and record a decision.</p>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
