import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../app/context/I18nContext'
import RiskForm from '../components/forms/RiskForm'
import PageHeader from '../components/common/PageHeader'
import { useErm } from '../app/context/ErmContext'

export default function CreateRisk() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const { categories, departments, users, addRisk, addToast } = useErm()
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = (payload) => {
    setSubmitting(true)
    addRisk(payload)
    addToast({
      type: 'success',
      title: t('create.toast.created'),
      message: t('create.toast.createdMsg', { riskId: payload.id }),
    })
    setTimeout(() => {
      setSubmitting(false)
      navigate('/risks')
    }, 120)
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('create.title')}
        subtitle={t('create.subtitle')}
      />
      <RiskForm
        categories={categories}
        departments={departments}
        users={users}
        onSubmit={handleSubmit}
        submitting={submitting}
      />
    </div>
  )
}
