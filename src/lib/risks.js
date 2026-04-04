export function getRiskReference(risk) {
  if (!risk) {
    return ''
  }

  return String(
    risk.riskNumber ??
      risk.risk_number ??
      risk.referenceNumber ??
      risk.riskId ??
      risk.id ??
      '',
  )
}
