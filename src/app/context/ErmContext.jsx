import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  createActivityRecord,
  createCategoryRecord,
  createDecisionRecord,
  createDepartmentRecord,
  createMitigationRecord,
  createRiskRecord,
  deleteCategoryRecord,
  deleteDepartmentRecord,
  loadErmDataset,
  updateCategoryRecord,
  updateDepartmentRecord,
  updateMitigationRecord,
  updateRiskRecord,
} from '../../lib/api'
import {
  queueStatuses,
  statuses,
} from '../../data/seedMeta'
import { useAuth } from './AuthContext'
import { canViewRisk, hasAccessRole, matchesRiskCreator } from '../../lib/access'
import { applyGlobalRiskFilters } from '../../lib/compute'
import { normalizeDepartmentName, sameDepartment } from '../../lib/departments'
import { loadFromStorage, saveToStorage } from '../../lib/storage'
import { createRealtimeSocket } from '../../lib/realtime'

const STORAGE_KEYS = {
  globalFilters: 'erm_global_filters_v3',
  theme: 'erm_theme_v1',
  notificationReads: 'erm_notification_reads_v1',
  datasetCache: 'erm_backend_dataset_v1',
  syncState: 'erm_backend_sync_state_v1',
}

const defaultGlobalFilters = {
  search: '',
  dateFrom: '',
  dateTo: '',
  department: 'All',
  status: 'All',
  severity: 'All',
}

const severityFilters = ['All', 'Low', 'Small', 'Medium', 'Strong', 'High', 'Critical']
const ErmContext = createContext(null)
const creatorEditableStatusTokens = new Set([
  'DRAFT',
  'INFO_REQUESTED_BY_RISK_MANAGER',
  'INFO_REQUESTED_BY_COMMITTEE',
  'REQUESTED_INFO',
])
const MAX_RECENT_ACTIVITY_IDS = 4000
const MAX_RECENT_NOTIFICATION_IDS = 4000
const MAX_INLINE_REALTIME_NOTIFICATIONS = 150
const DEFAULT_SYNC_STATE = { since: null }

function normalizeStatusToken(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_')
}

function sortReferenceItems(items) {
  return [...items].sort((left, right) => left.name.localeCompare(right.name))
}

function sortItemsByDateDesc(items, key) {
  return [...items].sort((left, right) => {
    const leftValue = new Date(left?.[key] || 0).getTime()
    const rightValue = new Date(right?.[key] || 0).getTime()
    return rightValue - leftValue
  })
}

function sortItemsByDateAsc(items, key) {
  return [...items].sort((left, right) => {
    const leftValue = new Date(left?.[key] || 0).getTime()
    const rightValue = new Date(right?.[key] || 0).getTime()
    return leftValue - rightValue
  })
}

function hasPersistentReferenceId(item) {
  return item?.id !== null && item?.id !== undefined && item?.id !== ''
}

function isValidDateInput(value) {
  if (typeof value !== 'string' || !value) {
    return false
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }
  return !Number.isNaN(new Date(`${value}T00:00:00`).getTime())
}

function normalizeGlobalFilters(raw, availableDepartments = []) {
  if (!raw || typeof raw !== 'object') {
    return defaultGlobalFilters
  }

  const dateFrom = isValidDateInput(raw.dateFrom) ? raw.dateFrom : ''
  const dateTo = isValidDateInput(raw.dateTo) ? raw.dateTo : ''
  const normalized = {
    ...defaultGlobalFilters,
    ...raw,
    search: typeof raw.search === 'string' ? raw.search : '',
    dateFrom,
    dateTo,
    department:
      typeof raw.department === 'string' && availableDepartments.includes(raw.department)
        ? raw.department
        : 'All',
    status: typeof raw.status === 'string' && statuses.includes(raw.status) ? raw.status : 'All',
    severity:
      typeof raw.severity === 'string' && severityFilters.includes(raw.severity)
        ? raw.severity
        : 'All',
  }

  if (normalized.dateFrom && normalized.dateTo) {
    const fromTimestamp = new Date(`${normalized.dateFrom}T00:00:00`).getTime()
    const toTimestamp = new Date(`${normalized.dateTo}T00:00:00`).getTime()
    if (fromTimestamp > toTimestamp) {
      normalized.dateFrom = ''
      normalized.dateTo = ''
    }
  }

  return normalized
}

function findNewestMatchingRisk(risks, candidate) {
  return [...risks]
    .filter(
      (risk) =>
        risk.title === candidate.title &&
        risk.owner === candidate.owner &&
        risk.responsible === candidate.responsible,
    )
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0]
}

function normalizeTargetValue(value) {
  return String(value || '').trim().toLowerCase()
}

