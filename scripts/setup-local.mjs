import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const python = process.env.BILLFLOW_PYTHON || 'python3';
const run = (program, args, extra = {}) => {
    const result = spawnSync(program, args, {
        cwd: root, stdio: 'inherit',
        env: { ...process.env, PIP_CACHE_DIR: join(root, '.cache', 'pip'), ...extra },
    });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status || 1);
};
run('yarn', ['install', '--frozen-lockfile', '--non-interactive']);
const interpreter = join(root, 'api', '.venv', 'bin', 'python');
if (!existsSync(interpreter)) run(python, ['-m', 'venv', join(root, 'api', '.venv')]);
run(interpreter, ['-m', 'pip', 'install', '-r', join(root, 'api', 'requirements-local.txt')]);
console.log('Local setup complete. Start the connected application with: yarn dev:local');
