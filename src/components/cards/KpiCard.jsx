import { motion } from 'framer-motion'

export default function KpiCard({ label, value, helper, icon: Icon }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      whileHover={{ y: -2 }}
      className="panel p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">{value}</p>
          {helper ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{helper}</p> : null}
        </div>
        {Icon ? (
          <span className="rounded-lg bg-[#E8EFFF] p-2 text-[#0041B6] dark:bg-[#0041B6]/25 dark:text-[#B8CCFF]">
            <Icon className="h-4 w-4" />
          </span>
        ) : null}
      </div>
    </motion.div>
  )
}
