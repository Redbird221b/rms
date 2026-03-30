import { getImpactLevel, recalculateRisk } from './compute'
import { normalizeDepartmentName } from './departments'
import { refreshKeycloakToken } from './keycloak'

const DEFAULT_API_BASE_URL = 'http://172.16.55.9:8000'

const LEGACY_CATEGORY_TO_API = {
  Strategic: 'STRATEGIC',
  Financial: 'FINANCIAL',
  Operational: 'OPERATIONAL',
  Compliance: 'COMPLIANCE',
  Legal: 'LEGAL',
  IT: 'IT',
  Reputational: 'REPUTATIONAL',
  Fraud: 'OPERATIONAL',
  Vendor: 'OPERATIONAL',
}

const LEGACY_API_TO_CATEGORY = {
  STRATEGIC: 'Strategic',
  FINANCIAL: 'Financial',
  OPERATIONAL: 'Operational',
  COMPLIANCE: 'Compliance',
  LEGAL: 'Legal',
  IT: 'IT',
  REPUTATIONAL: 'Reputational',
}

const STATUS_TO_API = {
  Draft: 'OPEN',
  'Under Risk Review': 'IN_PROGRESS',
  'Info Requested by Risk Manager': 'IN_PROGRESS',
  'Rejected by Risk Manager': 'CLOSED',
  'Committee Review 1': 'IN_PROGRESS',
  'Info Requested by Committee': 'IN_PROGRESS',
  'Accepted for Mitigation': 'ACCEPTED',
  'Pending Review': 'IN_PROGRESS',
  'Requested Info': 'IN_PROGRESS',
  Approved: 'ACCEPTED',
  'In Mitigation': 'MITIGATED',
  'Committee Review 2': 'IN_PROGRESS',
  'Additional Mitigation Required': 'IN_PROGRESS',
  Overdue: 'IN_PROGRESS',
  Closed: 'CLOSED',
  'Risk Accepted': 'CLOSED',
  Rejected: 'CLOSED',
}

const DECISION_TO_API = {
  Approve: 'APPROVE',
  Reject: 'REJECT',
  'Request Info': 'REQUEST_INFO',
  'Accept Residual Risk': 'ACCEPT_RESIDUAL',
}

const API_TO_DECISION = {
  APPROVE: 'Approve',
  REJECT: 'Reject',
  REQUEST_INFO: 'Request Info',
  ACCEPT_RESIDUAL: 'Accept Residual Risk',
  ACCEPT_RESIDUAL_RISK: 'Accept Residual Risk',
}

const MITIGATION_TO_API = {
  'Not Started': 'NOT_STARTED',
  'In Progress': 'IN_PROGRESS',
  Done: 'DONE',
}

const API_TO_MITIGATION = {
  NOT_STARTED: 'Not Started',
  IN_PROGRESS: 'In Progress',
  DONE: 'Done',
}

const ACTIVITY_TO_API = {
  create: 'CREATE',
  update: 'UPDATE',
  decision: 'DECISION',
  assignment: 'ASSIGNMENT',
  financial: 'FINANCIAL',
  comment: 'COMMENT',
  review: 'REVIEW',
}

export const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/+$/, '')

