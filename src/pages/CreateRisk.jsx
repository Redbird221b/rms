import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../app/context/I18nContext'
import EmptyState from '../components/common/EmptyState'
import RiskForm from '../components/forms/RiskForm'
import PageHeader from '../components/common/PageHeader'
import { useErm } from '../app/context/ErmContext'

export default function CreateRisk() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const { categories, departments, addRisk, addToast, isBackendConnected, backendError } = useErm()
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (payload) => {
    setSubmitting(true)
    try {
      const createdRisk = await addRisk(payload)
      addToast({
        type: 'success',
        title: t('create.toast.created'),
        message: t('create.toast.createdMsg', { riskId: createdRisk?.id ?? 'N/A' }),
      })
      navigate(createdRisk?.id ? `/risks/${createdRisk.id}` : '/risks')
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Unable to create risk',
        message: error.message,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('create.title')}
        subtitle={t('create.subtitle')}
      />
      {!isBackendConnected && !backendError ? (
        <section className="panel p-4 text-sm text-slate-500 dark:text-slate-400">{t('common.loadingBackendData')}</section>
      ) : null}
      {!isBackendConnected && backendError ? (
        <EmptyState
          title={t('common.backendUnavailable')}
          description={backendError || t('common.backendUnavailableDesc')}
        />
      ) : null}
      {isBackendConnected && (!categories.length || !departments.length) ? (
        <EmptyState
          title={t('create.referenceDataMissingTitle')}
          description={t('create.referenceDataMissingDesc')}
        />
      ) : null}
      {isBackendConnected && categories.length && departments.length ? (
        <RiskForm
          categories={categories}
          departments={departments}
          onSubmit={handleSubmit}
          submitting={submitting}
        />
      ) : null}
    </div>
  )
}
