import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../app/context/AuthContext'
import { useErm } from '../app/context/ErmContext'
import { useI18n } from '../app/context/I18nContext'
import ActionModal from '../components/modals/ActionModal'
import AssignDrawer from '../components/modals/AssignDrawer'
import AuditTimeline from '../components/common/AuditTimeline'
import EmptyState from '../components/common/EmptyState'
import PageHeader from '../components/common/PageHeader'
import SeverityBadge from '../components/common/SeverityBadge'
import StatusChip from '../components/common/StatusChip'
import Tabs from '../components/common/Tabs'
import { PERMISSIONS } from '../lib/access'
import { recalculateRisk } from '../lib/compute'
import { formatCurrency, formatDate, formatPercent } from '../lib/format'

export default function RiskDetails() {
  const { id } = useParams()
  const {
    scopedRisks,
    mitigationActions,
    decisionLogs,
    users,
    updateRisk,
    addDecision,
    updateMitigationAction,
    addMitigationAction,
    addToast,
  } = useErm()
  const { currentUser, hasPermission } = useAuth()
  const { t, tr } = useI18n()

  const tabs = [
    { value: 'overview', label: t('details.tab.overview') },
    { value: 'financial', label: t('details.tab.financial') },
    { value: 'mitigation', label: t('details.tab.mitigation') },
    { value: 'audit', label: t('details.tab.audit') },
  ]

  const [activeTab, setActiveTab] = useState('overview')
  const [assignOpen, setAssignOpen] = useState(false)
  const [actionState, setActionState] = useState({ open: false, type: '' })
  const [financialDraft, setFinancialDraft] = useState({
    probability: 0,
    impactMin: 0,
    impactMostLikely: 0,
    impactMax: 0,
    residualScore: 0,
  })
  const [newAction, setNewAction] = useState({ title: '', dueDate: '' })

  const risk = useMemo(() => scopedRisks.find((item) => item.id === id), [id, scopedRisks])
  const canManageFinancials = hasPermission(PERMISSIONS.EDIT_FINANCIALS)
  const canAssign = hasPermission(PERMISSIONS.ASSIGN_RESPONSIBLE)
  const canDecide = hasPermission(PERMISSIONS.COMMITTEE_DECIDE)
  const canEditRisk = hasPermission(PERMISSIONS.EDIT_RISK)

  useEffect(() => {
    if (!risk) {
      return
    }
    setFinancialDraft({
      probability: risk.probability,
      impactMin: risk.impactMin,
      impactMostLikely: risk.impactMostLikely,
      impactMax: risk.impactMax,
      residualScore: risk.residualScore,
    })
  }, [risk])

  const actions = useMemo(
    () => mitigationActions.filter((action) => action.riskId === risk?.id),
    [mitigationActions, risk?.id],
  )

  const decisions = useMemo(
    () => decisionLogs.filter((entry) => entry.riskId === risk?.id),
    [decisionLogs, risk?.id],
  )

  const mitigationProgress = useMemo(() => {
    if (!actions.length) {
      return 0
    }
    const doneCount = actions.filter((action) => action.status === 'Done').length
    return Math.round((doneCount / actions.length) * 100)
  }, [actions])

  const financialPreview = useMemo(
    () =>
      recalculateRisk({
        ...risk,
        ...financialDraft,
      }),
    [financialDraft, risk],
  )

  if (!risk) {
    return <EmptyState title={t('details.notFoundTitle')} description={t('details.notFoundDesc')} />
  }

  const applyDecision = (comment) => {
    const now = new Date().toISOString()
    const actor = currentUser?.name ?? 'Risk Committee'

    if (actionState.type === 'Approve') {
      updateRisk(
        risk.id,
        {
          status: 'Approved',
          committee: { lastDecision: 'Approve', lastDecisionAt: now },
          lastReviewedAt: now,
        },
        {
          type: 'decision',
          title: t('queue.toast.approved'),
          notes: comment || 'Approved from risk detail page.',
          by: actor,
        },
      )
      addDecision({
        riskId: risk.id,
        decisionType: 'Approve',
        decidedBy: actor,
        decidedAt: now,
        notes: comment || 'Approved from detail page.',
      })
      addToast({ title: t('queue.toast.approved'), message: risk.id, type: 'success' })
    }

    if (actionState.type === 'Reject') {
      updateRisk(
        risk.id,
        {
          status: 'Rejected',
          committee: { lastDecision: 'Reject', lastDecisionAt: now },
          lastReviewedAt: now,
        },
        {
          type: 'decision',
          title: t('queue.toast.rejected'),
          notes: comment,
          by: actor,
        },
      )
      addDecision({
        riskId: risk.id,
        decisionType: 'Reject',
        decidedBy: actor,
        decidedAt: now,
        notes: comment,
      })
      addToast({ title: t('queue.toast.rejected'), message: risk.id, type: 'error' })
    }

    if (actionState.type === 'Comment') {
      updateRisk(
        risk.id,
        {},
        {
          type: 'comment',
          title: t('details.comment'),
          notes: comment,
          by: currentUser?.name ?? 'Risk Manager',
        },
      )
      addToast({ title: t('details.commentAdded'), message: risk.id, type: 'success' })
    }

    setActionState({ open: false, type: '' })
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={risk.title}
        subtitle={`${risk.id} · ${tr('department', risk.department)}`}
        actions={
          <>
            {canAssign ? (
              <button type="button" className="btn-secondary" onClick={() => setAssignOpen(true)}>
                {t('details.assign')}
              </button>
            ) : null}
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setActionState({ open: true, type: 'Comment' })}
            >
              {t('details.comment')}
            </button>
            {canDecide ? (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setActionState({ open: true, type: 'Reject' })}
              >
                {t('details.reject')}
              </button>
            ) : null}
            {canDecide ? (
              <button
                type="button"
                className="btn-primary"
                onClick={() => setActionState({ open: true, type: 'Approve' })}
              >
                {t('details.approve')}
              </button>
            ) : null}
          </>
        }
      />

      <section className="panel p-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip status={risk.status} />
          <SeverityBadge severity={risk.severity} />
          <span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600 dark:bg-[#1A2F59] dark:text-slate-200">
            {t('details.owner')}: {risk.owner}
          </span>
          <span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600 dark:bg-[#1A2F59] dark:text-slate-200">
            {t('details.responsible')}: {risk.responsible}
          </span>
          <span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600 dark:bg-[#1A2F59] dark:text-slate-200">
            {t('details.createdBy')}: {users.find((user) => user.id === risk.createdByUserId)?.name || t('common.unknownRisk')}
          </span>
        </div>
      </section>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'overview' ? (
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <article className="panel p-4 lg:col-span-2">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('details.description')}</h2>
            <p className="mt-2 break-words text-sm text-slate-600 dark:text-slate-300">{risk.description}</p>

            <h3 className="mt-4 text-sm font-semibold text-slate-900 dark:text-slate-100">{t('details.controls')}</h3>
            <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-slate-200 p-3 dark:border-[#2F4878]">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t('details.existingControls')}</p>
                <p className="mt-1 break-words text-sm text-slate-600 dark:text-slate-300">{risk.existingControlsText}</p>
              </div>
              <div className="rounded-lg border border-slate-200 p-3 dark:border-[#2F4878]">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t('details.plannedControls')}</p>
                <p className="mt-1 break-words text-sm text-slate-600 dark:text-slate-300">{risk.plannedControlsText}</p>
              </div>
            </div>
          </article>

          <aside className="panel p-4">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('details.metadata')}</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500 dark:text-slate-400">{t('form.category')}</dt>
                <dd className="text-right">{tr('category', risk.category)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500 dark:text-slate-400">{t('details.created')}</dt>
                <dd className="text-right">{formatDate(risk.createdAt)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500 dark:text-slate-400">{t('details.lastReviewed')}</dt>
                <dd className="text-right">{formatDate(risk.lastReviewedAt)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500 dark:text-slate-400">{t('details.dueDate')}</dt>
                <dd className="text-right">{formatDate(risk.dueDate)}</dd>
              </div>
            </dl>
            <div className="mt-4">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t('details.tags')}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {(risk.tags || []).map((tag) => (
                  <span key={tag} className="rounded-md border border-slate-200 px-2 py-1 text-xs dark:border-[#2F4878]">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </aside>
        </section>
      ) : null}

      {activeTab === 'financial' ? (
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <article className="panel p-4 lg:col-span-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('details.financial')}</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {canManageFinancials ? t('details.financialEditable') : t('details.financialReadOnlyDesc')}
                </p>
              </div>
              <span className="rounded-full bg-[#F7F8FB] px-3 py-1 text-xs font-medium text-slate-600 dark:bg-[#10203D] dark:text-slate-200">
                {risk.financialAssessmentStatus || t('details.financialPending')}
              </span>
            </div>

            {!risk.impactMostLikely ? (
              <div className="mt-4 rounded-2xl border border-dashed border-[#C9D4E7] bg-[#F7F8FB] p-4 dark:border-[#34507F] dark:bg-[#10203D]">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{t('details.financialPendingTitle')}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{t('details.financialPendingDesc')}</p>
              </div>
            ) : null}

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="md:col-span-2">
                <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('details.probability')}</span>
                <input
                  type="range"
                  min="0.01"
                  max="0.99"
                  step="0.01"
                  value={financialDraft.probability}
                  onChange={(event) => setFinancialDraft((current) => ({ ...current, probability: Number(event.target.value) }))}
                  className="w-full accent-[#0041B6]"
                  disabled={!canManageFinancials}
                />
                <span className="text-xs text-slate-500 dark:text-slate-400">{formatPercent(financialDraft.probability)}</span>
              </label>
              <label>
                <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('details.impactMin')}</span>
                <input type="number" className="input-field" value={financialDraft.impactMin} onChange={(event) => setFinancialDraft((current) => ({ ...current, impactMin: Number(event.target.value) }))} disabled={!canManageFinancials} />
              </label>
              <label>
                <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('details.impactMostLikely')}</span>
                <input type="number" className="input-field" value={financialDraft.impactMostLikely} onChange={(event) => setFinancialDraft((current) => ({ ...current, impactMostLikely: Number(event.target.value) }))} disabled={!canManageFinancials} />
              </label>
              <label>
                <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('details.impactMax')}</span>
                <input type="number" className="input-field" value={financialDraft.impactMax} onChange={(event) => setFinancialDraft((current) => ({ ...current, impactMax: Number(event.target.value) }))} disabled={!canManageFinancials} />
              </label>
              <label>
                <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('details.residual')}</span>
                <input type="number" min="1" max="25" className="input-field" value={financialDraft.residualScore} onChange={(event) => setFinancialDraft((current) => ({ ...current, residualScore: Number(event.target.value) }))} disabled={!canManageFinancials} />
              </label>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                className="btn-primary"
                disabled={!canManageFinancials}
                onClick={() => {
                  updateRisk(
                    risk.id,
                    {
                      ...financialDraft,
                      lastReviewedAt: new Date().toISOString(),
                      financialAssessmentStatus: 'Assessed',
                    },
                    {
                      type: 'financial',
                      title: t('details.financialUpdated'),
                      notes: 'Probability or impact values changed.',
                      by: currentUser?.name ?? 'Risk Manager',
                    },
                  )
                  addToast({ title: t('details.financialUpdated'), message: risk.id, type: 'success' })
                }}
              >
                {canManageFinancials ? t('details.saveFinancial') : t('details.financialReadOnly')}
              </button>
            </div>
          </article>

          <aside className="panel p-4">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('details.preview')}</h2>
            <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(financialPreview.expectedLoss)}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('details.expectedLoss')}</p>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400">{t('details.inherent')}</span>
                <span>{financialPreview.inherentScore}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400">{t('details.residual')}</span>
                <span>{financialPreview.residualScore}</span>
              </div>
            </div>
          </aside>
        </section>
      ) : null}

      {activeTab === 'mitigation' ? (
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <article className="panel p-4 lg:col-span-2">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('details.mitigation')}</h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">{t('details.progress', { progress: mitigationProgress })}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-200 dark:bg-[#1A2F59]">
              <div className="h-2 rounded-full bg-[#0041B6] transition-all" style={{ width: `${mitigationProgress}%` }} />
            </div>

            <div className="mt-4 space-y-2">
              {actions.map((action) => (
                <div key={action.id} className="rounded-lg border border-slate-200 p-3 dark:border-[#2F4878]">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{action.title}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {t('details.owner')}: {action.owner} · {t('details.due')} {formatDate(action.dueDate)}
                      </p>
                    </div>
                    <select
                      className="input-field !w-full !py-1.5 sm:!w-36"
                      value={action.status}
                      disabled={!canEditRisk}
                      onChange={(event) => updateMitigationAction(action.id, { status: event.target.value })}
                    >
                      <option value="Not Started">{tr('actionStatus', 'Not Started')}</option>
                      <option value="In Progress">{tr('actionStatus', 'In Progress')}</option>
                      <option value="Done">{tr('actionStatus', 'Done')}</option>
                    </select>
                  </div>
                  {action.notes ? <p className="mt-1 break-words text-xs text-slate-500 dark:text-slate-400">{action.notes}</p> : null}
                </div>
              ))}
            </div>
          </article>

          <aside className="panel p-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('details.addAction')}</h3>
            <label className="mt-3 block space-y-1">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('details.actionTitle')}</span>
              <input className="input-field" value={newAction.title} onChange={(event) => setNewAction((current) => ({ ...current, title: event.target.value }))} disabled={!canEditRisk} />
            </label>
            <label className="mt-3 block space-y-1">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('details.dueDate')}</span>
              <input type="date" className="input-field" value={newAction.dueDate} onChange={(event) => setNewAction((current) => ({ ...current, dueDate: event.target.value }))} disabled={!canEditRisk} />
            </label>
            {canEditRisk ? (
              <button
                type="button"
                className="btn-primary mt-4 w-full"
                onClick={() => {
                  if (!newAction.title || !newAction.dueDate) {
                    addToast({ type: 'error', title: t('details.actionValidationTitle'), message: t('details.actionValidationDesc') })
                    return
                  }
                  addMitigationAction({
                    riskId: risk.id,
                    title: newAction.title,
                    owner: risk.responsible,
                    dueDate: newAction.dueDate,
                    status: 'Not Started',
                    notes: '',
                  })
                  addToast({ title: t('details.actionAdded'), message: risk.id, type: 'success' })
                  setNewAction({ title: '', dueDate: '' })
                }}
              >
                {t('details.addMitigationAction')}
              </button>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-[#C9D4E7] bg-[#F7F8FB] p-4 text-sm leading-6 text-slate-600 dark:border-[#34507F] dark:bg-[#10203D] dark:text-slate-300">
                {t('details.mitigationReadOnly')}
              </div>
            )}
          </aside>
        </section>
      ) : null}

      {activeTab === 'audit' ? (
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <article className="panel p-4 lg:col-span-2">
            <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">{t('details.auditTimeline')}</h2>
            <AuditTimeline items={risk.audit || []} />
          </article>
          <aside className="panel p-4">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('details.decisionHistory')}</h2>
            <ul className="mt-3 space-y-2">
              {decisions.map((decision) => (
                <li key={decision.id} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-[#2F4878]">
                  <p className="font-medium text-slate-900 dark:text-slate-100">{tr('decisionType', decision.decisionType)}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{formatDate(decision.decidedAt)} · {decision.decidedBy}</p>
                  <p className="mt-1 break-words text-xs text-slate-600 dark:text-slate-300">{decision.notes}</p>
                </li>
              ))}
              {!decisions.length ? <li className="text-sm text-slate-500 dark:text-slate-400">{t('details.noDecisionHistory')}</li> : null}
            </ul>
          </aside>
        </section>
      ) : null}

      <AssignDrawer
        open={assignOpen}
        users={users}
        initialResponsible={risk.responsible}
        onClose={() => setAssignOpen(false)}
        onAssign={(responsible, note) => {
          updateRisk(
            risk.id,
            { responsible },
            {
              type: 'assignment',
              title: t('details.responsibleUpdated'),
              notes: note || `Responsible updated to ${responsible}`,
              by: currentUser?.name ?? 'Risk Committee',
            },
          )
          addToast({ title: t('details.responsibleUpdated'), message: responsible, type: 'success' })
          setAssignOpen(false)
        }}
      />

      <ActionModal
        open={actionState.open}
        title={
          actionState.type === 'Approve'
            ? t('details.approveTitle')
            : actionState.type === 'Reject'
              ? t('details.rejectTitle')
              : t('details.comment')
        }
        description={risk.id}
        confirmLabel={
          actionState.type === 'Approve'
            ? t('details.approve')
            : actionState.type === 'Reject'
              ? t('details.reject')
              : t('details.saveComment')
        }
        requireComment={actionState.type === 'Reject' || actionState.type === 'Comment'}
        onClose={() => setActionState({ open: false, type: '' })}
        onConfirm={applyDecision}
      />
    </div>
  )
}
