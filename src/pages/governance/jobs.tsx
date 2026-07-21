import { FormEvent, useCallback, useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';

type Repository = { id: string; name: string; fullName: string; lastSyncStatus: string; freshUntil?: string | null };
type Job = {
  id: string;
  repositoryId: string | null;
  requestedById: string;
  kind: string;
  status: string;
  attempt: number;
  maxAttempts: number;
  traceId: string;
  error?: { message?: string } | null;
  createdAt: string;
  aiRun?: {
    gateDecision: string;
    qualityScore: number;
    safetyScore: number;
    costCents: number;
    latencyMs: number;
    citations: Array<{ sourceId: string; path: string; lineStart: number; lineEnd: number }>;
  } | null;
};

export default function GovernanceJobs() {
  const { token, activeTenantId, memberships } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [repositoryId, setRepositoryId] = useState('');
  const [kind, setKind] = useState('GENERATE_API_REFERENCE');
  const [task, setTask] = useState('Document the public interfaces and observed behavior without inventing missing details.');
  const [reviewed, setReviewed] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const headers = useCallback(() => ({
    Authorization: `Bearer ${token}`,
    ...(activeTenantId ? { 'x-tenant-id': activeTenantId } : {}),
  }), [activeTenantId, token]);

  const load = useCallback(async () => {
    if (!token || !activeTenantId) return;
    setLoading(true);
    setError('');
    try {
      const [jobsResponse, repositoriesResponse] = await Promise.all([
        fetch('/api/governance/jobs?limit=100', { headers: headers() }),
        fetch('/api/docs/repositories', { headers: headers() }),
      ]);
      const jobsPayload = await jobsResponse.json();
      const repositoriesPayload = await repositoriesResponse.json();
      if (!jobsResponse.ok) throw new Error(jobsPayload.message || jobsPayload.error || 'Unable to load jobs');
      if (!repositoriesResponse.ok) throw new Error(repositoriesPayload.error || 'Unable to load repositories');
      setJobs(jobsPayload.jobs || []);
      setRepositories(repositoriesPayload || []);
      if (!repositoryId && repositoriesPayload?.[0]?.id) setRepositoryId(repositoriesPayload[0].id);
    } catch (caught: any) {
      setError(caught.message || 'Unable to load governed jobs');
    } finally {
      setLoading(false);
    }
  }, [activeTenantId, headers, repositoryId, token]);

  useEffect(() => { void load(); }, [load]);

  const createJob = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const idempotencyKey = crypto.randomUUID();
      const response = await fetch('/api/governance/jobs', {
        method: 'POST',
        headers: { ...headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ repositoryId, kind, task, audience: 'repository maintainers', sourceIds: [], idempotencyKey, requireApproval: true }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || 'Unable to queue job');
      await load();
    } catch (caught: any) {
      setError(caught.message || 'Unable to queue job');
    } finally {
      setSubmitting(false);
    }
  };

  const act = async (job: Job, action: string) => {
    setError('');
    try {
      const response = await fetch(`/api/governance/jobs/${job.id}`, {
        method: 'PATCH',
        headers: { ...headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          ...(action === 'APPROVE' || action === 'REJECT'
            ? { attestations: { sourcesReviewed: reviewed[job.id] === true, outputSafe: reviewed[job.id] === true } }
            : {}),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || 'Unable to update job');
      await load();
    } catch (caught: any) {
      setError(caught.message || 'Unable to update job');
    }
  };

  const activeMembership = memberships.find((membership) => membership.tenantId === activeTenantId);
  const canReview = activeMembership && ['OWNER', 'ADMIN', 'REVIEWER'].includes(activeMembership.role);

  return (
    <Layout>
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-semibold text-gray-900">Governed documentation jobs</h1>
          <p className="mt-1 text-sm text-gray-600">Queue grounded repository documentation, inspect evidence and gates, then approve or reject explicitly.</p>
        </header>

        {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <form onSubmit={createJob} className="grid gap-4 rounded-lg bg-white p-5 shadow md:grid-cols-2">
          <label className="text-sm font-medium text-gray-700">
            Repository
            <select className="mt-1 w-full rounded-md border border-gray-300 p-2" value={repositoryId} onChange={(event) => setRepositoryId(event.target.value)} required>
              <option value="" disabled>Select a repository</option>
              {repositories.map((repository) => <option key={repository.id} value={repository.id}>{repository.fullName}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-gray-700">
            Typed tool
            <select className="mt-1 w-full rounded-md border border-gray-300 p-2" value={kind} onChange={(event) => setKind(event.target.value)}>
              <option value="GENERATE_API_REFERENCE">Generate API reference</option>
              <option value="UPDATE_README">Update README</option>
              <option value="CONSISTENCY_REVIEW">Consistency review</option>
            </select>
          </label>
          <label className="text-sm font-medium text-gray-700 md:col-span-2">
            Bounded task
            <textarea className="mt-1 w-full rounded-md border border-gray-300 p-2" rows={3} maxLength={4000} value={task} onChange={(event) => setTask(event.target.value)} required />
          </label>
          <div className="md:col-span-2">
            <button className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={submitting || !repositoryId}>
              {submitting ? 'Queueing…' : 'Queue governed job'}
            </button>
          </div>
        </form>

        <section aria-live="polite" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Job history</h2>
            <button className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm" onClick={() => void load()}>Refresh</button>
          </div>
          {loading && <p className="text-sm text-gray-600">Loading jobs…</p>}
          {!loading && jobs.length === 0 && <div className="rounded-lg bg-white p-6 text-sm text-gray-600 shadow">No governed jobs exist in this workspace.</div>}
          {jobs.map((job) => (
            <article key={job.id} className="rounded-lg bg-white p-5 shadow">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{job.kind.replaceAll('_', ' ')}</h3>
                  <p className="mt-1 break-all font-mono text-xs text-gray-500">Trace {job.traceId}</p>
                </div>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">{job.status.replaceAll('_', ' ')}</span>
              </div>
              <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-4">
                <div><dt className="text-gray-500">Attempts</dt><dd>{job.attempt}/{job.maxAttempts}</dd></div>
                <div><dt className="text-gray-500">Gate</dt><dd>{job.aiRun?.gateDecision || 'Not evaluated'}</dd></div>
                <div><dt className="text-gray-500">Quality / safety</dt><dd>{job.aiRun ? `${job.aiRun.qualityScore.toFixed(2)} / ${job.aiRun.safetyScore.toFixed(2)}` : '—'}</dd></div>
                <div><dt className="text-gray-500">Cost / latency</dt><dd>{job.aiRun ? `${job.aiRun.costCents}¢ / ${job.aiRun.latencyMs} ms` : '—'}</dd></div>
              </dl>
              {job.error?.message && <p className="mt-3 rounded bg-red-50 p-2 text-sm text-red-700">{job.error.message}</p>}
              {job.aiRun?.citations?.length ? (
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer font-medium text-gray-700">Grounding evidence ({job.aiRun.citations.length})</summary>
                  <ul className="mt-2 space-y-1 font-mono text-xs text-gray-600">
                    {job.aiRun.citations.map((citation) => <li key={`${citation.sourceId}-${citation.lineStart}`}>{citation.path}:{citation.lineStart}-{citation.lineEnd}</li>)}
                  </ul>
                </details>
              ) : null}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {['QUEUED', 'RUNNING', 'RETRY_WAIT', 'AWAITING_APPROVAL'].includes(job.status) && (
                  <button className="rounded border border-gray-300 px-3 py-1.5 text-sm" onClick={() => void act(job, 'CANCEL')}>Cancel</button>
                )}
                {['FAILED', 'DEAD_LETTER'].includes(job.status) && (
                  <button className="rounded border border-gray-300 px-3 py-1.5 text-sm" onClick={() => void act(job, 'RETRY')}>Retry</button>
                )}
                {job.status === 'AWAITING_APPROVAL' && canReview && (
                  <>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input type="checkbox" checked={reviewed[job.id] || false} onChange={(event) => setReviewed({ ...reviewed, [job.id]: event.target.checked })} />
                      I reviewed the cited sources and output safety
                    </label>
                    <button className="rounded bg-green-600 px-3 py-1.5 text-sm text-white disabled:opacity-50" disabled={!reviewed[job.id]} onClick={() => void act(job, 'APPROVE')}>Approve</button>
                    <button className="rounded bg-red-600 px-3 py-1.5 text-sm text-white disabled:opacity-50" disabled={!reviewed[job.id]} onClick={() => void act(job, 'REJECT')}>Reject</button>
                  </>
                )}
              </div>
            </article>
          ))}
        </section>
      </div>
    </Layout>
  );
}
