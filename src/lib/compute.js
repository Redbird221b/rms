const safeNumber = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export const severityThresholds = [
  { label: 'Low', min: 0, max: 700_000_000 },
  { label: 'Medium', min: 700_000_000, max: 2_000_000_000 },
  { label: 'High', min: 2_000_000_000, max: 5_000_000_000 },
  { label: 'Critical', min: 5_000_000_000, max: Number.POSITIVE_INFINITY },
]

const impactBands = [
  { band: 1, min: 0, max: 1_000_000_000 },
  { band: 2, min: 1_000_000_000, max: 2_500_000_000 },
  { band: 3, min: 2_500_000_000, max: 6_000_000_000 },
  { band: 4, min: 6_000_000_000, max: 10_000_000_000 },
  { band: 5, min: 10_000_000_000, max: Number.POSITIVE_INFINITY },
]

export function clampProbability(probability) {
  return Math.min(0.99, Math.max(0.01, safeNumber(probability)))
}

export function calculateExpectedLoss(probability, impactMostLikely) {
  return clampProbability(probability) * safeNumber(impactMostLikely)
}

export function getSeverityByLoss(expectedLoss) {
  return severityThresholds.find(
    (threshold) => expectedLoss >= threshold.min && expectedLoss < threshold.max,
  )?.label
}

export function getImpactBand(impactMostLikely) {
  return impactBands.find((band) => impactMostLikely >= band.min && impactMostLikely < band.max)?.band ?? 1
}

export function getProbabilityBand(probability) {
  return Math.max(1, Math.min(5, Math.ceil(clampProbability(probability) * 5)))
}

export function isOverdue(risk) {
  if (!risk?.dueDate) {
    return false
  }
  const now = new Date().setHours(0, 0, 0, 0)
  const due = new Date(risk.dueDate).setHours(0, 0, 0, 0)
  return due < now && !['Closed', 'Rejected'].includes(risk.status)
}

export function recalculateRisk(risk) {
  const expectedLoss = calculateExpectedLoss(risk.probability, risk.impactMostLikely)
  const inherentScore = getProbabilityBand(risk.probability) * getImpactBand(risk.impactMostLikely)
  const residualScore = risk.residualScore
    ? Math.max(1, Math.min(25, safeNumber(risk.residualScore)))
    : Math.max(1, inherentScore - 3)

  return {
    ...risk,
    probability: clampProbability(risk.probability),
    impactMin: safeNumber(risk.impactMin),
    impactMostLikely: safeNumber(risk.impactMostLikely),
    impactMax: safeNumber(risk.impactMax),
    expectedLoss,
    inherentScore,
    residualScore,
    severity: getSeverityByLoss(expectedLoss),
  }
}

const matchesSearch = (risk, term) => {
  if (!term) {
    return true
  }
  const lower = term.toLowerCase()
  return [risk.title, risk.owner, risk.responsible, ...(risk.tags ?? [])]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(lower))
}

function parseDateStart(value) {
  if (!value || typeof value !== 'string') {
    return null
  }
  const date = new Date(`${value}T00:00:00`)
  const timestamp = date.getTime()
  return Number.isNaN(timestamp) ? null : timestamp
}

function parseDateEnd(value) {
  if (!value || typeof value !== 'string') {
    return null
  }
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  date.setHours(23, 59, 59, 999)
  return date.getTime()
}

export function applyGlobalRiskFilters(risks, filters) {
  return risks.filter((risk) => {
    const createdAtTs = new Date(risk.createdAt).getTime()
    const updatedAtTs = new Date(risk.updatedAt).getTime()
    const riskTimestamp = Number.isNaN(createdAtTs) ? updatedAtTs : createdAtTs
    const fromTs = parseDateStart(filters.dateFrom)
    const toTs = parseDateEnd(filters.dateTo)

    if (filters.department !== 'All' && risk.department !== filters.department) {
      return false
    }
    if (filters.status !== 'All' && risk.status !== filters.status) {
      return false
    }
    if (filters.severity && filters.severity !== 'All' && risk.severity !== filters.severity) {
      return false
    }
    if (fromTs !== null && riskTimestamp < fromTs) {
      return false
    }
    if (toTs !== null && riskTimestamp > toTs) {
      return false
    }
    return matchesSearch(risk, filters.search)
  })
}

export function sortRisksByExpectedLoss(risks, direction = 'desc') {
  const copy = [...risks]
  copy.sort((a, b) => {
    if (direction === 'asc') {
      return a.expectedLoss - b.expectedLoss
    }
    return b.expectedLoss - a.expectedLoss
  })
  return copy
}

export function buildHeatmapMatrix(risks) {
  const matrix = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => 0))
  risks.forEach((risk) => {
    const probabilityBand = getProbabilityBand(risk.probability)
    const impactBand = getImpactBand(risk.impactMostLikely)
    matrix[probabilityBand - 1][impactBand - 1] += 1
  })
  return matrix
}

export function buildExpectedLossTrend(risks, monthCount = 12) {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() - (monthCount - 1), 1)
  const language =
    typeof window !== 'undefined' ? window.localStorage.getItem('erm_language_v1') ?? 'ru' : 'ru'
  const locale =
    language === 'ru' ? 'ru-RU' : language === 'uz' ? 'uz-UZ' : 'en-US'

  const buckets = Array.from({ length: monthCount }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth() + index, 1)
    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      label: date.toLocaleDateString(locale, { month: 'short' }),
      expectedLoss: 0,
    }
  })

  const mapByKey = new Map(buckets.map((bucket) => [bucket.key, bucket]))

  risks.forEach((risk) => {
    const date = new Date(risk.createdAt)
    if (Number.isNaN(date.getTime())) {
      return
    }
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const bucket = mapByKey.get(key)
    if (bucket) {
      bucket.expectedLoss += risk.expectedLoss
    }
  })

  return buckets
}
