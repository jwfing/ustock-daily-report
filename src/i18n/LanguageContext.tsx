import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { translations, type Dict, type Lang } from './translations'

interface LangState { lang: Lang; setLang: (l: Lang) => void; t: Dict }

const LanguageContext = createContext<LangState>({ lang: 'en', setLang: () => {}, t: translations.en })

function initialLang(): Lang {
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('lang') : null
  return stored === 'zh' || stored === 'en' ? stored : 'en' // default English
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang)

  function setLang(l: Lang) {
    setLangState(l)
    try { localStorage.setItem('lang', l) } catch { /* ignore */ }
  }

  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'
    document.title = lang === 'zh' ? '美股日报 · 免费订阅' : 'US Stock Daily · Free recap'
  }, [lang])

  return (
    <LanguageContext.Provider value={{ lang, setLang, t: translations[lang] }}>
      {children}
    </LanguageContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLang() { return useContext(LanguageContext) }
