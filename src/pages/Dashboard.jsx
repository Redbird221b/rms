import { AlertTriangle, BadgeDollarSign, Clock3, ClipboardCheck } from 'lucide-react'
import { lazy, Suspense, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useErm } from '../app/context/ErmContext'
import { useI18n } from '../app/context/I18nContext'
import KpiCard from '../components/cards/KpiCard'
import EmptyState from '../components/common/EmptyState'
import SeverityBadge from '../components/common/SeverityBadge'
import StatusChip from '../components/common/StatusChip'
import { SkeletonCard } from '../components/common/Skeletons'
import { buildExpectedLossTrend, sortRisksByExpectedLoss } from '../lib/compute'
import { formatCompactCurrency, formatCurrency } from '../lib/format'
import { getRiskReference } from '../lib/risks'

const DepartmentRiskBarChart = lazy(() => import('../components/charts/DepartmentRiskBarChart'))
const ExpectedLossTrendChart = lazy(() => import('../components/charts/ExpectedLossTrendChart'))
const RiskHeatmap = lazy(() => import('../components/charts/RiskHeatmap'))

function ChartPanelFallback({ title }) {
  return (
    <div className="panel rounded-[22px] p-4">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      <div className="mt-3 h-64 animate-pulse rounded-[18px] bg-slate-100 dark:bg-[#17305B]" />
    </div>
  )
}

