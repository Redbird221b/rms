import { useMemo, useState } from 'react'
import { useI18n } from '../../app/context/I18nContext'
import { calculateExpectedLoss, getSeverityByLoss, recalculateRisk } from '../../lib/compute'
import { formatCurrency, formatPercent } from '../../lib/format'

const initialState = {
  title: '',
  description: '',
  category: 'Operational',
  department: 'Treasury',
  owner: '',
  responsible: '',
  status: 'Draft',
  probability: 0.25,
  impactMin: 600_000_000,
  impactMostLikely: 1_400_000_000,
  impactMax: 2_500_000_000,
  dueDate: '',
  tags: '',
  existingControlsText: '',
  plannedControlsText: '',
}

export default function RiskForm({ categories, departments, users, onSubmit, submitting }) {
  const { t, tr } = useI18n()
  const [form, setForm] = useState(initialState)
  const [errors, setErrors] = useState({})

  const expectedLoss = useMemo(
    () => calculateExpectedLoss(form.probability, form.impactMostLikely),
    [form.impactMostLikely, form.probability],
  )
  const severity = useMemo(() => getSeverityByLoss(expectedLoss), [expectedLoss])
  const uniqueRoles = Array.from(new Set(users.map((user) => user.role)))
  const uniqueUsers = Array.from(new Set(users.map((user) => user.name)))

  const setField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const validate = () => {
    const nextErrors = {}
    if (!form.title.trim()) nextErrors.title = t('form.validation.title')
    if (!form.description.trim()) nextErrors.description = t('form.validation.description')
    if (!form.owner) nextErrors.owner = t('form.validation.owner')
    if (!form.responsible) nextErrors.responsible = t('form.validation.responsible')
    if (!form.dueDate) nextErrors.dueDate = t('form.validation.dueDate')
    if (Number(form.probability) <= 0 || Number(form.probability) >= 1) {
      nextErrors.probability = t('form.validation.probability')
    }
    if (Number(form.impactMostLikely) <= 0) {
      nextErrors.impactMostLikely = t('form.validation.impactPositive')
    }
    if (Number(form.impactMin) > Number(form.impactMostLikely)) {
      nextErrors.impactMin = t('form.validation.minMost')
    }
    if (Number(form.impactMostLikely) > Number(form.impactMax)) {
      nextErrors.impactMax = t('form.validation.maxMost')
    }
    return nextErrors
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    const validationErrors = validate()
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length) {
      return
    }

    const riskId = `RISK-${String(Math.floor(Math.random() * 9000) + 1000)}`
    const payload = recalculateRisk({
      id: riskId,
      ...form,
      tags: form.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      attachments: [],
      committee: {
        lastDecision: form.status === 'Pending Review' ? 'Request Info' : 'Drafted',
        lastDecisionAt: new Date().toISOString(),
      },
    })
    onSubmit(payload)
    setForm(initialState)
    setErrors({})
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="panel p-4 lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('form.riskInformation')}</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="md:col-span-2">
              <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('form.title')}</span>
              <input className="input-field" value={form.title} onChange={(event) => setField('title', event.target.value)} />
              {errors.title ? <span className="mt-1 block text-xs text-rose-600">{errors.title}</span> : null}
            </label>
            <label className="md:col-span-2">
              <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('form.description')}</span>
              <textarea rows={4} className="input-field resize-none" value={form.description} onChange={(event) => setField('description', event.target.value)} />
              {errors.description ? <span className="mt-1 block text-xs text-rose-600">{errors.description}</span> : null}
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('form.category')}</span>
              <select className="input-field" value={form.category} onChange={(event) => setField('category', event.target.value)}>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {tr('category', category)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('form.department')}</span>
              <select className="input-field" value={form.department} onChange={(event) => setField('department', event.target.value)}>
                {departments.map((department) => (
                  <option key={department} value={department}>
                    {tr('department', department)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('form.ownerRole')}</span>
              <select className="input-field" value={form.owner} onChange={(event) => setField('owner', event.target.value)}>
                <option value="">{t('form.selectOwner')}</option>
                {uniqueRoles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
              {errors.owner ? <span className="mt-1 block text-xs text-rose-600">{errors.owner}</span> : null}
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('form.responsible')}</span>
              <select className="input-field" value={form.responsible} onChange={(event) => setField('responsible', event.target.value)}>
                <option value="">{t('form.selectResponsible')}</option>
                {uniqueUsers.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              {errors.responsible ? <span className="mt-1 block text-xs text-rose-600">{errors.responsible}</span> : null}
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('form.statusOnSubmit')}</span>
              <select className="input-field" value={form.status} onChange={(event) => setField('status', event.target.value)}>
                <option value="Draft">{tr('status', 'Draft')}</option>
                <option value="Pending Review">{tr('status', 'Pending Review')}</option>
              </select>
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('form.dueDate')}</span>
              <input type="date" className="input-field" value={form.dueDate} onChange={(event) => setField('dueDate', event.target.value)} />
              {errors.dueDate ? <span className="mt-1 block text-xs text-rose-600">{errors.dueDate}</span> : null}
            </label>
            <label className="md:col-span-2">
              <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('form.tags')}</span>
              <input className="input-field" value={form.tags} onChange={(event) => setField('tags', event.target.value)} placeholder={t('form.tagsPlaceholder')} />
            </label>
            <label className="md:col-span-2">
              <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('form.existingControls')}</span>
              <textarea rows={3} className="input-field resize-none" value={form.existingControlsText} onChange={(event) => setField('existingControlsText', event.target.value)} />
            </label>
            <label className="md:col-span-2">
              <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('form.plannedControls')}</span>
              <textarea rows={3} className="input-field resize-none" value={form.plannedControlsText} onChange={(event) => setField('plannedControlsText', event.target.value)} />
            </label>
          </div>
        </div>

        <div className="panel p-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('form.financialInput')}</h2>
          <div className="mt-3 space-y-3">
            <label>
              <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('form.probability')}</span>
              <input type="range" min="0.01" max="0.99" step="0.01" value={form.probability} onChange={(event) => setField('probability', Number(event.target.value))} className="w-full accent-[#0041B6]" />
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{formatPercent(form.probability)}</div>
              {errors.probability ? <span className="mt-1 block text-xs text-rose-600">{errors.probability}</span> : null}
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('form.impactMin')}</span>
              <input type="number" className="input-field" value={form.impactMin} onChange={(event) => setField('impactMin', Number(event.target.value))} />
              {errors.impactMin ? <span className="mt-1 block text-xs text-rose-600">{errors.impactMin}</span> : null}
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('form.impactMostLikely')}</span>
              <input type="number" className="input-field" value={form.impactMostLikely} onChange={(event) => setField('impactMostLikely', Number(event.target.value))} />
              {errors.impactMostLikely ? <span className="mt-1 block text-xs text-rose-600">{errors.impactMostLikely}</span> : null}
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('form.impactMax')}</span>
              <input type="number" className="input-field" value={form.impactMax} onChange={(event) => setField('impactMax', Number(event.target.value))} />
              {errors.impactMax ? <span className="mt-1 block text-xs text-rose-600">{errors.impactMax}</span> : null}
            </label>
          </div>

          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-[#2F4878] dark:bg-[#10203D]/80">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('form.previewExpectedLoss')}</p>
            <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(expectedLoss)}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('form.severity')}: {tr('severity', severity)}</p>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setForm(initialState)}>
              {t('common.reset')}
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? t('form.creating') : t('form.create')}
            </button>
          </div>
        </div>
      </div>
    </form>
  )
}

