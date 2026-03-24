import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { useErm } from '../../app/context/ErmContext'
import { useI18n } from '../../app/context/I18nContext'

export default function LanguageMenu() {
  const { theme } = useErm()
  const { language, setLanguage, supportedLanguages, t } = useI18n()
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)
  const isDark = theme === 'dark'

  useEffect(() => {
    if (!open) {
      return undefined
    }

    const onPointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setOpen(false)
      }
    }

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const currentLanguage = supportedLanguages.find((item) => item.code === language) ?? supportedLanguages[0]

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={clsx(
          'flex h-10 min-w-[112px] items-center justify-between gap-2 rounded-xl border px-3 text-sm transition-colors',
          'border-[#D9D9D9] bg-white text-slate-700 hover:bg-[#F6F8FC]',
          'dark:border-[#274272] dark:bg-[#132547] dark:text-[#E5ECFF] dark:hover:bg-[#1A2F59]',
        )}
      >
        <span className="text-xs font-medium text-slate-500 dark:text-[#9EB4E2]">
          {t('top.language')}
        </span>
        <span className="text-sm font-medium">{currentLanguage?.label}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className={clsx(
              'absolute right-0 top-[calc(100%+8px)] z-50 min-w-[112px] overflow-hidden rounded-xl border shadow-xl',
              'border-[#D9D9D9] bg-white dark:border-[#2F4878] dark:bg-[#132547]',
            )}
          >
            {supportedLanguages.map((item) => {
              const active = item.code === language
              return (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => {
                    setLanguage(item.code)
                    setOpen(false)
                  }}
                  className={clsx(
                    'flex w-full items-center justify-between px-3 py-2.5 text-left text-sm transition-colors',
                    active
                      ? 'bg-[#0041B6] text-white'
                      : 'text-slate-700 hover:bg-[#E8EFFF] dark:text-[#E5ECFF] dark:hover:bg-[#1A2F59]',
                  )}
                >
                  <span>{item.label}</span>
                  <span
                    className={clsx(
                      'text-[11px] uppercase tracking-[0.18em]',
                      active
                        ? 'text-white/85'
                        : 'text-slate-400 dark:text-[#9EB4E2]',
                    )}
                  >
                    {item.code}
                  </span>
                </button>
              )
            })}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
