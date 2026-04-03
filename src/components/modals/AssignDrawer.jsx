import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useI18n } from '../../app/context/I18nContext'

export default function AssignDrawer({
  open,
  users,
  initialResponsible,
  onClose,
  onAssign,
}) {
  const { t } = useI18n()
  const [responsible, setResponsible] = useState('')
  const [note, setNote] = useState('')

  const uniqueUsers = Array.from(
    new Map(
      users
        .filter(Boolean)
        .map((user) => {
          const value = String(user.username || user.email || user.id || user.name || '').trim()
          if (!value) {
            return null
          }

          const label = String(user.name || user.full_name || user.username || user.email || value).trim()
          return [
            value,
            {
              value,
              label,
              user,
            },
          ]
        })
        .filter(Boolean),
    ).values(),
  )

  useEffect(() => {
    if (!open) {
      return
    }
    const initialMatch = uniqueUsers.find(({ user, value }) =>
      [user?.username, user?.email, user?.id, user?.name, value]
        .map((item) => String(item || '').trim())
        .filter(Boolean)
        .includes(String(initialResponsible || '').trim()),
    )

    setResponsible(initialMatch?.value || '')
    setNote('')
  }, [initialResponsible, open, uniqueUsers])

  useEffect(() => {
    if (!open) {
      return undefined
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, open])

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            className="fixed inset-0 z-50 bg-[#0B1326]/52"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            onClick={onClose}
            aria-label={t('common.close')}
          />
          <motion.aside
            className="fixed inset-y-0 right-0 z-50 w-full max-w-md border-l border-[#D9D9D9] bg-white p-4 shadow-lg dark:border-[#2F4878] dark:bg-[#13264A]"
            initial={{ x: 28, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 20, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{t('modal.assignTitle')}</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {t('modal.assignDesc')}
            </p>
            <label className="mt-4 block space-y-1">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('modal.responsibleUser')}</span>
              <select
                value={responsible}
                onChange={(event) => setResponsible(event.target.value)}
                className="input-field"
              >
                <option value="">{t('modal.selectUser')}</option>
                {uniqueUsers.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-4 block space-y-1">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('modal.comment')}</span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={4}
                className="input-field resize-none"
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={onClose}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => onAssign(uniqueUsers.find((item) => item.value === responsible)?.user ?? null, note)}
                disabled={!responsible}
              >
                {t('modal.assign')}
              </button>
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  )
}
