import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { exec } from 'child_process';
import { createServer, Server, IncomingMessage, ServerResponse } from 'http';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);
const CLI_PATH = path.resolve(process.cwd(), 'bin/maestro.js');

describe('workspace-openness CLI integration', () => {
  let server: Server;
  let port: number;
  const capturedRequests: Array<{ method: string; url: string; headers: Record<string, string>; body: string }> = [];

  beforeAll(async () => {
    server = createServer((req: IncomingMessage, res: ServerResponse) => {
      let body = '';
      req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      req.on('end', () => {
        capturedRequests.push({
          method: req.method || 'GET',
          url: req.url || '/',
          headers: req.headers as Record<string, string>,
          body,
        });

        res.setHeader('Content-Type', 'application/json');

        if (req.url?.match(/^\/api\/sessions\/[^/]+\/mode$/) && req.method === 'POST') {
          res.end(JSON.stringify({ id: 'sess-test', mode: 'coordinator', previousMode: 'worker', changed: true }));
        } else if (req.url?.match(/^\/api\/sessions\/[^/]+\/mode$/) && req.method === 'GET') {
          res.end(JSON.stringify({ id: 'sess-test', mode: 'worker', relation: 'standalone', role: 'worker' }));
        } else if (req.url?.startsWith('/api/master/sessions')) {
          res.end(JSON.stringify([]));
        } else if (req.url?.startsWith('/api/team-members/')) {
          res.end(JSON.stringify({ id: 'tm-1', name: 'Test Member', role: 'Tester', mode: 'worker', status: 'active', avatar: 'T' }));
        } else {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: 'Not found' }));
        }
      });
    });

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        port = (server.address() as { port: number }).port;
        resolve();
      });
    });
  });

  afterAll(() => {
    server.close();
  });

  it('coordinator enable: POSTs to /api/sessions/:id/mode with role coordinator', async () => {
    capturedRequests.length = 0;
    const { stdout } = await execAsync(
      `MAESTRO_SESSION_ID=sess-test node ${CLI_PATH} coordinator enable --server http://localhost:${port} --json`,
    );
    const result = JSON.parse(stdout);
    const data = result.data ?? result;
    expect(data.changed).toBe(true);
    expect(data.mode).toBe('coordinator');

    const req = capturedRequests.find(r => r.url.includes('/mode') && r.method === 'POST');
    expect(req).toBeDefined();
    expect(JSON.parse(req!.body)).toMatchObject({ role: 'coordinator' });
  });

  it('coordinator enable: attaches X-Session-Id header', async () => {
    capturedRequests.length = 0;
    await execAsync(
      `MAESTRO_SESSION_ID=sess-test node ${CLI_PATH} coordinator enable --server http://localhost:${port} --json`,
    );
    const req = capturedRequests.find(r => r.url.includes('/mode') && r.method === 'POST');
    expect(req).toBeDefined();
    expect(req!.headers['x-session-id']).toBe('sess-test');
  });

  it('master sessions --active: forwards ?active=true', async () => {
    capturedRequests.length = 0;
    await execAsync(
      `node ${CLI_PATH} master sessions --active --server http://localhost:${port} --json`,
    );
    const req = capturedRequests.find(r => r.url.startsWith('/api/master/sessions'));
    expect(req).toBeDefined();
    expect(req!.url).toContain('active=true');
  });

  it('master sessions without --active: does not include active=true', async () => {
    capturedRequests.length = 0;
    await execAsync(
      `node ${CLI_PATH} master sessions --server http://localhost:${port} --json`,
    );
    const req = capturedRequests.find(r => r.url.startsWith('/api/master/sessions'));
    expect(req).toBeDefined();
    expect(req!.url).not.toContain('active=true');
  });

  it('team-member get: works without --project flag (no required-projectId error)', async () => {
    capturedRequests.length = 0;
    // Run with no MAESTRO_PROJECT_ID in env and no --project flag: should not throw "No project context" error
    const { stdout, stderr } = await execAsync(
      `MAESTRO_PROJECT_ID= node ${CLI_PATH} team-member get tm-1 --server http://localhost:${port} --json`,
    );
    const result = JSON.parse(stdout);
    const data = result.data ?? result;
    expect(data.id).toBe('tm-1');

    // No error should appear
    expect(stderr).not.toContain('No project context');

    const req = capturedRequests.find(r => r.url.includes('/api/team-members/tm-1'));
    expect(req).toBeDefined();
    // Without projectId env var, the endpoint should not include projectId
    expect(req!.url).not.toContain('projectId');
  });
});