function buildUrl(path) {
  if (/^https?:\/\//i.test(path)) {
    return path
  }
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

function extractId(value) {
  if (!value || typeof value !== 'object') {
    return null
  }
  return value.id ?? value.pk ?? value.value ?? null
}

function safeNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function toIsoDateTime(value) {
  if (!value) {
    return null
  }
  if (typeof value !== 'string') {
    return value
  }
  if (value.includes('T')) {
    return value
  }
  return `${value}T00:00:00Z`
}

function normalizeEnumToken(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_')
}

function normalizeDecisionType(value) {
  if (!value) {
    return ''
  }
  return API_TO_DECISION[normalizeEnumToken(value)] || value
}

function normalizeMitigationStatus(value) {
  if (!value) {
    return 'Not Started'
  }
  return API_TO_MITIGATION[normalizeEnumToken(value)] || value
}

function buildFallbackId(prefix, fields) {
  const parts = fields.filter(Boolean).map((field) => String(field).trim())
  if (!parts.length) {
    return `${prefix}-${Date.now()}`
  }
  return `${prefix}-${parts.join('-')}`
}

function parsePayloadText(text) {
  if (!text) {
    return null
  }
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function pickErrorMessage(payload) {
  if (!payload) {
    return ''
  }
  if (typeof payload === 'string') {
    return payload
  }
  if (Array.isArray(payload)) {
    return payload.map((item) => pickErrorMessage(item)).filter(Boolean).join(', ')
  }
  if (typeof payload === 'object') {
    if (typeof payload.detail === 'string') {
      return payload.detail
    }
    if (typeof payload.error === 'string') {
      return payload.error
    }
    if (payload.errors) {
      return pickErrorMessage(payload.errors)
    }
    return Object.values(payload)
      .map((value) => pickErrorMessage(value))
      .filter(Boolean)
      .join(', ')
  }
  return ''
}

async function request(path, { method = 'GET', body, unwrapData = true } = {}) {
  const token = await refreshKeycloakToken(30).catch(() => null)
  const response = await fetch(buildUrl(path), {
    method,
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const text = await response.text()
  const payload = parsePayloadText(text)

  if (!response.ok) {
    const message = pickErrorMessage(payload) || `Request failed with status ${response.status}`
    throw new Error(message)
  }

  if (payload && typeof payload === 'object' && typeof payload.status === 'number' && payload.status >= 400) {
    const message = pickErrorMessage(payload) || `Request failed with status ${payload.status}`
    throw new Error(message)
  }

  if (unwrapData && payload && typeof payload === 'object' && 'data' in payload) {
    return payload.data
  }

  return payload
}

function createReferenceIndex(rawItems = [], nameNormalizer = null) {
  const items = []
  const byId = new Map()

  rawItems.forEach((entry, index) => {
    if (!entry) {
      return
    }

    if (typeof entry === 'string') {
      const normalizedName = nameNormalizer ? nameNormalizer(entry) : entry
      const name = String(normalizedName || '').trim()
      if (!name) {
        return
      }
      items.push({ id: null, name, clientKey: `name:${name.toLowerCase()}` })
      return
    }

    const id = extractId(entry)
    const rawName = entry.name ?? entry.title ?? entry.label ?? (id !== null ? String(id) : `item-${index + 1}`)
    const name = nameNormalizer ? nameNormalizer(rawName) : rawName

    items.push({
      id,
      name,
      clientKey: id !== null ? `id:${id}` : `name:${String(name).toLowerCase()}:${index + 1}`,
    })
    if (id !== null) {
      byId.set(String(id), name)
    }
  })
  items.sort((left, right) => left.name.localeCompare(right.name))

  return {
    items,
    names: items.map((item) => item.name),
    byId,
  }
}

function resolveDepartmentName(value, departmentIndex) {
  if (!value) {
    return ''
  }
  if (typeof value === 'object') {
    return normalizeDepartmentName(value.name ?? value.title ?? String(extractId(value) ?? ''))
  }
  return normalizeDepartmentName(departmentIndex.byId.get(String(value)) || String(value))
}

function resolveDepartmentValue(value, departmentItems) {
  if (!value) {
    return null
  }
  if (typeof value === 'object') {
    return extractId(value) ?? value.name ?? null
  }

  const normalized = normalizeDepartmentName(value)
  const match = departmentItems.find(
    (item) => normalizeDepartmentName(item.name) === normalized,
  )

  return match?.id ?? normalized
}

function normalizeCategoryName(value, categoryIndex) {
  if (!value) {
    return 'Operational'
  }
  if (typeof value === 'object') {
    return value.name ?? value.title ?? String(extractId(value) ?? '')
  }
  return categoryIndex.byId.get(String(value)) || LEGACY_API_TO_CATEGORY[normalizeEnumToken(value)] || String(value)
}

function resolveCategoryValue(value, categoryItems) {
  if (!value) {
    return null
  }
  if (typeof value === 'object') {
    return extractId(value) ?? value.name ?? null
  }

  const normalized = String(value).trim()
  const match = categoryItems.find(
    (item) => String(item.name).toLowerCase() === normalized.toLowerCase(),
  )

  if (match?.id !== null && match?.id !== undefined) {
    return match.id
  }

  return LEGACY_CATEGORY_TO_API[normalized] || normalized
}

function sortByDateDesc(items, key) {
  return [...items].sort((left, right) => {
    const leftValue = new Date(left[key] || 0).getTime()
    const rightValue = new Date(right[key] || 0).getTime()
    return rightValue - leftValue
  })
}

function groupBy(items, key) {
  return items.reduce((accumulator, item) => {
    const groupKey = String(item[key] || '')
    if (!accumulator.has(groupKey)) {
      accumulator.set(groupKey, [])
    }
    accumulator.get(groupKey).push(item)
    return accumulator
  }, new Map())
}

function deriveRiskStatus(risk, latestDecision, latestWorkflowStatus) {
  const apiStatus = normalizeEnumToken(risk?.status)
  const decision = normalizeDecisionType(latestDecision?.decisionType || latestDecision?.decision_type)

  if (latestWorkflowStatus) {
    return latestWorkflowStatus
  }

  if (decision === 'Reject') {
    return 'Rejected'
  }

  if (decision === 'Request Info') {
    return 'Requested Info'
  }

  if (apiStatus === 'CLOSED') {
    return 'Closed'
  }

  if (apiStatus === 'MITIGATED') {
    return 'In Mitigation'
  }

  if (apiStatus === 'ACCEPTED') {
    return 'Approved'
  }

  const dueDate = risk?.due_date ?? risk?.dueDate
  if (dueDate) {
    const dueTime = new Date(dueDate).getTime()
    if (!Number.isNaN(dueTime) && dueTime < new Date().setHours(0, 0, 0, 0)) {
      return 'Overdue'
    }
  }

  if (apiStatus === 'IN_PROGRESS') {
    return 'Pending Review'
  }

  return 'Draft'
}

function normalizeActivityRecord(entry) {
  const riskId = entry?.risk_id ?? entry?.riskId ?? entry?.risk ?? ''
  const rawDiff = entry?.diff
  const diff =
    rawDiff && typeof rawDiff === 'object'
      ? {
          ...rawDiff,
          mitigationDepartment: rawDiff.mitigationDepartment
            ? normalizeDepartmentName(rawDiff.mitigationDepartment)
            : rawDiff.mitigationDepartment,
          notification:
            rawDiff.notification && typeof rawDiff.notification === 'object'
              ? {
                  ...rawDiff.notification,
                  targetDepartment: rawDiff.notification.targetDepartment
                    ? normalizeDepartmentName(rawDiff.notification.targetDepartment)
                    : rawDiff.notification.targetDepartment,
                }
              : rawDiff.notification,
        }
      : rawDiff

  return {
    id:
      entry?.id ??
      buildFallbackId('audit', [riskId, entry?.type, entry?.at, entry?.title]),
    riskId: typeof riskId === 'object' ? extractId(riskId) : riskId,
    type: String(entry?.type || '').toLowerCase(),
    title: entry?.title || 'Risk updated',
    notes: entry?.notes || '',
    by: entry?.by || 'System',
    at: entry?.at || new Date().toISOString(),
    diff,
  }
}

function normalizeDecisionRecord(entry) {
  const riskId = entry?.risk_id ?? entry?.riskId ?? entry?.risk ?? ''

  return {
    id:
      entry?.id ??
      buildFallbackId('decision', [riskId, entry?.decision_type, entry?.decided_at]),
    riskId: typeof riskId === 'object' ? extractId(riskId) : riskId,
    decisionType: normalizeDecisionType(
      entry?.decition_type ?? entry?.decision_type ?? entry?.decitionType ?? entry?.decisionType,
    ),
    decidedBy: entry?.decided_by ?? entry?.decidedBy ?? 'Risk Committee',
    decidedAt: entry?.decided_at ?? entry?.decidedAt ?? new Date().toISOString(),
    notes: entry?.notes ?? '',
  }
}

function normalizeMitigationRecord(entry) {
  const riskId = entry?.risk_id ?? entry?.riskId ?? entry?.risk ?? ''

  return {
    id:
      entry?.id ??
      buildFallbackId('mitigation', [riskId, entry?.title, entry?.created_at]),
    riskId: typeof riskId === 'object' ? extractId(riskId) : riskId,
    title: entry?.title ?? '',
    owner: entry?.owner ?? '',
    dueDate: entry?.due_date ?? entry?.dueDate ?? '',
    status: normalizeMitigationStatus(entry?.status),
    notes: entry?.notes ?? '',
    createdAt: entry?.created_at ?? entry?.createdAt ?? '',
    updatedAt: entry?.updated_at ?? entry?.updatedAt ?? '',
  }
}

function normalizeRiskRecord(entry, { departmentIndex, categoryIndex, decisionsByRisk, activitiesByRisk }) {
  const riskId =
    entry?.id ??
    entry?.risk_number ??
    entry?.risk_id ??
    entry?.riskId ??
    buildFallbackId('risk', [entry?.title, entry?.created_at])
  const latestDecision = (decisionsByRisk.get(String(riskId)) || [])[0]
  const latestWorkflowActivity = (activitiesByRisk.get(String(riskId)) || []).find(
    (activity) => activity?.diff?.workflowStatus,
  )
  const latestMitigationDepartmentActivity = (activitiesByRisk.get(String(riskId)) || []).find(
    (activity) => activity?.diff?.mitigationDepartment || activity?.diff?.mitigationDepartmentId,
  )
  const status = deriveRiskStatus(entry, latestDecision, latestWorkflowActivity?.diff?.workflowStatus)
  const mitigationDepartment = resolveDepartmentName(
    latestMitigationDepartmentActivity?.diff?.mitigationDepartment ??
      entry?.mitigation_department_name ?? entry?.mitigationDepartment ?? entry?.mitigation_department,
    departmentIndex,
  ) ?? ''
  const mitigationDepartmentId =
    latestMitigationDepartmentActivity?.diff?.mitigationDepartmentId ??
    extractId(entry?.mitigation_department_id ?? entry?.mitigationDepartmentId ?? null)
  const computedRisk = recalculateRisk({
    id: riskId,
    title: entry?.title ?? '',
    description: entry?.description ?? '',
    category: normalizeCategoryName(entry?.category_name ?? entry?.category, categoryIndex),
    department: resolveDepartmentName(entry?.department_name ?? entry?.department, departmentIndex),
    owner: entry?.owner ?? '',
    responsible: entry?.responsible ?? '',
    createdByUserId: entry?.created_by_user_id ?? entry?.createdByUserId ?? null,
    createdByDepartmentId: entry?.created_by_department_id ?? entry?.createdByDepartmentId ?? null,
    mitigationDepartment,
    mitigationDepartmentId,
    status,
    probability: safeNumber(entry?.probability, 0.01),
    impactMin: safeNumber(entry?.impact_min ?? entry?.impactMin, 0),
    impactMostLikely: safeNumber(entry?.impact_most_likely ?? entry?.impactMostLikely, 0),
    impactMax: safeNumber(entry?.impact_max ?? entry?.impactMax, 0),
    residualScore: safeNumber(entry?.residual_score ?? entry?.residualScore, 0),
    createdAt: entry?.created_at ?? entry?.createdAt ?? new Date().toISOString(),
    updatedAt: entry?.updated_at ?? entry?.updatedAt ?? entry?.created_at ?? new Date().toISOString(),
    dueDate: entry?.due_date ?? entry?.dueDate ?? '',
    lastReviewedAt:
      entry?.last_reviewed_at ??
      entry?.lastReviewedAt ??
      entry?.updated_at ??
      entry?.created_at ??
      '',
    tags: Array.isArray(entry?.tags) ? entry.tags : [],
    attachments: Array.isArray(entry?.attachments) ? entry.attachments : [],
    existingControlsText: entry?.existing_controls_text ?? entry?.existingControlsText ?? '',
    plannedControlsText: entry?.planned_controls_text ?? entry?.plannedControlsText ?? '',
    audit: activitiesByRisk.get(String(riskId)) || [],
  })

  const expectedLoss = safeNumber(entry?.expected_loss ?? entry?.expectedLoss, computedRisk.expectedLoss)
  const inherentScore = safeNumber(entry?.inherent_score ?? entry?.inherentScore, computedRisk.inherentScore)
  const residualScore = safeNumber(entry?.residual_score ?? entry?.residualScore, computedRisk.residualScore)
  const severity = getImpactLevel(entry?.severity ?? computedRisk.severity, entry?.impact_most_likely ?? entry?.impactMostLikely)

  return {
    ...computedRisk,
    expectedLoss,
    inherentScore,
    residualScore,
    severity,
    status,
    financialAssessmentStatus:
      safeNumber(entry?.impact_most_likely ?? entry?.impactMostLikely, 0) > 0
        ? 'Assessed'
        : 'Pending Assessment',
  }
}

export async function loadErmDataset() {
  const [rawDepartments, rawCategories, rawRisks, rawMitigations, rawDecisions, rawActivities] = await Promise.all([
    request('/app/api/create/department/'),
    request('/app/api/create/category/'),
    request('/app/api/create/risk/'),
    request('/app/api/create/mitigation/'),
    request('/app/api/create/decisition/'),
    request('/app/api/create/riskactivity/'),
  ])

  const departmentIndex = createReferenceIndex(Array.isArray(rawDepartments) ? rawDepartments : [], normalizeDepartmentName)
  const categoryIndex = createReferenceIndex(Array.isArray(rawCategories) ? rawCategories : [])

  const decisionLogs = sortByDateDesc(
    (Array.isArray(rawDecisions) ? rawDecisions : []).map(normalizeDecisionRecord),
    'decidedAt',
  )

  const activities = sortByDateDesc(
    (Array.isArray(rawActivities) ? rawActivities : []).map(normalizeActivityRecord),
    'at',
  )

  const decisionsByRisk = groupBy(decisionLogs, 'riskId')
  const activitiesByRisk = groupBy(activities, 'riskId')

  const risks = sortByDateDesc(
    (Array.isArray(rawRisks) ? rawRisks : []).map((entry) =>
      normalizeRiskRecord(entry, {
        departmentIndex,
        categoryIndex,
        decisionsByRisk,
        activitiesByRisk,
      }),
    ),
    'updatedAt',
  )

  const mitigationActions = sortByDateDesc(
    (Array.isArray(rawMitigations) ? rawMitigations : []).map(normalizeMitigationRecord),
    'updatedAt',
  )

  return {
    departmentItems: departmentIndex.items,
    categoryItems: categoryIndex.items,
    departments: departmentIndex.names,
    categories: categoryIndex.names,
    risks,
    mitigationActions,
    decisionLogs,
  }
}

export async function createRiskRecord(risk, departmentItems = [], categoryItems = []) {
  return request('/app/api/create/risk/', {
    method: 'POST',
    body: buildRiskPayload(risk, departmentItems, categoryItems),
  })
}

export async function getRiskRecord(
  riskId,
  { departmentItems = [], categoryItems = [], decisionLogs = [], auditItems = [] } = {},
) {
  const rawRisk = await request(`/app/api/crud/risk/${riskId}/`)
  const departmentIndex = createReferenceIndex(departmentItems, normalizeDepartmentName)
  const categoryIndex = createReferenceIndex(categoryItems)
  const decisionsByRisk = groupBy(Array.isArray(decisionLogs) ? decisionLogs : [], 'riskId')
  const activitiesByRisk = new Map([
    [String(riskId), Array.isArray(auditItems) ? auditItems : []],
  ])

  return normalizeRiskRecord(rawRisk, {
    departmentIndex,
    categoryIndex,
    decisionsByRisk,
    activitiesByRisk,
  })
}

export async function updateRiskRecord(riskId, risk, departmentItems = [], categoryItems = []) {
  return request(`/app/api/crud/risk/${riskId}/`, {
    method: 'PATCH',
    body: buildRiskPayload(risk, departmentItems, categoryItems),
  })
}

export async function createDepartmentRecord(name) {
  const payload = await request('/app/api/create/department/', {
    method: 'POST',
    body: { name },
    unwrapData: false,
  })

  return {
    id: payload?.data?.id ?? payload?.id ?? null,
    name: payload?.data?.name ?? name,
  }
}

export async function updateDepartmentRecord(id, name) {
  return request(`/app/api/crud/department/${id}/`, {
    method: 'PATCH',
    body: { name },
  })
}

export async function deleteDepartmentRecord(id) {
  return request(`/app/api/crud/department/${id}/`, {
    method: 'DELETE',
    unwrapData: false,
  })
}

export async function createCategoryRecord(name) {
  const payload = await request('/app/api/create/category/', {
    method: 'POST',
    body: { name },
    unwrapData: false,
  })

  return {
    id: payload?.data?.id ?? payload?.id ?? null,
    name: payload?.data?.name ?? name,
  }
}

export async function updateCategoryRecord(id, name) {
  return request(`/app/api/crud/category/${id}/`, {
    method: 'PATCH',
    body: { name },
  })
}

export async function deleteCategoryRecord(id) {
  return request(`/app/api/crud/category/${id}/`, {
    method: 'DELETE',
    unwrapData: false,
  })
}

export async function createDecisionRecord(entry) {
  return request('/app/api/create/decisition/', {
    method: 'POST',
    body: {
      risk: entry.riskId,
      decition_type: DECISION_TO_API[entry.decisionType] || entry.decisionType,
      decided_by: entry.decidedBy,
      decided_at: toIsoDateTime(entry.decidedAt) || new Date().toISOString(),
      notes: entry.notes ?? '',
    },
  })
}

export async function createMitigationRecord(entry) {
  const payload = await request('/app/api/create/mitigation/', {
    method: 'POST',
    body: {
      risk: entry.riskId,
      title: entry.title,
      owner: entry.owner,
      due_date: toIsoDateTime(entry.dueDate),
      status: MITIGATION_TO_API[entry.status] || entry.status,
      notes: entry.notes ?? '',
    },
    unwrapData: false,
  })

  return normalizeMitigationRecord({
    ...(payload?.data ?? payload ?? {}),
    risk: payload?.data?.risk ?? payload?.risk ?? entry.riskId,
    title: payload?.data?.title ?? payload?.title ?? entry.title,
    owner: payload?.data?.owner ?? payload?.owner ?? entry.owner,
    due_date: payload?.data?.due_date ?? payload?.due_date ?? toIsoDateTime(entry.dueDate),
    status: payload?.data?.status ?? payload?.status ?? (MITIGATION_TO_API[entry.status] || entry.status),
    notes: payload?.data?.notes ?? payload?.notes ?? entry.notes ?? '',
    created_at: payload?.data?.created_at ?? payload?.created_at ?? entry.createdAt ?? new Date().toISOString(),
    updated_at: payload?.data?.updated_at ?? payload?.updated_at ?? entry.updatedAt ?? new Date().toISOString(),
  })
}

export async function updateMitigationRecord(actionId, entry) {
  return request(`/app/api/crud/mitigation/${actionId}/`, {
    method: 'PATCH',
    body: {
      risk: entry.riskId,
      title: entry.title,
      owner: entry.owner,
      due_date: toIsoDateTime(entry.dueDate),
      status: MITIGATION_TO_API[entry.status] || entry.status,
      notes: entry.notes ?? '',
    },
  })
}

export async function createActivityRecord(riskId, event) {
  return request('/app/api/create/riskactivity/', {
    method: 'POST',
    body: {
      risk: riskId,
      type: ACTIVITY_TO_API[event.type] || String(event.type || 'update').toUpperCase(),
      title: event.title || 'Risk updated',
      notes: event.notes ?? '',
      by: event.by || 'System',
      at: toIsoDateTime(event.at) || new Date().toISOString(),
      diff: event.diff ?? null,
    },
  })
}

function buildRiskPayload(risk, departmentItems = [], categoryItems = []) {
  return {
    title: risk.title?.trim() ?? '',
    description: risk.description?.trim() ?? '',
    category: resolveCategoryValue(risk.category, categoryItems),
    department: resolveDepartmentValue(risk.department, departmentItems),
    owner: risk.owner?.trim() ?? '',
    responsible: risk.responsible?.trim() ?? '',
    created_by_user_id: risk.createdByUserId ?? '',
    created_by_department_id: risk.createdByDepartmentId ?? risk.department ?? '',
    status: STATUS_TO_API[risk.status] || risk.status || 'OPEN',
    probability: safeNumber(risk.probability, 0.01),
    impact_min: safeNumber(risk.impactMin, 0),
    impact_most_likely: safeNumber(risk.impactMostLikely, 0),
    impact_max: safeNumber(risk.impactMax, 0),
    severity: risk.severity ?? '',
    inherent_score: safeNumber(risk.inherentScore, 0),
    residual_score: safeNumber(risk.residualScore, 0),
    due_date: toIsoDateTime(risk.dueDate),
    last_reviewed_at: toIsoDateTime(risk.lastReviewedAt),
    tags: Array.isArray(risk.tags) ? risk.tags : [],
    attachments: Array.isArray(risk.attachments) ? risk.attachments : [],
    existing_controls_text: risk.existingControlsText ?? '',
    planned_controls_text: risk.plannedControlsText ?? '',
  }
}
