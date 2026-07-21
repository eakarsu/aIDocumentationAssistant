import retiredGapRoute from '@/lib/retired-gap-route';

export default retiredGapRoute(
  '/api/notes/[id]/ai/codes',
  'The generic clinical-compliance prompt simulation was removed; use the authenticated coding workflow and require professional review.'
);
