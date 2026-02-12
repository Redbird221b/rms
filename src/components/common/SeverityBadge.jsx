import clsx from 'clsx'
import { useI18n } from '../../app/context/I18nContext'

const severityStyles = {
  Low: 'bg-[#EAEAEA] text-[#4F4F4F] dark:bg-[#314A77] dark:text-[#E6EEFF]',
  Medium: 'bg-[#DFEAFF] text-[#003EAB] dark:bg-[#1D4EA9] dark:text-white',
  High: 'bg-[#FFE9DB] text-[#A83600] dark:bg-[#B94A16] dark:text-white',
  Critical: 'bg-[#DB4300] text-white dark:bg-[#DB4300] dark:text-white',
}

export default function SeverityBadge({ severity }) {
  const { tr } = useI18n()

  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold',
        severityStyles[severity] ?? severityStyles.Low,
      )}
    >
      {tr('severity', severity)}
    </span>
  )
}

