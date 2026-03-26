import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../app/context/AuthContext'
import { useErm } from '../app/context/ErmContext'
import { useI18n } from '../app/context/I18nContext'
import ActionModal from '../components/modals/ActionModal'
import AssignDrawer from '../components/modals/AssignDrawer'
import EmptyState from '../components/common/EmptyState'
import PageHeader from '../components/common/PageHeader'
import RiskChatThread from '../components/common/RiskChatThread'
import SeverityBadge from '../components/common/SeverityBadge'
import StatusChip from '../components/common/StatusChip'
import Tabs from '../components/common/Tabs'
import { isAwaitingDecisionResponse, PERMISSIONS } from '../lib/access'
import { impactLevels, probabilityLevels, getProbabilityLevel, recalculateRisk } from '../lib/compute'
import { sameDepartment } from '../lib/departments'
import { formatCurrency, formatDate } from '../lib/format'
import { getRiskRecord } from '../lib/api'

const IMPORTANT_DECISION_TYPES = new Set(['Approve', 'Reject', 'Accept Residual Risk'])

function getDecisionStageStatus(workflowStatus) {
  if (['Committee Review 1', 'Info Requested by Risk Manager', 'Rejected by Risk Manager'].includes(workflowStatus)) {
    return 'Under Risk Review'
  }
  if (['Accepted for Mitigation', 'Info Requested by Committee', 'Risk Accepted'].includes(workflowStatus)) {
    return 'Committee Review 1'
  }
  if (['Closed', 'Additional Mitigation Required'].includes(workflowStatus)) {
    return 'Committee Review 2'
  }
  return ''
}

