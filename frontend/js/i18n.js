let currentLang = 'en';
let translations = {};
const listeners = [];

export async function initI18n() {
  currentLang = localStorage.getItem('language') || 'en';
  await loadLang(currentLang);
}

export async function loadLang(lang) {
  try {
    const mod = await import(`./lang/${lang}.js`);
    translations = mod.default || {};
    currentLang = lang;
    localStorage.setItem('language', lang);
    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('dir', lang === 'bn' ? 'ltr' : 'ltr');
    document.documentElement.setAttribute('data-lang', lang);
    listeners.forEach((fn) => fn(lang));
  } catch (err) {
    console.error('Failed to load language:', lang, err);
  }
}

export function t(key, ...args) {
  let text = translations[key];
  if (!text) {
    text = key;
  }
  if (args.length > 0) {
    args.forEach((arg, i) => {
      text = text.replace(`{${i}}`, arg);
    });
  }
  return text;
}

export function translatePage(container) {
  if (!container) container = document;
  const elements = container.querySelectorAll('[data-i18n]');
  elements.forEach((el) => {
    const key = el.getAttribute('data-i18n');
    const attr = el.getAttribute('data-i18n-attr');
    if (attr) {
      el.setAttribute(attr, t(key));
    } else {
      el.textContent = t(key);
    }
  });
}

export function getCurrentLang() {
  return currentLang;
}

export function onLangChange(fn) {
  listeners.push(fn);
  return () => {
    const idx = listeners.indexOf(fn);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

window.t = t;
window.translatePage = translatePage;
