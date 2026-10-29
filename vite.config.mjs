import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export default defineConfig(({ command, mode, isPreview }) => {
    const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
    const connected = env.REACT_APP_ACCOUNT_BACKEND === 'django';
    let localLogin = {};
    const loginFile = fileURLToPath(new URL('./api/.local/local-login.json', import.meta.url));
    if (command === 'serve' && !isPreview && mode === 'development' && connected && existsSync(loginFile)) {
        const saved = JSON.parse(readFileSync(loginFile, 'utf8'));
        localLogin = { email: saved.email, password: saved.password };
    }
    return {
        plugins: [tailwindcss(), react()],
        define: {
            'process.env.REACT_APP_ACCOUNT_BACKEND': JSON.stringify(connected ? 'django' : ''),
            'process.env.REACT_APP_LOCAL_LOGIN': JSON.stringify(JSON.stringify(localLogin)),
            'process.env.PUBLIC_URL': JSON.stringify(''),
        },
        build: { outDir: 'build', emptyOutDir: true },
        server: {
            host: '127.0.0.1', port: 3000, strictPort: true,
            fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/api/**', '**/.cache/**', '**/.venv/**'] },
            proxy: connected ? Object.fromEntries(['/api', '/_allauth', '/accounts'].map(path =>
                [path, { target: env.BILLFLOW_API_TARGET || 'http://127.0.0.1:8001', changeOrigin: true }])) : {},
        },
    };
});
