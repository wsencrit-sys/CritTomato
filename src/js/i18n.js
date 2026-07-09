/**
 * Simple i18n module — auto-detects language from browser,
 * stores preference in localStorage, provides t(key) lookup.
 *
 * Supported: en, zh-CN
 */

const STORAGE_KEY = 'crit-tomato-lang';

const translations = {
  en: {
    // Clock
    'format.24h': '24h',
    'format.12h': '12h',

    // Language
    'lang.label': 'Language',

    // Timezones
    'tz.title': 'Time Zone',
    'tz.local': 'Local',

    // Pomodoro
    'pomo.title': 'Pomodoro',
    'pomo.ready': 'Ready',
    'pomo.focus': 'Focus',
    'pomo.break': 'Break',
    'pomo.paused': 'Paused',
    'pomo.start': 'Start',
    'pomo.pause': 'Pause',
    'pomo.resume': 'Resume',
    'pomo.reset': 'Reset',
    'pomo.work_label': 'Work',
    'pomo.break_label': 'Break',
    'pomo.min': 'min',
    'pomo.notify.break_title': 'Crit Tomato',
    'pomo.notify.break_body': 'Break finished! Time to focus.',
    'pomo.notify.done_title': 'Pomodoro Complete!',
    'pomo.notify.done_body': "You've finished {count} tomato{plural}. Take a break!",
    'pomo.break_popup': 'Break time, stand up!',
    'pomo.break_go': 'Get Moving',
    'pomo.focus_popup': 'Focus time!',
    'pomo.focus_go': 'Get to Work',
  },

  'zh-CN': {
    // Clock
    'format.24h': '24小时',
    'format.12h': '12小时',

    // Language
    'lang.label': '语言',

    // Timezones
    'tz.title': '时区',
    'tz.local': '本地',

    // Pomodoro
    'pomo.title': '番茄钟',
    'pomo.ready': '准备就绪',
    'pomo.focus': '专注中',
    'pomo.break': '休息',
    'pomo.paused': '已暂停',
    'pomo.start': '开始',
    'pomo.pause': '暂停',
    'pomo.resume': '继续',
    'pomo.reset': '重置',
    'pomo.work_label': '工作时长',
    'pomo.break_label': '休息时长',
    'pomo.min': '分钟',
    'pomo.notify.break_title': 'Crit Tomato',
    'pomo.notify.break_body': '休息结束！该专注了。',
    'pomo.notify.done_title': '番茄钟完成！',
    'pomo.notify.done_body': '你已完成 {count} 个番茄{plural}。休息一下吧！',
    'pomo.break_popup': '休息时间，起立！',
    'pomo.break_go': '去活动',
    'pomo.focus_popup': '专注时间！',
    'pomo.focus_go': '去工作',
  },
};

/** Detect the best language to use. */
function detectLanguage() {
  // 1. User preference in localStorage
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && translations[stored]) return stored;
  } catch { /* ignore */ }

  // 2. Browser language
  const nav = navigator.language || '';
  if (nav.startsWith('zh')) return 'zh-CN';

  return 'en';
}

let currentLang = detectLanguage();

/**
 * Get a translated string.
 * Supports {key} interpolation: t('pomo.notify.done_body', { count: 5, plural: 'es' })
 */
export function t(key, vars = {}) {
  const dict = translations[currentLang] || translations['en'];
  let text = dict[key];
  if (text === undefined) {
    console.warn(`[i18n] Missing key: ${key}`);
    return key;
  }
  for (const [k, v] of Object.entries(vars)) {
    text = text.replace(`{${k}}`, String(v));
  }
  return text;
}

/** Get current language code. */
export function getLang() {
  return currentLang;
}

/** Switch language and save preference. */
export function setLang(lang) {
  if (!translations[lang]) return;
  currentLang = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch { /* ignore */ }
}

/** Walk the DOM and set textContent for elements with data-i18n attributes. */
export function bindI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key) el.textContent = t(key);
  });

  // Also handle placeholder attributes
  root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key) el.setAttribute('placeholder', t(key));
  });
}
