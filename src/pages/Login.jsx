import { useEffect, useRef } from 'react'
import { LoaderCircle, ShieldCheck } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../app/context/AuthContext'
import { useI18n } from '../app/context/I18nContext'

const LOGIN_COPY = {
  en: {
    title: 'Redirecting to Keycloak',
    subtitle: 'You will be sent to the corporate sign-in page in a moment.',
    errorTitle: 'Keycloak is unavailable',
    errorSubtitle: 'Check the authentication server and refresh the page.',
  },
  ru: {
    title: 'Перенаправляем в Keycloak',
    subtitle: 'Сейчас откроется корпоративная форма входа.',
    errorTitle: 'Keycloak недоступен',
    errorSubtitle: 'Проверь сервер аутентификации и обнови страницу.',
  },
  uz: {
    title: 'Keycloak ga yo‘naltirilmoqda',
    subtitle: 'Hozir korporativ kirish sahifasi ochiladi.',
    errorTitle: 'Keycloak mavjud emas',
    errorSubtitle: 'Autentifikatsiya serverini tekshirib, sahifani yangilang.',
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
  const { login, error } = useAuth()
  const location = useLocation()
  const redirectStartedRef = useRef(false)
  const copy = LOGIN_COPY[language] ?? LOGIN_COPY.ru

  useEffect(() => {
    if (redirectStartedRef.current || error) {
      return
    }

    redirectStartedRef.current = true
    void login({
      redirectPath: buildRedirectPath(location),
    })
  }, [error, location, login])

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <section className="panel w-full max-w-md p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[rgba(0,65,182,0.12)] text-[color:var(--brand-blue)] dark:bg-[rgba(90,132,255,0.16)] dark:text-[#AFC5FF]">
          {error ? <ShieldCheck className="h-7 w-7" /> : <LoaderCircle className="h-7 w-7 animate-spin" />}
        </div>

        <h1 className="mt-5 text-xl font-semibold text-slate-950 dark:text-white">
          {error ? copy.errorTitle : copy.title}
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          {error ? error : copy.subtitle}
        </p>
        {error ? (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{copy.errorSubtitle}</p>
        ) : null}
      </section>
    </main>
  )
}
