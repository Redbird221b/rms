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
  Draft: 'DRAFT',
  'Under Risk Review': 'UNDER_RISK_REVIEW',
  'Info Requested by Risk Manager': 'INFO_REQUESTED_BY_RISK_MANAGER',
  'Rejected by Risk Manager': 'REJECTED_BY_RISK_MANAGER',
  'Committee Review 1': 'COMMITTEE_REVIEW_1',
  'Info Requested by Committee': 'INFO_REQUESTED_BY_COMMITTEE',
  'Accepted for Mitigation': 'ACCEPTED_FOR_MITIGATION',
  'Pending Review': 'IN_PROGRESS',
  'Requested Info': 'IN_PROGRESS',
  Approved: 'ACCEPTED',
  'In Mitigation': 'IN_MITIGATION',
  'Committee Review 2': 'COMMITTEE_REVIEW_2',
  'Additional Mitigation Required': 'ADDITIONAL_MITIGATION_REQUIRED',
  Overdue: 'IN_PROGRESS',
  Closed: 'CLOSED',
  'Risk Accepted': 'RISK_ACCEPTED',
  Rejected: 'CLOSED',
}

const API_STATUS_TO_FRONTEND = {
  DRAFT: 'Draft',
  UNDER_RISK_REVIEW: 'Under Risk Review',
  INFO_REQUESTED_BY_RISK_MANAGER: 'Info Requested by Risk Manager',
  REJECTED_BY_RISK_MANAGER: 'Rejected by Risk Manager',
  COMMITTEE_REVIEW_1: 'Committee Review 1',
  INFO_REQUESTED_BY_COMMITTEE: 'Info Requested by Committee',
  ACCEPTED_FOR_MITIGATION: 'Accepted for Mitigation',
  COMMITTEE_REVIEW_2: 'Committee Review 2',
  ADDITIONAL_MITIGATION_REQUIRED: 'Additional Mitigation Required',
  RISK_ACCEPTED: 'Risk Accepted',
  IN_MITIGATION: 'In Mitigation',
  OPEN: 'Draft',
  IN_PROGRESS: 'Pending Review',
  MITIGATED: 'In Mitigation',
  ACCEPTED: 'Approved',
  CLOSED: 'Closed',
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
  'Pending Risk Review': 'PENDING_RISK_REVIEW',
  Approved: 'APPROVED',
}

const API_TO_MITIGATION = {
  NOT_STARTED: 'Not Started',
  IN_PROGRESS: 'In Progress',
  PENDING_RISK_REVIEW: 'Pending Risk Review',
  APPROVED: 'Approved',
  DONE: 'Pending Risk Review',
}

const PROBABILITY_TO_API = {
  Low: 'LOW',
  Medium: 'MEDIUM',
  High: 'HIGH',
}

const API_TO_PROBABILITY = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
}

const IMPACT_TO_API = {
  Small: 'SMALL',
  Medium: 'AVERAGE',
  Strong: 'HUGE',
  Critical: 'CRITICAL',
}

