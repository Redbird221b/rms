const DEPARTMENT_ALIASES = {
  Treasury: [
    'treasury',
    'казначейство',
    'казначейский департамент',
  ],
  'Retail Banking': [
    'retail banking',
    'розничный бизнес',
    'розничный департамент',
  ],
  'Corporate Banking': [
    'corporate banking',
    'корпоративный бизнес',
    'корпоративный департамент',
  ],
  'IT & Security': [
    'it & security',
    'it and security',
    'ит и безопасность',
    'ит департамент',
    'департамент ит и безопасности',
  ],
  Compliance: [
    'compliance',
    'комплаенс',
    'департамент комплаенс',
  ],
  Operations: [
    'operations',
    'operations department',
    'операции',
    'операционный департамент',
    'операционный отдел',
    'департамент операций',
  ],
  'Human Resources': [
    'human resources',
    'hr',
    'кадры',
    'департамент hr',
    'департамент персонала',
  ],
  Procurement: [
    'procurement',
    'закупки',
    'департамент закупок',
  ],
}

function sanitizeDepartmentName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/["'`’]/g, '')
    .replace(/&/g, 'and')
    .replace(/\s+/g, ' ')
}

export function normalizeDepartmentName(value) {
  const normalized = sanitizeDepartmentName(value)
  if (!normalized) {
    return ''
  }

  for (const [canonicalName, aliases] of Object.entries(DEPARTMENT_ALIASES)) {
    if (aliases.some((alias) => sanitizeDepartmentName(alias) === normalized)) {
      return canonicalName
    }
  }

  return String(value || '').trim()
}

export function sameDepartment(left, right) {
  const normalizedLeft = normalizeDepartmentName(left)
  const normalizedRight = normalizeDepartmentName(right)

  if (!normalizedLeft || !normalizedRight) {
    return false
  }

  return normalizedLeft === normalizedRight
}
