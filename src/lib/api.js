import { getImpactLevel, recalculateRisk } from './compute'
import { normalizeDepartmentName } from './departments'
import { refreshKeycloakToken } from './keycloak'

const DEFAULT_API_BASE_URL = ''

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

const GET_REQUEST_CACHE_TTL_MS = 15_000
const PROFILE_CACHE_TTL_MS = 45_000
const DIRECTORY_CACHE_TTL_MS = 45_000
const REQUEST_CACHE_KEY_PREFIX = 'api-get:'
const API_LIST_PAGE_SIZE = 120
const MAX_SYNC_PAGES = 500
const MAX_INCREMENTAL_SYNC_PAGES = 180

const requestResponseCache = new Map()
const inflightGetRequests = new Map()

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

const TOKEN_CACHE_TTL_MS = 10_000
const EMPTY_TOKEN_CACHE_TTL_MS = 1_000

let authTokenCache = {
  value: null,
  expiresAt: 0,
}
let inflightAuthTokenPromise = null

async function getRequestAuthToken() {
  if (Date.now() < authTokenCache.expiresAt) {
    return authTokenCache.value
  }

  if (!inflightAuthTokenPromise) {
    inflightAuthTokenPromise = refreshKeycloakToken(30)
      .catch(() => null)
      .then((token) => {
        authTokenCache = {
          value: token,
          expiresAt: Date.now() + (token ? TOKEN_CACHE_TTL_MS : EMPTY_TOKEN_CACHE_TTL_MS),
        }
        return token
      })
      .finally(() => {
        inflightAuthTokenPromise = null
      })
  }

  return inflightAuthTokenPromise
}

function getRequestCacheKey(path) {
  return `${REQUEST_CACHE_KEY_PREFIX}${path}`
}

function getCachedResponse(cacheKey) {
  const cached = requestResponseCache.get(cacheKey)
  if (!cached) {
    return null
  }

  if (cached.expiresAt <= Date.now()) {
    requestResponseCache.delete(cacheKey)
    return null
  }

  return cached.value
}

function setCachedResponse(cacheKey, value, ttlMs) {
  if (!ttlMs || ttlMs <= 0) {
    return
  }

  requestResponseCache.set(cacheKey, {
    value,
    expiresAt: Date.now() + ttlMs,
  })
}

function invalidateRequestCache(pathPrefix = '') {
  const normalizedPrefix = getRequestCacheKey(pathPrefix)
  if (!pathPrefix) {
    requestResponseCache.clear()
    return
  }

  for (const key of requestResponseCache.keys()) {
    if (key === normalizedPrefix || key.startsWith(normalizedPrefix)) {
      requestResponseCache.delete(key)
    }
  }
}

export function clearApiCache(pathPrefix = '') {
  invalidateRequestCache(pathPrefix)
}

function createRequestError(message, response, payload) {
  const error = new Error(message)
  if (response) {
    error.status = response.status
  }
  if (payload !== undefined) {
    error.payload = payload
  }
  return error
}

function requestWithErrorDetails(message, response, payload) {
  throw createRequestError(message, response, payload)
}

