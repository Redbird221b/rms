import { API_BASE_URL } from './api'
import { getKeycloakClient, refreshKeycloakToken } from './keycloak'

const DEFAULT_RECONNECT_DELAYS_MS = [500, 1000, 2000, 4000, 6000, 8000, 12000, 18000]
const FALLBACK_WINDOW_ORIGIN = 'http://localhost'
const DEFAULT_WEBSOCKET_BASE_PATH = '/app'

function isValidToken(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function getHostUrl() {
  if (typeof window === 'undefined') {
    return new URL(FALLBACK_WINDOW_ORIGIN)
  }

  return new URL(window.location.origin)
}

function stripLeadingSlash(value) {
  return String(value || '').replace(/^\/+/, '')
}

function stripTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '')
}

function normalizeEventPath(path) {
  return `/${stripLeadingSlash(stripTrailingSlash(path))}`
}

function normalizeRejoinUrl(value) {
  return String(value || '').replace(/\/+/g, '/')
}

function getApiBasePath() {
  const rawBase = String(API_BASE_URL || '').trim()

  if (/^https?:\/\//i.test(rawBase)) {
    try {
      return normalizeEventPath(new URL(rawBase).pathname)
    } catch {
      return DEFAULT_WEBSOCKET_BASE_PATH
    }
  }

  const normalized = normalizeEventPath(rawBase)
  if (normalized === '/' && rawBase) {
    return DEFAULT_WEBSOCKET_BASE_PATH
  }

  if (normalized === '/') {
    return DEFAULT_WEBSOCKET_BASE_PATH
  }

  return normalized || DEFAULT_WEBSOCKET_BASE_PATH
}

function buildSocketPath(endpoint) {
  const rawEndpoint = normalizeEventPath(endpoint)
  const basePath = getApiBasePath()

  if (basePath === '/' || !basePath) {
    if (rawEndpoint === '/ws' || rawEndpoint.startsWith('/ws/')) {
      return normalizeRejoinUrl(`${DEFAULT_WEBSOCKET_BASE_PATH}${rawEndpoint}`)
    }

    return rawEndpoint
  }

  if (rawEndpoint === basePath || rawEndpoint.startsWith(`${basePath}/`)) {
    return rawEndpoint
  }

  return normalizeRejoinUrl(`${basePath}${rawEndpoint}`)
}

function buildWebSocketUrlFromPath(path) {
  const rawBase = String(API_BASE_URL || '').trim()
  const hostUrl = getHostUrl()
  const normalizedPath = normalizeEventPath(path)

  if (/^https?:\/\//i.test(rawBase)) {
    const baseUrl = new URL(rawBase)
    const basePath = stripTrailingSlash(baseUrl.pathname)
    const normalizedBase = normalizeEventPath(basePath)
    const hasBasePrefix =
      normalizedBase &&
      (normalizedPath === normalizedBase || normalizedPath.startsWith(`${normalizedBase}/`))

    const resolvedPath = normalizedBase && !hasBasePrefix
      ? normalizeRejoinUrl(`${normalizedBase}${normalizedPath}`)
      : normalizedPath

    return `${baseUrl.protocol === 'https:' ? 'wss' : 'ws'}://${baseUrl.host}${resolvedPath}`
  }

  return `${hostUrl.protocol === 'https:' ? 'wss' : 'ws'}://${hostUrl.host}${normalizedPath}`
}

function buildWebSocketUrlCandidates(endpoint) {
  const basePath = getApiBasePath()
  const primaryPath = buildSocketPath(endpoint)
  const candidates = [primaryPath]

  if (
    (basePath === '/app' || basePath === 'app') &&
    (primaryPath === '/app/ws' || primaryPath.startsWith('/app/ws/'))
  ) {
    candidates.push(`/${stripLeadingSlash(primaryPath.slice(4))}`)
  }

  const uniqueCandidates = candidates.map((path) => normalizeEventPath(path))
  return [...new Map(uniqueCandidates.map((path) => [path, path])).keys()]
}

async function resolveSocketToken() {
  try {
    const keycloak = getKeycloakClient()
    const tokenFromClient = keycloak?.token

    if (isValidToken(tokenFromClient) && typeof keycloak.isTokenExpired === 'function') {
      if (!keycloak.isTokenExpired(30)) {
        return tokenFromClient
      }
    }

    const refreshed = await refreshKeycloakToken(30)
    if (isValidToken(refreshed)) {
      return refreshed
    }
  } catch {
    // Ignore token lookup errors; caller can retry.
  }

  return null
}

export function buildWebSocketUrl(endpoint) {
  return buildWebSocketUrlFromPath(buildSocketPath(endpoint))
}

function parsePayload(event) {
  if (!event || typeof event.data !== 'string') {
    return null
  }

  try {
    return JSON.parse(event.data)
  } catch {
    return null
  }
}

export function createRealtimeSocket(endpoint, handlers = {}) {
  const { onEvent, onConnected, onDisconnected, onError } = handlers
  let activeSocket = null
  let reconnectTimeout = null
  let reconnectAttempt = 0
  let isStopped = false
  let isConnecting = false
  const urlVariants = buildWebSocketUrlCandidates(endpoint)
  let candidateIndex = 0

  const clearReconnectTimeout = () => {
    if (reconnectTimeout) {
      window.clearTimeout(reconnectTimeout)
      reconnectTimeout = null
    }
  }

  const stop = () => {
    isStopped = true
    clearReconnectTimeout()

    if (activeSocket && activeSocket.readyState !== WebSocket.CLOSED) {
      activeSocket.close(1000, 'Manual close')
    }

    activeSocket = null
  }

  const scheduleReconnect = () => {
    if (isStopped) {
      return
    }

    candidateIndex = 0

    const delay = DEFAULT_RECONNECT_DELAYS_MS[
      Math.min(reconnectAttempt, DEFAULT_RECONNECT_DELAYS_MS.length - 1)
    ]
    reconnectAttempt += 1

    clearReconnectTimeout()
    reconnectTimeout = window.setTimeout(() => {
      void connect()
    }, delay)
  }

  const connect = async () => {
    if (isStopped || isConnecting || activeSocket) {
      return
    }

    if (activeSocket && activeSocket.readyState < WebSocket.CLOSING) {
      return
    }

    isConnecting = true

    try {
      const token = await resolveSocketToken()
      if (!token) {
        scheduleReconnect()
        return
      }

      const socketUrl = urlVariants[candidateIndex]
        ? `${urlVariants[candidateIndex]}?token=${encodeURIComponent(token)}`
        : `${buildWebSocketUrl(endpoint)}?token=${encodeURIComponent(token)}`
      const socket = new WebSocket(socketUrl)
      activeSocket = socket

      socket.onopen = () => {
        reconnectAttempt = 0
        candidateIndex = 0
        onConnected?.()
      }

      socket.onmessage = (event) => {
        const payload = parsePayload(event)
        if (!payload) {
          return
        }

        onEvent?.(payload)
      }

      socket.onclose = () => {
        activeSocket = null
        if (!isStopped) {
          if (candidateIndex < urlVariants.length - 1) {
            candidateIndex += 1
            connect()
            return
          }

          scheduleReconnect()
        }
        onDisconnected?.()
      }

      socket.onerror = (error) => {
        onError?.(error)
      }
    } catch (error) {
      if (!isStopped) {
        onError?.(error)
        scheduleReconnect()
      }
    } finally {
      isConnecting = false
    }
  }

  const start = () => {
    if (isStopped) {
      isStopped = false
    }

    void connect()
  }

  return {
    start,
    stop,
  }
}
