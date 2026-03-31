import Keycloak from 'keycloak-js'

const DEFAULT_KEYCLOAK_REALM = 'risk-management-system'
const DEFAULT_KEYCLOAK_CLIENT_ID = 'frontend-client'
const DEFAULT_KEYCLOAK_FLOW = 'implicit'

function getDefaultKeycloakUrl() {
  if (typeof window === 'undefined') {
    return 'http://localhost:8080'
  }

  return `${window.location.protocol}//${window.location.hostname}:8080`
}

export const KEYCLOAK_URL = String(import.meta.env.VITE_KEYCLOAK_URL || getDefaultKeycloakUrl()).replace(/\/+$/, '')
export const KEYCLOAK_REALM = String(import.meta.env.VITE_KEYCLOAK_REALM || DEFAULT_KEYCLOAK_REALM).trim()
export const KEYCLOAK_CLIENT_ID = String(
  import.meta.env.VITE_KEYCLOAK_CLIENT_ID || DEFAULT_KEYCLOAK_CLIENT_ID,
).trim()
export const KEYCLOAK_FLOW = String(import.meta.env.VITE_KEYCLOAK_FLOW || DEFAULT_KEYCLOAK_FLOW).trim()

let keycloakClient = null
let initPromise = null

function createUuidFromBytes(bytes) {
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'))
  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-')
}

function createFallbackRandomUuid() {
  const bytes = new Uint8Array(16)

  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes)
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256)
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80

  return createUuidFromBytes(bytes)
}

function ensureCryptoCompat() {
  if (typeof window === 'undefined') {
    return
  }

  if (typeof globalThis.crypto === 'undefined') {
    try {
      Object.defineProperty(globalThis, 'crypto', {
        value: {},
        configurable: true,
      })
    } catch {
      return
    }
  }

  if (typeof globalThis.crypto.randomUUID !== 'function') {
    try {
      globalThis.crypto.randomUUID = () => createFallbackRandomUuid()
    } catch {
      // Ignore if the runtime forbids patching the crypto object.
    }
  }
}

function buildRedirectUri(redirectPath = '/') {
  if (typeof window === 'undefined') {
    return undefined
  }

  const normalizedPath = redirectPath.startsWith('/') ? redirectPath : `/${redirectPath}`
  return `${window.location.origin}${normalizedPath}`
}

export function getKeycloakClient() {
  ensureCryptoCompat()

  if (!keycloakClient) {
    keycloakClient = new Keycloak({
      url: KEYCLOAK_URL,
      realm: KEYCLOAK_REALM,
      clientId: KEYCLOAK_CLIENT_ID,
    })
  }

  return keycloakClient
}

export async function initKeycloak() {
  if (!initPromise) {
    initPromise = getKeycloakClient()
      .init({
        flow: KEYCLOAK_FLOW,
        pkceMethod: false,
        checkLoginIframe: false,
      })
      .catch((error) => {
        initPromise = null
        throw error
      })
  }

  return initPromise
}

export function getKeycloakRoles() {
  const keycloak = getKeycloakClient()
  const realmRoles = Array.isArray(keycloak.realmAccess?.roles) ? keycloak.realmAccess.roles : []
  const clientRoles = Array.isArray(keycloak.resourceAccess?.[KEYCLOAK_CLIENT_ID]?.roles)
    ? keycloak.resourceAccess[KEYCLOAK_CLIENT_ID].roles
    : []

  return [...new Set([...realmRoles, ...clientRoles])]
}

export async function loginWithKeycloak({ redirectPath = '/dashboard' } = {}) {
  await getKeycloakClient().login({
    redirectUri: buildRedirectUri(redirectPath),
  })
}

export async function logoutFromKeycloak() {
  await getKeycloakClient().logout({
    redirectUri: buildRedirectUri('/login'),
  })
}

export async function refreshKeycloakToken(minValidity = 30) {
  const keycloak = getKeycloakClient()
  if (!keycloak.authenticated) {
    return null
  }

  if (!keycloak.refreshToken) {
    try {
      if (!keycloak.isTokenExpired(minValidity)) {
        return keycloak.token ?? null
      }
    } catch {
      return keycloak.token ?? null
    }

    keycloak.clearToken()
    return null
  }

  try {
    await keycloak.updateToken(minValidity)
    return keycloak.token ?? null
  } catch (error) {
    keycloak.clearToken()
    throw error
  }
}
