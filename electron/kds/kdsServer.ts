import express, { type Request, type Response } from 'express'
import { createServer } from 'node:http'
import { Server } from 'socket.io'
import path from 'node:path'
import { existsSync } from 'node:fs'
import { listActiveKitchenOrders, setKitchenStatus } from './kitchenService'
import { getKdsPort, ensureKdsToken, getAlertMinutes, buildKitchenUrls } from './kdsConfig'
import { isKitchenStatus, type KitchenOrder } from '../../shared/kitchen'
import { broadcastKitchenEvent } from '../ipc/kitchenHandlers.js'

export interface KdsStatus {
  running: boolean
  port: number | null
  urls: string[]
  error: string | null
}

let httpServer: ReturnType<typeof createServer> | null = null
let ioServer: Server | null = null
let kitchenNs: ReturnType<Server['of']> | null = null
let lastStatus: KdsStatus = { running: false, port: null, urls: [], error: null }

export function getKdsStatus(): KdsStatus {
  return lastStatus
}

function resolvePublicDir(): string | null {
  const candidates = [path.resolve('dist-electron/kds/public'), path.resolve('electron/kds/public')]
  for (const c of candidates) {
    if (existsSync(c)) return c
  }
  return null
}

export async function startKdsServer(port?: number): Promise<KdsStatus> {
  const effective = port ?? getKdsPort()
  if (httpServer && lastStatus.running && lastStatus.port === effective) {
    return lastStatus
  }
  if (httpServer) {
    await stopKdsServer()
  }

  const app = express()
  const publicDir = resolvePublicDir()
  if (publicDir) {
    app.get('/kitchen', (_req: Request, res: Response) => {
      res.sendFile(path.join(publicDir, 'kitchen.html'))
    })
    app.use('/kitchen', express.static(publicDir))
  } else {
    app.get('/kitchen', (_req: Request, res: Response) => {
      res.status(503).send('Kitchen display not installed')
    })
  }
  app.get('/', (_req: Request, res: Response) => {
    res.redirect('/kitchen')
  })
  app.use((_req: Request, res: Response) => {
    res.status(404).send('Not found')
  })

  httpServer = createServer(app)
  // LAN tablets; allow any origin on the local network.
  ioServer = new Server(httpServer, { cors: { origin: '*' } })
  const ns = ioServer.of('/kitchen')
  kitchenNs = ns
  ns.use((socket, next) => {
    const t = (socket.handshake.auth as { token?: unknown } | undefined)?.token
    if (typeof t === 'string' && t === ensureKdsToken()) next()
    else next(new Error('unauthorized'))
  })
  ns.on('connection', (socket) => {
    socket.emit('kds:config', { alertMinutes: getAlertMinutes() })
    try {
      socket.emit('orders:sync', listActiveKitchenOrders())
    } catch {
      socket.emit('order:error', { message: 'Sync failed' })
    }
    socket.on('order:setStatus', (p: unknown) => {
      try {
        if (typeof p !== 'object' || p === null) {
          socket.emit('order:error', { message: 'Invalid request' })
          return
        }
        const orderId = (p as { orderId?: unknown }).orderId
        const status = (p as { status?: unknown }).status
        if (!Number.isInteger(orderId) || !isKitchenStatus(status)) {
          socket.emit('order:error', { message: 'Invalid request' })
          return
        }
        try {
          const updated = setKitchenStatus(orderId as number, status)
          ns.emit('order:updated', updated)
          try {
            broadcastKitchenEvent({ type: 'order:updated', order: updated })
          } catch {
            // POS fan-out must never break the socket path
          }
        } catch (err) {
          socket.emit('order:error', { message: err instanceof Error ? err.message : 'Update failed' })
        }
      } catch (err) {
        try {
          socket.emit('order:error', { message: err instanceof Error ? err.message : 'Update failed' })
        } catch {
          // never throw out of a socket handler
        }
      }
    })
  })

  await new Promise<void>((resolve) => {
    const onError = (err: unknown) => {
      if ((err as { code?: string }).code === 'EADDRINUSE') {
        lastStatus = {
          running: false,
          port: effective,
          urls: [],
          error: `Port ${effective} is already in use. Change it in Settings → Kitchen display.`,
        }
      } else {
        lastStatus = {
          running: false,
          port: effective,
          urls: [],
          error: String((err as { message?: unknown }).message ?? err),
        }
      }
      resolve()
    }
    httpServer!.once('error', onError)
    httpServer!.listen(effective, '0.0.0.0', () => {
      httpServer!.off('error', onError)
      const addr = httpServer!.address()
      const actual =
        addr && typeof addr === 'object' && typeof (addr as { port?: unknown }).port === 'number'
          ? (addr as { port: number }).port
          : effective
      lastStatus = { running: true, port: actual, urls: buildKitchenUrls(actual), error: null }
      resolve()
    })
  })

  if (!lastStatus.running && httpServer) {
    try {
      ioServer?.close()
    } catch {
      // ignore close errors on failed bind
    }
    try {
      httpServer.close()
    } catch {
      // ignore close errors on failed bind
    }
    httpServer = null
    ioServer = null
    kitchenNs = null
  }
  return lastStatus
}

export async function stopKdsServer(): Promise<void> {
  try {
    kitchenNs?.disconnectSockets(true)
  } catch {
    // idempotent: ignore
  }
  kitchenNs = null
  if (ioServer) {
    const s = ioServer
    ioServer = null
    try {
      s.close()
    } catch {
      // idempotent: ignore
    }
  }
  if (httpServer) {
    const s = httpServer
    httpServer = null
    await new Promise<void>((resolve) => {
      try {
        s.close(() => resolve())
      } catch {
        resolve()
      }
    })
  }
  lastStatus = { running: false, port: null, urls: [], error: null }
}

export function emitToKitchenSocket(type: 'order:new' | 'order:updated', order: KitchenOrder): void {
  try {
    if (!kitchenNs || !lastStatus.running) return
    kitchenNs.emit(type, order)
  } catch {
    // never throws
  }
}
