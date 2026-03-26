import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../app/context/I18nContext'

export default function ActionModal({
  open,
  title,
  description,
  confirmLabel,
  requireComment = false,
  confirmDisabled = false,
  initialComment = '',
  children,
  onClose,
  onConfirm,
}) {
  const { t } = useI18n()
  const [comment, setComment] = useState(initialComment)
  const [error, setError] = useState('')
  const textareaRef = useRef(null)

  useEffect(() => {
    if (!open) {
      return
    }
      setComment(initialComment)
      setError('')
    const timer = window.setTimeout(() => textareaRef.current?.focus(), 40)
    return () => window.clearTimeout(timer)
  }, [initialComment, open])

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

  const isConfirmDisabled = useMemo(
    () => confirmDisabled || (requireComment && !comment.trim()),
    [comment, confirmDisabled, requireComment],
  )

  const handleSubmit = () => {
    if (requireComment && !comment.trim()) {
      setError(t('modal.commentRequired'))
      return
    }
    onConfirm(comment.trim())
    setError('')
    setComment('')
  }

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            className="fixed inset-0 z-50 bg-[#0B1326]/55"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            onClick={onClose}
            aria-label={t('common.close')}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <div className="w-full max-w-lg rounded-xl border border-[#D9D9D9] bg-white p-4 shadow-lg dark:border-[#2F4878] dark:bg-[#13264A]">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
              {description ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p> : null}
              {children ? <div className="mt-4">{children}</div> : null}
              <label className="mt-4 block space-y-1">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {requireComment ? t('modal.commentRequiredLabel') : t('modal.commentOptional')}
                </span>
                <textarea
                  ref={textareaRef}
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  rows={4}
                  className="input-field resize-none"
                />
                {error ? <span className="text-xs text-rose-600 dark:text-rose-400">{error}</span> : null}
              </label>
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" className="btn-secondary" onClick={onClose}>
                  {t('common.cancel')}
                </button>
                <button type="button" className="btn-primary" onClick={handleSubmit} disabled={isConfirmDisabled}>
                  {confirmLabel || t('common.save')}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  )
}
