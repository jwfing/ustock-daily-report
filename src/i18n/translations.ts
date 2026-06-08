export type Lang = 'en' | 'zh'

export interface Dict {
  nav: { brand: string; archive: string; login: string; logout: string }
  common: { loading: string }
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
    badge: string; heroTitleL1: string; heroTitleL2: string; heroSubtitle: string
    subscribeFree: string; subscribeStart: string; trustLine: string
    subscribed: string; viewArchive: string; unsubscribe: string; loginToSubscribe: string
    emailLang: string
    langZh: string
    langEn: string
    featuresTitle: string; featuresSub: string
    features: Array<{ title: string; desc: string }>
    sampleTitle: string; sampleBadge: string; sampleSubject: string
    sampleSummaryTitle: string; sampleSummary: string; sampleStatus: string
    sampleOverviewTitle: string
    thIndex: string; thClose: string; thChange: string; thTech: string
    rows: Array<{ name: string; close: string; change: string; tech: string }>
    sampleFooter: string
    why: Array<{ icon: string; title: string; desc: string }>
    stepsTitle: string; steps: Array<{ title: string; desc: string }>
    bottomTitle: string; bottomSub: string; disclaimer: string
  }
  reports: { title: string; needSub: string; goSubscribe: string; empty: string }
  detail: { back: string; cannotLoad: string }
  share: { share: string; shareOnX: string; copy: string; copied: string; tweet: (title: string) => string }
  pub: { tagline: string; subscribeCta: string; subscribeBtn: string; notFound: string; explore: string }
}

