// === Batch 03 Gaps & Frontend Mounts ===
// Auto-generated frontend page (lean v0). Wires Custom Feature Suggestions
// and Gap endpoints (AI counterparts + non-AI features) to backend routes.
import React, { useState } from 'react';
import Link from 'next/link';
import AIResponseReport from '@/components/AIResponseReport';
import Layout from '@/components/Layout';

const API_BASE = '/api';

const json = (value) => JSON.stringify(value, null, 2);
const RETIRED_PRESETS = [
  { label: 'Successor workflow', value: json({ request: 'Show the supported successor workflow and its authorization requirements.' }) },
  { label: 'Migration guidance', value: json({ request: 'Explain how to migrate an existing task without bypassing approval or source permissions.' }) },
  { label: 'Capability status', value: json({ request: 'Return the current capability status, replacement route, and remaining limitations.' }) },
];

const FEATURES = [
  {
    kind: 'cfs', slug: 'cf-rag-over-clinical-templates', label: 'RAG over clinical templates',
    desc: 'Retrieve specialty-specific phrasing as scribe drafts SOAP', endpoint: '/ai/rag-clinical-templates',
    presets: [
      { label: 'Cardiology follow-up', value: json({ specialty: 'Cardiology', draft: 'Follow-up for exertional chest pressure. Blood pressure is controlled. ECG is unchanged. Continue current medicines and arrange stress testing.', top_k: 3 }) },
      { label: 'Pediatric fever', value: json({ specialty: 'Pediatrics', draft: 'Three-day fever with sore throat, tolerating fluids, no respiratory distress. Exam shows mild pharyngeal erythema.', top_k: 4 }) },
      { label: 'Orthopedic review', value: json({ specialty: 'Orthopedics', draft: 'Six-week postoperative knee review. Incision healed, range of motion improving, no calf tenderness. Continue physical therapy.', top_k: 5 }) },
    ],
  },
  {
    kind: 'cfs', slug: 'cf-live-code-to-docs-sync', label: 'Live code-to-docs sync',
    desc: 'This compatibility form was replaced by the tenant-scoped governed documentation workflow.', replacement: '/governance/jobs',
  },
  {
    kind: 'cfs', slug: 'cf-fhir-bundle-round-trip', label: 'FHIR-bundle round-trip',
    desc: 'Import a controlled FHIR bundle into a draft chart', endpoint: '/ai/fhir-import',
    presets: [
      { label: 'Patient and condition', value: json({ bundle: { resourceType: 'Bundle', type: 'collection', entry: [{ resource: { resourceType: 'Patient', id: 'example-patient-1', name: [{ given: ['Avery'], family: 'Morgan' }] } }, { resource: { resourceType: 'Condition', id: 'example-condition-1', code: { text: 'Hypertension' } } }] } }) },
      { label: 'Patient and observation', value: json({ bundle: { resourceType: 'Bundle', type: 'collection', entry: [{ resource: { resourceType: 'Patient', id: 'example-patient-2', name: [{ given: ['Jordan'], family: 'Lee' }] } }, { resource: { resourceType: 'Observation', id: 'example-observation-1', status: 'final', code: { text: 'Blood pressure' }, valueString: '128/78 mmHg' } }] } }) },
      { label: 'Medication history', value: json({ bundle: { resourceType: 'Bundle', type: 'collection', entry: [{ resource: { resourceType: 'Patient', id: 'example-patient-3', name: [{ given: ['Taylor'], family: 'Kim' }] } }, { resource: { resourceType: 'MedicationStatement', id: 'example-medication-1', status: 'active', medicationCodeableConcept: { text: 'Lisinopril 10 mg daily' } } }] } }) },
    ],
  },
  {
    kind: 'cfs', slug: 'cf-voice-driven-coding', label: 'Voice-driven coding',
    desc: 'Generate unverified code candidates from a complete transcript example', endpoint: '/ai/voice-coding',
    presets: [
      { label: 'Established visit', value: json({ recording_id: null, transcript: 'Established patient follow-up for controlled hypertension. Medication reviewed, no adverse effects, continue lisinopril and follow up in three months.', note_id: null }) },
      { label: 'Laceration repair', value: json({ recording_id: null, transcript: 'Simple 2 centimeter forearm laceration irrigated and repaired with three interrupted sutures after local anesthesia. No foreign body or complication.', note_id: null }) },
      { label: 'Respiratory review', value: json({ recording_id: null, transcript: 'Patient reports cough and wheeze. Oxygen saturation 97 percent on room air. Mild expiratory wheeze; inhaler technique reviewed.', note_id: null }) },
    ],
  },
  {
    kind: 'cfs', slug: 'cf-openapi-generator', label: 'OpenAPI generator',
    desc: 'Generate a deterministic OpenAPI document from parsed endpoint records', endpoint: '/ai/openapi-generator',
    presets: [
      { label: 'Notes API', value: json({ entries: [{ path: '/api/notes', method: 'GET', summary: 'List notes', description: 'Returns authorized notes.', params: [{ name: 'page', in: 'query', required: false, type: 'integer' }], responses: { '200': { description: 'Authorized note page' } } }], title: 'Notes API', version: '1.0.0', server_url: 'http://localhost:3000' }) },
      { label: 'Recordings API', value: json({ entries: [{ path: '/api/recordings/{id}/transcribe', method: 'POST', summary: 'Transcribe recording', description: 'Starts transcription for an authorized recording.', params: [{ name: 'id', in: 'path', required: true, type: 'string' }], responses: { '200': { description: 'Completed transcription' }, '403': { description: 'Forbidden' } } }], title: 'Recordings API', version: '1.0.0', server_url: 'http://localhost:3000' }) },
      { label: 'Governance API', value: json({ entries: [{ path: '/api/governance/jobs', method: 'POST', summary: 'Queue documentation job', description: 'Queues a tenant-scoped governed documentation job.', params: [], responses: { '202': { description: 'Job queued' }, '403': { description: 'Workspace membership required' } } }], title: 'Governance API', version: '1.0.0', server_url: 'http://localhost:3000' }) },
    ],
  },
  { kind: 'gap-ai', slug: 'gap-ai-no-clinical-note-coding-compliance-check-hcc-meat-risk', label: 'Clinical coding compliance replacement', desc: 'Retired placeholder; use the supported note quality and code review paths.', endpoint: '/batch03-gap/gap-no-clinical-note-coding-compliance-check-hcc-meat-risk', presets: RETIRED_PRESETS },
  { kind: 'gap-ai', slug: 'gap-ai-no-agentic-doc-generator-from-full-repo-scan', label: 'Governed repository documentation replacement', desc: 'Retired placeholder; use governed documentation jobs.', endpoint: '/batch03-gap/gap-no-agentic-doc-generator-from-full-repo-scan', presets: RETIRED_PRESETS },
  { kind: 'gap-ai', slug: 'gap-ai-no-drift-consistency-detector-across-linked-docs', label: 'Documentation consistency replacement', desc: 'Retired placeholder; use the supported consistency workflow.', endpoint: '/batch03-gap/gap-no-drift-consistency-detector-across-linked-docs', presets: RETIRED_PRESETS },
  { kind: 'gap-non', slug: 'gap-non-no-multi-tenant-organisation-scoping-in-pages-observed', label: 'Workspace scoping status', desc: 'Retired placeholder; workspace scoping is enforced in native routes.', endpoint: '/batch03-gap/gap-no-multi-tenant-organisation-scoping-in-pages-observed', presets: RETIRED_PRESETS },
  { kind: 'gap-non', slug: 'gap-non-no-webhook-delivery-log-retry-ui-incoming-github-hook-exi', label: 'Webhook operations status', desc: 'Retired placeholder; use the supported repository workflow.', endpoint: '/batch03-gap/gap-no-webhook-delivery-log-retry-ui-incoming-github-hook-exi', presets: RETIRED_PRESETS },
  { kind: 'gap-non', slug: 'gap-non-no-public-api-tokens-management-beyond-integrations', label: 'Integration credential status', desc: 'Retired placeholder; use the governed integration workflow.', endpoint: '/batch03-gap/gap-no-public-api-tokens-management-beyond-integrations', presets: RETIRED_PRESETS },
];

