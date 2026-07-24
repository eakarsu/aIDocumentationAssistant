import http from 'node:http';

const listenPort = Number(process.env.BACKEND_PORT);
const targetPort = Number(process.env.FRONTEND_PORT);
if (!Number.isInteger(listenPort) || !Number.isInteger(targetPort)) throw new Error('BACKEND_PORT and FRONTEND_PORT are required');

const server = http.createServer((request, response) => {
  const upstream = http.request({
    hostname: '127.0.0.1',
    port: targetPort,
    path: request.url,
    method: request.method,
    headers: { ...request.headers, host: `127.0.0.1:${targetPort}` },
  }, (upstreamResponse) => {
    response.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
    upstreamResponse.pipe(response);
  });
  upstream.on('error', () => {
    if (!response.headersSent) response.writeHead(502, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ error: 'Application server is not ready' }));
  });
  request.pipe(upstream);
});

server.listen(listenPort, '127.0.0.1');
const shutdown = () => server.close(() => process.exit(0));
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