function matchesNotificationTarget(notification, user) {
  if (!notification || !user) {
    return false
  }

  const userId = normalizeTargetValue(user.id)
  const userBackendUserId = normalizeTargetValue(user.backendUserId)
  const userEmail = normalizeTargetValue(user.email)
  const userRole = normalizeTargetValue(user.accessRole)
  const userRoles = Array.isArray(user.accessRoles) ? user.accessRoles.map(normalizeTargetValue) : []
  const userUsername = normalizeTargetValue(user.username)
  const userName = normalizeTargetValue(user.name)
  const userDepartment = normalizeTargetValue(user.department)

  if (notification.targetUser && normalizeTargetValue(notification.targetUser) === userId) {
    return true
  }

  if (notification.targetUser && userUsername && normalizeTargetValue(notification.targetUser) === userUsername) {
    return true
  }

  if (notification.targetUserId && normalizeTargetValue(notification.targetUserId) === userId) {
    return true
  }

  if (notification.targetUserName && normalizeTargetValue(notification.targetUserName) === userUsername) {
    return true
  }

  if (notification.targetUserName && normalizeTargetValue(notification.targetUserName) === userName) {
    return true
  }

  if (notification.targetUserEmail && normalizeTargetValue(notification.targetUserEmail) === userEmail) {
    return true
  }

  if (notification.targetEmail && normalizeTargetValue(notification.targetEmail) === userEmail) {
    return true
  }

  if (notification.targetBackendUserId && normalizeTargetValue(notification.targetBackendUserId) === userBackendUserId) {
    return true
  }

  if (notification.targetKeycloakSubject && normalizeTargetValue(notification.targetKeycloakSubject) === normalizeTargetValue(user.keycloakSubject)) {
    return true
  }

  const targetRole = normalizeTargetValue(notification.targetRole)
  if (targetRole && userRoles.length === 0) {
    if (targetRole !== userRole) {
      return false
    }
  } else if (targetRole && userRoles.length > 0 && !userRoles.includes(targetRole)) {
    return false
  }

  if (targetRole) {
    return true
  }

  const targetDepartment = notification.targetDepartment
  if (targetDepartment && !sameDepartment(targetDepartment, userDepartment)) {
    return false
  }

  if (targetDepartment) {
    return true
  }

  if (notification.targetUsername && normalizeTargetValue(notification.targetUsername) === userUsername) {
    return true
  }

  if (notification.targetName && normalizeTargetValue(notification.targetName) === userName) {
    return true
  }

  if (notification.targetEmail && normalizeTargetValue(notification.targetEmail) === userEmail) {
    return true
  }

  return Boolean(notification.targetDepartment || notification.targetRole)
}

function getGlobalFiltersStorageKey(userId) {
  return `${STORAGE_KEYS.globalFilters}:${userId ?? 'guest'}`
}

function getDatasetCacheStorageKey(userId) {
  return `${STORAGE_KEYS.datasetCache}:${userId ?? 'guest'}`
}

function getNotificationReadUserKeys(user) {
  if (!user) {
    return []
  }

  return [...new Set([
    user.keycloakSubject,
    user.backendUserId,
    user.id,
  ].filter(Boolean).map(String))]
}

function getPrimaryNotificationReadUserKey(user) {
  return getNotificationReadUserKeys(user)[0] ?? null
}

function getNotificationReadMap(notificationReads, user) {
  return getNotificationReadUserKeys(user).reduce((accumulator, key) => ({
    ...accumulator,
    ...(notificationReads?.[key] ?? {}),
  }), {})
}

function hasDatasetContent(dataset) {
  if (!dataset || typeof dataset !== 'object') {
    return false
  }

  return Boolean(
    (Array.isArray(dataset.risks) && dataset.risks.length) ||
    (Array.isArray(dataset.departmentItems) && dataset.departmentItems.length) ||
    (Array.isArray(dataset.categoryItems) && dataset.categoryItems.length) ||
    (Array.isArray(dataset.mitigationActions) && dataset.mitigationActions.length) ||
    (Array.isArray(dataset.decisionLogs) && dataset.decisionLogs.length),
  )
}

function normalizeIncomingAuditEvent(riskId, rawEvent, currentUser) {
  const resolvedRiskId = String(rawEvent?.riskId ?? rawEvent?.risk ?? riskId ?? '').trim()
  const type = String(rawEvent?.type || 'update').toLowerCase()

  return {
    id: rawEvent?.id,
    riskId: resolvedRiskId,
    type,
    title: rawEvent?.title || 'Risk updated',
    notes: rawEvent?.notes || '',
    by: rawEvent?.by || currentUser?.name || 'System',
    at: rawEvent?.at || new Date().toISOString(),
    diff: rawEvent?.diff || null,
  }
}

function normalizeIncomingNotification(rawNotification) {
  const objectId = rawNotification?.objectId ?? rawNotification?.object_id ?? ''
  const riskId =
    rawNotification?.riskId ??
    rawNotification?.risk_id ??
    rawNotification?.risk ??
    (objectId ? String(objectId) : '')

  return {
    id: rawNotification?.id,
    riskId: String(riskId).trim(),
    title: rawNotification?.title || 'Notification',
    message: rawNotification?.message || rawNotification?.note || '',
    at: rawNotification?.createdAt || rawNotification?.created_at || new Date().toISOString(),
    targetUser: rawNotification?.targetUser,
    targetUserId: rawNotification?.targetUserId,
    targetUserName: rawNotification?.targetUserName || rawNotification?.targetUserUsername,
    targetUsername: rawNotification?.targetUsername,
    targetName: rawNotification?.targetName,
    targetEmail: rawNotification?.targetEmail,
    targetRole: rawNotification?.targetRole,
    targetDepartment: rawNotification?.targetDepartment,
    targetKeycloakSubject: rawNotification?.targetKeycloakSubject,
    targetBackendUserId: rawNotification?.targetBackendUserId,
    read: false,
  }
}

function addRecentId(idRef, id, maxSize) {
  if (!id) {
    return false
  }

  const key = String(id)
  if (idRef.current.has(key)) {
    return true
  }

  idRef.current.add(key)
  if (idRef.current.size > maxSize) {
    const oldest = idRef.current.values().next().value
    if (oldest !== undefined) {
      idRef.current.delete(oldest)
    }
  }

  return false
}

function mergeNotificationLists(...lists) {
  const byId = new Map()

  lists.forEach((notificationList) => {
    notificationList.forEach((notification) => {
      if (notification?.id) {
        byId.set(String(notification.id), notification)
      }
    })
  })

  return Array.from(byId.values())
}

function getSyncStateStorageKey(userId) {
  return `${STORAGE_KEYS.syncState}:${userId ?? 'guest'}`
}

