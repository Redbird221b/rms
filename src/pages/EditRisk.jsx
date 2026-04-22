import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../app/context/AuthContext'
import { useErm } from '../app/context/ErmContext'
import { useI18n } from '../app/context/I18nContext'
import EmptyState from '../components/common/EmptyState'
import PageHeader from '../components/common/PageHeader'
import RiskForm from '../components/forms/RiskForm'
import { getRiskRecord } from '../lib/api'
import { matchesRiskCreator } from '../lib/access'
import { getRiskReference } from '../lib/risks'

export default function EditRisk() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const {
    scopedRisks,
    departmentItems,
    categoryItems,
    categories,
    departments,
    updateRisk,
    addToast,
    isBackendConnected,
    backendError,
  } = useErm()
  const { t } = useI18n()
  const [loadingRisk, setLoadingRisk] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [editableRisk, setEditableRisk] = useState(null)

  const fallbackRisk = useMemo(
    () => scopedRisks.find((item) => String(item.id) === String(id)),
    [id, scopedRisks],
  )

  useEffect(() => {
    let active = true

    if (!id || !isBackendConnected) {
      setEditableRisk(null)
      return () => {
        active = false
      }
    }

    const loadRisk = async () => {
      setLoadingRisk(true)
      try {
        const risk = await getRiskRecord(id, {
          departmentItems,
          categoryItems,
        })
        if (active) {
          setEditableRisk(risk)
        }
      } catch {
        if (active) {
          setEditableRisk(null)
        }
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
  }, [id, isBackendConnected, departmentItems, categoryItems])

  const risk = editableRisk ?? fallbackRisk
  const riskReference = getRiskReference(risk)
  const isDraftAuthor = Boolean(risk) && risk.status === 'Draft' && matchesRiskCreator(currentUser, risk)

  if (!isBackendConnected && !backendError) {
    return <section className="panel p-4 text-sm text-slate-500 dark:text-slate-400">{t('common.loadingBackendData')}</section>
  }

  if (!isBackendConnected && backendError) {
    return <EmptyState title={t('common.backendUnavailable')} description={backendError || t('common.backendUnavailableDesc')} />
  }

  if (loadingRisk && !risk) {
    return <section className="panel p-4 text-sm text-slate-500 dark:text-slate-400">Loading draft...</section>
  }

  if (!risk) {
    return <EmptyState title={t('edit.notFoundTitle')} description={t('edit.notFoundDesc')} />
  }

  if (!isDraftAuthor) {
    return <EmptyState title={t('edit.notAllowedTitle')} description={t('edit.notAllowedDesc')} />
  }

  const handleSubmit = async (payload) => {
    setSubmitting(true)
    const submittingToReview = payload.status === 'Under Risk Review'

    try {
      await updateRisk(
        risk.id,
        {
          ...payload,
          status: submittingToReview ? 'Under Risk Review' : 'Draft',
        },
        {
          type: submittingToReview ? 'review' : 'update',
          title: submittingToReview ? t('edit.toast.submitted') : t('edit.toast.updated'),
          notes: submittingToReview
            ? 'Draft updated and sent for review.'
            : 'Draft updated by the risk author.',
          by: currentUser?.name ?? risk.owner,
          diff: {
            workflowStatus: submittingToReview ? 'Under Risk Review' : 'Draft',
          },
        },
      )

      addToast({
        type: 'success',
        title: submittingToReview ? t('edit.toast.submitted') : t('edit.toast.updated'),
        message: riskReference,
      })

      navigate(`/risks/${risk.id}`)
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Unable to update draft',
        message: error.message,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title={t('edit.title')} subtitle={t('edit.subtitle')} />
      <RiskForm
        categories={categories}
        departments={departments}
        initialValues={risk}
        onSubmit={handleSubmit}
        submitting={submitting}
        resetOnSuccess={false}
        submitLabel={t('form.saveChanges')}
        submittingLabel={t('form.saving')}
      />
    </div>
  )
}
