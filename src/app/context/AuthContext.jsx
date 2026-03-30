import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { users as seedUsers } from '../../data/seedMeta'
import {
  canAccessPath,
  getPermissions,
  getRoleConfig,
  hasPermission as hasPermissionForUser,
} from '../../lib/access'
import {
  getKeycloakClient,
  getKeycloakRoles,
  initKeycloak,
  loginWithKeycloak,
  logoutFromKeycloak,
  refreshKeycloakToken,
} from '../../lib/keycloak'
import { useI18n } from './I18nContext'

const AuthContext = createContext(null)

const ROLE_LABELS = {
  admin: 'Administrator',
  risk: 'Risk Analyst',
  committee: 'Committee Member',
  director: 'Department Director',
  employee: 'Employee',
}

const ROLE_ALIASES = {
  admin: 'admin',
  administrator: 'admin',
  erm_admin: 'admin',
  rms_admin: 'admin',
  risk: 'risk',
  risk_manager: 'risk',
  'risk-manager': 'risk',
  risk_department: 'risk',
  risk_analyst: 'risk',
  committee: 'committee',
  committee_member: 'committee',
  'committee-member': 'committee',
  risk_committee: 'committee',
  director: 'director',
  department_director: 'director',
  'department-director': 'director',
  head_of_department: 'director',
  employee: 'employee',
  staff: 'employee',
  user: 'employee',
}

const AUTH_TEXT = {
  en: {
    unavailable: 'Unable to connect to Keycloak. Check the auth server and try again.',
    sessionExpired: 'Your session expired. Please sign in again.',
  },
  ru: {
    unavailable: 'Не удалось подключиться к Keycloak. Проверьте сервер авторизации и попробуйте снова.',
    sessionExpired: 'Сессия истекла. Войдите повторно.',
  },
  uz: {
    unavailable: 'Keycloak ga ulanib bo‘lmadi. Autentifikatsiya serverini tekshirib, qayta urinib ko‘ring.',
    sessionExpired: 'Sessiya tugadi. Qaytadan tizimga kiring.',
  },
}

function pickAuthText(language) {
  return AUTH_TEXT[language] ?? AUTH_TEXT.ru
}

function normalizeRoleToken(role) {
  return String(role || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
}

function buildInitials(name, fallback) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }

  if (parts.length === 1 && parts[0].length >= 2) {
    return parts[0].slice(0, 2).toUpperCase()
  }

  return String(fallback || 'U')
    .slice(0, 2)
    .toUpperCase()
}

