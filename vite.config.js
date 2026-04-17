import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

const saveImagePlugin = {
  name: 'save-image',
  configureServer(server) {
    server.middlewares.use('/api/list-items', (req, res) => {
      const url = new URL(req.url, 'http://localhost')
      const dir = url.searchParams.get('dir') || ''
      const fullDir = path.resolve(import.meta.dirname, 'public', dir.replace(/^\//, ''))
      let files = []
      try {
        files = fs.readdirSync(fullDir)
          .filter(f => f.endsWith('.png'))
          .map(f => f.slice(0, -4))
      } catch { /* directory missing = no files */ }
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(files))
    })

    server.middlewares.use('/api/save-image', async (req, res) => {
      if (req.method !== 'POST') {
        res.statusCode = 405
        res.end()
        return
      }

      const chunks = []
      for await (const chunk of req) chunks.push(chunk)
      const { filePath, dataUrl } = JSON.parse(Buffer.concat(chunks).toString())

      const base64 = dataUrl.split(',')[1]
      const buffer = Buffer.from(base64, 'base64')
      const fullPath = path.resolve(import.meta.dirname, 'public', filePath)

      fs.mkdirSync(path.dirname(fullPath), { recursive: true })
      fs.writeFileSync(fullPath, buffer)

      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ ok: true }))
    })
  },
}

export default defineConfig({
  plugins: [react(), saveImagePlugin],
})
