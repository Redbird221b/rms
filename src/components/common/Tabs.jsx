import clsx from 'clsx'

export default function Tabs({ tabs, activeTab, onChange }) {
  return (
    <div className="mb-4 flex flex-wrap gap-1.5 rounded-lg border border-[#D9D9D9] bg-white p-1 dark:border-[#2F4878] dark:bg-[#13264A]">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onChange(tab.value)}
          className={clsx(
            'rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0041B6]',
            activeTab === tab.value
              ? 'bg-[#0041B6] text-white'
              : 'text-slate-600 hover:bg-slate-100 dark:text-[#D8E5FF] dark:hover:bg-[#1A2F59]',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
