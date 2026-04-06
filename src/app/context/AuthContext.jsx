import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  canAccessPath,
  getPermissions,
  getRoleConfig,
  hasPermission as hasPermissionForUser,
} from '../../lib/access'
import { getCurrentProfile } from '../../lib/api'
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
  admin: 'Super Admin',
  risk: 'Risk Department',
  committee: 'Risk Committee',
  director: 'Department Director',
  employee: 'Staff',
}

const ROLE_ALIASES = {
  admin: 'admin',
  administrator: 'admin',
  erm_admin: 'admin',
  rms_admin: 'admin',
  super_admin: 'admin',
  'super-admin': 'admin',
  top_manager: 'admin',
  'top-manager': 'admin',
  topmanager: 'admin',
  risk: 'risk',
  risk_dept: 'risk',
  'risk-dept': 'risk',
  risk_manager: 'risk',
  'risk-manager': 'risk',
  risk_management: 'risk',
  'risk-management': 'risk',
  risk_department: 'risk',
  risk_analyst: 'risk',
  risk_analysts: 'risk',
  risk_controller: 'risk',
  risk_control: 'risk',
  committee: 'committee',
  committee_member: 'committee',
  'committee-member': 'committee',
  risk_committee: 'committee',
  'risk-committee': 'committee',
  committee_secretary: 'committee',
  director: 'director',
  dept_director: 'director',
  'dept-director': 'director',
  department_director: 'director',
  'department-director': 'director',
  head_of_department: 'director',
  head_of_unit: 'director',
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

const ROLE_PRIORITY = ['admin', 'committee', 'risk', 'director', 'employee']

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

function buildDisplayName(tokenParsed) {
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

  return pickFirstClaim(tokenParsed, ['preferred_username', 'username', 'email']) || 'User'
}

function resolveAccessRoles(roles) {
  const mappedRoles = [
    ...new Set(
      roles
        .map((role) => ROLE_ALIASES[normalizeRoleToken(role)])
        .filter(Boolean),
    ),
  ]

  return mappedRoles.length ? mappedRoles : ['employee']
}

function resolvePrimaryAccessRole(accessRoles) {
  for (const role of ROLE_PRIORITY) {
    if (accessRoles.includes(role)) {
      return role
    }
  }

  return 'employee'
}

function buildPermissions(accessRoles) {
  return [
    ...new Set(
      accessRoles.flatMap((role) => getPermissions(role)),
    ),
  ]
}

function mergeDirectoryUsers(currentUser) {
  return currentUser ? [currentUser] : []
}

function buildCurrentUser() {
  const keycloak = getKeycloakClient()
  const tokenParsed = keycloak.tokenParsed ?? {}
  const tokenRoles = getKeycloakRoles()
  const accessRoles = resolveAccessRoles(tokenRoles)
  const accessRole = resolvePrimaryAccessRole(accessRoles)
  const name = buildDisplayName(tokenParsed)
  const username =
    pickFirstClaim(tokenParsed, ['preferred_username', 'username']) || ''
  const email = pickFirstClaim(tokenParsed, ['email']) || ''
  const role =
    pickFirstClaim(tokenParsed, ['job_title', 'title', 'position']) ||
    ROLE_LABELS[accessRole] ||
    'Employee'
  const department =
    pickFirstClaim(tokenParsed, ['department', 'dept', 'org_unit', 'organization', 'division']) || ''

  return {
    id: tokenParsed.sub ?? `kc:${username || email || 'user'}`,
    name,
    email,
    username,
    role,
    department,
    accessRole,
    accessRoles,
    reportsTo: null,
    initials: buildInitials(name, username || email || 'U'),
    keycloakSubject: tokenParsed.sub ?? null,
    keycloakRoles: tokenRoles,
    permissions: buildPermissions(accessRoles),
    roleConfig: getRoleConfig(accessRole),
  }
}

function buildProfileName(profile, fallbackName) {
  if (!profile || typeof profile !== 'object') {
    return fallbackName
  }

  const explicitName =
    String(profile.full_name || '')
      .trim()
  if (explicitName) {
    return explicitName
  }

  const joinedName = [profile.first_name, profile.last_name]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(' ')

  return joinedName || fallbackName
}

function mergeBackendProfile(currentUser, profile) {
  if (!profile || typeof profile !== 'object') {
    return currentUser
  }

  const departmentName =
    String(profile.department_name || profile.department?.name || currentUser.department || '').trim()
  const roleNames = Array.isArray(profile.roles) ? profile.roles.filter(Boolean) : []
  const groupPaths = Array.isArray(profile.groups) ? profile.groups.filter(Boolean) : []
  const name = buildProfileName(profile, currentUser.name)

  return {
    ...currentUser,
    id: profile.id ?? currentUser.id,
    backendUserId: profile.id ?? currentUser.backendUserId ?? null,
    name,
    email: String(profile.email || currentUser.email || '').trim(),
    username: String(profile.username || currentUser.username || '').trim(),
    firstName: String(profile.first_name || '').trim(),
    lastName: String(profile.last_name || '').trim(),
    department: departmentName,
    departmentId: profile.department_id ?? profile.department?.id ?? currentUser.departmentId ?? null,
    departmentRecord:
      profile.department && typeof profile.department === 'object'
        ? profile.department
        : currentUser.departmentRecord ?? null,
    groups: groupPaths,
    keycloakRoles: [...new Set([...(currentUser.keycloakRoles ?? []), ...roleNames])],
    initials: buildInitials(name, profile.username || currentUser.username || currentUser.email || 'U'),
    permissions: buildPermissions(currentUser.accessRoles ?? [currentUser.accessRole]),
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
    let syncRunId = 0

    const syncState = async ({ error = '' } = {}) => {
      const currentRunId = syncRunId + 1
      syncRunId = currentRunId

      const currentUser = keycloak.authenticated ? buildCurrentUser() : null

      setState({
        isReady: true,
        isAuthenticated: Boolean(currentUser),
        currentUser,
        error,
      })

      if (!currentUser) {
        return
      }

      try {
        const profile = await getCurrentProfile()
        if (!active || currentRunId !== syncRunId) {
          return
        }

        setState((current) => ({
          ...current,
          currentUser: mergeBackendProfile(currentUser, profile),
        }))
      } catch {
        // Do not block auth readiness on backend profile enrichment.
      }
    }

    keycloak.onAuthSuccess = () => {
      void syncState()
    }

    keycloak.onAuthRefreshSuccess = () => {
      void syncState()
    }

    keycloak.onAuthLogout = () => {
      void syncState()
    }

    keycloak.onAuthError = () => {
      void syncState({ error: pickAuthText(language).unavailable })
    }

    keycloak.onTokenExpired = async () => {
      if (!keycloak.refreshToken) {
        keycloak.clearToken()
        await loginWithKeycloak({
          redirectPath:
            typeof window === 'undefined'
              ? '/dashboard'
              : `${window.location.pathname}${window.location.search}${window.location.hash}`,
        })
        return
      }

      try {
        await refreshKeycloakToken(30)
        await syncState()
      } catch {
        keycloak.clearToken()
        await syncState({ error: pickAuthText(language).sessionExpired })
      }
    }

    const bootstrap = async () => {
      try {
        await initKeycloak()
        await syncState()
      } catch {
        await syncState({ error: pickAuthText(language).unavailable })
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
          const keycloakClient = getKeycloakClient()
          const currentUser = keycloakClient.authenticated ? buildCurrentUser() : null
          setState({
            isReady: true,
            isAuthenticated: Boolean(currentUser),
            currentUser,
            error: '',
          })

          if (currentUser) {
            void getCurrentProfile()
              .then((profile) => {
                setState((current) => ({
                  ...current,
                  currentUser: mergeBackendProfile(currentUser, profile),
                }))
              })
              .catch(() => {})
          }

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
