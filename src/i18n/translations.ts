export type Lang = 'en' | 'zh'

export interface Dict {
  nav: { brand: string; archive: string; login: string; logout: string }
  common: { loading: string; readTime: (n: number) => string }
  auth: {
    titleSignIn: string; titleSignUp: string; titleVerify: string
    name: string; email: string; password: string; otp: string
    signIn: string; signUp: string; confirm: string; resend: string
    google: string; github: string
    haveAccount: string; noAccount: string; goSignIn: string; goSignUp: string
    msgCodeSent: string; msgVerifyFail: string; msgEmailNotVerified: string
    msgSignInFail: (m: string) => string; msgSignUpFail: (m: string) => string
  }
  home: {
    folio: string; heroTitleL1: string; heroTitleL2: string; heroSubtitle: string
    subscribeFree: string; subscribeStart: string; trustLine: string
    subscribed: string; viewArchive: string; unsubscribe: string; loginToSubscribe: string
    emailLang: string
    langZh: string
    langEn: string
    sampleTitle: string; sampleBadge: string; sampleSubject: string
    sampleSummaryTitle: string; sampleSummary: string; sampleStatus: string
    sampleOverviewTitle: string
    thIndex: string; thClose: string; thChange: string; thTech: string
    rows: Array<{ name: string; close: string; change: string; tech: string }>
    sampleFooter: string
    contentsTitle: string; contentsSub: string; contents: string[]
    whyTitle: string; why: Array<{ title: string; desc: string }>
    sourcesLabel: string; sources: string[]
    bottomTitle: string; bottomSub: string; disclaimer: string
  }
  reports: { title: string; subtitle: string; needSub: string; goSubscribe: string; empty: string }
  detail: { back: string; cannotLoad: string }
  share: { share: string; shareOnX: string; copy: string; copied: string; tweet: (title: string) => string }
  pub: { tagline: string; subscribeCta: string; subscribeBtn: string; notFound: string; explore: string }
}

