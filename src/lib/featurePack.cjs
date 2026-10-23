'use strict';
// Feature pack wave 2A — pure helpers: task validation, doc search/filter,
// CSV/JSON export, deterministic document AI fallbacks (aiGenerated:false).
const DOC_COLUMNS = ['id', 'title', 'status', 'visibility', 'wordCount', 'createdAt'];

function validateTask(input = {}) {
  const title = String(input.title || '').trim();
  if (!title) throw new Error('title is required');
  const status = ['open', 'in_progress', 'done'].includes(input.status) ? input.status : 'open';
  return { title, status, assignee: input.assignee || null, doc_id: input.doc_id ?? null, due_date: input.due_date || null, notes: input.notes || null };
}

function filterDocs(records, filters = {}) {
  const list = Array.isArray(records) ? records : [];
  const q = String(filters.search || '').trim().toLowerCase();
  const status = String(filters.status || '').trim().toLowerCase();
  return list.filter((r) => {
    if (status && String(r.status || '').toLowerCase() !== status) return false;
    if (q) {
      const hay = `${r.title || ''} ${r.excerpt || ''} ${r.status || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function csvEscape(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(records, columns = DOC_COLUMNS) {
  const list = Array.isArray(records) ? records : [];
  return [columns.join(','), ...list.map((r) => columns.map((c) => csvEscape(r[c])).join(','))].join('\n');
}
function toJsonExport(records) {
  return { exported_at: new Date().toISOString(), count: (records || []).length, data: records || [] };
}

// Deterministic document AI over the user's own docs.
function docCompleteness(doc = {}) {
  const content = String(doc.content || '');
  const words = content.split(/\s+/).filter(Boolean).length;
  const hasTitle = Boolean(String(doc.title || '').trim());
  const hasExcerpt = Boolean(String(doc.excerpt || '').trim());
  return {
    aiGenerated: false, source: 'deterministic-fallback', feature: 'doc-completeness',
    title: doc.title || '', wordCount: words, hasTitle, hasExcerpt,
    isEmpty: words === 0, isDraft: String(doc.status || '') === 'DRAFT',
    summary: `${hasTitle ? 'Titled' : 'Untitled'} document with ${words} word(s)${hasExcerpt ? '' : ' and no excerpt'}.`,
    nextActions: [...(hasExcerpt ? [] : ['Add a short excerpt so the doc is findable in search.']), ...(words === 0 ? ['Add body content before publishing.'] : [])],
  };
}
function staleDocs(docs, now = new Date(), staleDays = 90) {
  const list = Array.isArray(docs) ? docs : [];
  const cutoff = now.getTime() - staleDays * 86400000;
  const stale = list.filter((d) => new Date(d.updatedAt || d.createdAt || 0).getTime() < cutoff);
  return {
    aiGenerated: false, source: 'deterministic-fallback', feature: 'stale-docs',
    totalDocs: list.length, staleCount: stale.length, staleDays,
    summary: `${stale.length} of ${list.length} document(s) not updated in ${staleDays} days.`,
    nextActions: stale.slice(0, 5).map((d) => `Review ${d.title || 'untitled doc'}`),
    hasStale: stale.length > 0,
  };
}
function publishReadiness(docs) {
  const list = Array.isArray(docs) ? docs : [];
  const drafts = list.filter((d) => String(d.status || '') === 'DRAFT');
  const published = list.filter((d) => String(d.status || '') === 'PUBLISHED');
  return {
    aiGenerated: false, source: 'deterministic-fallback', feature: 'publish-readiness',
    totalDocs: list.length, drafts: drafts.length, published: published.length,
    summary: `${published.length} published, ${drafts.length} still in draft.`,
    nextActions: drafts.slice(0, 5).map((d) => `Finish draft: ${d.title || 'untitled doc'}`),
    allPublished: drafts.length === 0 && list.length > 0,
  };
}

module.exports = { DOC_COLUMNS, validateTask, filterDocs, toCsv, toJsonExport, docCompleteness, staleDocs, publishReadiness };
