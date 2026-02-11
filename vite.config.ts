import { defineConfig } from 'vite'

export default defineConfig({
    server: {
        host: true,
        strictPort: true,
        port: 5173,
        allowedHosts: true,
        hmr: {
            protocol: 'wss',
            clientPort: 443
        }
    }
})