function pickFirstClaim(tokenParsed, keys) {
  for (const key of keys) {
    const value = tokenParsed?.[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }
  return ''
}

function buildDisplayName(tokenParsed, fallbackUser) {
  const explicitName = pickFirstClaim(tokenParsed, ['name'])
  if (explicitName) {
    return explicitName
  }

  const firstName = pickFirstClaim(tokenParsed, ['given_name', 'firstName'])
  const lastName = pickFirstClaim(tokenParsed, ['family_name', 'lastName'])
  const joinedName = [firstName, lastName].filter(Boolean).join(' ')
  if (joinedName) {
    return joinedName
  }

  return (
    fallbackUser?.name ||
    pickFirstClaim(tokenParsed, ['preferred_username', 'username', 'email']) ||
    'User'
  )
}

function findSeedUser(tokenParsed) {
  const candidates = [
    pickFirstClaim(tokenParsed, ['preferred_username', 'username']),
    pickFirstClaim(tokenParsed, ['email']),
    buildDisplayName(tokenParsed, null),
  ]
    .map((value) => value.toLowerCase())
    .filter(Boolean)

  return (
    seedUsers.find((user) => {
      const identityPool = [user.username, user.email, user.name]
        .map((value) => String(value || '').toLowerCase())
        .filter(Boolean)

      return identityPool.some((value) => candidates.includes(value))
    }) ?? null
  )
}

function resolveAccessRole(roles, fallbackUser) {
  for (const role of roles) {
    const mappedRole = ROLE_ALIASES[normalizeRoleToken(role)]
    if (mappedRole) {
      return mappedRole
    }
  }

  return fallbackUser?.accessRole ?? 'employee'
}

function mergeDirectoryUsers(currentUser) {
  if (!currentUser) {
    return seedUsers
  }

  const identityMatchesUser = (user) =>
    user.id === currentUser.id ||
    (currentUser.username && user.username === currentUser.username) ||
    (currentUser.email && user.email === currentUser.email)

  const existingIndex = seedUsers.findIndex(identityMatchesUser)
  if (existingIndex === -1) {
    return [...seedUsers, currentUser]
  }

  return seedUsers.map((user, index) => (index === existingIndex ? { ...user, ...currentUser } : user))
}

function buildCurrentUser() {
  const keycloak = getKeycloakClient()
  const tokenParsed = keycloak.tokenParsed ?? {}
  const fallbackUser = findSeedUser(tokenParsed)
  const tokenRoles = getKeycloakRoles()
  const accessRole = resolveAccessRole(tokenRoles, fallbackUser)
  const name = buildDisplayName(tokenParsed, fallbackUser)
  const username =
    pickFirstClaim(tokenParsed, ['preferred_username', 'username']) ||
    fallbackUser?.username ||
    ''
  const email = pickFirstClaim(tokenParsed, ['email']) || fallbackUser?.email || ''
  const role =
    pickFirstClaim(tokenParsed, ['job_title', 'title', 'position']) ||
    fallbackUser?.role ||
    ROLE_LABELS[accessRole] ||
    'Employee'
  const department =
    pickFirstClaim(tokenParsed, ['department', 'dept', 'org_unit', 'organization', 'division']) ||
    fallbackUser?.department ||
    ''

  return {
    ...(fallbackUser ?? {}),
    id: fallbackUser?.id ?? tokenParsed.sub ?? `kc:${username || email || 'user'}`,
    name,
    email,
    username,
    role,
    department,
    accessRole,
    reportsTo: fallbackUser?.reportsTo ?? null,
    initials: buildInitials(name, username || email || 'U'),
    keycloakSubject: tokenParsed.sub ?? null,
    keycloakRoles: tokenRoles,
    permissions: getPermissions(accessRole),
    roleConfig: getRoleConfig(accessRole),
  }
}

export function AuthProvider({ children }) {
  const { language } = useI18n()
  const [state, setState] = useState({
    isReady: false,
    isAuthenticated: false,
    currentUser: null,
    error: '',
  })

  useEffect(() => {
    const keycloak = getKeycloakClient()
    let active = true

    const syncState = ({ error = '' } = {}) => {
      if (!active) {
        return
      }

      const currentUser = keycloak.authenticated ? buildCurrentUser() : null
      setState({
        isReady: true,
        isAuthenticated: Boolean(currentUser),
        currentUser,
        error,
      })
    }

    keycloak.onAuthSuccess = () => {
      syncState()
    }

    keycloak.onAuthRefreshSuccess = () => {
      syncState()
    }

    keycloak.onAuthLogout = () => {
      syncState()
    }

    keycloak.onAuthError = () => {
      syncState({ error: pickAuthText(language).unavailable })
    }

    keycloak.onTokenExpired = async () => {
      try {
        await refreshKeycloakToken(30)
        syncState()
      } catch {
        keycloak.clearToken()
        syncState({ error: pickAuthText(language).sessionExpired })
      }
    }

    const bootstrap = async () => {
      try {
        await initKeycloak()
        syncState()
      } catch {
        syncState({ error: pickAuthText(language).unavailable })
      }
    }

    void bootstrap()

    return () => {
      active = false
      keycloak.onAuthSuccess = undefined
      keycloak.onAuthRefreshSuccess = undefined
      keycloak.onAuthLogout = undefined
      keycloak.onAuthError = undefined
      keycloak.onTokenExpired = undefined
    }
  }, [language])

  const directoryUsers = useMemo(() => mergeDirectoryUsers(state.currentUser), [state.currentUser])

  const value = useMemo(
    () => ({
      currentUser: state.currentUser,
      directoryUsers,
      isReady: state.isReady,
      isAuthenticated: state.isAuthenticated,
      error: state.error,
      login: ({ redirectPath } = {}) => loginWithKeycloak({ redirectPath }),
      logout: () => logoutFromKeycloak(),
      refreshSession: async () => {
        try {
          await initKeycloak()
          const currentUser = getKeycloakClient().authenticated ? buildCurrentUser() : null
          setState({
            isReady: true,
            isAuthenticated: Boolean(currentUser),
            currentUser,
            error: '',
          })
          return { ok: true }
        } catch {
          setState((current) => ({
            ...current,
            isReady: true,
            isAuthenticated: false,
            currentUser: null,
            error: pickAuthText(language).unavailable,
          }))
          return { ok: false }
        }
      },
      hasPermission: (permission) => hasPermissionForUser(state.currentUser, permission),
      canAccessPath: (pathname) => canAccessPath(state.currentUser, pathname),
    }),
    [directoryUsers, language, state],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
