import { useState } from 'react';
import Layout from '@/components/Layout';

const sample = JSON.stringify([
  { status: 'draft', owner: 'Dr. Avery', signedAt: null },
  { status: 'final', owner: 'Dr. Avery', signedAt: null },
  { status: 'final', owner: 'Dr. Chen', signedAt: '2026-05-20T14:00:00Z' }
], null, 2);

export default function DocConsistencyRisk() {
  const [notes, setNotes] = useState(sample);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const runCheck = async () => {
    setError('');
    try {
      const response = await fetch('/api/doc-consistency-risk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: JSON.parse(notes) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Consistency check failed');
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Documentation Consistency Risk</h1>
          <p className="text-sm text-gray-600">Check packets for conflicting status, ownership, and signature state.</p>
        </div>
        <textarea className="w-full rounded border border-gray-300 p-3 font-mono text-sm" rows={10} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <button className="rounded bg-blue-600 px-4 py-2 text-white" onClick={runCheck}>Run check</button>
        {error && <div className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        {result && (
          <div className="rounded bg-white p-4 shadow">
            <h2 className="text-lg font-semibold">{result.level.toUpperCase()} · {result.riskScore}/100</h2>
            <ul className="mt-3 list-disc pl-5 text-sm text-gray-700">
              {result.findings.map((finding: any) => <li key={`${finding.field}-${finding.detail}`}>{finding.field}: {finding.detail}</li>)}
            </ul>
          </div>
        )}
      </div>
    </Layout>
  );
}