function normalizeSyncState(raw) {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_SYNC_STATE }
  }

  const candidate = String(raw.since || '').trim()
  return {
    since: candidate || null,
  }
}

function getEntityId(value) {
  const rawId = value?.id ?? value?.riskId
  if (rawId === null || rawId === undefined || rawId === '') {
    return null
  }
  return String(rawId)
}

function mergeById(currentItems, incomingItems) {
  const byId = new Map()
  const noIdItems = []

  if (Array.isArray(currentItems)) {
    currentItems.forEach((item) => {
      const id = getEntityId(item)
      if (id === null) {
        return
      }

      byId.set(id, item)
    })
  }

  if (Array.isArray(incomingItems)) {
    incomingItems.forEach((item) => {
      const id = getEntityId(item)
      if (id === null) {
        noIdItems.push(item)
        return
      }

      byId.set(id, item)
    })
  }

  return [...byId.values(), ...noIdItems]
}

function mergeRiskAudits(existingRisk, incomingRisk) {
  const incomingAudit = incomingRisk?.audit
  if (!Array.isArray(incomingAudit) || incomingAudit.length === 0) {
    return Array.isArray(existingRisk?.audit) ? existingRisk.audit : []
  }

  return sortItemsByDateDesc(
    mergeById(existingRisk?.audit, incomingAudit),
    'at',
  )
}

function mergeRiskCollections(currentRisks, incomingRisks) {
  const currentById = new Map()
  const noIdIncoming = []

  if (Array.isArray(currentRisks)) {
    currentRisks.forEach((risk) => {
      const id = getEntityId(risk)
      if (id !== null) {
        currentById.set(id, risk)
      }
    })
  }

  if (Array.isArray(incomingRisks)) {
    incomingRisks.forEach((incomingRisk) => {
      const id = getEntityId(incomingRisk)
      if (id === null) {
        noIdIncoming.push(incomingRisk)
        return
      }

      const existingRisk = currentById.get(id)
      const mergedRisk = {
        ...(existingRisk || {}),
        ...(incomingRisk || {}),
      }

      mergedRisk.audit = mergeRiskAudits(existingRisk, incomingRisk)
      currentById.set(id, mergedRisk)
    })
  }

  return sortItemsByDateDesc(
    [...currentById.values(), ...noIdIncoming],
    'updatedAt',
  )
}

function mergeDecisionCollections(current, incoming) {
  return sortItemsByDateDesc(mergeById(current, incoming), 'decidedAt')
}

function mergeMitigationCollections(current, incoming) {
  return sortItemsByDateAsc(mergeById(current, incoming), 'createdAt')
}

