import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import net from 'net'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Checks if a port is truly available across 127.0.0.1, ::1, and 0.0.0.0
 * Prevents Windows loopback collision where 0.0.0.0 binds despite 127.0.0.1 being in use.
 */
function tryConnect(port, host) {
  return new Promise((resolve) => {
    const s = new net.Socket()
    s.once('connect', () => {
      s.destroy()
      resolve(true) // Connected! (Port is busy)
    })
    s.once('error', () => resolve(false))
    s.setTimeout(250, () => {
      s.destroy()
      resolve(false)
    })
    try {
      s.connect(port, host)
    } catch {
      resolve(false)
    }
  })
}

/**
 * Checks if a port is truly available across IPv6 (::1), IPv4 (127.0.0.1), and 0.0.0.0
 * Prevents Windows loopback collision where 0.0.0.0 binds despite ::1 or 127.0.0.1 being in use.
 */
async function isPortAvailable(port) {
  // 1. Check if another project is listening on IPv6 localhost
  if (await tryConnect(port, '::1')) return false
  // 2. Check if another project is listening on IPv4 localhost
  if (await tryConnect(port, '127.0.0.1')) return false

  // 3. Verify socket binding succeeds
  return new Promise((resolve) => {
    const server = net.createServer()
    server.once('error', () => resolve(false))
    server.once('listening', () => {
      server.close(() => resolve(true))
    })
    try {
      server.listen(port)
    } catch {
      resolve(false)
    }
  })
}

/**
 * Searches sequentially from preferredPort until a completely free port is found.
 */
async function findFreePort(startPort = 5173, maxSearch = 100) {
  const preferred = parseInt(process.env.PORT, 10) || startPort
  for (let p = preferred; p < preferred + maxSearch; p++) {
    if (await isPortAvailable(p)) {
      return p
    }
  }
  return 0
}

/**
 * Discovers the active backend port by checking configuration files
 */
function getBackendPort() {
  const candidateFiles = [
    path.resolve(__dirname, '.active_backend_port.json'),
    path.resolve(__dirname, '../backend/.active_backend_port.json'),
    path.resolve(__dirname, '../.active_backend_port.json')
  ]

  for (const filePath of candidateFiles) {
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf8')
        const data = JSON.parse(raw)
        if (data && data.port) return data.port
      }
    } catch (_) {}
  }
  return process.env.BACKEND_PORT || 5000
}

export default defineConfig(async () => {
  const freePort = await findFreePort(5173)

  console.log(`\n======================================================`)
  console.log(`🚀 [Frontend] Selected free port: ${freePort}`)
  console.log(`📡 Backend proxy target: http://localhost:${getBackendPort()}`)
  console.log(`======================================================\n`)

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'crm-active-port-endpoint',
        configureServer(server) {
          server.middlewares.use('/active-backend-port', (req, res) => {
            const port = getBackendPort()
            res.setHeader('Content-Type', 'application/json')
            res.setHeader('Access-Control-Allow-Origin', '*')
            res.end(JSON.stringify({ port, url: `http://localhost:${port}/api`, service: 'crm-sales-management-system' }))
          })
        }
      }
    ],
    server: {
      host: true,
      port: freePort,
      open: true,
      strictPort: false,
      proxy: {
        '/api': {
          target: `http://localhost:${getBackendPort()}`,
          changeOrigin: true,
          router: () => `http://localhost:${getBackendPort()}`
        },
        '/storage': {
          target: `http://localhost:${getBackendPort()}`,
          changeOrigin: true,
          router: () => `http://localhost:${getBackendPort()}`
        }
      }
    },
    preview: {
      host: true,
      port: freePort,
      proxy: {
        '/api': {
          target: `http://localhost:${getBackendPort()}`,
          changeOrigin: true,
          router: () => `http://localhost:${getBackendPort()}`
        },
        '/storage': {
          target: `http://localhost:${getBackendPort()}`,
          changeOrigin: true,
          router: () => `http://localhost:${getBackendPort()}`
        }
      }
    }
  }
})