const API_TO_IMPACT = {
  SMALL: 'Small',
  AVERAGE: 'Medium',
  MEDIUM: 'Medium',
  HUGE: 'Strong',
  STRONG: 'Strong',
  CRITICAL: 'Critical',
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

function normalizeProbabilityLevel(value) {
  if (!value) {
    return ''
  }

  if (API_TO_PROBABILITY[normalizeEnumToken(value)]) {
    return API_TO_PROBABILITY[normalizeEnumToken(value)]
  }

  const numericValue = Number(value)
  if (Number.isFinite(numericValue) && numericValue > 0) {
    if (numericValue <= 0.34) {
      return 'Low'
    }
    if (numericValue <= 0.67) {
      return 'Medium'
    }
    return 'High'
  }

  const normalized = String(value).trim()
  if (['Low', 'Medium', 'High'].includes(normalized)) {
    return normalized
  }

  return ''
}

function normalizeImpactLevel(value) {
  if (!value) {
    return ''
  }

  if (API_TO_IMPACT[normalizeEnumToken(value)]) {
    return API_TO_IMPACT[normalizeEnumToken(value)]
  }

  const normalized = String(value).trim()
  if (['Small', 'Medium', 'Strong', 'Critical'].includes(normalized)) {
    return normalized
  }

  return ''
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

export async function getCurrentProfile() {
  return request('/app/me/', { unwrapData: false })
}

export async function getDepartmentMemberDirectory() {
  return request('/app/api/directory/department-members/')
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

function normalizeCategoryLabel(value) {
  if (!value) {
    return ''
  }

  if (typeof value === 'object') {
    return normalizeCategoryLabel(value.name ?? value.title ?? String(extractId(value) ?? ''))
  }

  const rawValue = String(value).trim()
  if (!rawValue) {
    return ''
  }

  const enumMatch = LEGACY_API_TO_CATEGORY[normalizeEnumToken(rawValue)]
  if (enumMatch) {
    return enumMatch
  }

  const namedMatch = Object.keys(LEGACY_CATEGORY_TO_API).find(
    (label) => label.toLowerCase() === rawValue.toLowerCase(),
  )

  return namedMatch ?? rawValue
}

function normalizeCategoryName(value, categoryIndex) {
  if (!value) {
    return ''
  }
  if (typeof value === 'object') {
    return normalizeCategoryLabel(value.name ?? value.title ?? String(extractId(value) ?? ''))
  }

  return normalizeCategoryLabel(categoryIndex.byId.get(String(value)) || value)
}

function resolveCategoryValue(value, categoryItems) {
  if (!value) {
    return null
  }
  if (typeof value === 'object') {
    return extractId(value) ?? value.name ?? null
  }

  const normalized = normalizeCategoryLabel(value)
  const match = categoryItems.find(
    (item) => normalizeCategoryLabel(item.name) === normalized,
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

function sortByDateAsc(items, key) {
  return [...items].sort((left, right) => {
    const leftValue = new Date(left[key] || 0).getTime()
    const rightValue = new Date(right[key] || 0).getTime()
    return leftValue - rightValue
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

  if (API_STATUS_TO_FRONTEND[apiStatus]) {
    return API_STATUS_TO_FRONTEND[apiStatus]
  }

  if (decision === 'Reject') {
    return 'Rejected'
  }

  if (decision === 'Request Info') {
    return 'Requested Info'
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
    createdBy: entry?.created_by ?? entry?.createdBy ?? entry?.department_director ?? entry?.departmentDirector ?? '',
    completedBy: entry?.completed_by ?? entry?.completedBy ?? '',
    completedAt: entry?.completed_at ?? entry?.completedAt ?? '',
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
    entry?.risk_id ??
    entry?.riskId ??
    buildFallbackId('risk', [entry?.title, entry?.created_at])
  const riskNumber = entry?.risk_number ?? entry?.riskNumber ?? String(riskId)
  const latestDecision = (decisionsByRisk.get(String(riskId)) || [])[0]
  const latestWorkflowActivity = (activitiesByRisk.get(String(riskId)) || []).find(
    (activity) => activity?.diff?.workflowStatus,
  )
  const latestMitigationDepartmentActivity = (activitiesByRisk.get(String(riskId)) || []).find(
    (activity) => activity?.diff?.mitigationDepartment || activity?.diff?.mitigationDepartmentId,
  )
  const status = deriveRiskStatus(entry, latestDecision, latestWorkflowActivity?.diff?.workflowStatus)
  const probability = normalizeProbabilityLevel(entry?.probability)
  const impactLevel = normalizeImpactLevel(entry?.Impact ?? entry?.impact ?? entry?.severity)
  const possibleLoss = safeNumber(
    entry?.possible_loss ?? entry?.possibleLoss ?? entry?.impact_most_likely ?? entry?.impactMostLikely,
    0,
  )
  const mitigationDepartment = resolveDepartmentName(
    latestMitigationDepartmentActivity?.diff?.mitigationDepartment ??
      entry?.responsible_department_name ??
      entry?.mitigation_department_name ??
      entry?.mitigationDepartment ??
      entry?.mitigation_department ??
      entry?.responsible_department_id,
    departmentIndex,
  ) ?? ''
  const mitigationDepartmentId =
    latestMitigationDepartmentActivity?.diff?.mitigationDepartmentId ??
    extractId(
      entry?.responsible_department_id ??
        entry?.mitigation_department_id ??
        entry?.mitigationDepartmentId ??
        null,
    )
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
    probability,
    impactMostLikely: possibleLoss,
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
    severity: impactLevel,
  })

  const expectedLoss = safeNumber(entry?.expected_loss ?? entry?.expectedLoss, computedRisk.expectedLoss)
  const inherentScore = safeNumber(entry?.inherent_score ?? entry?.inherentScore, computedRisk.inherentScore)
  const residualScore = safeNumber(entry?.residual_score ?? entry?.residualScore, computedRisk.residualScore)
  const severity = getImpactLevel(impactLevel || entry?.severity || computedRisk.severity)

  return {
    ...computedRisk,
    riskNumber,
    expectedLoss,
    inherentScore,
    residualScore,
    severity,
    status,
    financialAssessmentStatus:
      probability || severity || possibleLoss
        ? 'Assessed'
        : 'Pending Assessment',
  }
}

export async function loadErmDataset() {
  const rawDepartments = await request('/app/api/create/department/')
  const rawRisks = await request('/app/api/create/risk/')
  const [rawCategories, rawMitigations, rawDecisions, rawActivities] = await Promise.all([
    request('/app/api/create/category/'),
    request('/app/api/create/mitigation/'),
    request('/app/api/create/decisition/'),
    request('/app/api/create/riskactivity/'),
  ])

  const departmentIndex = createReferenceIndex(
    Array.isArray(rawDepartments) ? rawDepartments : [],
    normalizeDepartmentName,
  )
  const categoryIndex = createReferenceIndex(
    Array.isArray(rawCategories) ? rawCategories : [],
    normalizeCategoryLabel,
  )

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

  const mitigationActions = sortByDateAsc(
    (Array.isArray(rawMitigations) ? rawMitigations : []).map(normalizeMitigationRecord),
    'createdAt',
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
  const rawRisks = await request('/app/api/create/risk/')
  let rawRisk = (Array.isArray(rawRisks) ? rawRisks : []).find(
    (entry) => String(entry?.id ?? entry?.risk_id ?? entry?.riskId ?? '') === String(riskId),
  )

  if (!rawRisk) {
    rawRisk = await request(`/app/api/crud/risk/${riskId}/`)
  }

  const departmentIndex = createReferenceIndex(departmentItems, normalizeDepartmentName)
  const categoryIndex = createReferenceIndex(categoryItems, normalizeCategoryLabel)
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

export async function updateRiskRecord(
  riskId,
  risk,
  departmentItems = [],
  categoryItems = [],
  { useCreatorEndpoint = false, partialUpdates = null } = {},
) {
  const path = useCreatorEndpoint ? `/app/api/risk/crud/user/${riskId}/` : `/app/api/crud/risk/${riskId}/`
  const body = partialUpdates
    ? buildPartialRiskPayload(partialUpdates, risk, departmentItems, categoryItems)
    : buildRiskPayload(risk, departmentItems, categoryItems)

  return request(path, {
    method: 'PATCH',
    body,
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
    created_by: payload?.data?.created_by ?? payload?.created_by ?? entry.createdBy ?? '',
    completed_by: payload?.data?.completed_by ?? payload?.completed_by ?? entry.completedBy ?? '',
    completed_at: payload?.data?.completed_at ?? payload?.completed_at ?? entry.completedAt ?? '',
    due_date: payload?.data?.due_date ?? payload?.due_date ?? toIsoDateTime(entry.dueDate),
    status: payload?.data?.status ?? payload?.status ?? (MITIGATION_TO_API[entry.status] || entry.status),
    notes: payload?.data?.notes ?? payload?.notes ?? entry.notes ?? '',
    created_at: payload?.data?.created_at ?? payload?.created_at ?? entry.createdAt ?? new Date().toISOString(),
    updated_at: payload?.data?.updated_at ?? payload?.updated_at ?? entry.updatedAt ?? new Date().toISOString(),
  })
}

export async function updateMitigationRecord(actionId, entry, { useStaffEndpoint = false } = {}) {
  const path = useStaffEndpoint
    ? `/app/api/crud/mitigation/staff/${actionId}/`
    : `/app/api/crud/mitigation/${actionId}/`

  const payload = await request(path, {
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

  return normalizeMitigationRecord({
    ...(payload ?? {}),
    risk: payload?.risk ?? entry.riskId,
    title: payload?.title ?? entry.title,
    owner: payload?.owner ?? entry.owner,
    created_by: payload?.created_by ?? entry.createdBy ?? '',
    completed_by: payload?.completed_by ?? entry.completedBy ?? '',
    completed_at: payload?.completed_at ?? entry.completedAt ?? '',
    due_date: payload?.due_date ?? toIsoDateTime(entry.dueDate),
    status: payload?.status ?? (MITIGATION_TO_API[entry.status] || entry.status),
    notes: payload?.notes ?? entry.notes ?? '',
    created_at: payload?.created_at ?? entry.createdAt ?? '',
    updated_at: payload?.updated_at ?? new Date().toISOString(),
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
  const probabilityLevel = normalizeProbabilityLevel(risk.probability)
  const impactLevel = normalizeImpactLevel(risk.severity ?? risk.Impact ?? risk.impact)
  const responsibleDepartmentValue = resolveDepartmentValue(
    risk.mitigationDepartment ?? risk.department,
    departmentItems,
  )

  return {
    title: risk.title?.trim() ?? '',
    description: risk.description?.trim() ?? '',
    category: resolveCategoryValue(risk.category, categoryItems),
    department: resolveDepartmentValue(risk.department, departmentItems),
    owner: risk.owner?.trim() ?? '',
    responsible: risk.responsible?.trim() ?? '',
    responsible_department_id: responsibleDepartmentValue,
    status: STATUS_TO_API[risk.status] || risk.status || 'DRAFT',
    probability: PROBABILITY_TO_API[probabilityLevel] || null,
    Impact: IMPACT_TO_API[impactLevel] || null,
    possible_loss: safeNumber(risk.impactMostLikely ?? risk.possibleLoss, 0),
    due_date: toIsoDateTime(risk.dueDate),
    last_reviewed_at: toIsoDateTime(risk.lastReviewedAt),
    tags: Array.isArray(risk.tags) ? risk.tags : [],
    attachments: Array.isArray(risk.attachments) ? risk.attachments : [],
    existing_controls_text: risk.existingControlsText ?? '',
    planned_controls_text: risk.plannedControlsText ?? '',
  }
}

function buildPartialRiskPayload(updates, risk, departmentItems = [], categoryItems = []) {
  const source = { ...(risk || {}), ...(updates || {}) }
  const body = {}

  if ('title' in updates) {
    body.title = source.title?.trim() ?? ''
  }
  if ('description' in updates) {
    body.description = source.description?.trim() ?? ''
  }
  if ('category' in updates) {
    body.category = resolveCategoryValue(source.category, categoryItems)
  }
  if ('department' in updates) {
    body.department = resolveDepartmentValue(source.department, departmentItems)
  }
  if ('owner' in updates) {
    body.owner = source.owner?.trim() ?? ''
  }
  if ('responsible' in updates) {
    body.responsible = source.responsible?.trim() ?? ''
  }
  if (
    'mitigationDepartment' in updates ||
    'department' in updates ||
    'responsibleDepartmentId' in updates ||
    'responsible_department_id' in updates
  ) {
    body.responsible_department_id = resolveDepartmentValue(
      source.mitigationDepartment ??
        source.responsibleDepartmentId ??
        source.responsible_department_id ??
        source.department,
      departmentItems,
    )
  }
  if ('status' in updates) {
    body.status = STATUS_TO_API[source.status] || source.status || 'DRAFT'
  }
  if ('probability' in updates) {
    const probabilityLevel = normalizeProbabilityLevel(source.probability)
    body.probability = PROBABILITY_TO_API[probabilityLevel] || null
  }
  if ('severity' in updates || 'Impact' in updates || 'impact' in updates) {
    const impactLevel = normalizeImpactLevel(source.severity ?? source.Impact ?? source.impact)
    body.Impact = IMPACT_TO_API[impactLevel] || null
  }
  if ('impactMostLikely' in updates || 'possibleLoss' in updates || 'possible_loss' in updates) {
    body.possible_loss = safeNumber(
      source.impactMostLikely ?? source.possibleLoss ?? source.possible_loss,
      0,
    )
  }
  if ('dueDate' in updates || 'due_date' in updates) {
    body.due_date = toIsoDateTime(source.dueDate ?? source.due_date)
  }
  if ('lastReviewedAt' in updates || 'last_reviewed_at' in updates) {
    body.last_reviewed_at = toIsoDateTime(source.lastReviewedAt ?? source.last_reviewed_at)
  }
  if ('tags' in updates) {
    body.tags = Array.isArray(source.tags) ? source.tags : []
  }
  if ('attachments' in updates) {
    body.attachments = Array.isArray(source.attachments) ? source.attachments : []
  }
  if ('existingControlsText' in updates || 'existing_controls_text' in updates) {
    body.existing_controls_text = source.existingControlsText ?? source.existing_controls_text ?? ''
  }
  if ('plannedControlsText' in updates || 'planned_controls_text' in updates) {
    body.planned_controls_text = source.plannedControlsText ?? source.planned_controls_text ?? ''
  }

  return body
}
