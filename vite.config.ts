import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '')
    const proxyTarget = env.VITE_API_PROXY_TARGET || 'https://arnvoid-api-242743978070.asia-southeast2.run.app'

    return {
        server: {
            allowedHosts: [
                '.trycloudflare.com'
            ],
            proxy: {
                '/api': {
                    target: proxyTarget,
                    changeOrigin: true,
                    secure: true,
                    rewrite: (path) => path.replace(/^\/api/, ''),
                },
            },
        },
    }
})

