import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const python = join(root, 'api', '.venv', 'bin', 'python');
const vite = join(root, 'node_modules', 'vite', 'bin', 'vite.js');
const port = (name, fallback) => {
    const value = Number(process.env[name] || fallback);
    if (!Number.isInteger(value) || value < 1024 || value > 65535) throw new Error(name + ' must be a port from 1024 to 65535.');
    return value;
};
const apiPort = port('BILLFLOW_API_PORT', 8001);
const webPort = port('BILLFLOW_WEB_PORT', 3000);
const origin = 'http://127.0.0.1:' + webPort;
const apiOrigin = 'http://127.0.0.1:' + apiPort;
const children = [];
let stopping = false;
const stop = () => {
    if (stopping) return;
    stopping = true;
    for (const child of children) {
        if (child.exitCode !== null || !child.pid) continue;
        try { process.kill(-child.pid, 'SIGTERM'); } catch (error) { if (error.code !== 'ESRCH') console.error(error.message); }
    }
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
const launch = (command, args, env) => {
    const child = spawn(command, args, { cwd: root, stdio: 'inherit', env, detached: true });
    children.push(child);
    child.on('error', error => { console.error(error.message); process.exitCode = 1; stop(); });
    child.on('exit', code => {
        if (!stopping) { process.exitCode = code || 1; stop(); }
    });
    return child;
};
async function available(value) {
    await new Promise((resolve, reject) => {
        const server = createServer();
        server.once('error', () => reject(new Error('Port ' + value + ' is occupied. Stop that service or set BILLFLOW_WEB_PORT/BILLFLOW_API_PORT.')));
        server.listen(value, '127.0.0.1', () => server.close(resolve));
    });
}
try {
    if (!existsSync(python) || !existsSync(vite)) throw new Error('Run yarn setup:local before starting the connected application.');
    if (apiPort === webPort) throw new Error('Web and API ports must be different.');
    await Promise.all([available(webPort), available(apiPort)]);
    const env = { ...process.env, APP_ORIGIN: origin, EMAIL_DELIVERY_MODE: 'capture',
        BILLFLOW_API_PORT: String(apiPort), BILLFLOW_API_TARGET: apiOrigin,
        REACT_APP_ACCOUNT_BACKEND: 'django' };
    const backend = launch(python, [join(root, 'api/scripts/with_local_postgres.py'), '--', '-m', 'scripts.run_local'], env);
    let ready = false;
    const deadline = Date.now() + 60000;
    while (!stopping && Date.now() < deadline) {
        if (backend.exitCode !== null) break;
        try {
            const response = await fetch(apiOrigin + '/api/v1/health/ready', { signal: AbortSignal.timeout(1500) });
            if (response.ok) { ready = true; break; }
        } catch {}
        await delay(300);
    }
    if (!ready) throw new Error('The local API did not become ready.');
    launch(process.execPath, [vite, '--host', '127.0.0.1', '--port', String(webPort), '--strictPort'], env);
    console.log('BillFlow connected app: ' + origin);
    console.log('Verification/recovery messages are captured privately in api/.local/mail/.');
    console.log('Press Ctrl+C to stop the web app, API and local database.');
} catch (error) {
    if (!stopping) { console.error(error.message); process.exitCode = 1; }
    stop();
}