export default function RiskDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const {
    scopedRisks,
    mitigationActions,
    decisionLogs,
    departmentItems,
    categoryItems,
    users,
    updateRisk,
    addDecision,
    addRiskActivity,
    updateMitigationAction,
    addMitigationAction,
    addToast,
    isBackendConnected,
    runWithDeferredSync,
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
  const [sendingChat, setSendingChat] = useState(false)
  const [chatFocusToken, setChatFocusToken] = useState(0)
  const [detailRisk, setDetailRisk] = useState(null)
  const [loadingRisk, setLoadingRisk] = useState(false)
  const [selectedDepartment, setSelectedDepartment] = useState('')
  const [financialDraft, setFinancialDraft] = useState({
    probability: 0,
    impactMostLikely: 0,
    severity: '',
  })
  const [newAction, setNewAction] = useState({ title: '', dueDate: '' })

  const fallbackRisk = useMemo(
    () => scopedRisks.find((item) => String(item.id) === String(id)),
    [id, scopedRisks],
  )
  const risk = useMemo(() => {
    if (detailRisk && fallbackRisk && String(detailRisk.id) === String(fallbackRisk.id)) {
      return {
        ...detailRisk,
        ...fallbackRisk,
        audit: fallbackRisk.audit ?? detailRisk.audit ?? [],
      }
    }

    return detailRisk ?? fallbackRisk
  }, [detailRisk, fallbackRisk])
  const riskKey = String(risk?.id ?? id ?? '')
  const canManageFinancials = hasPermission(PERMISSIONS.EDIT_FINANCIALS)
  const canManageMitigationPlan = hasPermission(PERMISSIONS.MANAGE_MITIGATION_PLAN)
  const canUpdateMitigationProgress = hasPermission(PERMISSIONS.UPDATE_MITIGATION_PROGRESS)
  const canEditDraft = Boolean(risk) && risk.status === 'Draft' && currentUser?.id === risk.createdByUserId
  const responseStatusByCurrentStatus = {
    'Info Requested by Risk Manager': 'Under Risk Review',
    'Info Requested by Committee': 'Committee Review 1',
    'Requested Info': 'Committee Review 1',
  }
  const responseNextStatus = responseStatusByCurrentStatus[risk?.status] ?? ''
  const canRespondToInfoRequest = Boolean(responseNextStatus) && currentUser?.id === risk?.createdByUserId
  const isActionLocked = isAwaitingDecisionResponse(risk, currentUser?.name)
  const isRiskManagerReview = currentUser?.accessRole === 'risk' && risk?.status === 'Under Risk Review'
  const isCommitteeStage1 = currentUser?.accessRole === 'committee' && risk?.status === 'Committee Review 1'
  const isCommitteeStage2 = currentUser?.accessRole === 'committee' && risk?.status === 'Committee Review 2'
  const isMitigationDepartmentDirector =
    currentUser?.accessRole === 'director' &&
    Boolean(risk?.mitigationDepartment) &&
    sameDepartment(currentUser.department, risk.mitigationDepartment)
  const isMitigationResponsibleEmployee =
    currentUser?.accessRole === 'employee' &&
    Boolean(risk?.responsible) &&
    currentUser.name === risk.responsible
  const mitigationStageStatuses = ['Accepted for Mitigation', 'In Mitigation', 'Additional Mitigation Required']
  const isMitigationStage = mitigationStageStatuses.includes(risk?.status)
  const canAssign = hasPermission(PERMISSIONS.ASSIGN_RESPONSIBLE) && isMitigationDepartmentDirector && isMitigationStage
  const canEditFinancialStage = canManageFinancials && isRiskManagerReview && !isActionLocked
  const canManageMitigationPlanStage = canManageMitigationPlan && isMitigationDepartmentDirector && isMitigationStage && !isActionLocked
  const canUpdateMitigationProgressStage =
    canUpdateMitigationProgress &&
    (isMitigationDepartmentDirector || isMitigationResponsibleEmployee) &&
    ['In Mitigation', 'Additional Mitigation Required'].includes(risk?.status) &&
    !isActionLocked
  const canRequestInfoAction = !isActionLocked && (isRiskManagerReview || isCommitteeStage1)
  const canRejectRiskManagerAction = !isActionLocked && isRiskManagerReview
  const canApproveRiskManagerAction = !isActionLocked && isRiskManagerReview
  const canApproveCommitteeStage1Action = !isActionLocked && isCommitteeStage1
  const canAcceptResidualRiskAction = !isActionLocked && isCommitteeStage1
  const canApproveCommitteeStage2Action = !isActionLocked && isCommitteeStage2
  const canRejectCommitteeStage2Action = !isActionLocked && isCommitteeStage2
  const shouldRequireMitigationDepartmentForCommittee =
    (isCommitteeStage1 && actionState.type === 'Approve') ||
    (isCommitteeStage2 && actionState.type === 'Reject')
  const requiresMitigationDepartment =
    shouldRequireMitigationDepartmentForCommittee
  const departmentOptions = useMemo(
    () =>
      (Array.isArray(departmentItems) ? departmentItems : [])
        .map((item) => (typeof item === 'string' ? item : item?.name))
        .filter(Boolean),
    [departmentItems],
  )
  const eligibleResponsibleUsers = useMemo(
    () =>
      users.filter(
        (user) =>
          user.accessRole === 'employee' &&
          sameDepartment(user.department, risk?.mitigationDepartment),
      ),
    [risk?.mitigationDepartment, users],
  )

  const showErrorToast = (title, error) => {
    addToast({
      type: 'error',
      title,
      message: error.message,
    })
  }

  useEffect(() => {
    if (!risk) {
      return
    }
    setFinancialDraft({
      probability: risk.probability,
      impactMostLikely: risk.impactMostLikely,
      severity: risk.severity || '',
    })
  }, [risk])

  useEffect(() => {
    let active = true

    if (!id || !isBackendConnected) {
      setDetailRisk(null)
      return () => {
        active = false
      }
    }

    const loadRisk = async () => {
      setLoadingRisk(true)
      try {
        const backendRisk = await getRiskRecord(id, {
          departmentItems,
          categoryItems,
          decisionLogs,
          auditItems: fallbackRisk?.audit ?? [],
        })
        if (!active) {
          return
        }
        setDetailRisk(backendRisk)
      } catch {
        if (!active) {
          return
        }
        setDetailRisk(null)
      } finally {
        if (active) {
          setLoadingRisk(false)
        }
      }
    }

    void loadRisk()

    return () => {
      active = false
    }
  }, [id, isBackendConnected, departmentItems, categoryItems, decisionLogs, fallbackRisk])

  useEffect(() => {
    const needsDepartment =
      (isCommitteeStage1 && actionState.type === 'Approve') ||
      (isCommitteeStage2 && actionState.type === 'Reject')

    if (!actionState.open || !needsDepartment) {
      return
    }

    setSelectedDepartment(risk?.mitigationDepartment || risk?.department || '')
  }, [actionState.open, actionState.type, isCommitteeStage1, isCommitteeStage2, risk])

  const actions = useMemo(
    () => mitigationActions.filter((action) => String(action.riskId) === riskKey),
    [mitigationActions, riskKey],
  )

  const decisions = useMemo(
    () => {
      const auditItems = Array.isArray(risk?.audit) ? risk.audit : []
      const auditDecisionItems = auditItems.filter((item) => item?.type === 'decision')
      const findMatchingAuditDecision = (decision) => {
        const decisionTime = new Date(decision?.decidedAt || 0).getTime()

        return auditDecisionItems.find((item) => {
          const auditTime = new Date(item?.at || 0).getTime()
          return (
            item?.by === decision?.decidedBy &&
            item?.diff?.decisionType === decision?.decisionType &&
            Number.isFinite(auditTime) &&
            Number.isFinite(decisionTime) &&
            Math.abs(auditTime - decisionTime) <= 10000
          )
        })
      }

      const directDecisions = decisionLogs
        .filter((entry) => String(entry.riskId) === riskKey)
        .filter((entry) => IMPORTANT_DECISION_TYPES.has(entry?.decisionType))
        .map((entry) => {
          const matchingAudit = findMatchingAuditDecision(entry)
          const workflowStatus = matchingAudit?.diff?.workflowStatus || ''

          return {
            ...entry,
            label: matchingAudit?.title || entry?.label || entry?.decisionType,
            workflowStatus,
            stageStatus: getDecisionStageStatus(workflowStatus),
            mitigationDepartment: matchingAudit?.diff?.mitigationDepartment || '',
          }
        })
        .sort((left, right) => new Date(right.decidedAt || 0).getTime() - new Date(left.decidedAt || 0).getTime())
      if (directDecisions.length) {
        return directDecisions
      }

      return auditDecisionItems
        .map((item) => {
          const decisionType = item?.diff?.decisionType ?? ''
          const workflowStatus = item?.diff?.workflowStatus ?? ''

          return {
            id: `audit-decision-${item.id}`,
            riskId: riskKey,
            decisionType,
            label: item?.title || decisionType,
            decidedBy: item?.by || 'System',
            decidedAt: item?.at || new Date().toISOString(),
            workflowStatus,
            stageStatus: getDecisionStageStatus(workflowStatus),
            mitigationDepartment: item?.diff?.mitigationDepartment || '',
          }
        })
        .filter((item) => IMPORTANT_DECISION_TYPES.has(item?.decisionType))
        .sort((left, right) => new Date(right.decidedAt || 0).getTime() - new Date(left.decidedAt || 0).getTime())
    },
    [decisionLogs, risk?.audit, riskKey],
  )

  const mitigationProgress = useMemo(() => {
    if (!actions.length) {
      return 0
    }
    const doneCount = actions.filter((action) => action.status === 'Done').length
    return Math.round((doneCount / actions.length) * 100)
  }, [actions])

  const canSubmitMitigationReview =
    (isMitigationDepartmentDirector || isMitigationResponsibleEmployee) &&
    risk?.status === 'In Mitigation' &&
    !isActionLocked &&
    mitigationProgress === 100 &&
    actions.length > 0

  const financialPreview = useMemo(
    () =>
      recalculateRisk({
        ...risk,
        ...financialDraft,
      }),
    [financialDraft, risk],
  )

  if (loadingRisk && !risk) {
    return <section className="panel p-4 text-sm text-slate-500 dark:text-slate-400">Loading risk...</section>
  }

  if (!risk) {
    return <EmptyState title={t('details.notFoundTitle')} description={t('details.notFoundDesc')} />
  }

  const openChatComposer = () => {
    setActiveTab('audit')
    setChatFocusToken((current) => current + 1)
  }

  const isInfoRequestReplyTarget = (item) => {
    if (!item || item?.diff?.decisionType !== 'Request Info') {
      return false
    }

    if (item?.type === 'decision') {
      return true
    }

    return item?.type === 'comment' && item?.diff?.messageKind === 'decision-comment'
  }

  const sendChatMessage = async (message, replyTarget) => {
    setSendingChat(true)
    try {
      const shouldReturnFromReply =
        canRespondToInfoRequest && Boolean(replyTarget) && isInfoRequestReplyTarget(replyTarget)

      if (shouldReturnFromReply) {
        const now = new Date().toISOString()

        await runWithDeferredSync(async () => {
          await addRiskActivity(risk.id, {
            type: 'comment',
            title: t('details.chatReplyTitle'),
            notes: message,
            by: currentUser?.name ?? risk.owner,
            at: now,
            diff: {
              messageKind: 'comment',
              replyTo: replyTarget?.id ?? null,
            },
          })

          await updateRisk(
            risk.id,
            {
              status: responseNextStatus,
              lastReviewedAt: now,
            },
            {
              type: 'review',
              title: t('details.responseSubmitted'),
              notes: '',
              by: currentUser?.name ?? risk.owner,
              diff: {
                workflowStatus: responseNextStatus,
              },
            },
          )
        })

        addToast({ title: t('details.responseSubmitted'), message: risk.id, type: 'success' })
        return
      }

      await addRiskActivity(risk.id, {
        type: 'comment',
        title: replyTarget ? t('details.chatReplyTitle') : t('details.chatCommentTitle'),
        notes: message,
        diff: {
          messageKind: 'comment',
          replyTo: replyTarget?.id ?? null,
        },
      })
      addToast({ title: t('details.commentAdded'), message: risk.id, type: 'success' })
    } catch (error) {
      showErrorToast('Unable to send message', error)
      throw error
    } finally {
      setSendingChat(false)
    }
  }

  const applyDecision = async (comment) => {
    const now = new Date().toISOString()
    const actor = currentUser?.name ?? 'System'
    const isRiskManagerDecision = currentUser?.accessRole === 'risk'
    const isCommitteeDecision = currentUser?.accessRole === 'committee'
    const statusByAction = isRiskManagerDecision
      ? {
          Approve: 'Committee Review 1',
          Reject: 'Rejected by Risk Manager',
          'Request Info': 'Info Requested by Risk Manager',
        }
      : isCommitteeDecision
        ? {
            Approve: isCommitteeStage2 ? 'Closed' : 'Accepted for Mitigation',
            Reject: isCommitteeStage2 ? 'Additional Mitigation Required' : 'Rejected',
            'Request Info': 'Info Requested by Committee',
            'Accept Residual Risk': 'Risk Accepted',
          }
      : {
          Approve: 'Approved',
          Reject: 'Rejected',
          'Request Info': 'Requested Info',
        }
    const auditTitleByAction = {
      Approve: isRiskManagerDecision
        ? t('audit.event.sentToCommittee')
        : isCommitteeStage2
          ? t('audit.event.closed')
          : t('audit.event.sentToMitigation'),
      Reject: t('audit.event.rejected'),
      'Request Info': t('audit.event.requestInfo'),
      'Accept Residual Risk': t('audit.event.acceptResidualRisk'),
    }
    if (isCommitteeStage2) {
      auditTitleByAction.Reject = t('audit.event.additionalMitigation')
    }

    try {
      await runWithDeferredSync(async () => {
        if (actionState.type === 'Submit Response') {
        await updateRisk(
          risk.id,
          {
            status: responseNextStatus,
            lastReviewedAt: now,
          },
          {
            type: 'review',
            title: t('details.responseSubmitted'),
            notes: '',
            by: actor,
            diff: {
              workflowStatus: responseNextStatus,
            },
          },
        )
        await addRiskActivity(risk.id, {
          type: 'comment',
          title: t('details.chatCommentTitle'),
          notes: comment,
          by: actor,
          at: new Date(new Date(now).getTime() + 1).toISOString(),
          diff: { messageKind: 'comment' },
        })
          addToast({ title: t('details.responseSubmitted'), message: risk.id, type: 'success' })
        }

        if (actionState.type === 'Submit Mitigation Review') {
        await updateRisk(
          risk.id,
          {
            status: 'Committee Review 2',
            lastReviewedAt: now,
          },
          {
            type: 'review',
            title: t('details.sentToCommitteeReview'),
            notes: '',
            by: actor,
            diff: {
              workflowStatus: 'Committee Review 2',
            },
          },
        )
        await addRiskActivity(risk.id, {
          type: 'comment',
          title: t('details.chatCommentTitle'),
          notes: comment,
          by: actor,
          at: new Date(new Date(now).getTime() + 1).toISOString(),
          diff: { messageKind: 'comment' },
        })
          addToast({ title: t('details.sentToCommitteeReview'), message: risk.id, type: 'success' })
        }

        if (actionState.type === 'Approve') {
        const nextMitigationDepartment =
          requiresMitigationDepartment ? selectedDepartment : risk.mitigationDepartment
        const targetDirector =
          nextMitigationDepartment
            ? users.find(
                (user) =>
                  user.accessRole === 'director' &&
                  sameDepartment(user.department, nextMitigationDepartment),
              )
            : null
        const notification =
          requiresMitigationDepartment && targetDirector
            ? {
                targetUserId: targetDirector.id,
                targetRole: 'director',
                targetDepartment: nextMitigationDepartment,
                title: t('notification.mitigationAssignedTitle'),
                message: t('notification.mitigationAssignedDesc', {
                  riskId: risk.id,
                  department: nextMitigationDepartment,
                }),
              }
            : null

        await updateRisk(
          risk.id,
          {
            status: statusByAction.Approve,
            committee: { lastDecision: 'Approve', lastDecisionAt: now },
            lastReviewedAt: now,
            mitigationDepartment: nextMitigationDepartment,
            responsible: requiresMitigationDepartment ? '' : risk.responsible,
          },
          {
            type: 'decision',
            title: auditTitleByAction.Approve,
            notes: '',
            by: actor,
            diff: {
              workflowStatus: statusByAction.Approve,
              decisionType: 'Approve',
              mitigationDepartment: nextMitigationDepartment,
              responsible: requiresMitigationDepartment ? '' : risk.responsible,
              notification,
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
          addToast({
            title: isRiskManagerReview
              ? t('workflow.action.sendToCommittee')
              : isCommitteeStage2
                ? t('workflow.action.closeRisk')
                : t('workflow.action.sendToMitigation'),
            message: risk.id,
            type: 'success',
          })
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
          addToast({ title: t('queue.toast.infoRequested'), message: risk.id, type: 'success' })
        }

        if (actionState.type === 'Reject') {
        const nextMitigationDepartment =
          requiresMitigationDepartment ? selectedDepartment : risk.mitigationDepartment
        const targetDirector =
          nextMitigationDepartment
            ? users.find(
                (user) =>
                  user.accessRole === 'director' &&
                  sameDepartment(user.department, nextMitigationDepartment),
              )
            : null
        const notification =
          requiresMitigationDepartment && targetDirector
            ? {
                targetUserId: targetDirector.id,
                targetRole: 'director',
                targetDepartment: nextMitigationDepartment,
                title: t('notification.additionalMitigationAssignedTitle'),
                message: t('notification.additionalMitigationAssignedDesc', {
                  riskId: risk.id,
                  department: nextMitigationDepartment,
                }),
              }
            : null

        await updateRisk(
          risk.id,
          {
            status: statusByAction.Reject,
            committee: { lastDecision: 'Reject', lastDecisionAt: now },
            lastReviewedAt: now,
            mitigationDepartment: nextMitigationDepartment,
            responsible: requiresMitigationDepartment ? '' : risk.responsible,
          },
          {
            type: 'decision',
            title: auditTitleByAction.Reject,
            notes: '',
            by: actor,
            diff: {
              workflowStatus: statusByAction.Reject,
              decisionType: 'Reject',
              mitigationDepartment: nextMitigationDepartment,
              responsible: requiresMitigationDepartment ? '' : risk.responsible,
              notification,
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
          addToast({
            title: isCommitteeStage2 ? t('workflow.action.additionalMitigation') : t('queue.toast.rejected'),
            message: risk.id,
            type: isCommitteeStage2 ? 'success' : 'error',
          })
        }

        if (actionState.type === 'Accept Residual Risk') {
        await updateRisk(
          risk.id,
          {
            status: statusByAction['Accept Residual Risk'],
            committee: { lastDecision: 'Accept Residual Risk', lastDecisionAt: now },
            lastReviewedAt: now,
          },
          {
            type: 'decision',
            title: auditTitleByAction['Accept Residual Risk'],
            notes: '',
            by: actor,
            diff: {
              workflowStatus: statusByAction['Accept Residual Risk'],
              decisionType: 'Accept Residual Risk',
            },
          },
        )
        await addDecision({
          riskId: risk.id,
          decisionType: 'Accept Residual Risk',
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
          diff: { messageKind: 'decision-comment', decisionType: 'Accept Residual Risk' },
        })
          addToast({ title: t('workflow.action.acceptResidualRisk'), message: risk.id, type: 'success' })
        }
      })

      setActionState({ open: false, type: '' })
    } catch (error) {
      showErrorToast('Unable to save decision', error)
    }
  }

  const submitDraftForReview = async () => {
    try {
      await updateRisk(
        risk.id,
        {
          status: 'Under Risk Review',
          updatedAt: new Date().toISOString(),
        },
        {
          type: 'review',
          title: t('details.draftSubmitted'),
          notes: 'Draft sent for review by the risk author.',
          by: currentUser?.name ?? risk.owner,
          diff: {
            workflowStatus: 'Under Risk Review',
          },
        },
      )

      setDetailRisk((current) =>
        current
          ? {
              ...current,
              status: 'Under Risk Review',
              updatedAt: new Date().toISOString(),
            }
          : current,
      )

      addToast({
        type: 'success',
        title: t('details.draftSubmitted'),
        message: t('details.draftSubmittedDesc'),
      })
    } catch (error) {
      showErrorToast('Unable to submit draft for review', error)
    }
  }

  return (
    <div className={activeTab === 'audit' ? 'risk-details-page--audit' : 'space-y-4'}>
      <PageHeader
        title={risk.title}
        subtitle={`${risk.id} · ${tr('department', risk.department)}`}
        actions={
          <>
            {canEditDraft ? (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => navigate(`/risks/${risk.id}/edit`)}
              >
                {t('details.editDraft')}
              </button>
            ) : null}
            {canEditDraft ? (
              <button
                type="button"
                className="btn-primary"
                onClick={() => void submitDraftForReview()}
              >
                {t('details.submitDraft')}
              </button>
            ) : null}
            {canRespondToInfoRequest ? (
              <button
                type="button"
                className="btn-primary"
                onClick={() => setActionState({ open: true, type: 'Submit Response' })}
              >
                {t('details.submitResponse')}
              </button>
            ) : null}
            {canAssign ? (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setAssignOpen(true)}
                disabled={isActionLocked}
              >
                {t('details.assign')}
              </button>
            ) : null}
            <button
              type="button"
              className="btn-secondary"
              onClick={openChatComposer}
            >
              {t('details.comment')}
            </button>
            {canSubmitMitigationReview ? (
              <button
                type="button"
                className="btn-primary"
                disabled={isActionLocked}
                onClick={() => setActionState({ open: true, type: 'Submit Mitigation Review' })}
              >
                {t('details.submitMitigationReview')}
              </button>
            ) : null}
            {canRequestInfoAction ? (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setActionState({ open: true, type: 'Request Info' })}
              >
                {t('queue.actions.requestInfo')}
              </button>
            ) : null}
            {canAcceptResidualRiskAction ? (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setActionState({ open: true, type: 'Accept Residual Risk' })}
              >
                {t('workflow.action.acceptResidualRisk')}
              </button>
            ) : null}
            {canRejectRiskManagerAction ? (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setActionState({ open: true, type: 'Reject' })}
              >
                {t('details.reject')}
              </button>
            ) : null}
            {canRejectCommitteeStage2Action ? (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setActionState({ open: true, type: 'Reject' })}
              >
                {t('workflow.action.additionalMitigation')}
              </button>
            ) : null}
            {canApproveRiskManagerAction ? (
              <button
                type="button"
                className="btn-primary"
                onClick={() => setActionState({ open: true, type: 'Approve' })}
              >
                {t('workflow.action.sendToCommittee')}
              </button>
            ) : null}
            {canApproveCommitteeStage1Action ? (
              <button
                type="button"
                className="btn-primary"
                onClick={() => setActionState({ open: true, type: 'Approve' })}
              >
                {t('workflow.action.sendToMitigation')}
              </button>
            ) : null}
            {canApproveCommitteeStage2Action ? (
              <button
                type="button"
                className="btn-primary"
                onClick={() => setActionState({ open: true, type: 'Approve' })}
              >
                {t('workflow.action.closeRisk')}
              </button>
            ) : null}
          </>
        }
      />

      {isActionLocked ? (
        <section className="panel border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100">
          {t('workflow.awaitingResponse')}
        </section>
      ) : null}

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
          {risk.mitigationDepartment ? (
            <span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600 dark:bg-[#1A2F59] dark:text-slate-200">
              {t('details.mitigationDepartment')}: {risk.mitigationDepartment}
            </span>
          ) : null}
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
                  {canEditFinancialStage ? t('details.financialEditable') : t('details.financialReadOnlyDesc')}
                </p>
              </div>
              <span className="rounded-full bg-[#F7F8FB] px-3 py-1 text-xs font-medium text-slate-600 dark:bg-[#10203D] dark:text-slate-200">
                {risk.financialAssessmentStatus || t('details.financialPending')}
              </span>
            </div>

            {!risk.probability && !risk.severity && !risk.impactMostLikely ? (
              <div className="mt-4 rounded-2xl border border-dashed border-[#C9D4E7] bg-[#F7F8FB] p-4 dark:border-[#34507F] dark:bg-[#10203D]">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{t('details.financialPendingTitle')}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{t('details.financialPendingDesc')}</p>
              </div>
            ) : null}

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <label>
                <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('details.probability')}</span>
                <select
                  className="input-field"
                  value={getProbabilityLevel(financialDraft.probability)}
                  onChange={(event) =>
                    setFinancialDraft((current) => ({
                      ...current,
                      probability:
                        event.target.value === 'Low'
                          ? 0.2
                          : event.target.value === 'Medium'
                            ? 0.5
                            : event.target.value === 'High'
                              ? 0.8
                              : 0,
                    }))}
                  disabled={!canEditFinancialStage}
                >
                  <option value="">{t('modal.selectOption')}</option>
                  {probabilityLevels.map((level) => (
                    <option key={level} value={level}>
                      {tr('severity', level)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('details.impactLevel')}</span>
                <select
                  className="input-field"
                  value={financialDraft.severity || ''}
                  onChange={(event) => setFinancialDraft((current) => ({ ...current, severity: event.target.value }))}
                  disabled={!canEditFinancialStage}
                >
                  <option value="">{t('modal.selectOption')}</option>
                  {impactLevels.map((level) => (
                    <option key={level} value={level}>
                      {tr('severity', level)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="md:col-span-2">
                <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('details.impactMostLikely')}</span>
                <input
                  type="number"
                  className="input-field"
                  value={financialDraft.impactMostLikely}
                  onChange={(event) => setFinancialDraft((current) => ({ ...current, impactMostLikely: Number(event.target.value) }))}
                  disabled={!canEditFinancialStage}
                />
              </label>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                className="btn-primary"
                disabled={!canEditFinancialStage}
                onClick={async () => {
                  try {
                    await updateRisk(
                      risk.id,
                      {
                        ...financialDraft,
                        impactMin: 0,
                        impactMax: 0,
                        residualScore: 0,
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
                  } catch (error) {
                    showErrorToast('Unable to update financials', error)
                  }
                }}
              >
                {canEditFinancialStage ? t('details.saveFinancial') : t('details.financialReadOnly')}
              </button>
            </div>
          </article>

          <aside className="panel p-4">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('details.preview')}</h2>
            <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(financialPreview.expectedLoss)}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('details.expectedLoss')}</p>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400">{t('details.probability')}</span>
                <span>{tr('severity', getProbabilityLevel(financialPreview.probability)) || '—'}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400">{t('details.impactLevel')}</span>
                <span>{tr('severity', financialPreview.severity) || '—'}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400">{t('details.inherent')}</span>
                <span>{financialPreview.inherentScore || '—'}</span>
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
                      disabled={!canUpdateMitigationProgressStage}
                      onChange={(event) => {
                        void updateMitigationAction(action.id, { status: event.target.value }).catch((error) => {
                          showErrorToast('Unable to update mitigation', error)
                        })
                      }}
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
              <input className="input-field" value={newAction.title} onChange={(event) => setNewAction((current) => ({ ...current, title: event.target.value }))} disabled={!canManageMitigationPlanStage} />
            </label>
            <label className="mt-3 block space-y-1">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('details.dueDate')}</span>
              <input type="date" className="input-field" value={newAction.dueDate} onChange={(event) => setNewAction((current) => ({ ...current, dueDate: event.target.value }))} disabled={!canManageMitigationPlanStage} />
            </label>
            {canManageMitigationPlanStage ? (
              <button
                type="button"
                className="btn-primary mt-4 w-full"
                disabled={!risk.responsible}
                onClick={async () => {
                  if (!newAction.title || !newAction.dueDate) {
                    addToast({ type: 'error', title: t('details.actionValidationTitle'), message: t('details.actionValidationDesc') })
                    return
                  }
                  if (!risk.responsible) {
                    addToast({
                      type: 'error',
                      title: t('details.assignResponsibleFirstTitle'),
                      message: t('details.assignResponsibleFirstDesc'),
                    })
                    return
                  }
                  try {
                    await addMitigationAction({
                      riskId: risk.id,
                      title: newAction.title,
                      owner: risk.responsible,
                      dueDate: newAction.dueDate,
                      status: 'Not Started',
                      notes: '',
                    })
                    addToast({ title: t('details.actionAdded'), message: risk.id, type: 'success' })
                    setNewAction({ title: '', dueDate: '' })
                  } catch (error) {
                    showErrorToast('Unable to add mitigation action', error)
                  }
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
        <section className="risk-audit-layout">
          <article className="risk-audit-main">
            <RiskChatThread
              items={risk.audit || []}
              currentUser={currentUser}
              users={users}
              onSend={sendChatMessage}
              sending={sendingChat}
              focusToken={chatFocusToken}
            />
          </article>
          <aside className="panel p-4 risk-decision-panel">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('details.decisionHistory')}</h2>
            <ul className="mt-3 space-y-2 risk-decision-list scroll-panel">
              {decisions.map((decision) => (
                <li key={decision.id} className="rounded-xl border border-slate-200 p-3 text-sm dark:border-[#2F4878]">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                        {tr('decisionType', decision.decisionType)}
                      </p>
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {decision.label || tr('decisionType', decision.decisionType) || decision.decisionType}
                      </p>
                    </div>
                    {decision.workflowStatus ? <StatusChip status={decision.workflowStatus} /> : null}
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-slate-600 dark:text-slate-300 sm:grid-cols-2">
                    {decision.workflowStatus ? (
                      <div className="flex justify-between gap-2 sm:block">
                        <span className="text-slate-500 dark:text-slate-400">{t('details.decisionResult')}</span>
                        <p className="mt-1 text-right text-slate-900 dark:text-slate-100 sm:text-left">
                          {tr('status', decision.workflowStatus)}
                        </p>
                      </div>
                    ) : null}
                    {decision.stageStatus ? (
                      <div className="flex justify-between gap-2 sm:block">
                        <span className="text-slate-500 dark:text-slate-400">{t('details.decisionStage')}</span>
                        <p className="mt-1 text-right text-slate-900 dark:text-slate-100 sm:text-left">{tr('status', decision.stageStatus)}</p>
                      </div>
                    ) : null}
                    {decision.mitigationDepartment ? (
                      <div className="flex justify-between gap-2 sm:block">
                        <span className="text-slate-500 dark:text-slate-400">{t('details.mitigationDepartment')}</span>
                        <p className="mt-1 text-right text-slate-900 dark:text-slate-100 sm:text-left">{tr('department', decision.mitigationDepartment)}</p>
                      </div>
                    ) : null}
                    <div className="flex justify-between gap-2 sm:block">
                      <span className="text-slate-500 dark:text-slate-400">{t('details.decidedBy')}</span>
                      <p className="mt-1 text-right text-slate-900 dark:text-slate-100 sm:text-left">{decision.decidedBy}</p>
                    </div>
                    <div className="flex justify-between gap-2 sm:block">
                      <span className="text-slate-500 dark:text-slate-400">{t('details.decidedAt')}</span>
                      <p className="mt-1 text-right text-slate-900 dark:text-slate-100 sm:text-left">{formatDate(decision.decidedAt)}</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{formatDate(decision.decidedAt)} · {decision.decidedBy}</p>
                </li>
              ))}
              {!decisions.length ? <li className="text-sm text-slate-500 dark:text-slate-400">{t('details.noDecisionHistory')}</li> : null}
            </ul>
          </aside>
        </section>
      ) : null}

      <AssignDrawer
        open={assignOpen}
        users={eligibleResponsibleUsers}
        initialResponsible={risk.responsible}
        onClose={() => setAssignOpen(false)}
        onAssign={async (responsible, note) => {
          try {
            const assignedUser = users.find((user) => user.name === responsible)
            await runWithDeferredSync(async () => {
              await updateRisk(
                risk.id,
                { responsible },
                {
                  type: 'assignment',
                  title: t('details.responsibleUpdated'),
                  notes: '',
                  by: currentUser?.name ?? 'Risk Committee',
                  diff: {
                    responsible,
                    notification: assignedUser
                      ? {
                          targetUserId: assignedUser.id,
                          targetUserName: assignedUser.name,
                          title: t('notification.responsibleAssignedTitle'),
                          message: t('notification.responsibleAssignedDesc', {
                            riskId: risk.id,
                          }),
                        }
                      : null,
                  },
                },
              )

              if (note?.trim()) {
                await addRiskActivity(risk.id, {
                  type: 'comment',
                  title: t('details.chatCommentTitle'),
                  notes: note.trim(),
                  by: currentUser?.name ?? 'Risk Committee',
                  diff: { messageKind: 'comment' },
                })
              }
            })
            addToast({ title: t('details.responsibleUpdated'), message: responsible, type: 'success' })
            setAssignOpen(false)
          } catch (error) {
            showErrorToast('Unable to assign responsible user', error)
          }
        }}
      />

      <ActionModal
        open={actionState.open}
        title={
          actionState.type === 'Submit Response'
            ? t('details.submitResponseTitle')
            : actionState.type === 'Submit Mitigation Review'
              ? t('details.submitMitigationReviewTitle')
            : actionState.type === 'Approve'
            ? isRiskManagerReview
              ? t('details.sendToCommitteeTitle')
              : isCommitteeStage2
                ? t('details.closeRiskTitle')
                : t('details.sendToMitigationTitle')
            : actionState.type === 'Request Info'
              ? t('queue.modal.requestInfoTitle')
            : actionState.type === 'Accept Residual Risk'
              ? t('details.acceptResidualRiskTitle')
            : actionState.type === 'Reject'
              ? isCommitteeStage2
                ? t('details.additionalMitigationTitle')
                : t('details.rejectTitle')
              : t('details.approveTitle')
        }
        description={
          actionState.type === 'Submit Response'
            ? t('details.submitResponseDesc')
            : actionState.type === 'Submit Mitigation Review'
              ? t('details.submitMitigationReviewDesc')
            : actionState.type === 'Request Info'
              ? t('queue.modal.requestInfoDesc')
            : actionState.type === 'Approve' && isCommitteeStage1
              ? t('details.sendToMitigationDesc')
            : actionState.type === 'Reject' && isCommitteeStage2
              ? t('details.additionalMitigationDesc')
            : risk.id
        }
        confirmLabel={
          actionState.type === 'Submit Response'
            ? t('details.submitResponseConfirm')
            : actionState.type === 'Submit Mitigation Review'
              ? t('details.submitMitigationReviewConfirm')
            : actionState.type === 'Approve'
            ? isRiskManagerReview
              ? t('workflow.action.sendToCommittee')
              : isCommitteeStage2
                ? t('workflow.action.closeRisk')
                : t('workflow.action.sendToMitigation')
            : actionState.type === 'Request Info'
              ? t('queue.actions.requestInfo')
            : actionState.type === 'Accept Residual Risk'
              ? t('workflow.action.acceptResidualRisk')
            : actionState.type === 'Reject'
              ? isCommitteeStage2
                ? t('workflow.action.additionalMitigation')
                : t('details.reject')
              : t('details.approve')
        }
        requireComment
        confirmDisabled={requiresMitigationDepartment && !selectedDepartment}
        onClose={() => setActionState({ open: false, type: '' })}
        onConfirm={applyDecision}
      >
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
      </ActionModal>
    </div>
  )
}
