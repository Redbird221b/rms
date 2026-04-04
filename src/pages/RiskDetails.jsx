import {
  ArrowRight,
  BadgeDollarSign,
  Building2,
  CalendarDays,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  ListTodo,
  MessageSquareText,
  Target,
  TrendingUp,
  UserRound,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../app/context/AuthContext'
import { useErm } from '../app/context/ErmContext'
import { useI18n } from '../app/context/I18nContext'
import ActionModal from '../components/modals/ActionModal'
import AssignDrawer from '../components/modals/AssignDrawer'
import EmptyState from '../components/common/EmptyState'
import RiskChatThread from '../components/common/RiskChatThread'
import SeverityBadge from '../components/common/SeverityBadge'
import StatusChip from '../components/common/StatusChip'
import Tabs from '../components/common/Tabs'
import { hasAccessRole, isAwaitingDecisionResponse, matchesRiskCreator, matchesUserIdentity, PERMISSIONS } from '../lib/access'
import { impactLevels, probabilityLevels, getProbabilityLevel, recalculateRisk } from '../lib/compute'
import { sameDepartment } from '../lib/departments'
import { formatCurrency, formatDate } from '../lib/format'
import { getDepartmentMemberDirectory, getRiskRecord } from '../lib/api'
import { getRiskReference } from '../lib/risks'

const IMPORTANT_DECISION_TYPES = new Set(['Approve', 'Reject', 'Accept Residual Risk'])
const WORKFLOW_RAIL = ['Draft', 'Under Risk Review', 'Committee Review 1', 'In Mitigation', 'Committee Review 2', 'Closed']

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

function getWorkflowRailStatus(status) {
  if (status === 'Draft') {
    return 'Draft'
  }
  if (['Under Risk Review', 'Info Requested by Risk Manager', 'Rejected by Risk Manager'].includes(status)) {
    return 'Under Risk Review'
  }
  if (['Committee Review 1', 'Info Requested by Committee'].includes(status)) {
    return 'Committee Review 1'
  }
  if (['Accepted for Mitigation', 'In Mitigation', 'Additional Mitigation Required'].includes(status)) {
    return 'In Mitigation'
  }
  if (status === 'Committee Review 2') {
    return 'Committee Review 2'
  }
  if (['Closed', 'Risk Accepted'].includes(status)) {
    return 'Closed'
  }
  return 'Draft'
}

function getMitigationTone(status) {
  if (status === 'Approved') {
    return 'border-[#D5EAD9] bg-[#F4FBF5] dark:border-[#3D6A4C] dark:bg-[#11281A]'
  }
  if (status === 'Pending Risk Review') {
    return 'border-[#D7E2FA] bg-[#F5F8FF] dark:border-[#3C5C97] dark:bg-[#122649]'
  }
  if (status === 'In Progress') {
    return 'border-[#F2D8CA] bg-[#FFF5F0] dark:border-[#7E4A31] dark:bg-[#2E1D18]'
  }
  return 'border-slate-200 bg-white dark:border-[#2F4878] dark:bg-[#10203D]'
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
    backendError,
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
  const [actionState, setActionState] = useState({ open: false, type: '', mitigationActionId: null })
  const [sendingChat, setSendingChat] = useState(false)
  const [chatFocusToken, setChatFocusToken] = useState(0)
  const [detailRisk, setDetailRisk] = useState(null)
  const [loadingRisk, setLoadingRisk] = useState(false)
  const [assignableUsers, setAssignableUsers] = useState([])
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
  const riskReference = getRiskReference(risk)
  const canManageFinancials = hasPermission(PERMISSIONS.EDIT_FINANCIALS)
  const canManageMitigationPlan = hasPermission(PERMISSIONS.MANAGE_MITIGATION_PLAN)
  const canUpdateMitigationProgress = hasPermission(PERMISSIONS.UPDATE_MITIGATION_PROGRESS)
  const canReviewMitigationActions = hasPermission(PERMISSIONS.REVIEW_MITIGATION_ACTIONS)
  const canEditDraft = Boolean(risk) && risk.status === 'Draft' && matchesRiskCreator(currentUser, risk)
  const responseStatusByCurrentStatus = {
    'Info Requested by Risk Manager': 'Under Risk Review',
    'Info Requested by Committee': 'Committee Review 1',
    'Requested Info': 'Committee Review 1',
  }
  const responseNextStatus = responseStatusByCurrentStatus[risk?.status] ?? ''
  const canRespondToInfoRequest = Boolean(responseNextStatus) && matchesRiskCreator(currentUser, risk)
  const isActionLocked = isAwaitingDecisionResponse(risk, currentUser?.name)
  const isRiskManagerReview = hasAccessRole(currentUser, 'risk') && risk?.status === 'Under Risk Review'
  const isCommitteeStage1 = hasAccessRole(currentUser, 'committee') && risk?.status === 'Committee Review 1'
  const isCommitteeStage2 = hasAccessRole(currentUser, 'committee') && risk?.status === 'Committee Review 2'
  const isMitigationDepartmentDirector =
    hasAccessRole(currentUser, 'director') &&
    Boolean(risk?.mitigationDepartment) &&
    sameDepartment(currentUser.department, risk.mitigationDepartment)
  const mitigationStageStatuses = ['Accepted for Mitigation', 'In Mitigation', 'Additional Mitigation Required']
  const mitigationPlanEditableStatuses = [
    'Committee Review 1',
    'Committee Review 2',
    'Accepted for Mitigation',
    'In Mitigation',
    'Additional Mitigation Required',
  ]
  const isMitigationStage = mitigationStageStatuses.includes(risk?.status)
  const canManageMitigationPlanStatus = mitigationPlanEditableStatuses.includes(risk?.status)
  const canAssign =
    hasPermission(PERMISSIONS.ASSIGN_RESPONSIBLE) &&
    isMitigationDepartmentDirector &&
    canManageMitigationPlanStatus
  const canEditFinancialStage = canManageFinancials && isRiskManagerReview && !isActionLocked
  const canManageMitigationPlanStage =
    canManageMitigationPlan &&
    (isMitigationDepartmentDirector || hasAccessRole(currentUser, 'risk') || hasAccessRole(currentUser, 'committee')) &&
    canManageMitigationPlanStatus &&
    !isActionLocked
  const canUpdateMitigationProgressStage =
    canUpdateMitigationProgress &&
    ['Accepted for Mitigation', 'In Mitigation', 'Additional Mitigation Required'].includes(risk?.status) &&
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
    () => assignableUsers.filter((user) => sameDepartment(user.department_name || user.department?.name, risk?.mitigationDepartment)),
    [assignableUsers, risk?.mitigationDepartment],
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
    let active = true

    if (!assignOpen || !canAssign || !isBackendConnected) {
      if (!assignOpen) {
        setAssignableUsers([])
      }
      return () => {
        active = false
      }
    }

    const loadAssignableUsers = async () => {
      try {
        const directory = await getDepartmentMemberDirectory()
        if (!active) {
          return
        }
        setAssignableUsers(Array.isArray(directory) ? directory : [])
      } catch (error) {
        if (!active) {
          return
        }
        setAssignableUsers([])
        showErrorToast('Unable to load department users', error)
      }
    }

    void loadAssignableUsers()

    return () => {
      active = false
    }
  }, [assignOpen, canAssign, isBackendConnected])

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
    () =>
      mitigationActions
        .filter((action) => String(action.riskId) === riskKey)
        .sort((left, right) => {
          const leftTime = new Date(left?.createdAt || 0).getTime()
          const rightTime = new Date(right?.createdAt || 0).getTime()
          if (leftTime !== rightTime) {
            return leftTime - rightTime
          }
          return String(left?.id || '').localeCompare(String(right?.id || ''))
        }),
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
    const approvedCount = actions.filter((action) => action.status === 'Approved').length
    return Math.round((approvedCount / actions.length) * 100)
  }, [actions])
  const selectedMitigationAction = useMemo(
    () => actions.find((action) => String(action.id) === String(actionState.mitigationActionId)),
    [actionState.mitigationActionId, actions],
  )

  const financialPreview = useMemo(
    () =>
      recalculateRisk({
        ...risk,
        ...financialDraft,
      }),
    [financialDraft, risk],
  )

  if (!isBackendConnected && !backendError) {
    return <section className="panel p-4 text-sm text-slate-500 dark:text-slate-400">Loading backend data...</section>
  }

  if (!isBackendConnected && backendError) {
    return <EmptyState title="Backend unavailable" description={backendError || 'Unable to load data from backend.'} />
  }

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

  const isMitigationActionOwner = (action) => matchesUserIdentity(currentUser, action?.owner)
  const canPerformMitigationAction = (action) =>
    isMitigationActionOwner(action) || isMitigationDepartmentDirector

  const canEditMitigationAction = (action) =>
    canUpdateMitigationProgressStage &&
    canPerformMitigationAction(action) &&
    ['Not Started', 'In Progress'].includes(action?.status)
  const canStartMitigationAction = (action) =>
    canEditMitigationAction(action) && action?.status === 'Not Started'
  const canSubmitMitigationAction = (action) =>
    canEditMitigationAction(action) && action?.status === 'In Progress'
  const canSendMitigationPlanToCommittee =
    isMitigationDepartmentDirector &&
    ['Accepted for Mitigation', 'In Mitigation', 'Additional Mitigation Required'].includes(risk?.status) &&
    actions.length > 0 &&
    actions.every((action) => action?.status === 'Approved') &&
    !isActionLocked

  const canReviewMitigationAction = (action) =>
    canReviewMitigationActions &&
    hasAccessRole(currentUser, 'risk') &&
    ['In Mitigation', 'Additional Mitigation Required'].includes(risk?.status) &&
    action?.status === 'Pending Risk Review' &&
    !isActionLocked

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

        addToast({ title: t('details.responseSubmitted'), message: riskReference, type: 'success' })
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
      addToast({ title: t('details.commentAdded'), message: riskReference, type: 'success' })
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
    const trimmedComment = String(comment || '').trim()
    const isRiskManagerDecision = hasAccessRole(currentUser, 'risk')
    const isCommitteeDecision = hasAccessRole(currentUser, 'committee')
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
        if (actionState.type === 'Submit Mitigation Action') {
          if (!selectedMitigationAction) {
            throw new Error('Mitigation action not found')
          }

          await updateMitigationAction(
            selectedMitigationAction.id,
            {
              status: 'Pending Risk Review',
              notes: trimmedComment,
            },
            {
              useStaffEndpoint: true,
            },
          )
          addToast({ title: 'Mitigation action submitted', message: selectedMitigationAction.title, type: 'success' })
          return
        }

        if (actionState.type === 'Approve Mitigation Action') {
          if (!selectedMitigationAction) {
            throw new Error('Mitigation action not found')
          }

          await updateMitigationAction(
            selectedMitigationAction.id,
            {
              status: 'Approved',
              notes: trimmedComment || selectedMitigationAction.notes,
            },
          )
          addToast({ title: 'Mitigation action approved', message: selectedMitigationAction.title, type: 'success' })
          return
        }

        if (actionState.type === 'Decline Mitigation Action') {
          if (!selectedMitigationAction) {
            throw new Error('Mitigation action not found')
          }

          await updateMitigationAction(
            selectedMitigationAction.id,
            {
              status: 'In Progress',
              notes: trimmedComment,
            },
          )
          addToast({ title: 'Mitigation action returned to progress', message: selectedMitigationAction.title, type: 'error' })
          return
        }

        if (actionState.type === 'Send Mitigation Plan to Committee') {
          await updateRisk(
            risk.id,
            {
              status: 'Committee Review 2',
              lastReviewedAt: now,
            },
            {
              type: 'review',
              title: 'Mitigation plan sent to Committee Review 2',
              notes: 'All mitigation actions were approved and the department director sent the plan for committee review.',
              by: actor,
              diff: {
                workflowStatus: 'Committee Review 2',
              },
            },
          )
          addToast({ title: 'Mitigation plan sent', message: riskReference, type: 'success' })
          return
        }

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
          addToast({ title: t('details.responseSubmitted'), message: riskReference, type: 'success' })
        }

        if (actionState.type === 'Approve') {
        const nextMitigationDepartment =
          requiresMitigationDepartment ? selectedDepartment : risk.mitigationDepartment
        const targetDirector =
          nextMitigationDepartment
            ? users.find(
                (user) =>
                  hasAccessRole(user, 'director') &&
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
            message: riskReference,
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
          addToast({ title: t('queue.toast.infoRequested'), message: riskReference, type: 'success' })
        }

        if (actionState.type === 'Reject') {
        const nextMitigationDepartment =
          requiresMitigationDepartment ? selectedDepartment : risk.mitigationDepartment
        const targetDirector =
          nextMitigationDepartment
            ? users.find(
                (user) =>
                  hasAccessRole(user, 'director') &&
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
            message: riskReference,
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
          addToast({ title: t('workflow.action.acceptResidualRisk'), message: riskReference, type: 'success' })
        }
      })

      setActionState({ open: false, type: '', mitigationActionId: null })
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

  const createdByName =
    users.find((user) => matchesRiskCreator(user, risk))?.name ||
    risk.createdByUserId ||
    t('common.unknownRisk')

  const workflowAnchorStatus = getWorkflowRailStatus(risk.status)
  const workflowAnchorIndex = WORKFLOW_RAIL.indexOf(workflowAnchorStatus)
  const workflowSteps = WORKFLOW_RAIL.map((step, index) => ({
    value: step,
    state: index < workflowAnchorIndex ? 'complete' : index === workflowAnchorIndex ? 'active' : 'upcoming',
  }))

  const mitigationCounts = {
    approved: actions.filter((action) => action.status === 'Approved').length,
    pending: actions.filter((action) => action.status === 'Pending Risk Review').length,
    inProgress: actions.filter((action) => action.status === 'In Progress').length,
  }

  const overviewHighlights = [
    {
      key: 'expected-loss',
      label: t('details.expectedLoss'),
      value: formatCurrency(risk.expectedLoss),
      icon: BadgeDollarSign,
      accent:
        'bg-[linear-gradient(180deg,#FFFFFF_0%,#F5F8FF_100%)] border-[#DCE6F8] dark:bg-[linear-gradient(180deg,#15294E_0%,#112241_100%)] dark:border-[#365383]',
    },
    {
      key: 'department',
      label: t('form.department'),
      value: tr('department', risk.department),
      icon: Building2,
      accent: 'bg-[#FBFCFF] border-[#E7EDF8] dark:bg-[#10203D] dark:border-[#304B78]',
    },
    {
      key: 'responsible',
      label: t('details.responsible'),
      value: risk.responsible || '—',
      icon: UserRound,
      accent: 'bg-[#FBFCFF] border-[#E7EDF8] dark:bg-[#10203D] dark:border-[#304B78]',
    },
    {
      key: 'last-reviewed',
      label: actions.length ? t('details.progress', { progress: mitigationProgress }) : t('details.lastReviewed'),
      value: actions.length ? `${mitigationCounts.approved}/${actions.length}` : formatDate(risk.lastReviewedAt),
      icon: actions.length ? Target : CalendarDays,
      accent: 'bg-[#FBFCFF] border-[#E7EDF8] dark:bg-[#10203D] dark:border-[#304B78]',
    },
  ]

  const primaryActions = []
  const secondaryActions = []

  if (canEditDraft) {
    secondaryActions.push({
      key: 'edit-draft',
      label: t('details.editDraft'),
      onClick: () => navigate(`/risks/${risk.id}/edit`),
    })
    primaryActions.push({
      key: 'submit-draft',
      label: t('details.submitDraft'),
      onClick: () => void submitDraftForReview(),
    })
  }

  if (canRespondToInfoRequest) {
    primaryActions.push({
      key: 'submit-response',
      label: t('details.submitResponse'),
      onClick: () => setActionState({ open: true, type: 'Submit Response', mitigationActionId: null }),
    })
  }

  if (canAssign) {
    secondaryActions.push({
      key: 'assign',
      label: t('details.assign'),
      onClick: () => setAssignOpen(true),
      disabled: isActionLocked,
    })
  }

  secondaryActions.push({
    key: 'comment',
    label: t('details.comment'),
    onClick: openChatComposer,
  })

  if (canRequestInfoAction) {
    secondaryActions.push({
      key: 'request-info',
      label: t('queue.actions.requestInfo'),
      onClick: () => setActionState({ open: true, type: 'Request Info', mitigationActionId: null }),
    })
  }

  if (canAcceptResidualRiskAction) {
    secondaryActions.push({
      key: 'accept-residual',
      label: t('workflow.action.acceptResidualRisk'),
      onClick: () => setActionState({ open: true, type: 'Accept Residual Risk', mitigationActionId: null }),
    })
  }

  if (canRejectRiskManagerAction || canRejectCommitteeStage2Action) {
    secondaryActions.push({
      key: 'reject',
      label: canRejectCommitteeStage2Action ? t('workflow.action.additionalMitigation') : t('details.reject'),
      onClick: () => setActionState({ open: true, type: 'Reject', mitigationActionId: null }),
    })
  }

  if (canApproveRiskManagerAction) {
    primaryActions.push({
      key: 'approve-review',
      label: t('workflow.action.sendToCommittee'),
      onClick: () => setActionState({ open: true, type: 'Approve', mitigationActionId: null }),
    })
  }

  if (canApproveCommitteeStage1Action) {
    primaryActions.push({
      key: 'approve-committee-stage-1',
      label: t('workflow.action.sendToMitigation'),
      onClick: () => setActionState({ open: true, type: 'Approve', mitigationActionId: null }),
    })
  }

  if (canApproveCommitteeStage2Action) {
    primaryActions.push({
      key: 'approve-committee-stage-2',
      label: t('workflow.action.closeRisk'),
      onClick: () => setActionState({ open: true, type: 'Approve', mitigationActionId: null }),
    })
  }

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.55fr,0.95fr]">
        <article className="panel p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[#D6E2FF] bg-[#F5F8FF] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#003EAB] dark:border-[#45629A] dark:bg-[#10203D]/80 dark:text-[#BFD3FF]">
              {riskReference}
            </span>
            <StatusChip status={risk.status} />
            <SeverityBadge severity={risk.severity} />
            <span className="rounded-full border border-[#E2E8F4] bg-white px-3 py-1 text-xs font-medium text-slate-600 dark:border-[#355281] dark:bg-[#13264A] dark:text-slate-200">
              {tr('category', risk.category)}
            </span>
          </div>

          <h1 className="mt-4 max-w-4xl text-[2rem] font-semibold tracking-tight text-slate-950 dark:text-white">
            {risk.title}
          </h1>
          <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-600 dark:text-slate-300">
            {risk.description}
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <span className="rounded-full bg-[#F7F9FD] px-3 py-1.5 text-xs text-slate-600 dark:bg-[#10203D] dark:text-slate-200">
              {t('details.createdBy')}: {createdByName}
            </span>
            <span className="rounded-full bg-[#F7F9FD] px-3 py-1.5 text-xs text-slate-600 dark:bg-[#10203D] dark:text-slate-200">
              {t('details.owner')}: {risk.owner}
            </span>
            <span className="rounded-full bg-[#F7F9FD] px-3 py-1.5 text-xs text-slate-600 dark:bg-[#10203D] dark:text-slate-200">
              {t('details.responsible')}: {risk.responsible || '—'}
            </span>
            <span className="rounded-full bg-[#F7F9FD] px-3 py-1.5 text-xs text-slate-600 dark:bg-[#10203D] dark:text-slate-200">
              {t('details.mitigationDepartment')}: {risk.mitigationDepartment ? tr('department', risk.mitigationDepartment) : '—'}
            </span>
          </div>
        </article>

        <aside className="panel p-5">
          <div className="flex items-center gap-2">
            <MessageSquareText className="h-4 w-4 text-[#0041B6] dark:text-[#9FBCFF]" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
              Available actions
            </p>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
            {isActionLocked ? t('workflow.awaitingResponse') : t('committee.cardReady')}
          </p>

          <div className="mt-4 grid gap-2">
            {primaryActions.map((action) => (
              <button
                key={action.key}
                type="button"
                className="btn-primary w-full justify-between"
                onClick={action.onClick}
                disabled={action.disabled}
              >
                <span className="inline-flex w-full items-center justify-between gap-3">
                  {action.label}
                  <ArrowRight className="h-4 w-4" />
                </span>
              </button>
            ))}
            {secondaryActions.map((action) => (
              <button
                key={action.key}
                type="button"
                className="btn-secondary w-full justify-between"
                onClick={action.onClick}
                disabled={action.disabled}
              >
                {action.label}
              </button>
            ))}
            {!primaryActions.length && !secondaryActions.length ? (
              <div className="rounded-[22px] border border-dashed border-[#D7E2F6] bg-[#F8FAFE] p-4 text-sm leading-6 text-slate-500 dark:border-[#355281] dark:bg-[#10203D] dark:text-slate-300">
                No actions are available for your current role at this stage.
              </div>
            ) : null}
          </div>
        </aside>
      </section>

      <section className="panel p-5 sm:p-6">
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-[#0041B6] dark:text-[#9FBCFF]" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
              Workflow
            </p>
          </div>

          <div className="grid gap-3 xl:grid-cols-6">
            {workflowSteps.map((step, index) => {
              const isComplete = step.state === 'complete'
              const isActive = step.state === 'active'

              return (
                <div
                  key={step.value}
                  className={`rounded-[22px] border px-4 py-4 transition-colors ${
                    isActive
                      ? 'border-[#C9D7FF] bg-[#EEF3FF] dark:border-[#4569A8] dark:bg-[#17315E]'
                      : isComplete
                        ? 'border-[#D5EAD9] bg-[#F4FBF5] dark:border-[#3D6A4C] dark:bg-[#11281A]'
                        : 'border-[#E7EDF8] bg-[#FBFCFF] dark:border-[#304B78] dark:bg-[#10203D]'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                        isActive
                          ? 'bg-[#0041B6] text-white'
                          : isComplete
                            ? 'bg-[#1B7A39] text-white'
                            : 'bg-slate-200 text-slate-600 dark:bg-[#21375E] dark:text-slate-300'
                      }`}
                    >
                      {isComplete ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                        Step {index + 1}
                      </p>
                      <p className="mt-1 text-sm font-medium leading-5 text-slate-900 dark:text-slate-100">
                        {tr('status', step.value)}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {overviewHighlights.map((item) => {
              const Icon = item.icon

              return (
                <article
                  key={item.key}
                  className="rounded-[22px] border border-[#E7EDF8] bg-[#FBFCFF] px-4 py-4 dark:border-[#304B78] dark:bg-[#10203D]"
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-[#0041B6] dark:text-[#9FBCFF]" />
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {item.label}
                    </p>
                  </div>
                  <p className="mt-3 break-words text-base font-semibold text-slate-950 dark:text-white">
                    {item.value}
                  </p>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      {isActionLocked ? (
        <section className="panel border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100">
          {t('workflow.awaitingResponse')}
        </section>
      ) : null}

      <section className="panel p-2 sm:p-3">
        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
      </section>

      {activeTab === 'overview' ? (
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.35fr,0.9fr]">
          <article className="panel overflow-hidden">
            <div className="border-b border-[#E6ECF5] bg-[linear-gradient(180deg,#FFFFFF_0%,#F8FAFE_100%)] px-5 py-4 dark:border-[#304B78] dark:bg-[linear-gradient(180deg,#15294E_0%,#112241_100%)]">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-[#0041B6] dark:text-[#9FBCFF]" />
                <h2 className="text-sm font-semibold text-slate-950 dark:text-white">{t('details.description')}</h2>
              </div>
            </div>

            <div className="space-y-6 p-5">
              <p className="max-w-4xl break-words text-sm leading-7 text-slate-600 dark:text-slate-300">
                {risk.description}
              </p>

              <div>
                <h3 className="text-sm font-semibold text-slate-950 dark:text-white">{t('details.controls')}</h3>
                <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <section className="rounded-[24px] border border-[#E6ECF5] bg-[#FBFCFF] p-4 dark:border-[#304B78] dark:bg-[#10203D]">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                      {t('details.existingControls')}
                    </p>
                    <p className="mt-3 break-words text-sm leading-6 text-slate-600 dark:text-slate-300">
                      {risk.existingControlsText}
                    </p>
                  </section>
                  <section className="rounded-[24px] border border-[#E6ECF5] bg-[#FBFCFF] p-4 dark:border-[#304B78] dark:bg-[#10203D]">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                      {t('details.plannedControls')}
                    </p>
                    <p className="mt-3 break-words text-sm leading-6 text-slate-600 dark:text-slate-300">
                      {risk.plannedControlsText}
                    </p>
                  </section>
                </div>
              </div>
            </div>
          </article>

          <aside className="space-y-4">
            <section className="panel p-5">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-[#0041B6] dark:text-[#9FBCFF]" />
                <h2 className="text-sm font-semibold text-slate-950 dark:text-white">{t('details.metadata')}</h2>
              </div>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500 dark:text-slate-400">{t('form.category')}</dt>
                  <dd className="text-right font-medium text-slate-900 dark:text-slate-100">{tr('category', risk.category)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500 dark:text-slate-400">{t('details.created')}</dt>
                  <dd className="text-right font-medium text-slate-900 dark:text-slate-100">{formatDate(risk.createdAt)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500 dark:text-slate-400">{t('details.lastReviewed')}</dt>
                  <dd className="text-right font-medium text-slate-900 dark:text-slate-100">{formatDate(risk.lastReviewedAt)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500 dark:text-slate-400">{t('details.owner')}</dt>
                  <dd className="text-right font-medium text-slate-900 dark:text-slate-100">{risk.owner}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500 dark:text-slate-400">{t('details.responsible')}</dt>
                  <dd className="text-right font-medium text-slate-900 dark:text-slate-100">{risk.responsible || '—'}</dd>
                </div>
              </dl>
            </section>

            <section className="panel p-5">
              <div className="flex items-center gap-2">
                <ListTodo className="h-4 w-4 text-[#0041B6] dark:text-[#9FBCFF]" />
                <h3 className="text-sm font-semibold text-slate-950 dark:text-white">{t('details.tags')}</h3>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {(risk.tags || []).length ? (
                  (risk.tags || []).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-[#DCE6F8] bg-[#F8FAFE] px-3 py-1 text-xs font-medium text-slate-700 dark:border-[#355281] dark:bg-[#10203D] dark:text-slate-200"
                    >
                      {tag}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-slate-500 dark:text-slate-400">—</span>
                )}
              </div>
            </section>
          </aside>
        </section>
      ) : null}

      {activeTab === 'financial' ? (
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.35fr,0.9fr]">
          <article className="panel overflow-hidden">
            <div className="border-b border-[#E6ECF5] bg-[linear-gradient(180deg,#FFFFFF_0%,#F8FAFE_100%)] px-5 py-4 dark:border-[#304B78] dark:bg-[linear-gradient(180deg,#15294E_0%,#112241_100%)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-[#0041B6] dark:text-[#9FBCFF]" />
                    <h2 className="text-sm font-semibold text-slate-950 dark:text-white">{t('details.financial')}</h2>
                  </div>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    {canEditFinancialStage ? t('details.financialEditable') : t('details.financialReadOnlyDesc')}
                  </p>
                </div>
                <span className="rounded-full border border-[#DCE6F8] bg-white/80 px-3 py-1 text-xs font-medium text-slate-700 dark:border-[#355281] dark:bg-[#10203D] dark:text-slate-200">
                  {risk.financialAssessmentStatus || t('details.financialPending')}
                </span>
              </div>
            </div>

            <div className="space-y-5 p-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-[22px] border border-[#E6ECF5] bg-[#FBFCFF] px-4 py-4 dark:border-[#304B78] dark:bg-[#10203D]">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{t('details.probability')}</p>
                  <p className="mt-3 text-base font-semibold text-slate-950 dark:text-white">
                    {tr('severity', getProbabilityLevel(financialDraft.probability)) || '—'}
                  </p>
                </div>
                <div className="rounded-[22px] border border-[#E6ECF5] bg-[#FBFCFF] px-4 py-4 dark:border-[#304B78] dark:bg-[#10203D]">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{t('details.impactLevel')}</p>
                  <p className="mt-3 text-base font-semibold text-slate-950 dark:text-white">
                    {tr('severity', financialDraft.severity) || '—'}
                  </p>
                </div>
                <div className="rounded-[22px] border border-[#E6ECF5] bg-[#FBFCFF] px-4 py-4 dark:border-[#304B78] dark:bg-[#10203D]">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{t('details.expectedLoss')}</p>
                  <p className="mt-3 text-base font-semibold text-slate-950 dark:text-white">
                    {formatCurrency(financialPreview.expectedLoss)}
                  </p>
                </div>
              </div>

              {!risk.probability && !risk.severity && !risk.impactMostLikely ? (
                <div className="rounded-[24px] border border-dashed border-[#C9D4E7] bg-[#F7F8FB] p-4 dark:border-[#34507F] dark:bg-[#10203D]">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{t('details.financialPendingTitle')}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{t('details.financialPendingDesc')}</p>
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="rounded-[24px] border border-[#E6ECF5] bg-[#FBFCFF] p-4 dark:border-[#304B78] dark:bg-[#10203D]">
                  <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{t('details.probability')}</span>
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
                <label className="rounded-[24px] border border-[#E6ECF5] bg-[#FBFCFF] p-4 dark:border-[#304B78] dark:bg-[#10203D]">
                  <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{t('details.impactLevel')}</span>
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
                <label className="rounded-[24px] border border-[#E6ECF5] bg-[#FBFCFF] p-4 md:col-span-2 dark:border-[#304B78] dark:bg-[#10203D]">
                  <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{t('details.impactMostLikely')}</span>
                  <input
                    type="number"
                    className="input-field"
                    value={financialDraft.impactMostLikely}
                    onChange={(event) => setFinancialDraft((current) => ({ ...current, impactMostLikely: Number(event.target.value) }))}
                    disabled={!canEditFinancialStage}
                  />
                </label>
              </div>

              <div className="flex justify-end">
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
                      addToast({ title: t('details.financialUpdated'), message: riskReference, type: 'success' })
                    } catch (error) {
                      showErrorToast('Unable to update financials', error)
                    }
                  }}
                >
                  {canEditFinancialStage ? t('details.saveFinancial') : t('details.financialReadOnly')}
                </button>
              </div>
            </div>
          </article>

          <aside className="space-y-4">
            <section className="panel overflow-hidden">
              <div className="bg-[linear-gradient(180deg,#0F2141_0%,#17315E_100%)] px-5 py-5 text-white dark:bg-[linear-gradient(180deg,#0C1830_0%,#13264A_100%)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#BFD3FF]">{t('details.preview')}</p>
                <p className="mt-3 text-3xl font-semibold tracking-tight">{formatCurrency(financialPreview.expectedLoss)}</p>
                <p className="mt-1 text-sm text-[#DBE6FF]">{t('details.expectedLoss')}</p>
              </div>
              <div className="space-y-3 p-5 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500 dark:text-slate-400">{t('details.probability')}</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">{tr('severity', getProbabilityLevel(financialPreview.probability)) || '—'}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500 dark:text-slate-400">{t('details.impactLevel')}</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">{tr('severity', financialPreview.severity) || '—'}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500 dark:text-slate-400">{t('details.inherent')}</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">{financialPreview.inherentScore || '—'}</span>
                </div>
              </div>
            </section>
          </aside>
        </section>
      ) : null}

      {activeTab === 'mitigation' ? (
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.35fr,0.9fr]">
          <article className="panel overflow-hidden">
            <div className="border-b border-[#E6ECF5] bg-[linear-gradient(180deg,#FFFFFF_0%,#F8FAFE_100%)] px-5 py-4 dark:border-[#304B78] dark:bg-[linear-gradient(180deg,#15294E_0%,#112241_100%)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-[#0041B6] dark:text-[#9FBCFF]" />
                    <h2 className="text-sm font-semibold text-slate-950 dark:text-white">{t('details.mitigation')}</h2>
                  </div>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    {t('details.progress', { progress: mitigationProgress })}
                  </p>
                </div>
                <span className="rounded-full border border-[#DCE6F8] bg-white/80 px-3 py-1 text-xs font-medium text-slate-700 dark:border-[#355281] dark:bg-[#10203D] dark:text-slate-200">
                  {mitigationCounts.approved}/{actions.length || 0}
                </span>
              </div>

              <div className="mt-4 h-2 rounded-full bg-slate-200 dark:bg-[#1A2F59]">
                <div className="h-2 rounded-full bg-[#0041B6] transition-all" style={{ width: `${mitigationProgress}%` }} />
              </div>
            </div>

            <div className="space-y-3 p-5">
              {actions.length ? (
                actions.map((action, actionIndex) => (
                  <article
                    key={action.id}
                    className={`rounded-[24px] border p-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)] ${getMitigationTone(action.status)}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-current/10 bg-white/70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-white/5 dark:text-slate-400">
                            {actionIndex + 1}
                          </span>
                          <span className="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium dark:border-[#2F4878]">
                            {tr('actionStatus', action.status) || action.status}
                          </span>
                        </div>
                        <h3 className="mt-3 text-base font-semibold text-slate-950 dark:text-white">{action.title}</h3>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-1 dark:bg-white/5">
                            <UserRound className="h-3.5 w-3.5" />
                            {t('details.responsible')}: {action.owner || 'Unassigned'}
                          </span>
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-1 dark:bg-white/5">
                            <UserRound className="h-3.5 w-3.5" />
                            {t('details.createdBy')}: {action.createdBy || '-'}
                          </span>
                          {action.completedBy ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-1 dark:bg-white/5">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Completed by: {action.completedBy}
                            </span>
                          ) : null}
                          {action.completedAt ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-1 dark:bg-white/5">
                              <CalendarDays className="h-3.5 w-3.5" />
                              Completed: {formatDate(action.completedAt)}
                            </span>
                          ) : null}
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-1 dark:bg-white/5">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {t('details.due')} {formatDate(action.dueDate)}
                          </span>
                        </div>
                      </div>

                      <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[220px]">
                        {canEditMitigationAction(action) ? (
                          <>
                            {canStartMitigationAction(action) ? (
                              <button
                                type="button"
                                className="btn-secondary w-full"
                                onClick={() => {
                                  void updateMitigationAction(
                                    action.id,
                                    { status: 'In Progress' },
                                    { useStaffEndpoint: true },
                                  ).catch((error) => {
                                    showErrorToast('Unable to start mitigation', error)
                                  })
                                }}
                              >
                                Start Action
                              </button>
                            ) : null}
                            {canSubmitMitigationAction(action) ? (
                              <button
                                type="button"
                                className="btn-primary w-full"
                                onClick={() => setActionState({ open: true, type: 'Submit Mitigation Action', mitigationActionId: action.id })}
                              >
                                Send for Risk Review
                              </button>
                            ) : null}
                          </>
                        ) : null}
                        {canReviewMitigationAction(action) ? (
                          <>
                            <button
                              type="button"
                              className="btn-primary w-full"
                              onClick={() => setActionState({ open: true, type: 'Approve Mitigation Action', mitigationActionId: action.id })}
                            >
                              Approve Action
                            </button>
                            <button
                              type="button"
                              className="btn-secondary w-full"
                              onClick={() => setActionState({ open: true, type: 'Decline Mitigation Action', mitigationActionId: action.id })}
                            >
                              Decline Action
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                    {action.notes ? (
                      <div className="mt-4 rounded-2xl bg-white/70 px-3 py-3 text-sm leading-6 text-slate-600 dark:bg-white/5 dark:text-slate-300">
                        {action.notes}
                      </div>
                    ) : null}
                  </article>
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-[#C9D4E7] bg-[#F7F8FB] p-6 text-sm leading-6 text-slate-600 dark:border-[#34507F] dark:bg-[#10203D] dark:text-slate-300">
                  {t('details.mitigationReadOnly')}
                </div>
              )}
            </div>
          </article>

          <aside className="space-y-4">
            <section className="panel p-5">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-[#0041B6] dark:text-[#9FBCFF]" />
                <h3 className="text-sm font-semibold text-slate-950 dark:text-white">{t('details.progress', { progress: mitigationProgress })}</h3>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                <div className="rounded-[20px] bg-[#F8FAFE] px-3 py-4 dark:bg-[#10203D]">
                  <p className="text-2xl font-semibold text-slate-950 dark:text-white">{mitigationCounts.approved}</p>
                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Approved</p>
                </div>
                <div className="rounded-[20px] bg-[#F8FAFE] px-3 py-4 dark:bg-[#10203D]">
                  <p className="text-2xl font-semibold text-slate-950 dark:text-white">{mitigationCounts.pending}</p>
                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Review</p>
                </div>
                <div className="rounded-[20px] bg-[#F8FAFE] px-3 py-4 dark:bg-[#10203D]">
                  <p className="text-2xl font-semibold text-slate-950 dark:text-white">{mitigationCounts.inProgress}</p>
                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Active</p>
                </div>
              </div>
            </section>

            <section className="panel p-5">
              <div className="flex items-center gap-2">
                <ListTodo className="h-4 w-4 text-[#0041B6] dark:text-[#9FBCFF]" />
                <h3 className="text-sm font-semibold text-slate-950 dark:text-white">{t('details.addAction')}</h3>
              </div>
              <label className="mt-4 block space-y-1">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('details.actionTitle')}</span>
                <input className="input-field" value={newAction.title} onChange={(event) => setNewAction((current) => ({ ...current, title: event.target.value }))} disabled={!canManageMitigationPlanStage} />
              </label>
              <label className="mt-3 block space-y-1">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('details.dueDate')}</span>
                <input type="date" className="input-field" value={newAction.dueDate} onChange={(event) => setNewAction((current) => ({ ...current, dueDate: event.target.value }))} disabled={!canManageMitigationPlanStage} />
              </label>
              {canManageMitigationPlanStage ? (
                <>
                  <button
                    type="button"
                    className="btn-primary mt-4 w-full"
                    onClick={async () => {
                      if (!newAction.title || !newAction.dueDate) {
                        addToast({ type: 'error', title: t('details.actionValidationTitle'), message: t('details.actionValidationDesc') })
                        return
                      }
                      try {
                        await addMitigationAction({
                          riskId: risk.id,
                          title: newAction.title,
                          owner:
                            risk.responsible ||
                            currentUser?.username ||
                            currentUser?.email ||
                            currentUser?.id ||
                            currentUser?.name ||
                            '',
                          createdBy:
                            currentUser?.username ||
                            currentUser?.email ||
                            currentUser?.id ||
                            currentUser?.name ||
                            '',
                          dueDate: newAction.dueDate,
                          status: 'Not Started',
                          notes: '',
                        })
                        addToast({ title: t('details.actionAdded'), message: riskReference, type: 'success' })
                        setNewAction({ title: '', dueDate: '' })
                      } catch (error) {
                        showErrorToast('Unable to add mitigation action', error)
                      }
                    }}
                  >
                    {t('details.addMitigationAction')}
                  </button>
                  {canSendMitigationPlanToCommittee ? (
                    <button
                      type="button"
                      className="btn-secondary mt-3 w-full"
                      onClick={() => setActionState({ open: true, type: 'Send Mitigation Plan to Committee', mitigationActionId: null })}
                    >
                      Send to Committee Review
                    </button>
                  ) : null}
                </>
              ) : (
                <div className="mt-4 rounded-[24px] border border-dashed border-[#C9D4E7] bg-[#F7F8FB] p-4 text-sm leading-6 text-slate-600 dark:border-[#34507F] dark:bg-[#10203D] dark:text-slate-300">
                  {t('details.mitigationReadOnly')}
                </div>
              )}
            </section>
          </aside>
        </section>
      ) : null}

      {activeTab === 'audit' ? (
        <section className="risk-audit-layout">
          <article className="risk-audit-main panel overflow-hidden p-0">
            <RiskChatThread
              items={risk.audit || []}
              currentUser={currentUser}
              users={users}
              onSend={sendChatMessage}
              sending={sendingChat}
              focusToken={chatFocusToken}
            />
          </article>
          <aside className="panel p-5 risk-decision-panel">
            <div className="flex items-center gap-2">
              <MessageSquareText className="h-4 w-4 text-[#0041B6] dark:text-[#9FBCFF]" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('details.decisionHistory')}</h2>
            </div>
            <ul className="mt-4 space-y-3 risk-decision-list scroll-panel">
              {decisions.map((decision) => (
                <li
                  key={decision.id}
                  className="rounded-[22px] border border-[#E6ECF5] bg-[#FBFCFF] p-4 text-sm shadow-[0_10px_24px_rgba(15,23,42,0.04)] dark:border-[#304B78] dark:bg-[#10203D]"
                >
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
                  <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{formatDate(decision.decidedAt)} · {decision.decidedBy}</p>
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
        onAssign={async (selectedUser, note) => {
          if (!selectedUser) {
            return
          }

          const responsible =
            String(selectedUser.username || selectedUser.email || selectedUser.id || selectedUser.name || '').trim()

          if (!responsible) {
            addToast({ title: 'Unable to assign responsible user', message: 'Selected user is missing an identifier.', type: 'error' })
            return
          }

          try {
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
                    notification: selectedUser
                      ? {
                          targetUserId: selectedUser.id,
                          targetUserName: selectedUser.name,
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
            addToast({ title: t('details.responsibleUpdated'), message: selectedUser.name || responsible, type: 'success' })
            setAssignOpen(false)
          } catch (error) {
            showErrorToast('Unable to assign responsible user', error)
          }
        }}
      />

      <ActionModal
        open={actionState.open}
        title={
          actionState.type === 'Submit Mitigation Action'
            ? 'Submit mitigation action'
            : actionState.type === 'Approve Mitigation Action'
              ? 'Approve mitigation action'
            : actionState.type === 'Decline Mitigation Action'
              ? 'Decline mitigation action'
            : actionState.type === 'Send Mitigation Plan to Committee'
              ? 'Send mitigation plan to committee review'
            : actionState.type === 'Submit Response'
            ? t('details.submitResponseTitle')
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
          actionState.type === 'Submit Mitigation Action'
            ? `Describe what was completed for "${selectedMitigationAction?.title || 'this action'}".`
            : actionState.type === 'Approve Mitigation Action'
              ? `Approve "${selectedMitigationAction?.title || 'this mitigation action'}" for the next stage.`
            : actionState.type === 'Decline Mitigation Action'
              ? `Explain what must be reworked for "${selectedMitigationAction?.title || 'this mitigation action'}".`
            : actionState.type === 'Send Mitigation Plan to Committee'
              ? 'Send the fully approved mitigation plan to Committee Review 2.'
            : actionState.type === 'Submit Response'
            ? t('details.submitResponseDesc')
            : actionState.type === 'Request Info'
              ? t('queue.modal.requestInfoDesc')
            : actionState.type === 'Approve' && isCommitteeStage1
              ? t('details.sendToMitigationDesc')
            : actionState.type === 'Reject' && isCommitteeStage2
              ? t('details.additionalMitigationDesc')
            : riskReference
        }
        confirmLabel={
          actionState.type === 'Submit Mitigation Action'
            ? 'Send for Risk Review'
            : actionState.type === 'Approve Mitigation Action'
              ? 'Approve Action'
            : actionState.type === 'Decline Mitigation Action'
              ? 'Decline Action'
            : actionState.type === 'Send Mitigation Plan to Committee'
              ? 'Send to Committee Review'
            : actionState.type === 'Submit Response'
            ? t('details.submitResponseConfirm')
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
        requireComment={actionState.type !== 'Approve Mitigation Action' && actionState.type !== 'Send Mitigation Plan to Committee'}
        confirmDisabled={requiresMitigationDepartment && !selectedDepartment}
        onClose={() => setActionState({ open: false, type: '', mitigationActionId: null })}
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