export const translations: Record<Lang, Dict> = {
  en: {
    nav: { brand: 'US Stock Daily', archive: 'Archive', login: 'Sign in', logout: 'Sign out' },
    common: { loading: 'Loading…', readTime: (n) => `${n} min read` },
    auth: {
      titleSignIn: 'Sign in', titleSignUp: 'Create account', titleVerify: 'Verify email',
      name: 'Name', email: 'Email', password: 'Password (min 6 chars)', otp: '6-digit code',
      signIn: 'Sign in', signUp: 'Sign up', confirm: 'Confirm', resend: 'Resend code',
      google: 'Sign in with Google', github: 'Sign in with GitHub',
      haveAccount: 'Already have an account?', noAccount: "Don't have an account?",
      goSignIn: 'Sign in', goSignUp: 'Sign up',
      msgCodeSent: 'A verification code was sent to your email. Please enter it.',
      msgVerifyFail: 'Invalid or expired code',
      msgEmailNotVerified: 'Email not verified — please verify first',
      msgSignInFail: (m) => `Sign in failed: ${m}`,
      msgSignUpFail: (m) => `Sign up failed: ${m}`,
    },
    home: {
      folio: 'Generated live by AI · key figures cite their sources',
      heroTitleL1: 'After the closing bell,',
      heroTitleL2: 'a US-market recap you can actually read, free to your inbox.',
      heroSubtitle:
        'Indices, sector rotation, the Magnificent 7, macro and rates, institutional views, tomorrow’s game plan, and risk alerts. A professional 15-section closing report, delivered every weekday after the US close.',
      subscribeFree: 'Subscribe free in 30 seconds →',
      subscribeStart: 'Subscribe free, start now →',
      trustLine: 'Always free · Unsubscribe anytime · At most 5 emails a week',
      subscribed: '✓ Subscribed', viewArchive: 'View archive →', unsubscribe: 'Unsubscribe',
      loginToSubscribe: 'Sign in to subscribe',
      emailLang: 'Email language',
      langZh: '中文',
      langEn: 'English',
      sampleTitle: 'Real sample · see what you’ll receive',
      sampleBadge: 'excerpt',
      sampleSubject: 'US Stock Closing Report｜2026-06-07',
      sampleSummaryTitle: 'One-line summary',
      sampleSummary:
        'US stocks suffered their worst rout since April 2025 on Friday: the Nasdaq plunged 4.18% and the Philadelphia Semiconductor Index crashed 10.03%, wiping out over $1.3T in market cap. A hotter-than-expected jobs report sparked rate-hike fears, compounded by Broadcom’s soft results; AI hardware collapsed across the board in a textbook risk-off session with the VIX spiking.',
      sampleStatus: 'Market state: indices down hard, breadth collapsing, AI-hardware leadership under systemic selling, liquidity fear in control.',
      sampleOverviewTitle: 'Index overview',
      thIndex: 'Index', thClose: 'Close', thChange: 'Change', thTech: 'Technicals',
      rows: [
        { name: 'Dow Jones', close: '49,910.59', change: '-1.35%', tech: 'Below 20-DMA' },
        { name: 'S&P 500', close: '7,365.08', change: '-2.64%', tech: 'Heavy volume' },
        { name: 'Nasdaq', close: '25,838.94', change: '-4.18%', tech: 'Sharp breakdown' },
        { name: 'SOX Semis', close: '—', change: '-10.03%', tech: 'Worst day since 2020' },
      ],
      sampleFooter:
        'The full report runs 15 sections: intraday recap, macro and rates, sector rotation, key names, institutional views, tomorrow’s plan and risk alerts, with sources cited for the figures that matter.',
      contentsTitle: 'Every report answers the questions that matter',
      contentsSub: 'Why the market moved, what money is buying and selling, and what to watch tomorrow. Every weekday issue runs the same 15 sections.',
      contents: [
        'Index overview', 'Intraday recap', 'Macro & rates', 'Sector performance',
        'Themes & style', 'Market breadth', 'Technicals', 'Key names & movers',
        'Earnings calendar', 'Institutional views & flows', 'Sector rotation', 'Watchlist',
        'Tomorrow’s game plan', 'Risk alerts', 'Bottom line',
      ],
      whyTitle: 'Why you can trust it',
      why: [
        { title: 'Real data, cited sources', desc: 'The agent pulls live market data and cites sources for the key figures, so nothing is invented.' },
        { title: 'A professional 15-section format', desc: 'From indices to single names, macro to tomorrow’s plan, built on a real analyst recap framework.' },
        { title: 'Free, and never spammy', desc: 'One email after the close on trading days. Unsubscribe anytime, in a single click.' },
      ],
      sourcesLabel: 'Researched from',
      sources: ['CNBC', 'Reuters', 'Bloomberg', 'Yahoo Finance', 'Nasdaq', 'CME FedWatch', 'FRED'],
      bottomTitle: 'Let this report do your recap after tomorrow’s close',
      bottomSub: 'Subscribe free. Delivered every weekday after the US close.',
      disclaimer: 'Content is AI-generated and for reference only; it is not investment advice. Markets carry risk; invest with care.',
    },
    reports: {
      title: 'Report archive',
      subtitle: 'Every weekday’s US closing report, newest first.',
      needSub: 'An active subscription is required to view reports.',
      goSubscribe: 'Subscribe', empty: 'No reports yet.',
    },
    detail: { back: '← Back to archive', cannotLoad: 'Cannot load this report (active subscription required).' },
    share: {
      share: 'Share', shareOnX: 'Share on X', copy: 'Copy link', copied: 'Copied!',
      tweet: (title) => `${title} — a free daily US-market recap`,
    },
    pub: {
      tagline: 'A professional US-market closing recap, free to your inbox every weekday.',
      subscribeCta: 'Get a recap like this every trading day, free.',
      subscribeBtn: 'Subscribe free →',
      notFound: 'Report not found.',
      explore: 'Explore US Stock Daily →',
    },
  },
  zh: {
    nav: { brand: '美股日报', archive: '日报归档', login: '登录', logout: '退出' },
    common: { loading: '加载中…', readTime: (n) => `${n} 分钟阅读` },
    auth: {
      titleSignIn: '登录', titleSignUp: '注册', titleVerify: '验证邮箱',
      name: '昵称', email: '邮箱', password: '密码（≥6 位）', otp: '6 位验证码',
      signIn: '登录', signUp: '注册', confirm: '确认', resend: '重发验证码',
      google: 'Google 登录', github: 'GitHub 登录',
      haveAccount: '已有账号？', noAccount: '没有账号？', goSignIn: '去登录', goSignUp: '去注册',
      msgCodeSent: '验证码已发送到邮箱，请输入。',
      msgVerifyFail: '验证码无效或已过期',
      msgEmailNotVerified: '邮箱未验证，请先完成验证',
      msgSignInFail: (m) => `登录失败：${m}`,
      msgSignUpFail: (m) => `注册失败：${m}`,
    },
    home: {
      folio: 'AI 联网实时生成 · 关键数据标注来源',
      heroTitleL1: '每个交易日收盘后，',
      heroTitleL2: '一份看得懂的美股复盘，免费送到你邮箱。',
      heroSubtitle:
        '大盘、板块轮动、七巨头异动、宏观利率、机构观点、明日交易计划、风险提示，一份专业 15 节结构的《美股收盘日报》，每个工作日美西收盘后准时送达。',
      subscribeFree: '免费订阅，30 秒搞定 →',
      subscribeStart: '免费订阅，立即开始 →',
      trustLine: '永久免费 · 随时退订 · 一周最多 5 封',
      subscribed: '✓ 已订阅', viewArchive: '查看日报归档 →', unsubscribe: '取消订阅',
      loginToSubscribe: '登录后订阅',
      emailLang: '邮件语言',
      langZh: '中文',
      langEn: 'English',
      sampleTitle: '真实样例 · 看看你会收到什么',
      sampleBadge: '节选',
      sampleSubject: '美股收盘日报｜2026-06-07',
      sampleSummaryTitle: '今日一句话总结',
      sampleSummary:
        '美股周五遭遇 2025 年 4 月以来最惨烈血洗，纳指暴跌 4.18%，费城半导体指数狂泻 10.03%，单日蒸发超 1.3 万亿美元市值。导火索是超预期非农数据引发加息恐慌，叠加博通财报不及预期、AI 硬件链全线崩盘，资金呈现典型 risk-off，VIX 飙升，市场宽度严重恶化。',
      sampleStatus: '今日市场状态：指数暴跌、宽度崩溃，AI 硬件主线遭遇系统性抛售，流动性恐慌主导交易。',
      sampleOverviewTitle: '大盘表现总览',
      thIndex: '指数', thClose: '收盘', thChange: '涨跌幅', thTech: '技术状态',
      rows: [
        { name: '道琼斯', close: '49,910.59', change: '-1.35%', tech: '跌破 20 日线' },
        { name: '标普 500', close: '7,365.08', change: '-2.64%', tech: '大幅放量' },
        { name: '纳斯达克', close: '25,838.94', change: '-4.18%', tech: '重挫破位' },
        { name: 'SOX 半导体', close: '—', change: '-10.03%', tech: '2020 年来最大跌幅' },
      ],
      sampleFooter:
        '完整日报共 15 节：盘中复盘、宏观利率、板块轮动、重点个股、机构观点、明日交易计划、风险提示等，关键数据均标注来源链接。',
      contentsTitle: '每份日报，都帮你回答这些问题',
      contentsSub: '市场为什么涨跌、资金在买什么卖什么、明天该关注什么。每个工作日同样的 15 节结构。',
      contents: [
        '大盘表现总览', '盘中走势复盘', '宏观与利率', '板块表现',
        '主题与风格', '市场宽度', '技术面分析', '重点个股异动',
        '财报日历', '机构观点与资金流', '板块轮动判断', '重点关注股',
        '明日交易计划', '风险提示', '最终结论',
      ],
      whyTitle: '为什么可以信赖',
      why: [
        { title: '真实数据，标注来源', desc: 'AI 联网获取当日行情，关键数据附来源链接，不凭空编造。' },
        { title: '专业 15 节结构', desc: '从大盘到个股、从宏观到明日计划，按专业复盘框架成文。' },
        { title: '永久免费，不打扰', desc: '只在工作日收盘后一封，随时一键退订。' },
      ],
      sourcesLabel: '研究来源',
      sources: ['CNBC', 'Reuters', 'Bloomberg', 'Yahoo Finance', 'Nasdaq', 'CME FedWatch', 'FRED'],
      bottomTitle: '每天收盘后，就让这份日报替你做复盘',
      bottomSub: '免费订阅，每个工作日美西收盘后准时送达。',
      disclaimer: '本服务内容由 AI 生成，仅供参考，不构成任何投资建议。市场有风险，决策需谨慎。',
    },
    reports: {
      title: '日报归档',
      subtitle: '每个工作日的美股收盘日报，最新在前。',
      needSub: '需要有效订阅才能查看日报。',
      goSubscribe: '去订阅', empty: '暂无日报。',
    },
    detail: { back: '← 返回归档', cannotLoad: '无法加载该日报（需有效订阅）。' },
    share: {
      share: '分享', shareOnX: '分享到 X', copy: '复制链接', copied: '已复制！',
      tweet: (title) => `${title}｜免费美股收盘日报`,
    },
    pub: {
      tagline: '专业美股收盘复盘，每个工作日免费送到你邮箱。',
      subscribeCta: '每个交易日都收到这样的复盘，免费。',
      subscribeBtn: '免费订阅 →',
      notFound: '未找到该日报。',
      explore: '了解美股日报 →',
    },
  },
}
