import { BadgeDollarSign, Building2, Clock3, LockKeyhole } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../app/context/AuthContext'
import { useErm } from '../app/context/ErmContext'
import { useI18n } from '../app/context/I18nContext'
import EmptyState from '../components/common/EmptyState'
import PageHeader from '../components/common/PageHeader'
import SeverityBadge from '../components/common/SeverityBadge'
import StatusChip from '../components/common/StatusChip'
import Tabs from '../components/common/Tabs'
import ActionModal from '../components/modals/ActionModal'
import DataTable from '../components/table/DataTable'
import { isOverdue, sortRisksByExpectedLoss } from '../lib/compute'
import { sameDepartment } from '../lib/departments'
import { formatCurrency, formatDate } from '../lib/format'
import { isAwaitingDecisionResponse } from '../lib/access'

const logDecisionOptions = ['Approve', 'Reject', 'Request Info', 'Accept Residual Risk']
const committeeReviewStatuses = ['Committee Review 1', 'Committee Review 2']

function getCommitteeDecisionOptions(risk) {
  if (risk?.status === 'Committee Review 2') {
    return ['Approve', 'Reject']
  }
  return ['Approve', 'Request Info', 'Accept Residual Risk']
}

function getCommitteeDecisionLabel(decision, risk, t, tr) {
  if (risk?.status === 'Committee Review 2') {
    if (decision === 'Approve') {
      return t('workflow.action.closeRisk')
    }
    if (decision === 'Reject') {
      return t('workflow.action.additionalMitigation')
    }
  }

  if (decision === 'Approve') {
    return t('workflow.action.sendToMitigation')
  }

  if (decision === 'Accept Residual Risk') {
    return t('workflow.action.acceptResidualRisk')
  }

  return tr('decisionType', decision)
}

function getAgendaReason(risk, topRiskIds, t) {
  if (risk?.status === 'Committee Review 2') {
    return t('committee.reason.stage2')
  }
  if (isOverdue(risk)) {
    return t('committee.reason.overdue')
  }
  if (topRiskIds.has(risk.id)) {
    return t('committee.reason.top')
  }
  return t('committee.reason.requested')
}

function getAgendaReasonTone(reason, t) {
  if (reason === t('committee.reason.stage2')) {
    return 'border-[#C9D7FF] bg-[#EEF3FF] text-[#1F469B] dark:border-[#4569A8] dark:bg-[#17315E] dark:text-[#D8E5FF]'
  }
  if (reason === t('committee.reason.overdue')) {
    return 'border-[#F4C9B7] bg-[#FFF1EA] text-[#B53700] dark:border-[#B95B34] dark:bg-[#3A241C] dark:text-[#FFD9CA]'
  }
  if (reason === t('committee.reason.top')) {
    return 'border-[#D7DCE7] bg-[#F6F8FC] text-[#475569] dark:border-[#3F5A89] dark:bg-[#13264A] dark:text-[#C9D8F7]'
  }
  return 'border-[#D7DCE7] bg-[#F6F8FC] text-[#475569] dark:border-[#3F5A89] dark:bg-[#13264A] dark:text-[#C9D8F7]'
}

