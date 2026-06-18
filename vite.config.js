import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const ROBOTS_PUBLIC = 'User-agent: *\nAllow: /\n'
const ROBOTS_TEST = 'User-agent: *\nDisallow: /\n'

function isInternalTestBuild() {
  return process.env.VITE_INTERNAL_TEST_ENV === 'true'
}

function internalTestRobotsPlugin() {
  const robotsBody = isInternalTestBuild() ? ROBOTS_TEST : ROBOTS_PUBLIC

  return {
    name: 'internal-test-robots',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url !== '/robots.txt') return next()
        res.statusCode = 200
        res.setHeader('Content-Type', 'text/plain; charset=utf-8')
        res.end(robotsBody)
      })
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: robotsBody,
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), internalTestRobotsPlugin()],
  server: {
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