async function request(path, {
  method = 'GET',
  body,
  unwrapData = true,
  cacheTtlMs = GET_REQUEST_CACHE_TTL_MS,
} = {}) {
  const normalizedMethod = String(method || 'GET').toUpperCase()
  const isReadOnly = normalizedMethod === 'GET'
  const cacheKey = isReadOnly ? getRequestCacheKey(path) : null

  if (isReadOnly && cacheKey) {
    const cached = getCachedResponse(cacheKey)
    if (cached) {
      return cached
    }

    const inFlight = inflightGetRequests.get(cacheKey)
    if (inFlight) {
      return inFlight
    }
  }

  const token = await getRequestAuthToken()

  const requestPromise = (async () => {
    const response = await fetch(buildUrl(path), {
      method: normalizedMethod,
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })

    if (response.status === 401 || response.status === 403) {
      authTokenCache = {
        value: null,
        expiresAt: 0,
      }
    }

    const text = await response.text()
    const payload = parsePayloadText(text)

    if (!response.ok) {
      const message = pickErrorMessage(payload) || `Request failed with status ${response.status}`
      return requestWithErrorDetails(message, response, payload)
    }

    if (payload && typeof payload === 'object' && typeof payload.status === 'number' && payload.status >= 400) {
      const message = pickErrorMessage(payload) || `Request failed with status ${payload.status}`
      return requestWithErrorDetails(message, response, payload)
    }

    const resolvedPayload =
      unwrapData && payload && typeof payload === 'object' && 'data' in payload
        ? payload.data
        : payload

    if (cacheKey && isReadOnly && cacheTtlMs > 0 && payload !== undefined) {
      setCachedResponse(cacheKey, resolvedPayload, cacheTtlMs)
    }

    return resolvedPayload
  })()

  if (isReadOnly && cacheKey) {
    inflightGetRequests.set(cacheKey, requestPromise)
    requestPromise.finally(() => {
      if (inflightGetRequests.get(cacheKey) === requestPromise) {
        inflightGetRequests.delete(cacheKey)
      }
    })
  }

  return requestPromise
}

function buildAdminReportPath({ reportType, search = '', format = 'json' }) {
  const params = new URLSearchParams()
  if (reportType) {
    params.set('type', reportType)
  }
  const normalizedSearch = String(search || '').trim()
  if (normalizedSearch) {
    params.set('search', normalizedSearch)
  }
  if (format) {
    params.set('format', format)
  }

  const query = params.toString()
  return `/app/api/reports/${query ? `?${query}` : ''}`
}

function parseContentDispositionFilename(value) {
  if (!value) {
    return null
  }
  const utf8Match = value.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match) {
    try {
      return decodeURIComponent(utf8Match[1])
    } catch {
      return utf8Match[1]
    }
  }

  const quotedMatch = value.match(/filename="([^"]+)"/i)
  if (quotedMatch) {
    return quotedMatch[1]
  }

  const rawMatch = value.match(/filename=([^;]+)/i)
  return rawMatch ? rawMatch[1].replace(/^\s+|\s+$/g, '') : null
}

export async function generateAdminReport({
  reportType,
  search = '',
} = {}) {
  if (!reportType) {
    throw new Error('reportType is required')
  }

  return request(buildAdminReportPath({ reportType, search }), {
    cacheTtlMs: 0,
  })
}

export async function downloadAdminReport({
  reportType,
  search = '',
} = {}) {
  if (!reportType) {
    throw new Error('reportType is required')
  }

  const token = await getRequestAuthToken()
  const response = await fetch(
    buildUrl(buildAdminReportPath({ reportType, search, format: 'csv' })),
    {
      method: 'GET',
      headers: {
        Accept: 'text/csv',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    },
  )

  if (!response.ok) {
    const payloadText = await response.text()
    const payload = parsePayloadText(payloadText)
    const message = pickErrorMessage(payload) || `Request failed with status ${response.status}`
    return requestWithErrorDetails(message, response, payload)
  }

  const blob = await response.blob()
  const contentDisposition = response.headers.get('content-disposition') || ''
  const defaultDate = new Date().toISOString().slice(0, 10)
  const fallbackName = `${String(reportType).replace(/[^a-z0-9_-]+/gi, '_')}-${defaultDate}.csv`
  const filename = parseContentDispositionFilename(contentDisposition) || fallbackName

  return {
    blob,
    filename,
  }
}

export async function getCurrentProfile() {
  return request('/app/me/', {
    unwrapData: false,
    cacheTtlMs: PROFILE_CACHE_TTL_MS,
  })
}

export async function getDepartmentMemberDirectory() {
  return request('/app/api/directory/department-members/', {
    cacheTtlMs: DIRECTORY_CACHE_TTL_MS,
  })
}

function createReferenceIndex(rawItems = [], nameNormalizer = null) {
  const items = []
  const byId = new Map()
  const byName = new Map()
  const normalizeIndexKey = (value) => String(value || '').trim().toLowerCase()

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
      const normalizedKey = normalizeIndexKey(name)
      items.push({ id: null, name, clientKey: `name:${normalizedKey}` })
      if (normalizedKey && !byName.has(normalizedKey)) {
        byName.set(normalizedKey, null)
      }
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
      const normalizedName = normalizeIndexKey(name)
      if (normalizedName && !byName.has(normalizedName)) {
        byName.set(normalizedName, id)
      }
    } else {
      const normalizedName = normalizeIndexKey(name)
      if (normalizedName && !byName.has(normalizedName)) {
        byName.set(normalizedName, null)
      }
    }
  })
  items.sort((left, right) => left.name.localeCompare(right.name))

  return {
    items,
    names: items.map((item) => item.name),
    byId,
    byName,
  }
}

