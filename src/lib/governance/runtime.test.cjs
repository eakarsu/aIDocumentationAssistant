'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {
  decryptCredential,
  tenantPrincipals,
  enqueueJob,
  claimJob,
  failJob,
  executeClaimedJob,
} = require('./runtime.cjs');

function encryptForTest(text, key) {
  const iv = Buffer.alloc(12, 7);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
  return ['v2', iv.toString('hex'), cipher.getAuthTag().toString('hex'), encrypted.toString('hex')].join(':');
}

function requestBody(overrides = {}) {
  return {
    repositoryId: 'repo-1',
    kind: 'UPDATE_README',
    task: 'Update the README from indexed evidence.',
    audience: 'maintainers',
    sourceIds: [],
    idempotencyKey: 'request-1',
    ...overrides,
  };
}

function enqueueFixture(overrides = {}) {
  const calls = { jobs: [], audits: [], repositoryUpdates: [] };
  const created = { id: 'job-1', tenantId: 'tenant-1', traceId: 'trace-1', status: 'QUEUED' };
  const tx = {
    governedToolJob: { create: async ({ data }) => { calls.jobs.push(data); return { ...created, ...data }; } },
    repository: { update: async (value) => { calls.repositoryUpdates.push(value); return value; } },
    auditLog: { create: async ({ data }) => { calls.audits.push(data); return data; } },
  };
  const prisma = {
    repository: { findFirst: async () => ({ id: 'repo-1', tenantId: 'tenant-1', syncEnabled: true }) },
    governedToolJob: {
      findUnique: async () => overrides.existing || null,
      count: async () => overrides.recent || 0,
    },
    $transaction: async (callback) => callback(tx),
  };
  return { prisma, calls };
}

test('decrypts authenticated connector credentials', () => {
  const previous = process.env.ENCRYPTION_KEY;
  const key = Buffer.alloc(32, 3);
  process.env.ENCRYPTION_KEY = key.toString('hex');
  try {
    assert.equal(decryptCredential(encryptForTest('github-token-value', key)), 'github-token-value');
  } finally {
    if (previous === undefined) delete process.env.ENCRYPTION_KEY;
    else process.env.ENCRYPTION_KEY = previous;
  }
});

test('rejects placeholder and legacy connector credentials', () => {
  const previous = process.env.ENCRYPTION_KEY;
  process.env.ENCRYPTION_KEY = 'replace-with-64-hex-characters';
  try {
    assert.throws(() => decryptCredential('legacy:value'), /not configured|unsupported/);
  } finally {
    if (previous === undefined) delete process.env.ENCRYPTION_KEY;
    else process.env.ENCRYPTION_KEY = previous;
  }
});

test('derives permission principals only from authenticated context', () => {
  assert.deepEqual(tenantPrincipals('tenant-1', 'user-1', 'REVIEWER'), ['tenant:tenant-1', 'user:user-1', 'role:reviewer']);
});

test('enqueue persists a typed request, trace, and digest-only audit', async () => {
  const { prisma, calls } = enqueueFixture();
  const job = await enqueueJob(prisma, { tenantId: 'tenant-1', tenantRole: 'MEMBER', userId: 'user-1', body: requestBody({ actorPrincipals: ['tenant:attacker'] }) });
  assert.equal(job.id, 'job-1');
  assert.deepEqual(calls.jobs[0].input.actorPrincipals, ['tenant:tenant-1', 'user:user-1', 'role:member']);
  assert.equal(calls.audits[0].newValues.inputDigest.length, 64);
  assert.doesNotMatch(JSON.stringify(calls.audits[0]), /Update the README/);
});

test('enqueue returns the tenant-idempotent existing job', async () => {
  const existing = { id: 'existing-job', tenantId: 'tenant-1', status: 'QUEUED' };
  const { prisma, calls } = enqueueFixture({ existing });
  assert.equal((await enqueueJob(prisma, { tenantId: 'tenant-1', tenantRole: 'MEMBER', userId: 'user-1', body: requestBody() })).id, 'existing-job');
  assert.equal(calls.jobs.length, 0);
});

test('enqueue rejects repositories outside the active tenant', async () => {
  const { prisma } = enqueueFixture();
  prisma.repository.findFirst = async () => null;
  await assert.rejects(enqueueJob(prisma, { tenantId: 'tenant-2', tenantRole: 'MEMBER', userId: 'user-1', body: requestBody() }), (error) => error.code === 'NOT_FOUND');
});

test('enqueue enforces the durable tenant rate budget', async () => {
  const { prisma } = enqueueFixture({ recent: 20 });
  await assert.rejects(enqueueJob(prisma, { tenantId: 'tenant-1', tenantRole: 'MEMBER', userId: 'user-1', body: requestBody() }), (error) => error.code === 'RATE_LIMITED');
});

test('claim uses a bounded PostgreSQL lease and increments attempts', async () => {
  let update;
  const job = { id: 'job-1', status: 'QUEUED', timeoutMs: 2_000, attempt: 0, startedAt: null };
  const tx = {
    $queryRawUnsafe: async (query) => { assert.match(query, /FOR UPDATE SKIP LOCKED/); return [{ id: job.id }]; },
    governedToolJob: {
      findUnique: async () => job,
      update: async (value) => { update = value; return { ...job, ...value.data }; },
    },
  };
  const prisma = {
    governedToolJob: { updateMany: async () => ({ count: 0 }) },
    $transaction: async (callback) => callback(tx),
  };
  const claimed = await claimJob(prisma, 'worker-1');
  assert.equal(claimed.status, 'RUNNING');
  assert.deepEqual(update.data.attempt, { increment: 1 });
  assert.equal(update.data.leaseOwner, 'worker-1');
});

test('retryable connector failure schedules retry and reconciles sync status', async () => {
  const calls = { job: null, repository: null, sync: null };
  const tx = {
    governedToolJob: { update: async ({ data }) => { calls.job = data; return data; } },
    auditLog: { create: async () => ({}) },
    repository: { update: async ({ data }) => { calls.repository = data; return data; } },
    connectorSyncRun: { updateMany: async ({ data }) => { calls.sync = data; return { count: 1 }; } },
  };
  const prisma = { $transaction: async (callback) => callback(tx) };
  await failJob(prisma, { id: 'job-1', tenantId: 'tenant-1', requestedById: 'user-1', kind: 'REPOSITORY_SYNC', repositoryId: 'repo-1', attempt: 1, maxAttempts: 3, traceId: 'trace-1' }, { code: 'UPSTREAM', message: 'unavailable', retryable: true });
  assert.equal(calls.job.status, 'RETRY_WAIT');
  assert.equal(calls.repository.lastSyncStatus, 'QUEUED');
  assert.equal(calls.sync.status, 'QUEUED');
});

test('claimed cancellation completes without invoking a tool', async () => {
  let update;
  const prisma = { governedToolJob: { update: async (value) => { update = value; return value.data; } } };
  const result = await executeClaimedJob(prisma, { id: 'job-1', cancelRequestedAt: new Date() });
  assert.equal(result.status, 'CANCELLED');
  assert.equal(update.data.leaseOwner, null);
});
