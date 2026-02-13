import { defineConfig, loadEnv } from 'vite'

function isHttpUrl(value: string | undefined): value is string {
    if (!value) return false
    return /^https?:\/\//i.test(value)
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '')
    const isTunnelHmr = env.VITE_DEV_TUNNEL_HMR === '1'
    const devApiProxyTarget = env.VITE_DEV_API_PROXY_TARGET?.trim()
    const apiProxy = isHttpUrl(devApiProxyTarget)
        ? {
            '/api': {
                target: devApiProxyTarget,
                changeOrigin: true,
                secure: false
            }
        }
        : undefined

    return {
        server: {
            host: true,
            strictPort: true,
            port: 5173,
            allowedHosts: ['.trycloudflare.com'],
            ...(apiProxy ? { proxy: apiProxy } : {}),
            ...(isTunnelHmr
                ? {
                    hmr: {
                        protocol: 'wss',
                        clientPort: 443
                    }
                }
                : {})
        },
        preview: {
            ...(apiProxy ? { proxy: apiProxy } : {})
        },
    }
})

