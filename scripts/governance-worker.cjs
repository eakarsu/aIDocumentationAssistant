#!/usr/bin/env node
'use strict';

const { PrismaClient } = require('@prisma/client');
const { claimJob, executeClaimedJob } = require('../src/lib/governance/runtime.cjs');

const prisma = new PrismaClient();
const workerId = process.env.GOVERNANCE_WORKER_ID || `worker-${process.pid}`;
const pollMs = Math.max(250, Number.parseInt(process.env.GOVERNANCE_POLL_MS || '1000', 10));
let stopping = false;

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => { stopping = true; });
}

async function main() {
  while (!stopping) {
    const job = await claimJob(prisma, workerId);
    if (job) await executeClaimedJob(prisma, job);
    else await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}

main()
  .catch((error) => {
    console.error('Governance worker failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
