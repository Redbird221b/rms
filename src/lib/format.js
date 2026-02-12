const currencyFormatter = new Intl.NumberFormat('uz-UZ', {
  style: 'currency',
  currency: 'UZS',
  maximumFractionDigits: 0,
})

const shortCurrencyFormatter = new Intl.NumberFormat('uz-UZ', {
  notation: 'compact',
  style: 'currency',
  currency: 'UZS',
  maximumFractionDigits: 1,
})

const localeByLanguage = {
  ru: 'ru-RU',
  en: 'en-GB',
  uz: 'uz-UZ',
}

const dateFormatterByLocale = new Map()

export function formatCurrency(amount) {
  return currencyFormatter.format(Number(amount) || 0)
}

export function formatCompactCurrency(amount) {
  return shortCurrencyFormatter.format(Number(amount) || 0)
}

export function formatPercent(value) {
  return `${Math.round((Number(value) || 0) * 100)}%`
}

export function formatDate(value) {
  if (!value) {
    return '-'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '-'
  }
  const language =
    typeof window !== 'undefined' ? window.localStorage.getItem('erm_language_v1') ?? 'ru' : 'ru'
  const locale = localeByLanguage[language] ?? 'en-GB'
  if (!dateFormatterByLocale.has(locale)) {
    dateFormatterByLocale.set(
      locale,
      new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
      }),
    )
  }
  return dateFormatterByLocale.get(locale).format(date)
}