function resolveDepartmentName(value, departmentIndex) {
  if (!value) {
    return ''
  }
  if (typeof value === 'object') {
    return normalizeDepartmentName(value.name ?? value.title ?? String(extractId(value) ?? ''))
  }

  const normalizedValue = normalizeDepartmentName(String(value))
  if (!normalizedValue) {
    return ''
  }

  const rawValue = String(value)
  const directMatch = departmentIndex?.byId?.get(rawValue) || departmentIndex?.byId?.get(String(extractId(value) ?? ''))

  return normalizeDepartmentName(
    directMatch
      || departmentIndex?.byName?.get(normalizedValue.toLowerCase())
      || rawValue,
  )
}

function resolveDepartmentValue(value, departmentItems) {
  if (!value) {
    return null
  }
  if (typeof value === 'object') {
    return extractId(value) ?? value.name ?? null
  }

  const normalized = normalizeDepartmentName(value)
  const normalizedKey = normalized.toLowerCase()
  if (!departmentItems?.byId) {
    const match = (Array.isArray(departmentItems) ? departmentItems : []).find(
      (item) => normalizeDepartmentName(item?.name) === normalized,
    )
    return match?.id ?? normalized
  }

  const id = departmentItems.byId?.get(String(value))
  if (id) {
    return id
  }

  return departmentItems.byName?.get(normalizedKey) ?? normalized
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
  if (!categoryItems?.byId) {
    const match = (Array.isArray(categoryItems) ? categoryItems : []).find(
      (item) => normalizeCategoryLabel(item?.name) === normalized,
    )
    if (match?.id !== null && match?.id !== undefined) {
      return match.id
    }
    return LEGACY_CATEGORY_TO_API[normalized] || normalized
  }

  const matchId = categoryItems.byId?.get(String(value))
  if (matchId !== null && matchId !== undefined) {
    return matchId
  }

  const normalizedId = categoryItems.byName?.get(normalized.toLowerCase())
  return normalizedId || LEGACY_CATEGORY_TO_API[normalized] || normalized
}

function invalidateRiskDatasetCache() {
  clearApiCache('/app/api/create/risk/')
  clearApiCache('/app/api/create/department/')
  clearApiCache('/app/api/create/category/')
  clearApiCache('/app/api/create/mitigation/')
  clearApiCache('/app/api/create/decisition/')
  clearApiCache('/app/api/create/riskactivity/')
}

function parsePayloadAsList(payload) {
  if (Array.isArray(payload)) {
    return {
      data: payload,
      pagination: null,
      syncedUntil: null,
    }
  }
  if (!payload || typeof payload !== 'object') {
    return {
      data: [],
      pagination: null,
      syncedUntil: null,
    }
  }
  return {
    data: Array.isArray(payload.data) ? payload.data : [],
    pagination: payload.pagination && typeof payload.pagination === 'object' ? payload.pagination : null,
    syncedUntil: payload.syncedUntil || payload.synced_at || null,
  }
}

