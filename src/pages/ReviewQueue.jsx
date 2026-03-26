import { Check, MessageSquareMore, UserRoundPlus, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useAuth } from '../app/context/AuthContext'
import { useErm } from '../app/context/ErmContext'
import { useI18n } from '../app/context/I18nContext'
import EmptyState from '../components/common/EmptyState'
import PageHeader from '../components/common/PageHeader'
import SeverityBadge from '../components/common/SeverityBadge'
import StatusChip from '../components/common/StatusChip'
import ActionModal from '../components/modals/ActionModal'
import AssignDrawer from '../components/modals/AssignDrawer'
import DataTable from '../components/table/DataTable'
import { isAwaitingDecisionResponse, PERMISSIONS } from '../lib/access'
import { formatCurrency, formatDate } from '../lib/format'

export default function ReviewQueue() {
  const {
    filteredRisks,
    queueStatuses,
    updateRisk,
    addDecision,
    addRiskActivity,
    addToast,
    users,
    runWithDeferredSync,
  } = useErm()
  const { currentUser, hasPermission } = useAuth()
  const { t, tr } = useI18n()
  const [actionState, setActionState] = useState({ open: false, risk: null, type: '' })
  const [assignRisk, setAssignRisk] = useState(null)
  const canAssign = hasPermission(PERMISSIONS.ASSIGN_RESPONSIBLE)

  const showErrorToast = (title, error) => {
    addToast({
      type: 'error',
      title,
      message: error.message,
    })
  }

  const queueItems = useMemo(
    () =>
      filteredRisks
        .filter((risk) => queueStatuses.includes(risk.status))
        .map((risk) => ({
          ...risk,
          isActionLocked: isAwaitingDecisionResponse(risk, currentUser?.name),
        })),
    [currentUser?.name, filteredRisks, queueStatuses],
  )

  const openAction = (type, risk) => {
    if (risk?.isActionLocked) {
      return
    }
    setActionState({ open: true, type, risk })
  }
  const closeAction = () => setActionState({ open: false, type: '', risk: null })

  const submitAction = async (comment) => {
    const risk = actionState.risk
    if (!risk) {
      return
    }
    const now = new Date().toISOString()
    const actor = currentUser?.name ?? 'Risk Manager'
    const statusByAction = {
      Approve: 'Committee Review 1',
      Reject: 'Rejected by Risk Manager',
      'Request Info': 'Info Requested by Risk Manager',
    }
    const auditTitleByAction = {
      Approve: t('audit.event.approved'),
      Reject: t('audit.event.rejected'),
      'Request Info': t('audit.event.requestInfo'),
    }

    try {
      await runWithDeferredSync(async () => {
        if (actionState.type === 'Approve') {
          await updateRisk(
            risk.id,
            {
              status: statusByAction.Approve,
              committee: { lastDecision: 'Approve', lastDecisionAt: now },
              lastReviewedAt: now,
            },
            {
              type: 'decision',
              title: auditTitleByAction.Approve,
              notes: '',
              by: actor,
              diff: {
                workflowStatus: statusByAction.Approve,
                decisionType: 'Approve',
              },
            },
          )
          await addDecision({
            riskId: risk.id,
            decisionType: 'Approve',
            decidedBy: actor,
            decidedAt: now,
            notes: comment,
          })
          await addRiskActivity(risk.id, {
            type: 'comment',
            title: t('details.chatCommentTitle'),
            notes: comment,
            by: actor,
            at: new Date(new Date(now).getTime() + 1).toISOString(),
            diff: { messageKind: 'decision-comment', decisionType: 'Approve' },
          })
          addToast({ title: t('queue.toast.approved'), message: risk.title, type: 'success' })
        }

        if (actionState.type === 'Reject') {
          await updateRisk(
            risk.id,
            {
              status: statusByAction.Reject,
              committee: { lastDecision: 'Reject', lastDecisionAt: now },
              lastReviewedAt: now,
            },
            {
              type: 'decision',
              title: auditTitleByAction.Reject,
              notes: '',
              by: actor,
              diff: {
                workflowStatus: statusByAction.Reject,
                decisionType: 'Reject',
              },
            },
          )
          await addDecision({
            riskId: risk.id,
            decisionType: 'Reject',
            decidedBy: actor,
            decidedAt: now,
            notes: comment,
          })
          await addRiskActivity(risk.id, {
            type: 'comment',
            title: t('details.chatCommentTitle'),
            notes: comment,
            by: actor,
            at: new Date(new Date(now).getTime() + 1).toISOString(),
            diff: { messageKind: 'decision-comment', decisionType: 'Reject' },
          })
          addToast({ title: t('queue.toast.rejected'), message: risk.title, type: 'error' })
        }

        if (actionState.type === 'Request Info') {
          await updateRisk(
            risk.id,
            {
              status: statusByAction['Request Info'],
              committee: { lastDecision: 'Request Info', lastDecisionAt: now },
              lastReviewedAt: now,
            },
            {
              type: 'decision',
              title: auditTitleByAction['Request Info'],
              notes: '',
              by: actor,
              diff: {
                workflowStatus: statusByAction['Request Info'],
                decisionType: 'Request Info',
              },
            },
          )
          await addDecision({
            riskId: risk.id,
            decisionType: 'Request Info',
            decidedBy: actor,
            decidedAt: now,
            notes: comment,
          })
          await addRiskActivity(risk.id, {
            type: 'comment',
            title: t('details.chatCommentTitle'),
            notes: comment,
            by: actor,
            at: new Date(new Date(now).getTime() + 1).toISOString(),
            diff: { messageKind: 'decision-comment', decisionType: 'Request Info' },
          })
          addToast({ title: t('queue.toast.infoRequested'), message: risk.title, type: 'success' })
        }
      })

      closeAction()
    } catch (error) {
      showErrorToast('Unable to update review queue', error)
    }
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
            className={`inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#BFDCCF] bg-white text-emerald-700 transition-colors hover:bg-emerald-50 dark:border-[#2F4878] dark:bg-[#10203D] dark:text-emerald-300 dark:hover:bg-[#1A2F59] ${risk.isActionLocked ? 'cursor-not-allowed opacity-50' : ''}`}
            aria-label={t('queue.actions.approve')}
            title={t('queue.actions.approve')}
            disabled={risk.isActionLocked}
            onClick={(event) => {
              event.stopPropagation()
              openAction('Approve', risk)
            }}
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={`inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#E5CF9B] bg-white text-amber-700 transition-colors hover:bg-amber-50 dark:border-[#2F4878] dark:bg-[#10203D] dark:text-amber-300 dark:hover:bg-[#1A2F59] ${risk.isActionLocked ? 'cursor-not-allowed opacity-50' : ''}`}
            aria-label={t('queue.actions.requestInfo')}
            title={t('queue.actions.requestInfo')}
            disabled={risk.isActionLocked}
            onClick={(event) => {
              event.stopPropagation()
              openAction('Request Info', risk)
            }}
          >
            <MessageSquareMore className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={`inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#E5B7B7] bg-white text-rose-700 transition-colors hover:bg-rose-50 dark:border-[#2F4878] dark:bg-[#10203D] dark:text-rose-300 dark:hover:bg-[#1A2F59] ${risk.isActionLocked ? 'cursor-not-allowed opacity-50' : ''}`}
            aria-label={t('queue.actions.reject')}
            title={t('queue.actions.reject')}
            disabled={risk.isActionLocked}
            onClick={(event) => {
              event.stopPropagation()
              openAction('Reject', risk)
            }}
          >
            <X className="h-4 w-4" />
          </button>
          {canAssign ? (
            <button
              type="button"
              className={`inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#AFC5FF] bg-white text-[#0041B6] transition-colors hover:bg-[#E8EFFF] dark:border-[#2F4878] dark:bg-[#10203D] dark:text-[#BDD2FF] dark:hover:bg-[#1A2F59] ${risk.isActionLocked ? 'cursor-not-allowed opacity-50' : ''}`}
              aria-label={t('queue.actions.assign')}
              title={t('queue.actions.assign')}
              disabled={risk.isActionLocked}
              onClick={(event) => {
                event.stopPropagation()
                if (!risk.isActionLocked) {
                  setAssignRisk(risk)
                }
              }}
            >
              <UserRoundPlus className="h-4 w-4" />
            </button>
          ) : null}
          {risk.isActionLocked ? (
            <p className="w-full text-right text-[11px] text-slate-500 dark:text-slate-400">
              {t('workflow.awaitingResponseShort')}
            </p>
          ) : null}
        </div>
      ),
    },
  ]

  const modalMeta = {
    Approve: {
      title: t('queue.modal.approveTitle'),
      description: t('queue.modal.approveDesc'),
      confirmLabel: t('queue.actions.approve'),
      requireComment: true,
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

      {canAssign ? (
        <AssignDrawer
          open={Boolean(assignRisk)}
          users={users}
          initialResponsible={assignRisk?.responsible}
          onClose={() => setAssignRisk(null)}
          onAssign={async (responsible, note) => {
            if (!assignRisk) {
              return
            }
            try {
              await updateRisk(
                assignRisk.id,
                { responsible },
                {
                  type: 'assignment',
                  title: t('queue.toast.assigned'),
                  notes: note || `Responsible updated to ${responsible}`,
                  by: currentUser?.name ?? 'System',
                },
              )
              addToast({
                title: t('queue.toast.assigned'),
                message: `${assignRisk.id} -> ${responsible}`,
                type: 'success',
              })
              setAssignRisk(null)
            } catch (error) {
              showErrorToast('Unable to assign risk', error)
            }
          }}
        />
      ) : null}
    </div>
  )
}
