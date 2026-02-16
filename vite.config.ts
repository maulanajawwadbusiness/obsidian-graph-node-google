import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '')
    const isTunnelHmr = env.VITE_DEV_TUNNEL_HMR === '1'

    return {
        server: {
            host: true,
            strictPort: true,
            port: 5173,
            allowedHosts: ['.trycloudflare.com'],
            ...(isTunnelHmr
                ? {
                    hmr: {
                        protocol: 'wss',
                        clientPort: 443
                    }
                }
                : {})
        }
    }
})