export const translations: Record<Lang, Dict> = {
  en: {
    nav: { brand: 'US Stock Daily', archive: 'Archive', login: 'Sign in', logout: 'Sign out' },
    common: { loading: 'Loading…' },
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
      badge: 'Generated live by AI · Key figures cite their sources',
      heroTitleL1: 'After every trading day,',
      heroTitleL2: 'a US-market recap you can actually read — free to your inbox',
      heroSubtitle:
        'Indices, sector rotation, the Magnificent 7, macro & rates, institutional views, tomorrow’s game plan, and risk alerts — a professional 15-section US Stock Closing Report, delivered every weekday after the US close.',
      subscribeFree: 'Subscribe free — 30 seconds →',
      subscribeStart: 'Subscribe free, start now →',
      trustLine: 'Always free · Unsubscribe anytime · At most 5 emails a week',
      subscribed: '✓ Subscribed', viewArchive: 'View archive →', unsubscribe: 'Unsubscribe',
      loginToSubscribe: 'Sign in to subscribe',
      emailLang: 'Email language',
      langZh: '中文',
      langEn: 'English',
      featuresTitle: 'Every report answers the questions that matter',
      featuresSub: 'Why the market moved, what money is buying and selling, and what to watch tomorrow.',
      features: [
        { title: 'Indices & intraday recap', desc: 'Closing levels for the big three, SOX and VIX, plus the open-to-close flow and the drivers behind the move.' },
        { title: 'Macro & rates', desc: '2/10/30Y Treasuries, rate-cut odds (FedWatch), dollar, gold and oil — each read for what it means.' },
        { title: 'Sector rotation & themes', desc: 'Strength across the 11 sectors and rotation among AI hardware, software, power and more.' },
        { title: 'Magnificent 7 & key names', desc: 'NVDA/MSFT/AAPL… moves and why, with earnings, ratings and price-target changes.' },
        { title: 'Institutional views & flows', desc: 'Wall Street strategy, target revisions, ETF flows and options activity.' },
        { title: 'Tomorrow’s plan & risks', desc: 'Key support/resistance, a watchlist for tomorrow, and the biggest risks right now.' },
      ],
      sampleTitle: 'Real sample · See what you’ll receive',
      sampleBadge: 'excerpt',
      sampleSubject: '📧 US Stock Closing Report｜2026-06-07',
      sampleSummaryTitle: '0. One-line summary',
      sampleSummary:
        'US stocks suffered their worst rout since April 2025 on Friday — the Nasdaq plunged 4.18% and the Philadelphia Semiconductor Index crashed 10.03%, wiping out over $1.3T in market cap. A hotter-than-expected jobs report sparked rate-hike fears, compounded by Broadcom’s soft results; AI hardware collapsed across the board in a textbook risk-off session with the VIX spiking.',
      sampleStatus: 'Market state: indices down hard, breadth collapsing, AI-hardware leadership under systemic selling, liquidity fear in control.',
      sampleOverviewTitle: '1. Index overview',
      thIndex: 'Index', thClose: 'Close', thChange: 'Change', thTech: 'Technicals',
      rows: [
        { name: 'Dow Jones', close: '49,910.59', change: '-1.35%', tech: 'Below 20-DMA' },
        { name: 'S&P 500', close: '7,365.08', change: '-2.64%', tech: 'Heavy volume' },
        { name: 'Nasdaq', close: '25,838.94', change: '-4.18%', tech: 'Sharp breakdown' },
        { name: 'SOX Semis', close: '—', change: '-10.03%', tech: 'Worst day since 2020' },
      ],
      sampleFooter:
        '…the full report spans 15 sections — intraday recap, macro & rates, sector rotation, key names, institutional views, tomorrow’s plan and risk alerts — with sources cited for key data.',
      why: [
        { icon: '🔎', title: 'Real data, cited sources', desc: 'AI pulls live market data and cites sources for key figures — nothing made up.' },
        { icon: '🧭', title: 'Professional 15-section format', desc: 'From indices to single names, macro to tomorrow’s plan — built on a pro recap framework.' },
        { icon: '🆓', title: 'Free, never spammy', desc: 'One email after the close on trading days. Unsubscribe anytime, one click.' },
      ],
      stepsTitle: 'Get started in three steps',
      steps: [
        { title: 'Create an account', desc: 'Sign up with email, verified in 30 seconds.' },
        { title: 'Subscribe free', desc: 'One click. No payment, no card required.' },
        { title: 'Get the report', desc: 'Delivered automatically after the US close, every weekday.' },
      ],
      bottomTitle: 'Let this report do your recap after tomorrow’s close',
      bottomSub: 'Subscribe free — delivered every weekday after the US close.',
      disclaimer: 'Content is AI-generated and for reference only; it is not investment advice. Markets carry risk; invest with care.',
    },
    reports: {
      title: 'Report archive',
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
      subscribeCta: 'Get a recap like this every trading day — free.',
      subscribeBtn: 'Subscribe free →',
      notFound: 'Report not found.',
      explore: 'Explore US Stock Daily →',
    },
  },
  zh: {
    nav: { brand: '美股日报', archive: '日报归档', login: '登录', logout: '退出' },
    common: { loading: '加载中…' },
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
      badge: 'AI 联网实时生成 · 关键数据标注来源',
      heroTitleL1: '每个交易日收盘后，',
      heroTitleL2: '一份看得懂的美股复盘，免费送到你邮箱',
      heroSubtitle:
        '大盘、板块轮动、七巨头异动、宏观利率、机构观点、明日交易计划、风险提示——一份专业 15 节结构的《美股收盘日报》，每个工作日美西收盘后准时送达。',
      subscribeFree: '免费订阅，30 秒搞定 →',
      subscribeStart: '免费订阅，立即开始 →',
      trustLine: '永久免费 · 随时退订 · 一周最多 5 封',
      subscribed: '✓ 已订阅', viewArchive: '查看日报归档 →', unsubscribe: '取消订阅',
      loginToSubscribe: '登录后订阅',
      emailLang: '邮件语言',
      langZh: '中文',
      langEn: 'English',
      featuresTitle: '每份日报，都帮你回答这些问题',
      featuresSub: '市场为什么涨跌、资金在买什么卖什么、明天该关注什么。',
      features: [
        { title: '大盘与盘中复盘', desc: '三大指数收盘、SOX、VIX，开盘到尾盘的资金动向与涨跌主因' },
        { title: '宏观与利率', desc: '2/10/30Y 美债、降息预期（FedWatch）、美元黄金原油，逐项解读市场含义' },
        { title: '板块轮动与主题', desc: '11 大板块强弱、AI 硬件/软件/电力等主题轮动，资金在买什么卖什么' },
        { title: '七巨头与重点个股', desc: 'NVDA/MSFT/AAPL… 异动与原因，财报、评级、目标价调整一网打尽' },
        { title: '机构观点与资金流', desc: '华尔街大行策略、目标点位调整、ETF 资金流与期权异动' },
        { title: '明日计划与风险', desc: '关键支撑压力位、明日观察清单，以及当前最大的风险点提示' },
      ],
      sampleTitle: '真实样例 · 看看你会收到什么',
      sampleBadge: '节选',
      sampleSubject: '📧 美股收盘日报｜2026-06-07',
      sampleSummaryTitle: '0. 今日一句话总结',
      sampleSummary:
        '美股周五遭遇 2025 年 4 月以来最惨烈血洗，纳指暴跌 4.18%，费城半导体指数狂泻 10.03%，单日蒸发超 1.3 万亿美元市值。导火索是超预期非农数据引发加息恐慌，叠加博通财报不及预期、AI 硬件链全线崩盘，资金呈现典型 risk-off，VIX 飙升，市场宽度严重恶化。',
      sampleStatus: '今日市场状态：指数暴跌、宽度崩溃，AI 硬件主线遭遇系统性抛售，流动性恐慌主导交易。',
      sampleOverviewTitle: '1. 大盘表现总览',
      thIndex: '指数', thClose: '收盘', thChange: '涨跌幅', thTech: '技术状态',
      rows: [
        { name: '道琼斯', close: '49,910.59', change: '-1.35%', tech: '跌破 20 日线' },
        { name: '标普 500', close: '7,365.08', change: '-2.64%', tech: '大幅放量' },
        { name: '纳斯达克', close: '25,838.94', change: '-4.18%', tech: '重挫破位' },
        { name: 'SOX 半导体', close: '—', change: '-10.03%', tech: '2020 年来最大跌幅' },
      ],
      sampleFooter:
        '…完整日报含盘中复盘、宏观利率、板块轮动、重点个股、机构观点、明日交易计划、风险提示等 15 节，关键数据标注来源链接。',
      why: [
        { icon: '🔎', title: '真实数据，标注来源', desc: 'AI 联网获取当日行情，关键数据附来源链接，不凭空编造。' },
        { icon: '🧭', title: '专业 15 节结构', desc: '从大盘到个股、从宏观到明日计划，按专业复盘框架成文。' },
        { icon: '🆓', title: '永久免费，不打扰', desc: '只在工作日收盘后一封，随时一键退订。' },
      ],
      stepsTitle: '三步开始',
      steps: [
        { title: '注册账号', desc: '邮箱注册，30 秒完成验证' },
        { title: '一键免费订阅', desc: '点一下订阅，无需付费、无需绑卡' },
        { title: '收报告', desc: '每个工作日美西收盘后自动送达邮箱' },
      ],
      bottomTitle: '明天收盘后，就让这份日报替你做复盘',
      bottomSub: '免费订阅，每个工作日美西收盘后准时送达。',
      disclaimer: '本服务内容由 AI 生成，仅供参考，不构成任何投资建议。市场有风险，决策需谨慎。',
    },
    reports: {
      title: '日报归档',
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
      subscribeCta: '每个交易日都收到这样的复盘——免费。',
      subscribeBtn: '免费订阅 →',
      notFound: '未找到该日报。',
      explore: '了解美股日报 →',
    },
  },
}
