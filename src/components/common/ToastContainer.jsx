import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, CheckCircle2, X } from 'lucide-react'
import clsx from 'clsx'
import { useErm } from '../../app/context/ErmContext'
import { useI18n } from '../../app/context/I18nContext'

const iconMap = {
  success: CheckCircle2,
  error: AlertCircle,
}

export default function ToastContainer() {
  const { toasts, dismissToast } = useErm()
  const { t } = useI18n()

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[70] flex w-80 flex-col gap-2">
      <AnimatePresence>
        {toasts.map((toast) => {
          const Icon = iconMap[toast.type] ?? AlertCircle
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className={clsx(
                'pointer-events-auto rounded-lg border px-3 py-2 shadow-card',
                toast.type === 'error'
                  ? 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200',
              )}
              role="status"
              aria-live="polite"
            >
              <div className="flex items-start gap-2">
                <Icon className="mt-0.5 h-4 w-4" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{toast.title}</p>
                  {toast.message ? <p className="mt-0.5 text-xs opacity-85">{toast.message}</p> : null}
                </div>
                <button
                  type="button"
                  className="rounded p-1 opacity-70 transition-opacity hover:opacity-100"
                  onClick={() => dismissToast(toast.id)}
                  aria-label={t('modal.dismiss')}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
