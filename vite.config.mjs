import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
    const connected = env.REACT_APP_ACCOUNT_BACKEND === 'django';
    return {
        plugins: [react()],
        define: {
            'process.env.REACT_APP_ACCOUNT_BACKEND': JSON.stringify(connected ? 'django' : ''),
            'process.env.PUBLIC_URL': JSON.stringify(''),
        },
        build: { outDir: 'build', emptyOutDir: true },
        server: {
            host: '127.0.0.1', port: 3000, strictPort: true,
            proxy: connected ? Object.fromEntries(['/api', '/_allauth', '/accounts'].map(path =>
                [path, { target: env.BILLFLOW_API_TARGET || 'http://127.0.0.1:8001', changeOrigin: true }])) : {},
        },
    };
});
