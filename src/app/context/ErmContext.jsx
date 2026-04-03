import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
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
import { sameDepartment } from '../../lib/departments'
import { loadFromStorage, saveToStorage } from '../../lib/storage'

const STORAGE_KEYS = {
  globalFilters: 'erm_global_filters_v3',
  theme: 'erm_theme_v1',
  notificationReads: 'erm_notification_reads_v1',
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

function matchesNotificationTarget(notification, user) {
  if (!notification || !user) {
    return false
  }

  if (notification.targetUserId && notification.targetUserId === user.id) {
    return true
  }

  if (notification.targetUserName && notification.targetUserName === user.name) {
    return true
  }

  if (notification.targetDepartment && !sameDepartment(notification.targetDepartment, user.department)) {
    return false
  }

  if (notification.targetRole && notification.targetRole !== user.accessRole) {
    return false
  }

  return Boolean(notification.targetDepartment || notification.targetRole)
}

function getGlobalFiltersStorageKey(userId) {
  return `${STORAGE_KEYS.globalFilters}:${userId ?? 'guest'}`
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
  const [toasts, setToasts] = useState([])
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [sidebarSide, setSidebarSide] = useState('left')
  const [isBackendConnected, setIsBackendConnected] = useState(false)
  const [isBackendLoading, setIsBackendLoading] = useState(false)
  const [backendError, setBackendError] = useState('')
  const syncBatchDepthRef = useRef(0)
  const pendingSyncRef = useRef(false)
  const inflightSyncRef = useRef(null)

  const departments = useMemo(() => departmentItems.map((item) => item.name), [departmentItems])
  const categories = useMemo(() => categoryItems.map((item) => item.name), [categoryItems])

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

  const applyDataset = (dataset) => {
    setRisks(dataset.risks)
    setMitigationActions(dataset.mitigationActions)
    setDecisionLogs(dataset.decisionLogs)
    setDepartmentItems(sortReferenceItems(dataset.departmentItems))
    setCategoryItems(sortReferenceItems(dataset.categoryItems))
    setGlobalFiltersState((current) =>
      normalizeGlobalFilters(current, dataset.departments),
    )
    setIsBackendConnected(true)
    setBackendError('')
  }

  const syncFromBackend = async ({ force = false } = {}) => {
    if (!force && inflightSyncRef.current) {
      return inflightSyncRef.current
    }

    const syncPromise = (async () => {
      setIsBackendLoading(true)
      try {
        const dataset = await loadErmDataset()
        applyDataset(dataset)
        return dataset
      } catch (error) {
        setIsBackendConnected(false)
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
  }

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
        await syncFromBackend({ force: true })
      }
    }
  }

  useEffect(() => {
    let active = true

    if (!currentUser?.id) {
      setRisks([])
      setMitigationActions([])
      setDecisionLogs([])
      setDepartmentItems([])
      setCategoryItems([])
      setIsBackendConnected(false)
      setIsBackendLoading(false)
      setBackendError('')
      return () => {
        active = false
      }
    }

    const loadInitialData = async () => {
      try {
        await syncFromBackend({ force: true })
        if (!active) {
          return
        }
      } catch (error) {
        if (!active) {
          return
        }
        setRisks([])
        setMitigationActions([])
        setDecisionLogs([])
        setDepartmentItems([])
        setCategoryItems([])
        setGlobalFiltersState(defaultGlobalFilters)
        setIsBackendConnected(false)
        setBackendError(error instanceof Error ? error.message : 'Unable to load data from backend.')
        addToast({
          type: 'error',
          title: 'Backend unavailable',
          message: error instanceof Error ? error.message : 'Unable to load data from backend.',
        })
      }
    }

    void loadInitialData()

    return () => {
      active = false
    }
  }, [currentUser?.id])

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
  }, [currentUser?.id])

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

  const appendAuditEntryToRisk = (riskId, event) => {
    if (!riskId || !event) {
      return
    }

    const nextAuditEntry = {
      id: event.id ?? `local-audit-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      riskId,
      type: event.type ?? 'update',
      title: event.title ?? 'Risk updated',
      notes: event.notes ?? '',
      by: event.by ?? currentUser?.name ?? 'System',
      at: event.at ?? new Date().toISOString(),
      diff: event.diff ?? null,
    }

    setRisks((current) =>
      current.map((risk) =>
        String(risk.id) === String(riskId)
          ? {
              ...risk,
              audit: sortItemsByDateDesc([...(Array.isArray(risk.audit) ? risk.audit : []), nextAuditEntry], 'at'),
            }
          : risk,
      ),
    )
  }

  const addRisk = async (newRisk) => {
    const createdAt = new Date().toISOString()
    const owner = newRisk.owner?.trim() || currentUser?.role || currentUser?.name || 'Risk Owner'
    const responsible = newRisk.responsible?.trim() || currentUser?.name || currentUser?.role || 'Unassigned'
    const payload = {
      ...newRisk,
      owner,
      responsible,
      lastReviewedAt: newRisk.lastReviewedAt ?? createdAt,
    }

    await createRiskRecord(payload, departmentItems, categoryItems)
    const synced = await scheduleBackendSync()
    const createdRisk = findNewestMatchingRisk(synced.risks, payload)

    if (!createdRisk?.id) {
      return createdRisk ?? null
    }

    await createActivityRecord(createdRisk.id, {
      type: 'create',
      title: 'Risk created',
      notes: `Status set to ${payload.status}`,
      by: currentUser?.name ?? payload.owner ?? 'System',
      at: createdAt,
      diff: {
        workflowStatus: payload.status,
      },
    })

    const refreshed = await scheduleBackendSync({ force: true })
    return findNewestMatchingRisk(refreshed.risks, payload) ?? createdRisk
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

    if (auditEvent) {
      await createActivityRecord(riskId, {
        ...auditEvent,
        by: auditEvent.by ?? currentUser?.name ?? 'System',
      })
      appendAuditEntryToRisk(riskId, auditEvent)
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

    await createActivityRecord(riskId, {
      ...nextEvent,
    })

    appendAuditEntryToRisk(riskId, nextEvent)
    return true
  }

  const addMitigationAction = async (action) => {
    const nextAction = {
      id: action.id ?? `local-mitigation-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      riskId: action.riskId,
      title: action.title,
      owner: action.owner,
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

    setMitigationActions((current) => sortItemsByDateDesc([...current, persistedAction], 'updatedAt'))
    await scheduleBackendSync()
    return true
  }

  const updateMitigationAction = async (actionId, patch, { useStaffEndpoint = false } = {}) => {
    const currentAction = mitigationActions.find((action) => action.id === actionId)
    if (!currentAction) {
      throw new Error('Mitigation action not found')
    }

    await updateMitigationRecord(actionId, {
      ...currentAction,
      ...patch,
    }, { useStaffEndpoint })

    setMitigationActions((current) =>
      sortItemsByDateDesc(
        current.map((action) =>
          String(action.id) === String(actionId)
            ? {
                ...action,
                ...patch,
                updatedAt: new Date().toISOString(),
              }
            : action,
        ),
        'updatedAt',
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

    const readMap = notificationReads?.[currentUser.id] ?? {}
    const explicitNotifications = risks
      .flatMap((risk) =>
        (Array.isArray(risk.audit) ? risk.audit : [])
          .filter((item) => matchesNotificationTarget(item?.diff?.notification, currentUser))
          .map((item) => {
            const notification = item?.diff?.notification ?? {}
            const id = String(notification.id ?? `notification:${item.id}`)
            return {
              id,
              riskId: risk.id,
              riskTitle: risk.title,
              at: item.at,
              title: notification.title ?? item.title ?? 'Notification',
              message: notification.message ?? item.notes ?? '',
              read: Boolean(readMap[id]),
            }
          }),
      )
    const derivedDirectorNotifications =
      hasAccessRole(currentUser, 'director')
        ? risks
            .map((risk) => {
              if (
                !risk?.mitigationDepartment ||
                !sameDepartment(risk.mitigationDepartment, currentUser.department) ||
                !['Accepted for Mitigation', 'Additional Mitigation Required'].includes(risk.status)
              ) {
                return null
              }

              const sourceItem = [...(Array.isArray(risk.audit) ? risk.audit : [])]
                .sort((left, right) => new Date(right.at || 0).getTime() - new Date(left.at || 0).getTime())
                .find(
                  (item) =>
                    sameDepartment(item?.diff?.mitigationDepartment, currentUser.department) &&
                    ['Accepted for Mitigation', 'Additional Mitigation Required'].includes(
                      item?.diff?.workflowStatus,
                    ),
                )

              if (!sourceItem) {
                return null
              }

              const hasExplicitNotification = explicitNotifications.some(
                (item) => String(item.riskId) === String(risk.id) && item.at === sourceItem.at,
              )

              if (hasExplicitNotification) {
                return null
              }

              const id = `derived-notification:${sourceItem.id}`
              return {
                id,
                riskId: risk.id,
                riskTitle: risk.title,
                at: sourceItem.at,
                title: sourceItem.title || 'Risk assigned to your department',
                message:
                  sourceItem.notes ||
                  `${risk.id} was assigned to ${risk.mitigationDepartment} for mitigation handling.`,
                read: Boolean(readMap[id]),
              }
            })
            .filter(Boolean)
        : []

    const derivedMitigationPromptNotifications =
      (hasAccessRole(currentUser, 'risk') || hasAccessRole(currentUser, 'committee'))
        ? risks
            .map((risk) => {
              if (!['Accepted for Mitigation', 'Additional Mitigation Required'].includes(risk.status)) {
                return null
              }

              const relatedActions = mitigationActions.filter(
                (action) => String(action.riskId) === String(risk.id),
              )

              if (relatedActions.length) {
                return null
              }

              const id = `derived-mitigation-plan:${risk.id}:${risk.status}`
              return {
                id,
                riskId: risk.id,
                riskTitle: risk.title,
                at: risk.lastReviewedAt || risk.updatedAt || risk.createdAt || new Date().toISOString(),
                title: 'Add mitigation actions',
                message: `${risk.id} moved to ${risk.status}. Consider adding mitigation actions for this risk.`,
                read: Boolean(readMap[id]),
              }
            })
            .filter(Boolean)
        : []

    return [...explicitNotifications, ...derivedDirectorNotifications, ...derivedMitigationPromptNotifications]
      .sort((left, right) => new Date(right.at || 0).getTime() - new Date(left.at || 0).getTime())
  }, [currentUser, mitigationActions, notificationReads, risks])

  const unreadNotificationCount = useMemo(
    () => notifications.filter((item) => !item.read).length,
    [notifications],
  )

  const markNotificationRead = (notificationId) => {
    if (!currentUser?.id || !notificationId) {
      return
    }

    setNotificationReads((current) => ({
      ...current,
      [currentUser.id]: {
        ...(current?.[currentUser.id] ?? {}),
        [notificationId]: true,
      },
    }))
  }

  const markAllNotificationsRead = () => {
    if (!currentUser?.id || !notifications.length) {
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
      [currentUser.id]: {
        ...(current?.[currentUser.id] ?? {}),
        ...nextReads,
      },
    }))
  }

  const value = {
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
    sidebarSide,
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
    openSidebar: (side = 'left') => {
      setSidebarSide(side)
      setIsSidebarOpen(true)
    },
  }

  return <ErmContext.Provider value={value}>{children}</ErmContext.Provider>
}

export function useErm() {
  const context = useContext(ErmContext)
  if (!context) {
    throw new Error('useErm must be used within ErmProvider')
  }
  return context
}
