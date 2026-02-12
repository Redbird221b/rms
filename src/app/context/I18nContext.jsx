import { createContext, useContext, useMemo, useState } from 'react'
import { supportedLanguages, tByLang, translateEnum } from '../../lib/i18n'
import { loadFromStorage, saveToStorage } from '../../lib/storage'

const STORAGE_KEY = 'erm_language_v1'
const I18nContext = createContext(null)

export function I18nProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    const saved = loadFromStorage(STORAGE_KEY, 'ru')
    if (typeof saved !== 'string') {
      return 'ru'
    }
    return supportedLanguages.some((item) => item.code === saved) ? saved : 'ru'
  })

  const setLanguage = (nextLanguage) => {
    setLanguageState(nextLanguage)
    saveToStorage(STORAGE_KEY, nextLanguage)
  }

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      supportedLanguages,
      t: (key, vars) => tByLang(language, key, vars),
      tr: (group, valueToTranslate) => translateEnum(language, group, valueToTranslate),
    }),
    [language],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider')
  }
  return context
}
