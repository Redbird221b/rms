import Keycloak from 'keycloak-js'

const DEFAULT_KEYCLOAK_REALM = 'risk-management-system'
const DEFAULT_KEYCLOAK_CLIENT_ID = 'frontend-client'

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

let keycloakClient = null
let initPromise = null

function getSilentCheckSsoRedirectUri() {
  if (typeof window === 'undefined') {
    return undefined
  }
  return `${window.location.origin}/silent-check-sso.html`
}

function buildRedirectUri(redirectPath = '/') {
  if (typeof window === 'undefined') {
    return undefined
  }

  const normalizedPath = redirectPath.startsWith('/') ? redirectPath : `/${redirectPath}`
  return `${window.location.origin}${normalizedPath}`
}

export function getKeycloakClient() {
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
        onLoad: 'check-sso',
        pkceMethod: 'S256',
        checkLoginIframe: false,
        silentCheckSsoRedirectUri: getSilentCheckSsoRedirectUri(),
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

  try {
    await keycloak.updateToken(minValidity)
    return keycloak.token ?? null
  } catch (error) {
    keycloak.clearToken()
    throw error
  }
}