function toIsoDate(value) {
  if (!value) {
    return null
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  return date.toISOString()
}

function latestSyncMarker(...collections) {
  let latest = null
  if (!collections.length) {
    return null
  }

  const toTimestamp = (value) => {
    const iso = toIsoDate(value)
    if (!iso) {
      return null
    }
    const asNumber = Date.parse(iso)
    return Number.isNaN(asNumber) ? null : asNumber
  }

  collections.forEach((collection) => {
    if (!collection) {
      return
    }

    if (typeof collection === 'string' || typeof collection === 'number') {
      const candidate = toTimestamp(collection)
      if (candidate && (!latest || candidate > latest)) {
        latest = candidate
      }
      return
    }

    if (Array.isArray(collection)) {
      collection.forEach((item) => {
        const candidate = toTimestamp(
          item?.updatedAt ||
            item?.updated_at ||
            item?.at ||
            item?.decidedAt ||
            item?.decided_at ||
            item?.createdAt ||
            item?.created_at,
        )

        if (candidate && (!latest || candidate > latest)) {
          latest = candidate
        }
      })
      return
    }
  })

  return latest ? new Date(latest).toISOString() : null
}

function buildPagedPath(path, { page, pageSize, updatedSince, includeCount = false }) {
  const params = new URLSearchParams()
  const resolvedPage = Number.isFinite(Number(page)) ? Number(page) : 0
  const resolvedPageSize = Number.isFinite(Number(pageSize)) ? Number(pageSize) : 0

  if (resolvedPage > 0) {
    params.set('page', String(Math.max(1, resolvedPage)))
  }
  if (resolvedPageSize > 0) {
    params.set('page_size', String(Math.max(1, Math.trunc(resolvedPageSize))))
  }
  if (updatedSince) {
    params.set('updated_since', updatedSince)
  }
  if (resolvedPage > 0 || resolvedPageSize > 0) {
    params.set('include_count', includeCount ? '1' : '0')
  }

  const query = params.toString()
  if (!query) {
    return path
  }

  return `${path}?${query}`
}

async function loadPagedCollection(path, {
  pageSize = API_LIST_PAGE_SIZE,
  updatedSince = null,
  maxPages = MAX_SYNC_PAGES,
  includeCount = false,
} = {}) {
  const normalizedPageSize =
    Number.isFinite(Number(pageSize)) && Number(pageSize) > 0
      ? Math.max(1, Math.trunc(Number(pageSize)))
      : API_LIST_PAGE_SIZE
  const maxPageCount =
    Number.isFinite(Number(maxPages)) && Number(maxPages) > 0
      ? Math.max(1, Math.trunc(Number(maxPages)))
      : 1

  const payloads = []
  let currentPage = 1
  let pagesLoaded = 0
  const seenPages = new Set()

  while (pagesLoaded < maxPageCount) {
    const nextPath = buildPagedPath(path, {
      page: currentPage,
      pageSize: normalizedPageSize,
      updatedSince,
      includeCount,
    })

    const payload = await request(nextPath)
    const parsed = parsePayloadAsList(payload)
    payloads.push(parsed)

    const nextPage = Number(parsed.pagination?.next)
    pagesLoaded += 1
    if (Number.isNaN(nextPage) || nextPage <= 1) {
      break
    }

    if (seenPages.has(nextPage)) {
      break
    }

    if (nextPage <= currentPage) {
      break
    }

    seenPages.add(nextPage)
    currentPage = nextPage
  }

  const aggregatedData = []
  payloads.forEach((entry) => {
    if (Array.isArray(entry.data)) {
      aggregatedData.push(...entry.data)
    }
  })

  const syncedUntil = payloads.reduce((result, entry) => {
    if (!entry.syncedUntil) {
      return result
    }
    if (!result || entry.syncedUntil > result) {
      return entry.syncedUntil
    }
    return result
  }, null)

  return {
    data: aggregatedData,
    syncedUntil,
  }
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

export async function loadErmDataset({
  incremental = false,
  since = null,
  pageSize = API_LIST_PAGE_SIZE,
} = {}) {
  const [
    rawDepartments,
    rawCategories,
    rawRisks,
    rawMitigations,
    rawDecisions,
    rawActivities,
  ] = await Promise.all([
    request('/app/api/create/department/'),
    request('/app/api/create/category/'),
    loadPagedCollection('/app/api/create/risk/', {
      pageSize,
      updatedSince: incremental ? since : null,
      maxPages: incremental ? MAX_INCREMENTAL_SYNC_PAGES : MAX_SYNC_PAGES,
      includeCount: false,
    }),
    loadPagedCollection('/app/api/create/mitigation/', {
      pageSize,
      updatedSince: incremental ? since : null,
      maxPages: incremental ? MAX_INCREMENTAL_SYNC_PAGES : MAX_SYNC_PAGES,
      includeCount: false,
    }),
    loadPagedCollection('/app/api/create/decisition/', {
      pageSize,
      updatedSince: incremental ? since : null,
      maxPages: incremental ? MAX_INCREMENTAL_SYNC_PAGES : MAX_SYNC_PAGES,
      includeCount: false,
    }),
    loadPagedCollection('/app/api/create/riskactivity/', {
      pageSize,
      updatedSince: incremental ? since : null,
      maxPages: incremental ? MAX_INCREMENTAL_SYNC_PAGES : MAX_SYNC_PAGES,
      includeCount: false,
    }),
  ])

  const departmentIndex = createReferenceIndex(
    Array.isArray(rawDepartments) ? rawDepartments : [],
    normalizeDepartmentName,
  )
  const categoryIndex = createReferenceIndex(
    Array.isArray(rawCategories) ? rawCategories : [],
    normalizeCategoryLabel,
  )

  const riskPayload = parsePayloadAsList(rawRisks)
  const mitigationPayload = parsePayloadAsList(rawMitigations)
  const decisionPayload = parsePayloadAsList(rawDecisions)
  const activityPayload = parsePayloadAsList(rawActivities)

  const decisionLogs = sortByDateDesc(
    (Array.isArray(decisionPayload.data) ? decisionPayload.data : []).map(normalizeDecisionRecord),
    'decidedAt',
  )

  const activities = sortByDateDesc(
    (Array.isArray(activityPayload.data) ? activityPayload.data : []).map(normalizeActivityRecord),
    'at',
  )

  const decisionsByRisk = groupBy(decisionLogs, 'riskId')
  const activitiesByRisk = groupBy(activities, 'riskId')

  const risks = sortByDateDesc(
    (Array.isArray(riskPayload.data) ? riskPayload.data : []).map((entry) =>
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
    (Array.isArray(mitigationPayload.data) ? mitigationPayload.data : []).map(normalizeMitigationRecord),
    'createdAt',
  )

  const syncedUntil = latestSyncMarker(
    riskPayload.syncedUntil,
    mitigationPayload.syncedUntil,
    decisionPayload.syncedUntil,
    activityPayload.syncedUntil,
    risks,
    mitigationActions,
    decisionLogs,
    activities,
  )

  return {
    departmentItems: departmentIndex.items,
    categoryItems: categoryIndex.items,
    departments: departmentIndex.names,
    categories: categoryIndex.names,
    risks,
    mitigationActions,
    decisionLogs,
    sync: {
      since: syncedUntil,
      risks: riskPayload.syncedUntil,
      mitigation: mitigationPayload.syncedUntil,
      decisions: decisionPayload.syncedUntil,
      activities: activityPayload.syncedUntil,
    },
  }
}

export async function createRiskRecord(risk, departmentItems = [], categoryItems = []) {
  invalidateRiskDatasetCache()
  const departmentIndex = createReferenceIndex(departmentItems, normalizeDepartmentName)
  const categoryIndex = createReferenceIndex(categoryItems, normalizeCategoryLabel)
  return request('/app/api/create/risk/', {
    method: 'POST',
    body: buildRiskPayload(risk, departmentIndex, categoryIndex),
  })
}

export async function getRiskRecord(
  riskId,
  { departmentItems = [], categoryItems = [], decisionLogs = [], auditItems = [] } = {},
) {
  let rawRisk
  try {
    rawRisk = await request(`/app/api/crud/risk/${riskId}/`, {
      cacheTtlMs: 0,
    })
  } catch (error) {
    if (!error || error.status !== 404) {
      throw error
    }

    const rawRisks = await request('/app/api/create/risk/', {
      cacheTtlMs: GET_REQUEST_CACHE_TTL_MS,
    })
    rawRisk = (Array.isArray(rawRisks) ? rawRisks : []).find(
      (entry) => String(entry?.id ?? entry?.risk_id ?? entry?.riskId ?? '') === String(riskId),
    )
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
  invalidateRiskDatasetCache()
  const departmentIndex = createReferenceIndex(departmentItems, normalizeDepartmentName)
  const categoryIndex = createReferenceIndex(categoryItems, normalizeCategoryLabel)
  const path = useCreatorEndpoint ? `/app/api/risk/crud/user/${riskId}/` : `/app/api/crud/risk/${riskId}/`
  const body = partialUpdates
    ? buildPartialRiskPayload(partialUpdates, risk, departmentIndex, categoryIndex)
    : buildRiskPayload(risk, departmentIndex, categoryIndex)

  return request(path, {
    method: 'PATCH',
    body,
  })
}

export async function createDepartmentRecord(name) {
  clearApiCache('/app/api/create/department/')
  clearApiCache('/app/api/create/risk/')
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
  clearApiCache('/app/api/create/department/')
  clearApiCache('/app/api/create/risk/')
  return request(`/app/api/crud/department/${id}/`, {
    method: 'PATCH',
    body: { name },
  })
}

export async function deleteDepartmentRecord(id) {
  clearApiCache('/app/api/create/department/')
  clearApiCache('/app/api/create/risk/')
  return request(`/app/api/crud/department/${id}/`, {
    method: 'DELETE',
    unwrapData: false,
  })
}

export async function createCategoryRecord(name) {
  clearApiCache('/app/api/create/category/')
  clearApiCache('/app/api/create/risk/')
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
  clearApiCache('/app/api/create/category/')
  clearApiCache('/app/api/create/risk/')
  return request(`/app/api/crud/category/${id}/`, {
    method: 'PATCH',
    body: { name },
  })
}

export async function deleteCategoryRecord(id) {
  clearApiCache('/app/api/create/category/')
  clearApiCache('/app/api/create/risk/')
  return request(`/app/api/crud/category/${id}/`, {
    method: 'DELETE',
    unwrapData: false,
  })
}

export async function createDecisionRecord(entry) {
  invalidateRiskDatasetCache()
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
  invalidateRiskDatasetCache()
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
  invalidateRiskDatasetCache()
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
  invalidateRiskDatasetCache()
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
  const departmentIndex = departmentItems?.byId
    ? departmentItems
    : createReferenceIndex(departmentItems, normalizeDepartmentName)
  const categoryIndex = categoryItems?.byId
    ? categoryItems
    : createReferenceIndex(categoryItems, normalizeCategoryLabel)
  const responsibleDepartmentValue = resolveDepartmentValue(
    risk.mitigationDepartment ?? risk.department,
    departmentIndex,
  )

  return {
    title: risk.title?.trim() ?? '',
    description: risk.description?.trim() ?? '',
    category: resolveCategoryValue(risk.category, categoryIndex),
    department: resolveDepartmentValue(risk.department, departmentIndex),
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
  const departmentIndex = departmentItems?.byId
    ? departmentItems
    : createReferenceIndex(departmentItems, normalizeDepartmentName)
  const categoryIndex = categoryItems?.byId
    ? categoryItems
    : createReferenceIndex(categoryItems, normalizeCategoryLabel)
  const body = {}

  if ('title' in updates) {
    body.title = source.title?.trim() ?? ''
  }
  if ('description' in updates) {
    body.description = source.description?.trim() ?? ''
  }
  if ('category' in updates) {
    body.category = resolveCategoryValue(source.category, categoryIndex)
  }
  if ('department' in updates) {
    body.department = resolveDepartmentValue(source.department, departmentIndex)
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
      departmentIndex,
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
