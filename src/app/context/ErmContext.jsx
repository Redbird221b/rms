import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  categories,
  departments,
  queueStatuses,
  seedData,
  statuses,
  users,
} from '../../data/seed'
import { applyGlobalRiskFilters, recalculateRisk } from '../../lib/compute'
import { loadFromStorage, saveToStorage } from '../../lib/storage'

const STORAGE_KEYS = {
  risks: 'erm_risks_v2',
  mitigationActions: 'erm_mitigation_actions_v2',
  decisionLogs: 'erm_decision_logs_v2',
  globalFilters: 'erm_global_filters_v2',
  theme: 'erm_theme_v1',
}

const defaultGlobalFilters = {
  search: '',
  dateFrom: '',
  dateTo: '',
  department: 'All',
  status: 'All',
  severity: 'All',
}

const severityFilters = ['All', 'Low', 'Medium', 'High', 'Critical']

function isValidDateInput(value) {
  if (typeof value !== 'string' || !value) {
    return false
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }
  return !Number.isNaN(new Date(`${value}T00:00:00`).getTime())
}

const ErmContext = createContext(null)

function initList(key, fallback) {
  const persisted = loadFromStorage(key, fallback)
  if (!Array.isArray(persisted) || persisted.length === 0) {
    return fallback
  }
  return persisted
}

function normalizeGlobalFilters(raw) {
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
      typeof raw.department === 'string' && departments.includes(raw.department)
        ? raw.department
        : 'All',
    status: typeof raw.status === 'string' && statuses.includes(raw.status) ? raw.status : 'All',
    severity:
      typeof raw.severity === 'string' && severityFilters.includes(raw.severity)
        ? raw.severity
        : 'All',
  }
  if (normalized.dateFrom && normalized.dateTo) {
    const fromTs = new Date(`${normalized.dateFrom}T00:00:00`).getTime()
    const toTs = new Date(`${normalized.dateTo}T00:00:00`).getTime()
    if (fromTs > toTs) {
      normalized.dateFrom = ''
      normalized.dateTo = ''
    }
  }
  return normalized
}

function createAuditEvent(event = {}) {
  return {
    id: `AUD-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    type: event.type ?? 'update',
    title: event.title ?? 'Risk updated',
    notes: event.notes ?? '',
    by: event.by ?? 'System',
    at: event.at ?? new Date().toISOString(),
  }
}

export function ErmProvider({ children }) {
  const [risks, setRisks] = useState(() =>
    initList(STORAGE_KEYS.risks, seedData.risks).map(recalculateRisk),
  )
  const [mitigationActions, setMitigationActions] = useState(() =>
    initList(STORAGE_KEYS.mitigationActions, seedData.mitigationActions),
  )
  const [decisionLogs, setDecisionLogs] = useState(() =>
    initList(STORAGE_KEYS.decisionLogs, seedData.decisionLogs),
  )
  const [globalFilters, setGlobalFiltersState] = useState(() =>
    normalizeGlobalFilters(loadFromStorage(STORAGE_KEYS.globalFilters, defaultGlobalFilters)),
  )
  const [theme, setTheme] = useState(() => loadFromStorage(STORAGE_KEYS.theme, 'light'))
  const [toasts, setToasts] = useState([])
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.risks, risks)
  }, [risks])

  useEffect(() => {
    if (!risks.length && seedData.risks.length) {
      setRisks(seedData.risks.map(recalculateRisk))
    }
  }, [risks.length])

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.mitigationActions, mitigationActions)
  }, [mitigationActions])

  useEffect(() => {
    if (!mitigationActions.length && seedData.mitigationActions.length) {
      setMitigationActions(seedData.mitigationActions)
    }
  }, [mitigationActions.length])

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.decisionLogs, decisionLogs)
  }, [decisionLogs])

  useEffect(() => {
    if (!decisionLogs.length && seedData.decisionLogs.length) {
      setDecisionLogs(seedData.decisionLogs)
    }
  }, [decisionLogs.length])

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.globalFilters, globalFilters)
  }, [globalFilters])

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.theme, theme)
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [theme])

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

  const setGlobalFilters = (nextFilters) => {
    setGlobalFiltersState((current) =>
      normalizeGlobalFilters({
        ...current,
        ...nextFilters,
      }),
    )
  }

  const clearGlobalFilters = () => {
    setGlobalFiltersState(defaultGlobalFilters)
  }

  const addRisk = (newRisk) => {
    const createdAt = new Date().toISOString()
    const baseRisk = {
      ...newRisk,
      createdAt,
      updatedAt: createdAt,
      lastReviewedAt: newRisk.lastReviewedAt ?? createdAt,
      audit: [
        createAuditEvent({
          title: 'Risk created',
          type: 'create',
          by: newRisk.owner,
          notes: `Status set to ${newRisk.status}`,
          at: createdAt,
        }),
      ],
    }
    setRisks((current) => [recalculateRisk(baseRisk), ...current])
  }

  const updateRisk = (riskId, updates, auditEvent) => {
    setRisks((current) =>
      current.map((risk) => {
        if (risk.id !== riskId) {
          return risk
        }
        const patch = typeof updates === 'function' ? updates(risk) : updates
        const merged = recalculateRisk({
          ...risk,
          ...patch,
          updatedAt: new Date().toISOString(),
        })
        if (!auditEvent) {
          return merged
        }
        return {
          ...merged,
          audit: [createAuditEvent(auditEvent), ...(risk.audit ?? [])],
        }
      }),
    )
  }

  const addDecision = (entry) => {
    const nextEntry = {
      id: entry.id ?? `DEC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      decidedAt: entry.decidedAt ?? new Date().toISOString(),
      ...entry,
    }
    setDecisionLogs((current) => [nextEntry, ...current])
  }

  const addMitigationAction = (action) => {
    const nextAction = {
      id: action.id ?? `ACT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      ...action,
    }
    setMitigationActions((current) => [nextAction, ...current])
  }

  const updateMitigationAction = (actionId, patch) => {
    setMitigationActions((current) =>
      current.map((action) => {
        if (action.id !== actionId) {
          return action
        }
        return {
          ...action,
          ...patch,
        }
      }),
    )
  }

  const filteredRisks = useMemo(
    () => applyGlobalRiskFilters(risks, globalFilters),
    [risks, globalFilters],
  )

  const value = {
    risks,
    filteredRisks,
    mitigationActions,
    decisionLogs,
    globalFilters,
    theme,
    toasts,
    isSidebarOpen,
    departments,
    categories,
    statuses,
    queueStatuses,
    users,
    setGlobalFilters,
    clearGlobalFilters,
    addRisk,
    updateRisk,
    addDecision,
    addMitigationAction,
    updateMitigationAction,
    addToast,
    dismissToast,
    setTheme,
    setIsSidebarOpen,
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