export default function Dashboard() {
  const { filteredRisks, mitigationActions, queueStatuses, decisionLogs, isBackendConnected, backendError } = useErm()
  const { t, tr } = useI18n()
  const [loading] = useState(false)
  const inactiveExposureStatuses = useMemo(() => new Set(['Closed', 'Risk Accepted', 'Rejected']), [])
  const exposureRisks = useMemo(
    () => filteredRisks.filter((risk) => !inactiveExposureStatuses.has(risk.status)),
    [filteredRisks, inactiveExposureStatuses],
  )

  const metrics = useMemo(() => {
    const totalExpectedLoss = exposureRisks.reduce((sum, risk) => sum + risk.expectedLoss, 0)
    const openRisks = exposureRisks.length
    const pendingReviews = filteredRisks.filter((risk) => queueStatuses.includes(risk.status)).length
    const overdueActions = mitigationActions.filter((action) => {
      if (['Pending Risk Review', 'Approved'].includes(action.status)) {
        return false
      }
      const dueDate = new Date(action.dueDate)
      return dueDate.getTime() < new Date().setHours(0, 0, 0, 0)
    }).length
    return { totalExpectedLoss, openRisks, pendingReviews, overdueActions }
  }, [exposureRisks, filteredRisks, mitigationActions, queueStatuses])

  const trendData = useMemo(() => buildExpectedLossTrend(exposureRisks), [exposureRisks])
  const departmentData = useMemo(() => {
    const map = exposureRisks.reduce((acc, risk) => {
      acc[risk.department] = (acc[risk.department] || 0) + 1
      return acc
    }, {})
    return Object.entries(map)
      .map(([department, count]) => ({ department, count }))
      .sort((a, b) => b.count - a.count)
  }, [exposureRisks])
  const topRisks = useMemo(() => sortRisksByExpectedLoss(exposureRisks).slice(0, 8), [exposureRisks])
  const queueSnapshot = useMemo(
    () =>
      sortRisksByExpectedLoss(
        filteredRisks.filter((risk) => queueStatuses.includes(risk.status)),
      ).slice(0, 6),
    [filteredRisks, queueStatuses],
  )
  const risksById = useMemo(
    () => new Map(filteredRisks.map((risk) => [String(risk.id), risk])),
    [filteredRisks],
  )
  const overdueActionItems = useMemo(() => {
    return mitigationActions
      .filter((action) => {
        if (['Pending Risk Review', 'Approved'].includes(action.status)) {
          return false
        }
        const dueDate = new Date(action.dueDate).getTime()
        return dueDate < new Date().setHours(0, 0, 0, 0)
      })
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 6)
      .map((action) => ({
        ...action,
        risk: risksById.get(String(action.riskId)),
      }))
  }, [mitigationActions, risksById])
  const recentDecisions = useMemo(
    () =>
      [...decisionLogs]
        .sort((a, b) => new Date(b.decidedAt).getTime() - new Date(a.decidedAt).getTime())
        .slice(0, 6)
        .map((entry) => ({
          ...entry,
          risk: risksById.get(String(entry.riskId)),
        })),
    [decisionLogs, risksById],
  )

  if (!isBackendConnected && !backendError) {
    return <section className="panel p-4 text-sm text-slate-500 dark:text-slate-400">{t('common.loadingBackendData')}</section>
  }

  if (!isBackendConnected && backendError) {
    return <EmptyState title={t('common.backendUnavailable')} description={backendError || t('common.backendUnavailableDesc')} />
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <KpiCard
              label={t('dashboard.totalExpectedLoss')}
              value={formatCurrency(metrics.totalExpectedLoss)}
              helper={t('dashboard.activeRisks', { count: exposureRisks.length })}
              icon={BadgeDollarSign}
            />
            <KpiCard
              label={t('dashboard.openRisks')}
              value={metrics.openRisks}
              helper={t('dashboard.openRisksHelper')}
              icon={AlertTriangle}
            />
            <KpiCard
              label={t('dashboard.pendingReviews')}
              value={metrics.pendingReviews}
              helper={t('dashboard.pendingHelper')}
              icon={ClipboardCheck}
            />
            <KpiCard
              label={t('dashboard.overdueActions')}
              value={metrics.overdueActions}
              helper={t('dashboard.overdueHelper')}
              icon={Clock3}
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <Suspense fallback={<ChartPanelFallback title={t('dashboard.chartHeatmap')} />}>
          <RiskHeatmap risks={exposureRisks} />
        </Suspense>
        <Suspense fallback={<ChartPanelFallback title={t('dashboard.chartTrend')} />}>
          <ExpectedLossTrendChart data={trendData} />
        </Suspense>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <div className="space-y-3 xl:col-span-2">
          <Suspense fallback={<ChartPanelFallback title={t('dashboard.chartDept')} />}>
            <DepartmentRiskBarChart data={departmentData} />
          </Suspense>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="panel rounded-[22px] p-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('dashboard.overdueMitigationActions')}</h3>
              <div className="mt-3 space-y-2">
                {overdueActionItems.length ? (
                  overdueActionItems.map((action) => (
                    <div
                      key={action.id}
                      className="rounded-lg border border-slate-200 px-3 py-2 dark:border-[#2F4878]"
                    >
                      <p className="break-words text-sm font-medium text-slate-900 dark:text-slate-100">{action.title}</p>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        {getRiskReference(action.risk)} · {t('dashboard.due')} {action.dueDate}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500 dark:text-slate-400">{t('dashboard.noOverdueActions')}</p>
                )}
              </div>
            </div>
            <div className="panel rounded-[22px] p-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('dashboard.recentDecisions')}</h3>
              <div className="mt-3 space-y-2">
                {recentDecisions.length ? (
                  recentDecisions.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-lg border border-slate-200 px-3 py-2 dark:border-[#2F4878]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="break-words text-sm font-medium text-slate-900 dark:text-slate-100">{tr('decisionType', entry.decisionType)}</p>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{getRiskReference(entry.risk) || entry.riskId}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        {entry.risk?.title || t('dashboard.riskRecord')} · {entry.decidedBy}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500 dark:text-slate-400">{t('dashboard.noRecentDecisions')}</p>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="panel rounded-[22px] p-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('dashboard.topRisks')}</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {t('dashboard.topRisksDesc')}
            </p>
          </div>
          <div className="mt-3 space-y-2">
            {topRisks.length ? (
              topRisks.map((risk) => (
                <Link
                  key={risk.id}
                  to={`/risks/${risk.id}`}
                  className="block rounded-lg border border-slate-200 px-3 py-2 transition-colors hover:bg-slate-50 dark:border-[#2F4878] dark:hover:bg-[#1A2F59]/70"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-medium text-slate-900 dark:text-slate-100">{risk.title}</p>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{tr('department', risk.department)}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {formatCompactCurrency(risk.expectedLoss)}
                      </p>
                      <div className="mt-1 flex items-center justify-end gap-1">
                        <SeverityBadge severity={risk.severity} />
                        <StatusChip status={risk.status} />
                      </div>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <p className="rounded-lg border border-dashed border-slate-200 px-3 py-2 text-sm text-slate-500 dark:border-[#2F4878] dark:text-slate-400">
                {t('dashboard.topRisksEmpty')}
              </p>
            )}
            <div className="rounded-lg border border-slate-200 px-3 py-2 dark:border-[#2F4878]">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {t('dashboard.queueSnapshot')}
              </p>
              <div className="mt-2 space-y-1.5">
                {queueSnapshot.length ? (
                  queueSnapshot.map((risk) => (
                    <div key={risk.id} className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs text-slate-600 dark:text-slate-300">{getRiskReference(risk)}</span>
                      <StatusChip status={risk.status} />
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t('dashboard.noPendingQueue')}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
