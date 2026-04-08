import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../app/context/I18nContext'
import { recalculateRisk } from '../../lib/compute'

const baseState = {
  title: '',
  description: '',
  category: '',
  department: '',
  owner: '',
  responsible: '',
  status: 'Draft',
  probability: 0,
  impactMin: 0,
  impactMostLikely: 0,
  impactMax: 0,
  residualScore: 0,
  tags: '',
  existingControlsText: '',
  plannedControlsText: '',
}

function normalizeInitialValues(initialValues, categories, departments) {
  if (!initialValues) {
    return {
      ...baseState,
      category: categories[0] ?? '',
      department: departments[0] ?? '',
    }
  }

  return {
    ...baseState,
    ...initialValues,
    category: initialValues.category || categories[0] || '',
    department: initialValues.department || departments[0] || '',
    status: initialValues.status || 'Draft',
    tags: Array.isArray(initialValues.tags) ? initialValues.tags.join(', ') : initialValues.tags || '',
  }
}

export default function RiskForm({
  categories,
  departments,
  onSubmit,
  submitting,
  initialValues = null,
  submitLabel,
  submittingLabel,
  resetOnSuccess = true,
}) {
  const { t, tr } = useI18n()
  const resetSnapshot = useMemo(
    () => normalizeInitialValues(initialValues, categories, departments),
    [initialValues, categories, departments],
  )
  const [form, setForm] = useState(() => resetSnapshot)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    setForm(normalizeInitialValues(initialValues, categories, departments))
    setErrors({})
  }, [initialValues])

  useEffect(() => {
    setForm((current) => {
      const nextCategory = categories.includes(current.category) ? current.category : (categories[0] ?? '')
      const nextDepartment = departments.includes(current.department) ? current.department : (departments[0] ?? '')

      if (current.category === nextCategory && current.department === nextDepartment) {
        return current
      }

      return {
        ...current,
        category: nextCategory,
        department: nextDepartment,
      }
    })
  }, [categories, departments])

  const setField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const validate = () => {
    const nextErrors = {}
    if (!form.title.trim()) nextErrors.title = t('form.validation.title')
    if (!form.description.trim()) nextErrors.description = t('form.validation.description')
    if (!form.category) nextErrors.category = t('form.validation.category')
    if (!form.department) nextErrors.department = t('form.validation.department')
    return nextErrors
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const validationErrors = validate()
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length) {
      return
    }

    const payload = recalculateRisk({
      ...form,
      tags: form.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      attachments: [],
      financialAssessmentStatus: 'Pending Assessment',
    })

    await onSubmit(payload)

    if (resetOnSuccess) {
      setForm(normalizeInitialValues(null, categories, departments))
      setErrors({})
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.6fr)_340px]">
        <div className="panel p-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {t('form.riskInformation')}
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            {!categories.length || !departments.length ? (
              <div className="md:col-span-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
                {t('form.referenceSetupHint')}
              </div>
            ) : null}
            <label className="md:col-span-2">
              <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                {t('form.title')}
              </span>
              <input
                className="input-field"
                value={form.title}
                onChange={(event) => setField('title', event.target.value)}
              />
              {errors.title ? <span className="mt-1 block text-xs text-rose-600">{errors.title}</span> : null}
            </label>
            <label className="md:col-span-2">
              <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                {t('form.description')}
              </span>
              <textarea
                rows={4}
                className="input-field resize-none"
                value={form.description}
                onChange={(event) => setField('description', event.target.value)}
              />
              {errors.description ? <span className="mt-1 block text-xs text-rose-600">{errors.description}</span> : null}
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                {t('form.category')}
              </span>
              <select
                className="input-field"
                value={form.category}
                onChange={(event) => setField('category', event.target.value)}
                disabled={!categories.length}
              >
                <option value="">{t('form.selectCategory')}</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {tr('category', category)}
                  </option>
                ))}
              </select>
              {errors.category ? <span className="mt-1 block text-xs text-rose-600">{errors.category}</span> : null}
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                {t('form.department')}
              </span>
              <select
                className="input-field"
                value={form.department}
                onChange={(event) => setField('department', event.target.value)}
                disabled={!departments.length}
              >
                <option value="">{t('form.selectDepartment')}</option>
                {departments.map((department) => (
                  <option key={department} value={department}>
                    {tr('department', department)}
                  </option>
                ))}
              </select>
              {errors.department ? <span className="mt-1 block text-xs text-rose-600">{errors.department}</span> : null}
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                {t('form.statusOnSubmit')}
              </span>
              <select
                className="input-field"
                value={form.status}
                onChange={(event) => setField('status', event.target.value)}
              >
                <option value="Draft">{tr('status', 'Draft')}</option>
                <option value="Under Risk Review">{tr('status', 'Under Risk Review')}</option>
              </select>
            </label>
            <label className="md:col-span-2">
              <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                {t('form.tags')}
              </span>
              <input
                className="input-field"
                value={form.tags}
                onChange={(event) => setField('tags', event.target.value)}
                placeholder={t('form.tagsPlaceholder')}
              />
            </label>
            <label className="md:col-span-2">
              <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                {t('form.existingControls')}
              </span>
              <textarea
                rows={3}
                className="input-field resize-none"
                value={form.existingControlsText}
                onChange={(event) => setField('existingControlsText', event.target.value)}
              />
            </label>
            <label className="md:col-span-2">
              <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                {t('form.plannedControls')}
              </span>
              <textarea
                rows={3}
                className="input-field resize-none"
                value={form.plannedControlsText}
                onChange={(event) => setField('plannedControlsText', event.target.value)}
              />
            </label>
          </div>
        </div>

        <aside className="panel p-4 xl:sticky xl:top-6 xl:self-start">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {t('form.workflowTitle')}
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {t('create.subtitle')}
          </p>

          <div className="mt-4 space-y-3">
            <div className="rounded-2xl border border-[#D9D9D9] bg-[#F7F8FB] p-3 dark:border-[#2F4878] dark:bg-[#10203D]/80">
              <div className="flex gap-3">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#E8EFFF] text-xs font-semibold text-[#0041B6] dark:bg-[#17305B] dark:text-[#C7D8FF]">
                  1
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#0041B6] dark:text-[#BFD2FF]">
                    {t('form.workflowStep1')}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {t('form.workflowStep1Desc')}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-dashed border-[#C9D4E7] bg-white p-3 dark:border-[#34507F] dark:bg-[#13264A]">
              <div className="flex gap-3">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#FFF1EA] text-xs font-semibold text-[#DB4300] dark:bg-[#5A2D1F] dark:text-[#FFBE9F]">
                  2
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#DB4300] dark:text-[#FFBE9F]">
                    {t('form.workflowStep2')}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {t('form.workflowStep2Desc')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-[#2F4878] dark:bg-[#10203D]/70">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
              {t('form.workflowResultTitle')}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {t('form.workflowResultDesc')}
            </p>
          </div>

          <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4 dark:border-[#243D69]">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setForm(resetSnapshot)
                setErrors({})
              }}
            >
              {t('common.reset')}
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? submittingLabel || t('form.creating') : submitLabel || t('form.create')}
            </button>
          </div>
        </aside>
      </div>
    </form>
  )
}