export default function Committee() {
  const {
    risks,
    decisionLogs,
    departmentItems,
    users,
    addDecision,
    addRiskActivity,
    updateRisk,
    addToast,
    runWithDeferredSync,
    isBackendConnected,
    backendError,
  } = useErm()
  const { currentUser } = useAuth()
  const { t, tr } = useI18n()
  const [decisionType, setDecisionType] = useState('Approve')
  const [activeRisk, setActiveRisk] = useState(null)
  const [logFilter, setLogFilter] = useState('All')
  const [activeStageTab, setActiveStageTab] = useState('Committee Review 1')
  const [selectedDepartment, setSelectedDepartment] = useState('')

  const departmentOptions = useMemo(
    () =>
      (Array.isArray(departmentItems) ? departmentItems : [])
        .map((item) => (typeof item === 'string' ? item : item?.name))
        .filter(Boolean),
    [departmentItems],
  )

  const availableDecisionOptions = useMemo(
    () => getCommitteeDecisionOptions(activeRisk),
    [activeRisk],
  )

  const currentDecisionLabel = useMemo(
    () => getCommitteeDecisionLabel(decisionType, activeRisk, t, tr),
    [activeRisk, decisionType, t, tr],
  )

  const requiresMitigationDepartment =
    Boolean(activeRisk) &&
    (
      (activeRisk.status === 'Committee Review 1' && decisionType === 'Approve') ||
      (activeRisk.status === 'Committee Review 2' && decisionType === 'Reject')
    )

  useEffect(() => {
    if (!activeRisk) {
      setDecisionType('Approve')
      setSelectedDepartment('')
      return
    }

    const nextOptions = getCommitteeDecisionOptions(activeRisk)
    setDecisionType((current) => (nextOptions.includes(current) ? current : nextOptions[0]))
    setSelectedDepartment(activeRisk.mitigationDepartment || activeRisk.department || '')
  }, [activeRisk])

  const showErrorToast = (title, error) => {
    addToast({
      type: 'error',
      title,
      message: error.message,
    })
  }

  const agenda = useMemo(() => {
    const actionableRisks = risks.filter((risk) => committeeReviewStatuses.includes(risk.status))
    const topRiskIds = new Set(
      sortRisksByExpectedLoss(actionableRisks)
        .slice(0, 5)
        .map((risk) => risk.id),
    )

    return [...actionableRisks]
      .sort((left, right) => {
        const leftStageWeight = left.status === 'Committee Review 2' ? 0 : 1
        const rightStageWeight = right.status === 'Committee Review 2' ? 0 : 1
        if (leftStageWeight !== rightStageWeight) {
          return leftStageWeight - rightStageWeight
        }
        return right.expectedLoss - left.expectedLoss
      })
      .map((risk) => ({
        ...risk,
        reason: getAgendaReason(risk, topRiskIds, t),
        isActionLocked: isAwaitingDecisionResponse(risk, currentUser?.name),
      }))
  }, [currentUser?.name, risks, t])

  const agendaStats = useMemo(
    () => ({
      total: agenda.length,
      stageTwo: agenda.filter((risk) => risk.status === 'Committee Review 2').length,
      locked: agenda.filter((risk) => risk.isActionLocked).length,
    }),
    [agenda],
  )

  const stageTabs = useMemo(
    () => [
      { value: 'Committee Review 1', label: t('committee.stageTab1') },
      { value: 'Committee Review 2', label: t('committee.stageTab2') },
    ],
    [t],
  )

  const visibleAgenda = useMemo(
    () => agenda.filter((risk) => risk.status === activeStageTab),
    [activeStageTab, agenda],
  )

  const visibleLogs = useMemo(() => {
    if (logFilter === 'All') {
      return decisionLogs
    }
    return decisionLogs.filter((entry) => entry.decisionType === logFilter)
  }, [decisionLogs, logFilter])

  if (!isBackendConnected && !backendError) {
    return <section className="panel p-4 text-sm text-slate-500 dark:text-slate-400">Loading backend data...</section>
  }

  if (!isBackendConnected && backendError) {
    return <EmptyState title="Backend unavailable" description={backendError || 'Unable to load data from backend.'} />
  }

  const logColumns = [
    { key: 'id', label: t('committee.col.id'), sortable: true },
    {
      key: 'riskId',
      label: t('committee.col.risk'),
      sortable: true,
      render: (entry) => {
        const risk = risks.find((item) => item.id === entry.riskId)
        return (
          <div>
            <p className="font-medium text-slate-900 dark:text-slate-100">{entry.riskId}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{risk?.title || t('common.unknownRisk')}</p>
          </div>
        )
      },
    },
    { key: 'decisionType', label: t('committee.col.decision'), sortable: true, render: (entry) => tr('decisionType', entry.decisionType) },
    { key: 'decidedBy', label: t('committee.col.by'), sortable: true },
    { key: 'decidedAt', label: t('committee.col.date'), sortable: true, render: (entry) => formatDate(entry.decidedAt) },
    {
      key: 'notes',
      label: t('committee.col.notes'),
      render: (entry) => <p className="max-w-xs truncate text-xs text-slate-600 dark:text-slate-300">{entry.notes}</p>,
    },
  ]

  const applyDecision = async (comment) => {
    if (!activeRisk) {
      return
    }

    const now = new Date().toISOString()
    const decision = decisionType
    const actor = currentUser?.name ?? 'Risk Committee'
    const isStageTwo = activeRisk.status === 'Committee Review 2'
    const statusMap = isStageTwo
      ? {
          Approve: 'Closed',
          Reject: 'Additional Mitigation Required',
        }
      : {
          Approve: 'Accepted for Mitigation',
          'Request Info': 'Info Requested by Committee',
          'Accept Residual Risk': 'Risk Accepted',
        }
    const auditTitleByDecision = isStageTwo
      ? {
          Approve: t('audit.event.closed'),
          Reject: t('audit.event.additionalMitigation'),
        }
      : {
          Approve: t('audit.event.sentToMitigation'),
          'Request Info': t('audit.event.requestInfo'),
          'Accept Residual Risk': t('audit.event.acceptResidualRisk'),
        }
    const status = statusMap[decision] || activeRisk.status
    const mitigationDepartment = requiresMitigationDepartment ? selectedDepartment : activeRisk.mitigationDepartment
    const targetDirector =
      mitigationDepartment
        ? users.find(
            (user) =>
              user.accessRole === 'director' &&
              sameDepartment(user.department, mitigationDepartment),
          )
        : null
    const notification =
      requiresMitigationDepartment && targetDirector
        ? {
            targetUserId: targetDirector.id,
            targetRole: 'director',
            targetDepartment: mitigationDepartment,
            title: isStageTwo
              ? t('notification.additionalMitigationAssignedTitle')
              : t('notification.mitigationAssignedTitle'),
            message: isStageTwo
              ? t('notification.additionalMitigationAssignedDesc', {
                  riskId: activeRisk.id,
                  department: mitigationDepartment,
                })
              : t('notification.mitigationAssignedDesc', {
                  riskId: activeRisk.id,
                  department: mitigationDepartment,
                }),
          }
        : null

    try {
      await runWithDeferredSync(async () => {
        await addDecision({
          riskId: activeRisk.id,
          decisionType: decision,
          decidedBy: actor,
          decidedAt: now,
          notes: comment,
        })

        await updateRisk(
          activeRisk.id,
          {
            status,
            committee: { lastDecision: decision, lastDecisionAt: now },
            lastReviewedAt: now,
            mitigationDepartment,
            responsible: requiresMitigationDepartment ? '' : activeRisk.responsible,
          },
          {
            type: 'decision',
            title: auditTitleByDecision[decision] || `${t('committee.col.decision')}: ${currentDecisionLabel}`,
            notes: '',
            by: actor,
            diff: {
              workflowStatus: status,
              decisionType: decision,
              mitigationDepartment,
              responsible: requiresMitigationDepartment ? '' : activeRisk.responsible,
              notification,
            },
          },
        )

        await addRiskActivity(activeRisk.id, {
          type: 'comment',
          title: t('details.chatCommentTitle'),
          notes: comment,
          by: actor,
          at: new Date(new Date(now).getTime() + 1).toISOString(),
          diff: { messageKind: 'decision-comment', decisionType: decision },
        })
      })

      addToast({
        title: t('committee.toast.logged'),
        message: t('committee.toast.marked', { riskId: activeRisk.id, decision: currentDecisionLabel }),
        type: 'success',
      })
      setActiveRisk(null)
    } catch (error) {
      showErrorToast('Unable to record committee decision', error)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title={t('committee.title')} subtitle={t('committee.subtitle')} />

      <section className="panel overflow-hidden">
        <div className="border-b border-[#D9D9D9] bg-[linear-gradient(180deg,#FCFDFF_0%,#F6F8FC_100%)] px-4 py-4 dark:border-[#2F4878] dark:bg-[linear-gradient(180deg,#15294E_0%,#112241_100%)]">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('committee.agenda')}</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('committee.agendaSubtitle')}</p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 xl:min-w-[560px]">
              <div className="rounded-2xl border border-[#D9E2F2] bg-white/80 px-3 py-3 dark:border-[#365383] dark:bg-[#10203D]/90">
                <div className="flex items-center gap-2">
                  <BadgeDollarSign className="h-4 w-4 text-[#0041B6] dark:text-[#9FBCFF]" />
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {t('committee.metric.total')}
                  </span>
                </div>
                <p className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-100">{agendaStats.total}</p>
              </div>
              <div className="rounded-2xl border border-[#D9E2F2] bg-white/80 px-3 py-3 dark:border-[#365383] dark:bg-[#10203D]/90">
                <div className="flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-[#0041B6] dark:text-[#9FBCFF]" />
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {t('committee.metric.stage2')}
                  </span>
                </div>
                <p className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-100">{agendaStats.stageTwo}</p>
              </div>
              <div className="rounded-2xl border border-[#D9E2F2] bg-white/80 px-3 py-3 dark:border-[#365383] dark:bg-[#10203D]/90">
                <div className="flex items-center gap-2">
                  <LockKeyhole className="h-4 w-4 text-[#DB4300] dark:text-[#FFD1BF]" />
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {t('committee.metric.locked')}
                  </span>
                </div>
                <p className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-100">{agendaStats.locked}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="p-4">
          <div className="mb-4">
            <Tabs tabs={stageTabs} activeTab={activeStageTab} onChange={setActiveStageTab} />
          </div>
          {visibleAgenda.length ? (
            <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
              {visibleAgenda.map((risk) => (
                <article
                  key={risk.id}
                  className="overflow-hidden rounded-2xl border border-[#D9E2F2] bg-white shadow-[0_10px_30px_rgba(15,23,42,0.05)] dark:border-[#365383] dark:bg-[#10203D]/84 dark:shadow-[0_16px_36px_rgba(3,8,20,0.28)]"
                >
                  <div className="border-b border-[#E4EAF4] bg-[#FBFCFF] px-4 py-3 dark:border-[#2E4A79] dark:bg-[#13264A]/92">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
                            {risk.id}
                          </span>
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${getAgendaReasonTone(risk.reason, t)}`}
                          >
                            {risk.reason}
                          </span>
                        </div>
                        <h3 className="mt-2 break-words text-base font-semibold text-slate-900 dark:text-slate-100">
                          {risk.title}
                        </h3>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                        <SeverityBadge severity={risk.severity} />
                        <StatusChip status={risk.status} />
                      </div>
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl bg-[#F6F8FC] px-3 py-2.5 dark:bg-[#13284D]">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                          {t('committee.sourceDepartment')}
                        </p>
                        <div className="mt-1.5 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                          <Building2 className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                          <span className="break-words">{tr('department', risk.department)}</span>
                        </div>
                      </div>

                      <div className="rounded-xl bg-[#F6F8FC] px-3 py-2.5 dark:bg-[#13284D]">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                          {t('committee.mitigationDepartment')}
                        </p>
                        <div className="mt-1.5 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                          <Building2 className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                          <span className="break-words">
                            {risk.mitigationDepartment
                              ? tr('department', risk.mitigationDepartment)
                              : t('committee.noMitigationDepartment')}
                          </span>
                        </div>
                      </div>

                      <div className="rounded-xl bg-[#F6F8FC] px-3 py-2.5 dark:bg-[#13284D]">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                          {t('committee.expectedLoss')}
                        </p>
                        <p className="mt-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {formatCurrency(risk.expectedLoss)}
                        </p>
                      </div>

                      <div className="rounded-xl bg-[#F6F8FC] px-3 py-2.5 dark:bg-[#13284D]">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                          {t('committee.lastReviewed')}
                        </p>
                        <p className="mt-1.5 text-sm text-slate-700 dark:text-slate-200">
                          {formatDate(risk.lastReviewedAt)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-col gap-3 border-t border-[#E6ECF5] pt-4 dark:border-[#2E4A79] sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                          {getCommitteeDecisionLabel(getCommitteeDecisionOptions(risk)[0], risk, t, tr)}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                          {risk.isActionLocked ? t('workflow.awaitingResponseShort') : t('committee.cardReady')}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="btn-secondary min-w-[180px]"
                        disabled={risk.isActionLocked}
                        onClick={() => {
                          if (!risk.isActionLocked) {
                            setActiveRisk(risk)
                          }
                        }}
                      >
                        {t('committee.record')}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title={t('committee.agendaEmptyTitle')} description={t('committee.agendaEmptyDesc')} />
          )}
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('committee.log')}</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('committee.logSubtitle')}</p>
          </div>
          <select
            className="input-field !w-56 !py-1.5"
            value={logFilter}
            onChange={(event) => setLogFilter(event.target.value)}
          >
            <option value="All">{t('committee.all')}</option>
            {logDecisionOptions.map((option) => (
              <option key={option} value={option}>
                {tr('decisionType', option)}
              </option>
            ))}
          </select>
        </div>
        <DataTable
          title={t('committee.tableTitle')}
          columns={logColumns}
          data={visibleLogs}
          initialSort={{ key: 'decidedAt', direction: 'desc' }}
          emptyState={<EmptyState title={t('committee.emptyTitle')} description={t('committee.emptyDesc')} />}
        />
      </section>

      <ActionModal
        open={Boolean(activeRisk)}
        title={activeRisk ? t('committee.modalTitle', { decision: currentDecisionLabel }) : t('committee.record')}
        description={activeRisk ? `${activeRisk.id} · ${activeRisk.title}` : ''}
        confirmLabel={t('committee.confirm', { decision: currentDecisionLabel })}
        requireComment
        confirmDisabled={requiresMitigationDepartment && !selectedDepartment}
        onClose={() => setActiveRisk(null)}
        onConfirm={applyDecision}
      >
        {activeRisk ? (
          <div className="space-y-4">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('committee.decisionType')}</span>
              <select
                className="input-field"
                value={decisionType}
                onChange={(event) => setDecisionType(event.target.value)}
              >
                {availableDecisionOptions.map((option) => (
                  <option key={option} value={option}>
                    {getCommitteeDecisionLabel(option, activeRisk, t, tr)}
                  </option>
                ))}
              </select>
            </label>
            {requiresMitigationDepartment ? (
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('form.department')}</span>
                <select
                  className="input-field"
                  value={selectedDepartment}
                  onChange={(event) => setSelectedDepartment(event.target.value)}
                >
                  <option value="">{t('modal.selectDepartment')}</option>
                  {departmentOptions.map((department) => (
                    <option key={department} value={department}>
                      {department}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
        ) : null}
      </ActionModal>
    </div>
  )
}
