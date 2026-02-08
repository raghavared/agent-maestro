import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { exec } from 'child_process';
import { createServer, Server } from 'http';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);
const CLI_PATH = path.resolve(process.cwd(), 'bin/maestro.js');

describe('CLI Integration', () => {
    let server: Server;
    let port: number;

    beforeAll(async () => {
        // Start a mock server
        server = createServer((req, res) => {
            res.setHeader('Content-Type', 'application/json');
            // Add CORS if needed? CLI is server-side, no CORS.
            
            if (req.url?.startsWith('/api/tasks') && req.method === 'GET') {
                res.end(JSON.stringify([{ id: 't1', title: 'Task 1', status: 'pending', priority: 'medium' }]));
            } else if (req.url === '/api/tasks' && req.method === 'POST') {
                let body = '';
                req.on('data', chunk => body += chunk);
                req.on('end', () => {
                    const data = JSON.parse(body);
                    res.end(JSON.stringify({ id: 't2', ...data }));
                });
            } else {
                res.statusCode = 404;
                res.end(JSON.stringify({ error: 'Not found' }));
            }
        });
        
        await new Promise<void>((resolve) => {
            server.listen(0, () => {
                port = (server.address() as any).port;
                resolve();
            });
        });
    });

    afterAll(() => {
        server.close();
    });

    it('should list tasks via API', async () => {
        // We run the CLI command. We need to point to the bin script.
        // We assume 'npm run build' has been run.
        const { stdout } = await execAsync(`node ${CLI_PATH} task list --server http://localhost:${port} --json`);
        const result = JSON.parse(stdout);
        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(1);
        expect(result.data[0].id).toBe('t1');
    });

    it('should create a task via API', async () => {
        const { stdout } = await execAsync(`node ${CLI_PATH} task create "New Task" --project p1 --server http://localhost:${port} --json`);
        const result = JSON.parse(stdout);
        expect(result.success).toBe(true);
        expect(result.data.title).toBe('New Task');
        expect(result.data.projectId).toBe('p1');
    });
});
