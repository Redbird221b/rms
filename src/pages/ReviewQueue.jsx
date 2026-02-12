import { Check, MessageSquareMore, UserRoundPlus, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useErm } from '../app/context/ErmContext'
import { useI18n } from '../app/context/I18nContext'
import EmptyState from '../components/common/EmptyState'
import PageHeader from '../components/common/PageHeader'
import SeverityBadge from '../components/common/SeverityBadge'
import StatusChip from '../components/common/StatusChip'
import ActionModal from '../components/modals/ActionModal'
import AssignDrawer from '../components/modals/AssignDrawer'
import DataTable from '../components/table/DataTable'
import { formatCurrency, formatDate } from '../lib/format'

export default function ReviewQueue() {
  const { filteredRisks, queueStatuses, updateRisk, addDecision, addToast, users } = useErm()
  const { t, tr } = useI18n()
  const [actionState, setActionState] = useState({ open: false, risk: null, type: '' })
  const [assignRisk, setAssignRisk] = useState(null)

  const queueItems = useMemo(
    () => filteredRisks.filter((risk) => queueStatuses.includes(risk.status)),
    [filteredRisks, queueStatuses],
  )

  const openAction = (type, risk) => setActionState({ open: true, type, risk })
  const closeAction = () => setActionState({ open: false, type: '', risk: null })

  const submitAction = (comment) => {
    const risk = actionState.risk
    if (!risk) {
      return
    }
    const now = new Date().toISOString()

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
          notes: comment || 'Approved from review queue.',
          by: 'Risk Committee',
        },
      )
      addDecision({
        riskId: risk.id,
        decisionType: 'Approve',
        decidedBy: 'Risk Committee',
        decidedAt: now,
        notes: comment || 'Approved from queue.',
      })
      addToast({ title: t('queue.toast.approved'), message: risk.title, type: 'success' })
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
          by: 'Risk Committee',
        },
      )
      addDecision({
        riskId: risk.id,
        decisionType: 'Reject',
        decidedBy: 'Risk Committee',
        decidedAt: now,
        notes: comment,
      })
      addToast({ title: t('queue.toast.rejected'), message: risk.title, type: 'error' })
    }

    if (actionState.type === 'Request Info') {
      updateRisk(
        risk.id,
        {
          status: 'Requested Info',
          committee: { lastDecision: 'Request Info', lastDecisionAt: now },
          lastReviewedAt: now,
        },
        {
          type: 'decision',
          title: t('queue.toast.infoRequested'),
          notes: comment,
          by: 'Risk Committee',
        },
      )
      addDecision({
        riskId: risk.id,
        decisionType: 'Request Info',
        decidedBy: 'Risk Committee',
        decidedAt: now,
        notes: comment,
      })
      addToast({ title: t('queue.toast.infoRequested'), message: risk.title, type: 'success' })
    }

    closeAction()
  }

  const columns = [
    { key: 'id', label: t('queue.col.id'), sortable: true },
    {
      key: 'title',
      label: t('queue.col.risk'),
      sortable: true,
      render: (risk) => (
        <div>
          <p className="font-medium text-slate-900 dark:text-slate-100">{risk.title}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{tr('department', risk.department)}</p>
        </div>
      ),
    },
    {
      key: 'status',
      label: t('queue.col.status'),
      sortable: true,
      render: (risk) => <StatusChip status={risk.status} />,
    },
    {
      key: 'severity',
      label: t('queue.col.severity'),
      sortable: true,
      render: (risk) => <SeverityBadge severity={risk.severity} />,
    },
    {
      key: 'expectedLoss',
      label: t('queue.col.expectedLoss'),
      sortable: true,
      align: 'right',
      render: (risk) => formatCurrency(risk.expectedLoss),
    },
    {
      key: 'lastReviewedAt',
      label: t('queue.col.lastReviewed'),
      sortable: true,
      render: (risk) => formatDate(risk.lastReviewedAt),
    },
    {
      key: 'actions',
      label: t('queue.col.actions'),
      render: (risk) => (
        <div className="flex flex-wrap justify-end gap-1.5">
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#BFDCCF] bg-white text-emerald-700 transition-colors hover:bg-emerald-50 dark:border-[#2F4878] dark:bg-[#10203D] dark:text-emerald-300 dark:hover:bg-[#1A2F59]"
            aria-label={t('queue.actions.approve')}
            title={t('queue.actions.approve')}
            onClick={(event) => {
              event.stopPropagation()
              openAction('Approve', risk)
            }}
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#E5CF9B] bg-white text-amber-700 transition-colors hover:bg-amber-50 dark:border-[#2F4878] dark:bg-[#10203D] dark:text-amber-300 dark:hover:bg-[#1A2F59]"
            aria-label={t('queue.actions.requestInfo')}
            title={t('queue.actions.requestInfo')}
            onClick={(event) => {
              event.stopPropagation()
              openAction('Request Info', risk)
            }}
          >
            <MessageSquareMore className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#E5B7B7] bg-white text-rose-700 transition-colors hover:bg-rose-50 dark:border-[#2F4878] dark:bg-[#10203D] dark:text-rose-300 dark:hover:bg-[#1A2F59]"
            aria-label={t('queue.actions.reject')}
            title={t('queue.actions.reject')}
            onClick={(event) => {
              event.stopPropagation()
              openAction('Reject', risk)
            }}
          >
            <X className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#AFC5FF] bg-white text-[#0041B6] transition-colors hover:bg-[#E8EFFF] dark:border-[#2F4878] dark:bg-[#10203D] dark:text-[#BDD2FF] dark:hover:bg-[#1A2F59]"
            aria-label={t('queue.actions.assign')}
            title={t('queue.actions.assign')}
            onClick={(event) => {
              event.stopPropagation()
              setAssignRisk(risk)
            }}
          >
            <UserRoundPlus className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ]

  const modalMeta = {
    Approve: {
      title: t('queue.modal.approveTitle'),
      description: t('queue.modal.approveDesc'),
      confirmLabel: t('queue.actions.approve'),
      requireComment: false,
    },
    Reject: {
      title: t('queue.modal.rejectTitle'),
      description: t('queue.modal.rejectDesc'),
      confirmLabel: t('queue.actions.reject'),
      requireComment: true,
    },
    'Request Info': {
      title: t('queue.modal.requestInfoTitle'),
      description: t('queue.modal.requestInfoDesc'),
      confirmLabel: t('queue.actions.requestInfo'),
      requireComment: true,
    },
  }

  const activeModal = modalMeta[actionState.type] || modalMeta.Approve

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('queue.title')}
        subtitle={t('queue.subtitle')}
      />

      <DataTable
        title={t('queue.tableTitle')}
        columns={columns}
        data={queueItems}
        initialSort={{ key: 'expectedLoss', direction: 'desc' }}
        emptyState={
          <EmptyState
            title={t('queue.emptyTitle')}
            description={t('queue.emptyDesc')}
          />
        }
      />

      <ActionModal
        open={actionState.open}
        title={activeModal.title}
        description={activeModal.description}
        confirmLabel={activeModal.confirmLabel}
        requireComment={activeModal.requireComment}
        onClose={closeAction}
        onConfirm={submitAction}
      />

      <AssignDrawer
        open={Boolean(assignRisk)}
        users={users}
        initialResponsible={assignRisk?.responsible}
        onClose={() => setAssignRisk(null)}
        onAssign={(responsible, note) => {
          if (!assignRisk) {
            return
          }
          updateRisk(
            assignRisk.id,
            { responsible },
            {
              type: 'assignment',
              title: t('queue.toast.assigned'),
              notes: note || `Responsible updated to ${responsible}`,
              by: 'Risk Committee',
            },
          )
          addToast({
            title: t('queue.toast.assigned'),
            message: `${assignRisk.id} -> ${responsible}`,
            type: 'success',
          })
          setAssignRisk(null)
        }}
      />
    </div>
  )
}
