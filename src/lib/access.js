import { sameDepartment } from './departments'

export const PERMISSIONS = {
  VIEW_DASHBOARD: 'VIEW_DASHBOARD',
  VIEW_RISKS: 'VIEW_RISKS',
  CREATE_RISK: 'CREATE_RISK',
  EDIT_RISK: 'EDIT_RISK',
  MANAGE_MITIGATION_PLAN: 'MANAGE_MITIGATION_PLAN',
  UPDATE_MITIGATION_PROGRESS: 'UPDATE_MITIGATION_PROGRESS',
  REVIEW_MITIGATION_ACTIONS: 'REVIEW_MITIGATION_ACTIONS',
  EDIT_FINANCIALS: 'EDIT_FINANCIALS',
  ASSIGN_RESPONSIBLE: 'ASSIGN_RESPONSIBLE',
  REVIEW_QUEUE_ACTIONS: 'REVIEW_QUEUE_ACTIONS',
  COMMITTEE_DECIDE: 'COMMITTEE_DECIDE',
  MANAGE_REFERENCE_DATA: 'MANAGE_REFERENCE_DATA',
  VIEW_AUDIT: 'VIEW_AUDIT',
  VIEW_ALL_RISKS: 'VIEW_ALL_RISKS',
} 

export const ROLE_CONFIG = {
  admin: {
    labelKey: 'auth.role.admin',
    badgeTone: 'blue',
    permissions: [
      PERMISSIONS.VIEW_DASHBOARD,
      PERMISSIONS.VIEW_RISKS,
      PERMISSIONS.CREATE_RISK,
      PERMISSIONS.MANAGE_REFERENCE_DATA,
      PERMISSIONS.VIEW_AUDIT,
      PERMISSIONS.VIEW_ALL_RISKS,
    ],
  },
  risk: {
    labelKey: 'auth.role.risk',
    badgeTone: 'orange',
    permissions: [
      PERMISSIONS.VIEW_DASHBOARD,
      PERMISSIONS.VIEW_RISKS,
      PERMISSIONS.CREATE_RISK,
      PERMISSIONS.EDIT_FINANCIALS,
      PERMISSIONS.MANAGE_MITIGATION_PLAN,
      PERMISSIONS.REVIEW_MITIGATION_ACTIONS,
      PERMISSIONS.REVIEW_QUEUE_ACTIONS,
      PERMISSIONS.VIEW_AUDIT,
      PERMISSIONS.VIEW_ALL_RISKS,
    ],
  },
  committee: {
    labelKey: 'auth.role.committee',
    badgeTone: 'slate',
    permissions: [
      PERMISSIONS.VIEW_DASHBOARD,
      PERMISSIONS.VIEW_RISKS,
      PERMISSIONS.CREATE_RISK,
      PERMISSIONS.MANAGE_MITIGATION_PLAN,
      PERMISSIONS.COMMITTEE_DECIDE,
      PERMISSIONS.VIEW_AUDIT,
      PERMISSIONS.VIEW_ALL_RISKS,
    ],
  },
  director: {
    labelKey: 'auth.role.director',
    badgeTone: 'indigo',
    permissions: [
      PERMISSIONS.VIEW_DASHBOARD,
      PERMISSIONS.VIEW_RISKS,
      PERMISSIONS.CREATE_RISK,
      PERMISSIONS.MANAGE_MITIGATION_PLAN,
      PERMISSIONS.UPDATE_MITIGATION_PROGRESS,
      PERMISSIONS.ASSIGN_RESPONSIBLE,
    ],
  },
  employee: {
    labelKey: 'auth.role.employee',
    badgeTone: 'neutral',
    permissions: [
      PERMISSIONS.VIEW_DASHBOARD,
      PERMISSIONS.VIEW_RISKS,
      PERMISSIONS.CREATE_RISK,
      PERMISSIONS.UPDATE_MITIGATION_PROGRESS,
    ],
  },
}

