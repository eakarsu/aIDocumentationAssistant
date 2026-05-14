// === Batch 03 Gaps & Frontend Mounts ===
// Auto-generated frontend page (lean v0). Wires Custom Feature Suggestions
// and Gap endpoints (AI counterparts + non-AI features) to backend routes.
import React, { useState } from 'react';

const API_BASE = (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_URL) || 'http://localhost:4000/api';

const FEATURES = [
  { kind: 'cfs', slug: 'cf-rag-over-clinical-templates', label: 'RAG over clinical templates', desc: 'Retrieve specialty-specific phrasing as scribe drafts SOAP', endpoint: '/cf-rag-over-clinical-templates' },
  { kind: 'cfs', slug: 'cf-live-code-to-docs-sync', label: 'Live code-to-docs sync', desc: 'GitHub webhook already wired — extend to auto-regenerate affected pages', endpoint: '/cf-live-code-to-docs-sync' },
  { kind: 'cfs', slug: 'cf-fhir-bundle-round-trip', label: 'FHIR-bundle round-trip', desc: 'Currently export-only (`notes/export-fhir`); add FHIR import for chart pre-population', endpoint: '/cf-fhir-bundle-round-trip' },
  { kind: 'cfs', slug: 'cf-voice-driven-coding', label: 'Voice-driven coding', desc: 'Combine `recordings/transcribe` + `ai/billing-codes` into a single pipeline', endpoint: '/cf-voice-driven-coding' },
  { kind: 'cfs', slug: 'cf-openapi-generator', label: 'OpenAPI generator', desc: 'Use `docs/parse/jsdoc` output to emit Swagger spec', endpoint: '/cf-openapi-generator' },
  { kind: 'gap-ai', slug: 'gap-ai-no-clinical-note-coding-compliance-check-hcc-meat-risk', label: 'No clinical note coding compliance check (HCC/MEAT risk)', desc: 'No clinical note coding compliance check (HCC/MEAT risk)', endpoint: '/gap-no-clinical-note-coding-compliance-check-hcc-meat-risk' },
  { kind: 'gap-ai', slug: 'gap-ai-no-agentic-doc-generator-from-full-repo-scan', label: 'No agentic doc generator from full repo scan', desc: 'No agentic doc generator from full repo scan', endpoint: '/gap-no-agentic-doc-generator-from-full-repo-scan' },
  { kind: 'gap-ai', slug: 'gap-ai-no-drift-consistency-detector-across-linked-docs', label: 'No drift/consistency detector across linked docs', desc: 'No drift/consistency detector across linked docs', endpoint: '/gap-no-drift-consistency-detector-across-linked-docs' },
  { kind: 'gap-non', slug: 'gap-non-no-multi-tenant-organisation-scoping-in-pages-observed', label: 'No multi-tenant/organisation scoping in pages observed', desc: 'No multi-tenant/organisation scoping in pages observed', endpoint: '/gap-no-multi-tenant-organisation-scoping-in-pages-observed' },
  { kind: 'gap-non', slug: 'gap-non-no-webhook-delivery-log-retry-ui-incoming-github-hook-exi', label: 'No webhook delivery log / retry UI (incoming GitHub hook exi', desc: 'No webhook delivery log / retry UI (incoming GitHub hook exists but no admin view)', endpoint: '/gap-no-webhook-delivery-log-retry-ui-incoming-github-hook-exi' },
  { kind: 'gap-non', slug: 'gap-non-no-public-api-tokens-management-beyond-integrations', label: 'No public API tokens management beyond integrations', desc: 'No public API tokens management beyond integrations', endpoint: '/gap-no-public-api-tokens-management-beyond-integrations' },
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
  const current = FEATURES.find(f => f.slug === active) || FEATURES[0];

  async function run() {
    if (!current) return;
    setLoading(true); setError(null);
    try {
      let parsed;
      try { parsed = input ? JSON.parse(input) : {}; } catch { parsed = { input }; }
      const r = await fetch(`${API_BASE}${current.endpoint}`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify(parsed)
      });
      let body; try { body = await r.json(); } catch { body = { raw: await r.text() }; }
      if (!r.ok) setError(body.error || `HTTP ${r.status}`);
      setResults(prev => ({ ...prev, [current.slug]: body }));
    } catch (e) {
      setError(String(e.message || e));
    } finally { setLoading(false); }
  }

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h2 style={{ marginTop: 0 }}>Batch 03 Features <small style={{ color: '#64748b', fontWeight: 400 }}>(aIDocumentationAssistant)</small></h2>
      <p style={{ color: '#475569', maxWidth: 720 }}>
        Audit-driven AI counterparts, non-AI feature gaps, and custom feature suggestions.
        Backend endpoints prefixed <code>/api/cf-*</code> (custom features) and <code>/api/gap-*</code> (gap fills).
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
            <div style={{ color: '#64748b', fontSize: 11, marginTop: 4 }}>POST <code>{current.endpoint}</code></div>
          </div>
          <textarea value={input} onChange={e => setInput(e.target.value)}
            placeholder='Optional JSON input (e.g. {"query":"..."})'
            style={{ width: '100%', minHeight: 80, padding: 8, fontFamily: 'monospace', fontSize: 12, border: '1px solid #cbd5e1', borderRadius: 4 }} />
          <div style={{ marginTop: 8 }}>
            <button onClick={run} disabled={loading}
              style={{ padding: '8px 16px', background: '#1e40af', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
              {loading ? 'Running…' : 'Run'}
            </button>
          </div>
          {error && (<div style={{ marginTop: 12, padding: 10, background: '#fee2e2', color: '#991b1b', borderRadius: 4, fontSize: 13 }}>{error}</div>)}
          {results[current.slug] && (
            <pre style={{ marginTop: 12, padding: 10, background: '#0b1020', color: '#cbd5e1', borderRadius: 4, overflow: 'auto', maxHeight: 360, fontSize: 12 }}>
              {typeof results[current.slug] === 'string' ? results[current.slug] : JSON.stringify(results[current.slug], null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
