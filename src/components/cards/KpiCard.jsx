import { motion } from 'framer-motion'

export default function KpiCard({ label, value, helper, icon: Icon }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      whileHover={{ y: -2 }}
      className="panel rounded-[22px] p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-1.5 text-[2rem] font-semibold leading-none text-slate-900 dark:text-slate-100">{value}</p>
          {helper ? <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{helper}</p> : null}
        </div>
        {Icon ? (
          <span className="rounded-2xl bg-[#EEF4FF] p-2.5 text-[#0B4FCF] dark:bg-[#17315E] dark:text-[#B8CCFF]">
            <Icon className="h-[18px] w-[18px]" />
          </span>
        ) : null}
      </div>
    </motion.div>
  )
}
