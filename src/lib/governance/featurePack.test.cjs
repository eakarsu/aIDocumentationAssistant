'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { validateTask, filterDocs, toCsv, toJsonExport, docCompleteness, staleDocs, publishReadiness } = require('../featurePack.cjs');

test('validateTask requires title and normalises status', () => {
  assert.throws(() => validateTask({}), /title is required/);
  assert.equal(validateTask({ title: ' Review doc ' }).status, 'open');
  assert.equal(validateTask({ title: 'X', status: 'done' }).status, 'done');
});

test('filterDocs searches and filters docs; export preserves 0', () => {
  const rows = [
    { id: '1', title: 'Guide', status: 'DRAFT', visibility: 'PRIVATE', wordCount: 0, createdAt: '2026-01-01' },
    { id: '2', title: 'API Ref', status: 'PUBLISHED', visibility: 'PUBLIC', wordCount: 50, createdAt: '2026-01-02' },
  ];
  assert.equal(filterDocs(rows, { search: 'guide' }).length, 1);
  assert.equal(filterDocs(rows, { status: 'published' })[0].id, '2');
  assert.match(toCsv(rows), /Guide,DRAFT,PRIVATE,0/);
  assert.equal(toJsonExport(rows).count, 2);
});

test('deterministic doc AI is labelled and preserves zero/false', () => {
  const c = docCompleteness({ title: '', content: '', excerpt: '', status: 'DRAFT' });
  assert.equal(c.aiGenerated, false);
  assert.equal(c.wordCount, 0);
  assert.equal(c.hasTitle, false);
  assert.equal(c.isEmpty, true);
  const s = staleDocs([{ title: 'Old', updatedAt: '2020-01-01' }], new Date('2026-01-01'));
  assert.equal(s.aiGenerated, false);
  assert.equal(s.staleCount, 1);
  assert.equal(s.hasStale, true);
  const p = publishReadiness([]);
  assert.equal(p.totalDocs, 0);
  assert.equal(p.allPublished, false);
});