export const ROUTE_PERMISSIONS = {
  '/dashboard': PERMISSIONS.VIEW_DASHBOARD,
  '/risks': PERMISSIONS.VIEW_RISKS,
  '/queue': PERMISSIONS.REVIEW_QUEUE_ACTIONS,
  '/committee': PERMISSIONS.COMMITTEE_DECIDE,
  '/create': PERMISSIONS.CREATE_RISK,
  '/admin': PERMISSIONS.MANAGE_REFERENCE_DATA,
}

export function getRoleConfig(accessRole) {
  return ROLE_CONFIG[accessRole] ?? ROLE_CONFIG.employee
}

export function getPermissions(accessRole) {
  return getRoleConfig(accessRole).permissions
}

export function hasPermission(user, permission) {
  if (!user) {
    return false
  }
  if (Array.isArray(user.permissions) && user.permissions.length) {
    return user.permissions.includes(permission)
  }
  return getPermissions(user.accessRole).includes(permission)
}

export function hasAccessRole(user, role) {
  if (!user) {
    return false
  }

  const normalizedRole = String(role || '').trim()
  if (!normalizedRole) {
    return false
  }

  if (Array.isArray(user.accessRoles) && user.accessRoles.length) {
    return user.accessRoles.includes(normalizedRole)
  }

  return user.accessRole === normalizedRole
}

function normalizeIdentityValue(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
}

export function matchesUserIdentity(user, value) {
  if (!user) {
    return false
  }

  const candidates = [
    user.username,
    user.email,
    user.id,
    user.backendUserId,
    user.keycloakSubject,
    user.name,
  ]
    .map(normalizeIdentityValue)
    .filter(Boolean)

  return candidates.includes(normalizeIdentityValue(value))
}

export function matchesRiskCreator(user, riskOrCreatorValue) {
  const creatorValue =
    riskOrCreatorValue && typeof riskOrCreatorValue === 'object'
      ? riskOrCreatorValue.createdByUserId
      : riskOrCreatorValue

  return matchesUserIdentity(user, creatorValue)
}

export function canAccessPath(user, pathname) {
  if (!user) {
    return false
  }
  const routePermission = Object.entries(ROUTE_PERMISSIONS).find(([route]) => pathname.startsWith(route))?.[1]
  if (!routePermission) {
    return true
  }
  return hasPermission(user, routePermission)
}

export function getManagerChain(users, userId) {
  const chain = []
  const byId = new Map(users.map((user) => [user.id, user]))
  let current = byId.get(userId)
  const seen = new Set()

  while (current?.reportsTo && !seen.has(current.reportsTo)) {
    seen.add(current.reportsTo)
    const manager = byId.get(current.reportsTo)
    if (!manager) {
      break
    }
    chain.push(manager.id)
    current = manager
  }

  return chain
}

export function canViewRisk(user, risk, users) {
  if (!user || !risk) {
    return false
  }
  if (hasPermission(user, PERMISSIONS.VIEW_ALL_RISKS)) {
    return true
  }
  if (matchesRiskCreator(user, risk)) {
    return true
  }
  if (risk.responsible && matchesUserIdentity(user, risk.responsible)) {
    return true
  }
  if (
    risk.mitigationDepartment &&
    sameDepartment(risk.mitigationDepartment, user.department) &&
    hasAccessRole(user, 'director')
  ) {
    return true
  }
  return false
}

function toTimestamp(value) {
  const timestamp = new Date(value || 0).getTime()
  return Number.isFinite(timestamp) ? timestamp : 0
}

export function isAwaitingDecisionResponse(risk, actorName) {
  if (!risk || !actorName) {
    return false
  }

  const auditItems = Array.isArray(risk.audit) ? [...risk.audit] : []
  if (!auditItems.length) {
    return false
  }

  const latestOwnDecision = auditItems
    .filter((item) => item?.type === 'decision' && item?.by === actorName)
    .sort((left, right) => toTimestamp(right?.at) - toTimestamp(left?.at))[0]

  if (!latestOwnDecision) {
    return false
  }

  const decisionTime = toTimestamp(latestOwnDecision.at)

  return !auditItems.some(
    (item) =>
      item?.type === 'comment' &&
      item?.by &&
      item.by !== actorName &&
      toTimestamp(item.at) > decisionTime,
  )
}
