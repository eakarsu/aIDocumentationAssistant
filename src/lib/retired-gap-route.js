export default function retiredGapRoute(replacement, reason) {
  return function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Link', `<${replacement}>; rel="successor-version"`);
    return res.status(410).json({
      error: 'PLACEHOLDER_ROUTE_RETIRED',
      message: reason,
      replacement,
    });
  };
}