export function ErmProvider({ children }) {
  const { currentUser, directoryUsers } = useAuth()
  const [risks, setRisks] = useState([])
  const [mitigationActions, setMitigationActions] = useState([])
  const [decisionLogs, setDecisionLogs] = useState([])
  const [departmentItems, setDepartmentItems] = useState([])
  const [categoryItems, setCategoryItems] = useState([])
  const [globalFilters, setGlobalFiltersState] = useState(defaultGlobalFilters)
  const [theme, setTheme] = useState(() => loadFromStorage(STORAGE_KEYS.theme, 'light'))
  const [notificationReads, setNotificationReads] = useState(() =>
    loadFromStorage(STORAGE_KEYS.notificationReads, {}),
  )
  const [realtimeNotifications, setRealtimeNotifications] = useState([])
  const [toasts, setToasts] = useState([])
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isBackendConnected, setIsBackendConnected] = useState(false)
  const [isBackendLoading, setIsBackendLoading] = useState(false)
  const [backendError, setBackendError] = useState('')
  const previousUserIdRef = useRef(null)
  const syncBatchDepthRef = useRef(0)
  const pendingSyncRef = useRef(false)
  const inflightSyncRef = useRef(null)
  const hasDatasetRef = useRef(false)
  const activeNotificationSocketRef = useRef(null)
  const riskActivitySocketsRef = useRef(new Map())
  const seenActivityIdsRef = useRef(new Set())
  const seenNotificationIdsRef = useRef(new Set())
  const syncStateRef = useRef(DEFAULT_SYNC_STATE)

  const departments = useMemo(() => departmentItems.map((item) => item.name), [departmentItems])
  const categories = useMemo(() => categoryItems.map((item) => item.name), [categoryItems])
  const riskByIdMap = useMemo(() => {
    const next = new Map()

    risks.forEach((risk) => {
      const riskId = String(risk?.id || '').trim()
      if (!riskId) {
        return
      }
      next.set(riskId, risk)
    })

    return next
  }, [risks])

  const addToast = (payload) => {
    const id = `toast-${Date.now()}-${Math.floor(Math.random() * 10000)}`
    const toast = {
      id,
      type: payload.type ?? 'success',
      title: payload.title ?? 'Saved',
      message: payload.message ?? '',
    }

    setToasts((current) => [...current, toast])
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id))
    }, 3800)
  }

  const dismissToast = (id) => {
    setToasts((current) => current.filter((item) => item.id !== id))
  }

  const applySyncState = useCallback((rawSyncState) => {
    const nextSyncState = normalizeSyncState(rawSyncState)
    syncStateRef.current = nextSyncState

    if (currentUser?.id) {
      saveToStorage(getSyncStateStorageKey(currentUser.id), nextSyncState)
    }
  }, [currentUser?.id])

  const clearPersistedBackendState = useCallback((userId) => {
    if (typeof window === 'undefined' || !userId) {
      return
    }

    const keys = [
      getDatasetCacheStorageKey(userId),
      getSyncStateStorageKey(userId),
      getGlobalFiltersStorageKey(userId),
    ]

    try {
      keys.forEach((key) => {
        window.localStorage.removeItem(key)
      })
    } catch {
      // ignore browser storage errors
    }
  }, [])

  const restoreSyncState = useCallback((userId) => {
    if (!userId) {
      return DEFAULT_SYNC_STATE
    }

    const storedSyncState = loadFromStorage(getSyncStateStorageKey(userId), DEFAULT_SYNC_STATE)
    const normalizedSyncState = normalizeSyncState(storedSyncState)
    syncStateRef.current = normalizedSyncState
    return normalizedSyncState
  }, [])

  const applyDataset = useCallback((dataset, { incremental = false } = {}) => {
    const incomingRisks = Array.isArray(dataset?.risks) ? dataset.risks : []
    const incomingMitigationActions = Array.isArray(dataset?.mitigationActions)
      ? dataset.mitigationActions
      : []
    const incomingDecisionLogs = Array.isArray(dataset?.decisionLogs)
      ? dataset.decisionLogs
      : []

    setRisks((current) => (
      incremental
        ? mergeRiskCollections(current, incomingRisks)
        : sortItemsByDateDesc(incomingRisks, 'updatedAt')
    ))
    setMitigationActions((current) => (
      incremental
        ? mergeMitigationCollections(current, incomingMitigationActions)
        : sortItemsByDateAsc(incomingMitigationActions, 'createdAt')
    ))
    setDecisionLogs((current) => (
      incremental
        ? mergeDecisionCollections(current, incomingDecisionLogs)
        : sortItemsByDateDesc(incomingDecisionLogs, 'decidedAt')
    ))

    setDepartmentItems(sortReferenceItems(Array.isArray(dataset?.departmentItems) ? dataset.departmentItems : []))
    setCategoryItems(sortReferenceItems(Array.isArray(dataset?.categoryItems) ? dataset.categoryItems : []))
    setGlobalFiltersState((current) =>
      normalizeGlobalFilters(current, dataset.departments),
    )
    setIsBackendConnected(true)
    setBackendError('')
    hasDatasetRef.current = true

    if (currentUser?.id) {
      saveToStorage(getDatasetCacheStorageKey(currentUser.id), dataset)
    }

    if (dataset?.sync) {
      applySyncState({
        since: dataset.sync.since,
      })
    }
  }, [applySyncState, currentUser?.id])

  const syncFromBackend = useCallback(async ({ force = false, preserveOnError = false } = {}) => {
    if (!force && inflightSyncRef.current) {
      return inflightSyncRef.current
    }

    const syncPromise = (async () => {
      setIsBackendLoading(true)
      try {
        const syncMarker = force ? null : syncStateRef.current.since
        const dataset = await loadErmDataset({
          incremental: Boolean(syncMarker),
          since: syncMarker,
        })
        applyDataset(dataset, { incremental: Boolean(syncMarker) })
        return dataset
      } catch (error) {
        if (!preserveOnError && !hasDatasetRef.current) {
          setIsBackendConnected(false)
        }
        setBackendError(error instanceof Error ? error.message : 'Unable to load data from backend.')
        throw error
      } finally {
        setIsBackendLoading(false)
      }
    })()

    inflightSyncRef.current = syncPromise

    try {
      return await syncPromise
    } finally {
      if (inflightSyncRef.current === syncPromise) {
        inflightSyncRef.current = null
      }
    }
  }, [applyDataset])

  const scheduleBackendSync = async ({ force = false } = {}) => {
    if (!force && syncBatchDepthRef.current > 0) {
      pendingSyncRef.current = true
      return null
    }

    pendingSyncRef.current = false
    return syncFromBackend({ force })
  }

  const runWithDeferredSync = async (callback) => {
    syncBatchDepthRef.current += 1

    try {
      return await callback()
    } finally {
      syncBatchDepthRef.current = Math.max(0, syncBatchDepthRef.current - 1)

      if (syncBatchDepthRef.current === 0 && pendingSyncRef.current) {
        pendingSyncRef.current = false
        await syncFromBackend({ force: !syncStateRef.current.since })
      }
    }
  }

  useEffect(() => {
    let active = true
    const nextUserId = currentUser?.id ?? null
    const isReturningToUser = previousUserIdRef.current !== nextUserId

    if (!currentUser?.id) {
      if (previousUserIdRef.current) {
        clearPersistedBackendState(previousUserIdRef.current)
      }

      previousUserIdRef.current = null
      setRisks([])
      setMitigationActions([])
      setDecisionLogs([])
      setDepartmentItems([])
      setCategoryItems([])
      setIsBackendConnected(false)
      setIsBackendLoading(false)
      setBackendError('')
      hasDatasetRef.current = false
      return () => {
        active = false
      }
    }

    if (isReturningToUser) {
      clearPersistedBackendState(previousUserIdRef.current)
      previousUserIdRef.current = nextUserId
    }

    const currentSyncState = restoreSyncState(currentUser.id)
    const shouldForceSync = !currentSyncState.since

    const loadInitialData = async () => {
      const cachedDataset = loadFromStorage(getDatasetCacheStorageKey(currentUser.id), null)
      const hasCachedDataset = hasDatasetContent(cachedDataset)

      if (active && hasCachedDataset) {
        applyDataset(cachedDataset)
      }

      try {
        await syncFromBackend({
          force: shouldForceSync,
          preserveOnError: hasCachedDataset,
        })
        if (!active) {
          return
        }
      } catch (error) {
        if (!active) {
          return
        }

        if (!hasDatasetContent(cachedDataset)) {
          setRisks([])
          setMitigationActions([])
          setDecisionLogs([])
          setDepartmentItems([])
          setCategoryItems([])
          setGlobalFiltersState(defaultGlobalFilters)
          setIsBackendConnected(false)
        }

        setBackendError(error instanceof Error ? error.message : 'Unable to load data from backend.')
      }
    }

    void loadInitialData()

    return () => {
      active = false
    }
  }, [applyDataset, clearPersistedBackendState, currentUser?.id, restoreSyncState, syncFromBackend])

  useEffect(() => {
    if (!currentUser?.id) {
      setGlobalFiltersState(defaultGlobalFilters)
      return
    }

    setGlobalFiltersState(
      normalizeGlobalFilters(
        loadFromStorage(getGlobalFiltersStorageKey(currentUser.id), defaultGlobalFilters),
        departments,
      ),
    )
  }, [currentUser?.id, departments])

  useEffect(() => {
    if (!currentUser?.id) {
      return
    }
    saveToStorage(getGlobalFiltersStorageKey(currentUser.id), globalFilters)
  }, [currentUser?.id, globalFilters])

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.theme, theme)
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [theme])

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.notificationReads, notificationReads)
  }, [notificationReads])

  const setGlobalFilters = (nextFilters) => {
    setGlobalFiltersState((current) =>
      normalizeGlobalFilters(
        {
          ...current,
          ...nextFilters,
        },
        departments,
      ),
    )
  }

  const clearGlobalFilters = () => {
    setGlobalFiltersState(defaultGlobalFilters)
  }

  const appendRealtimeNotification = (rawNotification) => {
    if (!rawNotification) {
      return
    }

    const normalized = normalizeIncomingNotification(rawNotification)
    if (!normalized.id) {
      return
    }

    const hasExplicitTarget = [
      normalized.targetUser,
      normalized.targetUserId,
      normalized.targetUserName,
      normalized.targetUsername,
      normalized.targetEmail,
      normalized.targetRole,
      normalized.targetDepartment,
      normalized.targetKeycloakSubject,
      normalized.targetBackendUserId,
      normalized.targetName,
    ].some((value) => typeof value === 'string' ? value.trim() : value)

    if (hasExplicitTarget && !matchesNotificationTarget(normalized, currentUser)) {
      return
    }

    const isDuplicate = addRecentId(
      seenNotificationIdsRef,
      normalized.id,
      MAX_RECENT_NOTIFICATION_IDS,
    )

    if (isDuplicate) {
      return
    }

    const riskRecord = riskByIdMap.get(String(normalized.riskId))

    setRealtimeNotifications((current) => {
      return [
        {
          ...normalized,
          riskTitle: normalized.riskTitle || riskRecord?.title || '',
          read: false,
        },
        ...current,
      ].slice(0, MAX_INLINE_REALTIME_NOTIFICATIONS)
    })
  }

  const resolveRiskAuditEvent = (riskId, event) => {
    if (!event) {
      return null
    }

    const payload = event?.data ?? event
    const nextRiskId = String(payload.riskId ?? payload.risk ?? riskId ?? '').trim()
    const nextType = String(payload.type || event.type || 'update')
      .trim()
      .toLowerCase()

    if (!nextRiskId) {
      return null
    }

    return {
      ...payload,
      riskId: nextRiskId,
      type: nextType,
      title: payload.title || 'Risk updated',
      notes: payload.notes || '',
      by: payload.by || event.by || currentUser?.name || 'System',
      at: payload.at || new Date().toISOString(),
    }
  }

  const subscribeToRiskActivity = (riskId) => {
    const riskKey = String(riskId || '').trim()
    if (!riskKey || !currentUser?.id) {
      return () => {}
    }

    const existing = riskActivitySocketsRef.current.get(riskKey)
    if (existing) {
      existing.subscribers += 1
      return () => {
        const target = riskActivitySocketsRef.current.get(riskKey)
        if (!target) {
          return
        }

        target.subscribers -= 1
        if (target.subscribers > 0) {
          return
        }

        target.connection.stop()
        riskActivitySocketsRef.current.delete(riskKey)
      }
    }

    const connection = createRealtimeSocket(`ws/risk-activity/${riskKey}/`, {
      onEvent: (payload) => {
        if (!payload || payload.eventType !== 'risk_activity') {
          return
        }

        const resolvedEvent = resolveRiskAuditEvent(riskKey, payload)
        if (!resolvedEvent) {
          return
        }

        appendAuditEntryToRisk(riskKey, resolvedEvent)
      },
    })

    const entry = {
      connection,
      subscribers: 1,
    }
    riskActivitySocketsRef.current.set(riskKey, entry)
    connection.start()

    return () => {
      const target = riskActivitySocketsRef.current.get(riskKey)
      if (!target) {
        return
      }

      target.subscribers -= 1
      if (target.subscribers > 0) {
        return
      }

      target.connection.stop()
      riskActivitySocketsRef.current.delete(riskKey)
    }
  }

  const clearRealtimeState = () => {
    if (activeNotificationSocketRef.current) {
      activeNotificationSocketRef.current.stop()
      activeNotificationSocketRef.current = null
    }

    riskActivitySocketsRef.current.forEach((entry) => {
      entry.connection.stop()
    })
    riskActivitySocketsRef.current.clear()

    setRealtimeNotifications([])
    seenActivityIdsRef.current.clear()
    seenNotificationIdsRef.current.clear()
  }

  useEffect(() => {
    clearRealtimeState()
  }, [currentUser?.id])

  useEffect(() => {
    if (!currentUser?.id || !isBackendConnected) {
      return
    }

    const connection = createRealtimeSocket('ws/notifications/', {
      onEvent: (payload) => {
        if (!payload || payload.eventType !== 'notification') {
          return
        }

        appendRealtimeNotification(payload.data)
      },
    })

    activeNotificationSocketRef.current = connection
    connection.start()

    return () => {
      clearRealtimeState()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, isBackendConnected])

  const appendAuditEntryToRisk = (riskId, event) => {
    if (!riskId || !event) {
      return
    }

    const nextAuditEntry = normalizeIncomingAuditEvent(riskId, event, currentUser)
    const nextAuditEntryId = nextAuditEntry.id ?? `local-audit-${Date.now()}-${Math.floor(Math.random() * 10000)}`
    const isDuplicate = addRecentId(seenActivityIdsRef, nextAuditEntryId, MAX_RECENT_ACTIVITY_IDS)

    if (isDuplicate) {
      return
    }

    setRisks((current) =>
      current.map((risk) =>
        String(risk.id) === String(nextAuditEntry.riskId)
          ? {
              ...risk,
              audit: sortItemsByDateDesc(
                [...(Array.isArray(risk.audit) ? risk.audit : []), { ...nextAuditEntry, id: nextAuditEntryId }],
                'at',
              ),
            }
          : risk,
      ),
    )
  }

  const addRisk = async (newRisk) => {
    const createdAt = new Date().toISOString()
    const owner =
      newRisk.owner?.trim() ||
      currentUser?.name ||
      currentUser?.username ||
      currentUser?.email ||
      currentUser?.role ||
      'Risk Owner'
    const responsible =
      newRisk.responsible?.trim() ||
      currentUser?.name ||
      currentUser?.username ||
      currentUser?.email ||
      currentUser?.role ||
      'Unassigned'
    const payload = {
      ...newRisk,
      owner,
      responsible,
      lastReviewedAt: newRisk.lastReviewedAt ?? createdAt,
    }

    const createdRisk = await createRiskRecord(payload, departmentItems, categoryItems)
    const createdRiskRecord = createdRisk?.id
      ? createdRisk
      : null

    if (!createdRiskRecord?.id) {
      const synced = await scheduleBackendSync()
      return findNewestMatchingRisk(synced?.risks ?? [], payload) ?? null
    }

    await createActivityRecord(createdRiskRecord.id, {
      type: 'create',
      title: 'Risk created',
      notes: `Status set to ${payload.status}`,
      by: currentUser?.name ?? createdRiskRecord?.owner ?? payload.owner ?? 'System',
      at: createdAt,
      diff: {
        workflowStatus: payload.status,
      },
    })

    const refreshed = await scheduleBackendSync()
    return findNewestMatchingRisk(refreshed?.risks ?? [], payload)
  }

  const updateRisk = async (riskId, updates, auditEvent) => {
    const currentRisk = risks.find((risk) => risk.id === riskId)
    if (!currentRisk) {
      throw new Error('Risk not found')
    }

    const nextRisk = {
      ...currentRisk,
      ...updates,
      updatedAt: new Date().toISOString(),
    }

    const useCreatorEndpoint =
      creatorEditableStatusTokens.has(normalizeStatusToken(currentRisk.status)) &&
      matchesRiskCreator(currentUser, currentRisk)

    await updateRiskRecord(riskId, nextRisk, departmentItems, categoryItems, {
      useCreatorEndpoint,
      partialUpdates: updates,
    })

    setRisks((current) =>
      current.map((risk) =>
        String(risk.id) === String(riskId)
          ? {
              ...risk,
              ...nextRisk,
              audit: risk.audit,
            }
          : risk,
      ),
    )

    if (Object.prototype.hasOwnProperty.call(updates, 'responsible')) {
      setMitigationActions((current) =>
        current.map((action) =>
          String(action.riskId) === String(riskId) && action.status !== 'Approved'
            ? {
                ...action,
                owner: updates.responsible,
              }
            : action,
        ),
      )
    }

    if (auditEvent) {
      const nextAuditEvent = {
        ...auditEvent,
        by: auditEvent.by ?? currentUser?.name ?? 'System',
        at: auditEvent.at || new Date().toISOString(),
      }

      const createdActivity = await createActivityRecord(riskId, nextAuditEvent)
      const resolvedAuditEvent = resolveRiskAuditEvent(riskId, createdActivity) ?? nextAuditEvent
      appendAuditEntryToRisk(riskId, resolvedAuditEvent)
    }

    return true
  }

  const addDecision = async (entry) => {
    const nextEntry = {
      id: entry.id ?? `local-decision-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      riskId: entry.riskId,
      decisionType: entry.decisionType,
      decidedBy: entry.decidedBy ?? currentUser?.name ?? 'Risk Committee',
      decidedAt: entry.decidedAt ?? new Date().toISOString(),
      notes: entry.notes ?? '',
    }

    await createDecisionRecord({
      ...nextEntry,
    })

    setDecisionLogs((current) => sortItemsByDateDesc([...current, nextEntry], 'decidedAt'))
    return true
  }

  const addRiskActivity = async (riskId, event) => {
    const nextEvent = {
      id: event.id ?? `local-audit-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      riskId,
      ...event,
      by: event.by ?? currentUser?.name ?? 'System',
      at: event.at ?? new Date().toISOString(),
    }

    const createdActivity = await createActivityRecord(riskId, nextEvent)
    const resolvedActivity = resolveRiskAuditEvent(riskId, createdActivity) ?? nextEvent
    appendAuditEntryToRisk(riskId, resolvedActivity)
    return true
  }

  const addMitigationAction = async (action) => {
    const nextAction = {
      id: action.id ?? `local-mitigation-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      riskId: action.riskId,
      title: action.title,
      owner: action.owner,
      createdBy:
        action.createdBy ??
        currentUser?.username ??
        currentUser?.email ??
        currentUser?.id ??
        currentUser?.name ??
        '',
      completedBy: action.completedBy ?? '',
      completedAt: action.completedAt ?? '',
      dueDate: action.dueDate,
      status: action.status ?? 'Not Started',
      notes: action.notes ?? '',
      createdAt: action.createdAt ?? new Date().toISOString(),
      updatedAt: action.updatedAt ?? new Date().toISOString(),
    }

    const createdAction = await createMitigationRecord(nextAction)
    const persistedAction =
      createdAction && createdAction.id !== null && createdAction.id !== undefined && createdAction.id !== ''
        ? {
            ...nextAction,
            ...createdAction,
          }
        : nextAction

    setMitigationActions((current) => sortItemsByDateAsc([...current, persistedAction], 'createdAt'))
    await scheduleBackendSync()
    return true
  }

  const updateMitigationAction = async (actionId, patch, { useStaffEndpoint = false } = {}) => {
    const currentAction = mitigationActions.find((action) => action.id === actionId)
    if (!currentAction) {
      throw new Error('Mitigation action not found')
    }

    const persistedAction = await updateMitigationRecord(actionId, {
      ...currentAction,
      ...patch,
    }, { useStaffEndpoint })

    setMitigationActions((current) =>
      sortItemsByDateAsc(
        current.map((action) =>
          String(action.id) === String(actionId)
            ? {
                ...action,
                ...patch,
                ...persistedAction,
                updatedAt: new Date().toISOString(),
              }
            : action,
        ),
        'createdAt',
      ),
    )

    await scheduleBackendSync()
    return true
  }

  const createDepartment = async (name) => {
    const trimmed = name.trim()
    if (!trimmed) {
      throw new Error('Department name is required')
    }

    const created = await createDepartmentRecord(trimmed)
    await scheduleBackendSync()
    return created
  }

  const updateDepartment = async (item, name) => {
    const trimmed = name.trim()
    if (!trimmed) {
      throw new Error('Department name is required')
    }
    if (!hasPersistentReferenceId(item)) {
      throw new Error('This department cannot be edited until backend returns a stable id in list responses')
    }

    await updateDepartmentRecord(item.id, trimmed)
    await scheduleBackendSync()
    return true
  }

  const deleteDepartment = async (item) => {
    if (!hasPersistentReferenceId(item)) {
      throw new Error('This department cannot be deleted until backend returns a stable id in list responses')
    }

    await deleteDepartmentRecord(item.id)
    await scheduleBackendSync()
    return true
  }

  const createCategory = async (name) => {
    const trimmed = name.trim()
    if (!trimmed) {
      throw new Error('Category name is required')
    }

    const created = await createCategoryRecord(trimmed)
    await scheduleBackendSync()
    return created
  }

  const updateCategory = async (item, name) => {
    const trimmed = name.trim()
    if (!trimmed) {
      throw new Error('Category name is required')
    }
    if (!hasPersistentReferenceId(item)) {
      throw new Error('This category cannot be edited until backend returns a stable id in list responses')
    }

    await updateCategoryRecord(item.id, trimmed)
    await scheduleBackendSync()
    return true
  }

  const deleteCategory = async (item) => {
    if (!hasPersistentReferenceId(item)) {
      throw new Error('This category cannot be deleted until backend returns a stable id in list responses')
    }

    await deleteCategoryRecord(item.id)
    await scheduleBackendSync()
    return true
  }

  const scopedRisks = useMemo(() => {
    if (!currentUser) {
      return []
    }
    return risks.filter((risk) => canViewRisk(currentUser, risk, directoryUsers))
  }, [currentUser, directoryUsers, risks])

  const filteredRisks = useMemo(
    () => applyGlobalRiskFilters(scopedRisks, globalFilters),
    [globalFilters, scopedRisks],
  )

  const notifications = useMemo(() => {
    if (!currentUser) {
      return []
    }

    const readMap = getNotificationReadMap(notificationReads, currentUser)
    const isDirector = hasAccessRole(currentUser, 'director')
    const canSeeMitigationPrompts = hasAccessRole(currentUser, 'risk') || hasAccessRole(currentUser, 'committee')
    const normalizedUserDepartment = normalizeDepartmentName(currentUser.department)
    const activeMitigationStatuses = new Set([
      'Accepted for Mitigation',
      'Additional Mitigation Required',
    ])
    const riskHasMitigationMap = new Map()
    const explicitNotificationKeys = new Set()
    const explicitNotifications = []
    const directorDerivedNotifications = []
    const mitigationPromptNotifications = []

    for (const action of mitigationActions) {
      const riskId = String(action?.riskId || '')
      if (!riskId) {
        continue
      }
      riskHasMitigationMap.set(riskId, (riskHasMitigationMap.get(riskId) || 0) + 1)
    }

    for (const risk of risks) {
      const riskId = String(risk?.id || '')
      if (!riskId) {
        continue
      }

      const riskTitle = risk.title
      const riskAudit = Array.isArray(risk.audit) ? risk.audit : []
      let directorSourceItem = null

      for (const item of riskAudit) {
        const notificationDiff = item?.diff?.notification
        if (notificationDiff && matchesNotificationTarget(notificationDiff, currentUser)) {
          const notificationId = String(notificationDiff.id ?? `notification:${item.id}`)
          explicitNotificationKeys.add(`${riskId}|${item?.at || ''}`)
          explicitNotifications.push({
            id: notificationId,
            riskId,
            riskTitle,
            at: item.at,
            title: notificationDiff.title ?? item.title ?? 'Notification',
            message: notificationDiff.message ?? item.notes ?? '',
            read: Boolean(readMap[notificationId]),
          })
        }

        if (
          !isDirector ||
          !activeMitigationStatuses.has(item?.diff?.workflowStatus) ||
          normalizeDepartmentName(item?.diff?.mitigationDepartment) !== normalizedUserDepartment
        ) {
          continue
        }

        const candidateAt = new Date(item?.at || 0).getTime()
        if (Number.isNaN(candidateAt)) {
          continue
        }
        directorSourceItem = item
        break
      }

      if (
        isDirector &&
        activeMitigationStatuses.has(risk.status) &&
        riskHasMitigationMap.has(riskId) === false &&
        normalizedUserDepartment &&
        normalizeDepartmentName(risk.mitigationDepartment) === normalizedUserDepartment &&
        directorSourceItem
      ) {
        const explicitKey = `${riskId}|${directorSourceItem.at || ''}`
        if (!explicitNotificationKeys.has(explicitKey)) {
          const derivedNotificationId = `derived-notification:${directorSourceItem.id}`
          directorDerivedNotifications.push({
            id: derivedNotificationId,
            riskId,
            riskTitle,
            at: directorSourceItem.at,
            title: directorSourceItem.title || 'Risk assigned to your department',
            message:
              directorSourceItem.notes ||
              `${risk.id} was assigned to ${risk.mitigationDepartment} for mitigation handling.`,
            read: Boolean(readMap[derivedNotificationId]),
          })
        }
      }

      if (
        canSeeMitigationPrompts &&
        activeMitigationStatuses.has(risk.status) &&
        !riskHasMitigationMap.has(riskId)
      ) {
        const derivedNotificationId = `derived-mitigation-plan:${risk.id}:${risk.status}`
        mitigationPromptNotifications.push({
          id: derivedNotificationId,
          riskId,
          riskTitle,
          at: risk.lastReviewedAt || risk.updatedAt || risk.createdAt || new Date().toISOString(),
          title: 'Add mitigation actions',
          message: `${risk.id} moved to ${risk.status}. Consider adding mitigation actions for this risk.`,
          read: Boolean(readMap[derivedNotificationId]),
        })
      }
    }

    const mergedRealtimeNotifications = realtimeNotifications
      .map((notification) => ({
        ...notification,
        riskTitle:
          notification.riskTitle ||
          riskByIdMap.get(String(notification.riskId))?.title ||
          '',
      }))

    return mergeNotificationLists(
      explicitNotifications,
      directorDerivedNotifications,
      mitigationPromptNotifications,
      mergedRealtimeNotifications,
    )
      .map((notification) => ({
        ...notification,
        read: Boolean(readMap[String(notification.id)]),
      }))
      .sort((left, right) => new Date(right.at || 0).getTime() - new Date(left.at || 0).getTime())
  }, [currentUser, mitigationActions, notificationReads, realtimeNotifications, risks, riskByIdMap])

  const unreadNotificationCount = useMemo(
    () => notifications.filter((item) => !item.read).length,
    [notifications],
  )

  const markNotificationRead = (notificationId) => {
    const readKey = getPrimaryNotificationReadUserKey(currentUser)
    if (!readKey || !notificationId) {
      return
    }

    setNotificationReads((current) => ({
      ...current,
      [readKey]: {
        ...getNotificationReadMap(current, currentUser),
        [notificationId]: true,
      },
    }))
  }

  const markAllNotificationsRead = () => {
    const readKey = getPrimaryNotificationReadUserKey(currentUser)
    if (!readKey || !notifications.length) {
      return
    }

    const nextReads = notifications.reduce(
      (accumulator, item) => ({
        ...accumulator,
        [item.id]: true,
      }),
      {},
    )

    setNotificationReads((current) => ({
      ...current,
      [readKey]: {
        ...getNotificationReadMap(current, currentUser),
        ...nextReads,
      },
    }))
  }

  const value = useMemo(
    () => ({
      currentUser,
      risks,
      scopedRisks,
      filteredRisks,
      mitigationActions,
      decisionLogs,
      globalFilters,
      theme,
      toasts,
      isSidebarOpen,
      departments,
      departmentItems,
      categories,
      categoryItems,
      statuses,
      queueStatuses,
      users: directoryUsers,
      isBackendConnected,
      isBackendLoading,
      backendError,
      notifications,
      unreadNotificationCount,
      setGlobalFilters,
      clearGlobalFilters,
      addRisk,
      updateRisk,
      addDecision,
      addRiskActivity,
      subscribeToRiskActivity,
      addMitigationAction,
      updateMitigationAction,
      createDepartment,
      updateDepartment,
      deleteDepartment,
      createCategory,
      updateCategory,
      deleteCategory,
      addToast,
      dismissToast,
      markNotificationRead,
      markAllNotificationsRead,
      runWithDeferredSync,
      setTheme,
      setIsSidebarOpen,
      openSidebar: () => setIsSidebarOpen(true),
    }),
    [
      currentUser,
      risks,
      scopedRisks,
      filteredRisks,
      mitigationActions,
      decisionLogs,
      globalFilters,
      theme,
      toasts,
      isSidebarOpen,
      departments,
      departmentItems,
      categories,
      categoryItems,
      directoryUsers,
      isBackendConnected,
      isBackendLoading,
      backendError,
      notifications,
      unreadNotificationCount,
      setGlobalFilters,
      clearGlobalFilters,
      addRisk,
      updateRisk,
      addDecision,
      addRiskActivity,
      subscribeToRiskActivity,
      addMitigationAction,
      updateMitigationAction,
      createDepartment,
      updateDepartment,
      deleteDepartment,
      createCategory,
      updateCategory,
      deleteCategory,
      addToast,
      dismissToast,
      markNotificationRead,
      markAllNotificationsRead,
      runWithDeferredSync,
      setTheme,
      setIsSidebarOpen,
    ],
  )

  return <ErmContext.Provider value={value}>{children}</ErmContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useErm() {
  const context = useContext(ErmContext)
  if (!context) {
    throw new Error('useErm must be used within ErmProvider')
  }
  return context
}
