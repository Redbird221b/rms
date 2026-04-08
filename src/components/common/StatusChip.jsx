import clsx from 'clsx'
import { useI18n } from '../../app/context/I18nContext'

const styleByStatus = {
  Draft: 'bg-[#ECECEC] text-[#4E4E4E] dark:bg-[#324B79] dark:text-[#E6EEFF]',
  'Under Risk Review': 'bg-[#FFF1EA] text-[#B53700] dark:bg-[#B54616] dark:text-white',
  'Info Requested by Risk Manager': 'bg-[#FFE8D8] text-[#9E3202] dark:bg-[#9E3202] dark:text-white',
  'Rejected by Risk Manager': 'bg-[#FFDDD0] text-[#9B3000] dark:bg-[#A33300] dark:text-white',
  'Committee Review 1': 'bg-[#E8EFFF] text-[#003EAB] dark:bg-[#2D4D86] dark:text-white',
  'Info Requested by Committee': 'bg-[#DCEBFF] text-[#0F4E9D] dark:bg-[#24508A] dark:text-white',
  'Accepted for Mitigation': 'bg-[#DDE8FF] text-[#003EAB] dark:bg-[#1E54BE] dark:text-white',
  'Pending Review': 'bg-[#FFF1EA] text-[#B53700] dark:bg-[#B54616] dark:text-white',
  'Requested Info': 'bg-[#FFE8D8] text-[#9E3202] dark:bg-[#9E3202] dark:text-white',
  Approved: 'bg-[#DDE8FF] text-[#003EAB] dark:bg-[#1E54BE] dark:text-white',
  'In Mitigation': 'bg-[#E8EFFF] text-[#003EAB] dark:bg-[#2D4D86] dark:text-white',
  'Committee Review 2': 'bg-[#E8EFFF] text-[#003EAB] dark:bg-[#2D4D86] dark:text-white',
  'Additional Mitigation Required': 'bg-[#FFE8D8] text-[#9E3202] dark:bg-[#9E3202] dark:text-white',
  Overdue: 'bg-[#FFE0D2] text-[#992E00] dark:bg-[#C43F0A] dark:text-white',
  Closed: 'bg-[#E6E6E6] text-[#4A4A4A] dark:bg-[#2E456F] dark:text-[#E6EEFF]',
  'Risk Accepted': 'bg-[#E6E6E6] text-[#4A4A4A] dark:bg-[#2E456F] dark:text-[#E6EEFF]',
  Rejected: 'bg-[#FFDDD0] text-[#9B3000] dark:bg-[#A33300] dark:text-white',
}

export default function StatusChip({ status, compact = false }) {
  const { tr } = useI18n()

  return (
    <span
      className={clsx(
        compact
          ? 'inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium'
          : 'inline-flex items-center rounded-md px-2 py-1 text-xs font-medium',
        styleByStatus[status] ?? styleByStatus.Draft,
      )}
    >
      {tr('status', status)}
    </span>
  )
}

