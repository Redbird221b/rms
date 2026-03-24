import { ShieldAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useI18n } from '../app/context/I18nContext'

export default function AccessDenied() {
  const { t } = useI18n()

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="panel max-w-lg p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF1EA] text-[#DB4300] dark:bg-[#2B1A16] dark:text-[#FFB18B]">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-xl font-semibold text-slate-900 dark:text-slate-100">{t('access.title')}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{t('access.desc')}</p>
        <div className="mt-5 flex justify-center">
          <Link to="/dashboard" className="btn-primary">
            {t('access.back')}
          </Link>
        </div>
      </div>
    </div>
  )
}
