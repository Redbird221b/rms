export const PERMISSIONS = {
  VIEW_DASHBOARD: 'VIEW_DASHBOARD',
  VIEW_RISKS: 'VIEW_RISKS',
  CREATE_RISK: 'CREATE_RISK',
  EDIT_RISK: 'EDIT_RISK',
  EDIT_FINANCIALS: 'EDIT_FINANCIALS',
  ASSIGN_RESPONSIBLE: 'ASSIGN_RESPONSIBLE',
  REVIEW_QUEUE_ACTIONS: 'REVIEW_QUEUE_ACTIONS',
  COMMITTEE_DECIDE: 'COMMITTEE_DECIDE',
  MANAGE_REFERENCE_DATA: 'MANAGE_REFERENCE_DATA',
  VIEW_AUDIT: 'VIEW_AUDIT',
  VIEW_ALL_RISKS: 'VIEW_ALL_RISKS',
  VIEW_HIERARCHY_RISKS: 'VIEW_HIERARCHY_RISKS',
} 

export const ROLE_CONFIG = {
  admin: {
    labelKey: 'auth.role.admin',
    badgeTone: 'blue',
    permissions: Object.values(PERMISSIONS),
  },
  risk: {
    labelKey: 'auth.role.risk',
    badgeTone: 'orange',
    permissions: [
      PERMISSIONS.VIEW_DASHBOARD,
      PERMISSIONS.VIEW_RISKS,
      PERMISSIONS.CREATE_RISK,
      PERMISSIONS.EDIT_RISK,
      PERMISSIONS.EDIT_FINANCIALS,
      PERMISSIONS.ASSIGN_RESPONSIBLE,
      PERMISSIONS.REVIEW_QUEUE_ACTIONS,
      PERMISSIONS.COMMITTEE_DECIDE,
      PERMISSIONS.VIEW_AUDIT,
      PERMISSIONS.VIEW_ALL_RISKS,
      PERMISSIONS.VIEW_HIERARCHY_RISKS,
    ],
  },
  committee: {
    labelKey: 'auth.role.committee',
    badgeTone: 'slate',
    permissions: [
      PERMISSIONS.VIEW_DASHBOARD,
      PERMISSIONS.VIEW_RISKS,
      PERMISSIONS.REVIEW_QUEUE_ACTIONS,
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
      PERMISSIONS.VIEW_HIERARCHY_RISKS,
    ],
  },
  employee: {
    labelKey: 'auth.role.employee',
    badgeTone: 'neutral',
    permissions: [
      PERMISSIONS.VIEW_DASHBOARD,
      PERMISSIONS.VIEW_RISKS,
      PERMISSIONS.CREATE_RISK,
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
  return getPermissions(user.accessRole).includes(permission)
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
  if (risk.createdByUserId === user.id) {
    return true
  }
  if (hasPermission(user, PERMISSIONS.VIEW_HIERARCHY_RISKS)) {
    const managerChain = getManagerChain(users, risk.createdByUserId)
    if (managerChain.includes(user.id)) {
      return true
    }
  }
  return false
}