function authHeaders() {
  const t = (typeof window !== 'undefined') ? localStorage.getItem('token') : null;
  return { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) };
}

export default function Batch03Features() {
  const [active, setActive] = useState(FEATURES[0]?.slug);
  const [input, setInput] = useState('');
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const applySampleRequest = (value) => {
    setInput(value);
    setError(null);
  };
  const current = FEATURES.find(f => f.slug === active) || FEATURES[0];

  async function run() {
    if (!current?.endpoint) return;
    setLoading(true);
    setError(null);
    try {
      if (!input.trim()) throw new Error('Choose a complete preset or enter a JSON request.');
      let parsed;
      try {
        parsed = JSON.parse(input);
      } catch {
        throw new Error('Request must be valid JSON.');
      }
      const r = await fetch(`${API_BASE}${current.endpoint}`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify(parsed)
      });
      const text = await r.text();
      let body;
      try { body = JSON.parse(text); } catch { body = { response: text || 'No response body was returned.' }; }
      if (!r.ok) setError(body.message || body.error || `HTTP ${r.status}`);
      setResults(prev => ({ ...prev, [current.slug]: body }));
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout>
    <div className="mx-auto max-w-5xl space-y-5">
      <h2 style={{ marginTop: 0 }}>Batch 03 Features <small style={{ color: '#64748b', fontWeight: 400 }}>(aIDocumentationAssistant)</small></h2>
      <p style={{ color: '#475569', maxWidth: 720 }}>
        Compatibility tools with complete request presets and structured response reports. Governed repository generation stays in the native AI Jobs workflow.
      </p>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '12px 0' }}>
        {FEATURES.map(f => (
          <button key={f.slug} onClick={() => setActive(f.slug)}
            style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid #cbd5e1',
                     background: active === f.slug ? '#1e40af' : '#f8fafc',
                     color: active === f.slug ? 'white' : '#0f172a', cursor: 'pointer', fontSize: 12 }}>
            <span style={{ opacity: 0.7, marginRight: 4 }}>[{f.kind}]</span>{f.label}
          </button>
        ))}
      </div>
      {current && (
        <div style={{ marginTop: 16, padding: 16, background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
          <div style={{ marginBottom: 8 }}>
            <strong>{current.label}</strong>
            <div style={{ color: '#475569', fontSize: 13 }}>{current.desc}</div>
            {current.endpoint && <div style={{ color: '#64748b', fontSize: 11, marginTop: 4 }}>POST <code>{API_BASE}{current.endpoint}</code></div>}
          </div>
          {current.replacement ? (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
              This compatibility form is retired. <Link className="font-semibold underline" href={current.replacement}>Open the supported governed workflow</Link>.
            </div>
          ) : (
            <>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          {(current.presets || []).map((sample) => (
            <button
              key={sample.label}
              type="button"
              data-ai-preset={sample.label}
              onClick={() => applySampleRequest(sample.value)}
              style={{ padding: '6px 10px', background: '#eef2ff', color: '#1e3a8a', border: '1px solid #c7d2fe', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
            >
              {sample.label}
            </button>
          ))}
        </div>

          <textarea aria-label="Complete JSON request" value={input} onChange={e => setInput(e.target.value)}
            placeholder="Choose a complete preset or enter a valid JSON request"
            style={{ width: '100%', minHeight: 80, padding: 8, fontFamily: 'monospace', fontSize: 12, border: '1px solid #cbd5e1', borderRadius: 4 }} />
          <div style={{ marginTop: 8 }}>
            <button onClick={run} disabled={loading}
              style={{ padding: '8px 16px', background: '#1e40af', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
              {loading ? 'Running…' : 'Run'}
            </button>
          </div>
          {error && (<div style={{ marginTop: 12, padding: 10, background: '#fee2e2', color: '#991b1b', borderRadius: 4, fontSize: 13 }}>{error}</div>)}
          {results[current.slug] && (
            <AIResponseReport value={results[current.slug]} title={`${current.label} response`} />
          )}
            </>
          )}
        </div>
      )}
    </div>
    </Layout>
  );
}
