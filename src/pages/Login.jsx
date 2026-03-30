import { useState } from 'react'
import { motion } from 'framer-motion'
import { AlertCircle, ArrowRight, RefreshCw, ShieldCheck } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../app/context/AuthContext'
import { useI18n } from '../app/context/I18nContext'
import { KEYCLOAK_CLIENT_ID, KEYCLOAK_REALM, KEYCLOAK_URL } from '../lib/keycloak'

const transition = { duration: 0.18, ease: 'easeOut' }

const LOGIN_COPY = {
  en: {
    title: 'Sign in with Keycloak',
    subtitle: 'Use your corporate account to open the Risk Management System workspace.',
    action: 'Continue with Keycloak',
    retry: 'Retry session check',
    detailsLabel: 'Connection details',
  },
  ru: {
    title: 'Вход через Keycloak',
    subtitle: 'Используйте корпоративную учетную запись, чтобы открыть рабочее пространство Risk Management System.',
    action: 'Продолжить через Keycloak',
    retry: 'Повторить проверку сессии',
    detailsLabel: 'Параметры подключения',
  },
  uz: {
    title: 'Keycloak orqali kirish',
    subtitle: 'Risk Management System ga kirish uchun korporativ akkauntingizdan foydalaning.',
    action: 'Keycloak orqali davom etish',
    retry: 'Sessiyani qayta tekshirish',
    detailsLabel: 'Ulanish parametrlari',
  },
}

function buildRedirectPath(location) {
  const pathname = location.state?.from?.pathname || '/dashboard'
  const search = location.state?.from?.search || ''
  const hash = location.state?.from?.hash || ''
  return `${pathname}${search}${hash}`
}

export default function Login() {
  const { language } = useI18n()
  const { login, refreshSession, error } = useAuth()
  const location = useLocation()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)
  const copy = LOGIN_COPY[language] ?? LOGIN_COPY.ru

  const handleLogin = async () => {
    setIsSubmitting(true)
    try {
      await login({
        redirectPath: buildRedirectPath(location),
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRetry = async () => {
    setIsRetrying(true)
    try {
      await refreshSession()
    } finally {
      setIsRetrying(false)
    }
  }

  return (
    <main className="flex min-h-screen items-start justify-center px-4 py-8 sm:items-center sm:px-6">
      <div className="w-full max-w-[460px]">
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={transition}
          className="panel p-5 sm:p-6"
        >
          <div className="flex items-center justify-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(0,65,182,0.12)] text-[color:var(--brand-blue)] dark:bg-[rgba(90,132,255,0.16)] dark:text-[#AFC5FF]">
              <ShieldCheck className="h-6 w-6" />
            </span>
          </div>

          <h1 className="mt-4 text-center text-xl font-semibold text-slate-950 dark:text-white">
            {copy.title}
          </h1>
          <p className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400">
            {copy.subtitle}
          </p>

          {error ? (
            <div className="mt-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          <button
            type="button"
            className="btn-primary mt-5 w-full disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            onClick={() => {
              void handleLogin()
            }}
          >
            <span>{copy.action}</span>
            <ArrowRight className="ml-2 h-4 w-4" />
          </button>

          <button
            type="button"
            className="btn-secondary mt-3 w-full disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isRetrying}
            onClick={() => {
              void handleRetry()
            }}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} />
            <span>{copy.retry}</span>
          </button>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-[color:var(--brand-dark-border)] dark:bg-[color:var(--brand-dark-surface-2)] dark:text-slate-300">
            <p className="font-medium text-slate-800 dark:text-slate-100">{copy.detailsLabel}</p>
            <div className="mt-2 grid gap-1 text-xs sm:text-sm">
              <p>
                <span className="font-medium text-slate-700 dark:text-slate-200">URL:</span> {KEYCLOAK_URL}
              </p>
              <p>
                <span className="font-medium text-slate-700 dark:text-slate-200">Realm:</span> {KEYCLOAK_REALM}
              </p>
              <p>
                <span className="font-medium text-slate-700 dark:text-slate-200">Client:</span> {KEYCLOAK_CLIENT_ID}
              </p>
            </div>
          </div>
        </motion.section>
      </div>
    </main>
  )
}
