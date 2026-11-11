(function () {
  'use strict';
  const VERSION = '20261111-1';
  let standaloneAccount = null;
  const catalogs = {};
  const keysByText = new Map();
  let language = 'ar', accountId = null, saving = false, observer;
  const selector = '[data-i18n],[data-i18n-placeholder],[data-i18n-title],[data-i18n-aria-label],[data-i18n-text]';
  const valid = value => value === 'ar' || value === 'en';
  function user() {
    if (document.documentElement.hasAttribute('data-account-page')) return standaloneAccount;
    try { return typeof currentUser !== 'undefined' ? currentUser : window.currentUser; }
    catch (_) { return window.currentUser; }
  }
  function t(key, fallback = key) { return catalogs[language]?.[key] ?? catalogs.ar?.[key] ?? fallback; }
  function label(text) { return typeof text === 'string' ? t(keysByText.get(text), text) : text; }
  function setText(el, text) {
    const key = keysByText.get(text);
    el.setAttribute('data-i18n-text', String(text));
    if (key) el.setAttribute('data-i18n', key);
    else el.removeAttribute('data-i18n');
    const value = label(text);
    if (el.textContent !== value) el.textContent = value;
    return value;
  }
  async function load(next) {
    if (catalogs[next]) return;
    const response = await fetch('/locales/' + next + '.json?v=' + VERSION, {cache:'no-cache'});
    if (!response.ok) throw new Error('catalog_unavailable');
    const data = await response.json();
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('invalid_catalog');
    catalogs[next] = data;
    if (next === 'ar') for (const [key,text] of Object.entries(data)) keysByText.set(text,key);
  }
  function renderElement(el) {
    if (el.closest('[data-no-i18n],.quote-a4,.quote-doc,script,style')) return;
    const source = el.getAttribute('data-i18n-text');
    const key = el.getAttribute('data-i18n') || keysByText.get(source === '' ? el.textContent : source);
    if (source === '') el.setAttribute('data-i18n-text',el.textContent);
    if (key && el.children.length) {
      // A mobile navigation icon can be prepended after the caption is attached.
      const originals = [catalogs.ar?.[key],catalogs.en?.[key]];
      for (const node of el.childNodes) if (node.nodeType===3 && originals.includes(node.nodeValue.trim())) {
        const next=t(key,node.nodeValue); if (node.nodeValue!==next) node.nodeValue=next;
      }
    }
    if (key && !el.children.length && el.tagName !== 'TEXTAREA') {
      // Existing business logic uses Arabic option values. Translate labels only.
      if (el.tagName === 'OPTION' && !el.hasAttribute('value')) el.setAttribute('value', el.textContent);
      const value = t(key, el.textContent);
      if (el.textContent !== value) el.textContent = value;
    }
    for (const attr of ['placeholder','title','aria-label']) {
      const key = el.getAttribute('data-i18n-' + attr);
      if (key) {
        const value = t(key, el.getAttribute(attr));
        if (value !== el.getAttribute(attr)) el.setAttribute(attr, value);
      }
    }
  }
  function translate(root = document) {
    if (root.nodeType === 1 && root.matches(selector)) renderElement(root);
    root.querySelectorAll?.(selector).forEach(renderElement);
  }
  function render() {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'en' ? 'ltr' : 'rtl';
    if (document.body) document.body.dir = document.documentElement.dir;
    translate();
    document.dispatchEvent(new CustomEvent('jms:locale-rendered'));
    document.querySelectorAll('[data-language-switcher]').forEach(el => {
      el.value = language;
      el.disabled = saving;
    });
  }
  function storeLanguage(id, value) {
    try { localStorage.setItem('jms_language_' + id, value); } catch (_) {}
  }
  async function setLanguage(next) {
    if (!valid(next) || saving) return false;
    const current = user(), id = current?.id;
    saving = true;
    render();
    try {
      // Do not report success if the dictionary or server save fails.
      await load('ar');
      await load(next);
      if (id) {
        const token = sessionStorage.getItem('jms_auth_token') || localStorage.getItem('jms_auth_token');
        const response = await fetch('/api/auth-language', {
          method:'POST', headers:{'Content-Type':'application/json',Authorization:'Bearer ' + (token || '')},
          body:JSON.stringify({language:next}), cache:'no-store'
        });
        const result = await response.json();
        if (!response.ok || !result.ok || result.language !== next) throw new Error('language_save_failed');
        // Never apply an old account's response after sign-out or account switching.
        if (user()?.id !== id) return false;
        current.language = next;
        if (window.currentUser?.id === id) window.currentUser.language = next;
        try { sessionStorage.setItem('jms_current_user', JSON.stringify(current)); } catch (_) {}
        storeLanguage(id, next);
      }
      language = next;
      document.dispatchEvent(new CustomEvent('jms:language-changed',{detail:{language}}));
      return true;
    } catch (error) {
      console.warn('Language preference was not saved:', error);
      window.alert(language === 'en' ? 'Could not save language. Please try again.' : 'تعذر حفظ اللغة. حاول مرة أخرى.');
      return false;
    } finally { saving = false; render(); }
  }
  async function refresh() {
    const current = user(), id = current?.id || null;
    let next = current && valid(current.language) ? current.language : 'ar';
    // Per-account cache is an offline fallback only, never a shared browser default.
    if (current && !valid(current.language)) {
      try { const saved = localStorage.getItem('jms_language_' + id); if (valid(saved)) next = saved; } catch (_) {}
    }
    accountId = id;
    if (id && next !== language) document.documentElement.setAttribute('data-locale-pending','');
    try {
      await Promise.all([load('ar'),next === 'ar' ? null : load(next)]);
      if ((user()?.id || null) !== id || saving) return;
      language = next; render();
      if (id) storeLanguage(id, next);
    } catch (error) { console.warn('Localization catalog unavailable:', error); }
    finally { if (accountId === id) document.documentElement.removeAttribute('data-locale-pending'); }
  }
  function mount() {
    if (document.getElementById('accountLanguageBox')) return;
    const side = document.querySelector('.sidebar');
    if (!side) return;
    document.getElementById('fieldLangBox')?.remove();
    const box = document.createElement('div');
    box.id = 'accountLanguageBox'; box.className = 'account-language';
    const label = document.createElement('label');
    label.htmlFor = 'accountLanguageSelect'; label.textContent = 'العربية / English';
    const select = document.createElement('select');
    select.id = 'accountLanguageSelect'; select.setAttribute('data-language-switcher','');
    for (const [value,text] of [['ar','العربية'],['en','English']]) {
      const option = document.createElement('option'); option.value = value; option.textContent = text; select.append(option);
    }
    select.addEventListener('change', () => setLanguage(select.value));
    box.append(label, select); side.insertBefore(box, side.querySelector('nav'));
    render();
  }
  function start() {
    // Dialogs are UI messages; user-entered values and stored records are untouched.
    for (const name of ['alert','confirm','prompt']) {
      const original = window[name];
      if (typeof original === 'function') window[name] = function(message, ...args) {
        return original.call(window, label(message), ...args);
      };
    }
    if (document.documentElement.hasAttribute('data-account-page')) {
      try { standaloneAccount = JSON.parse(sessionStorage.getItem('jms_current_user') || 'null'); } catch (_) {}
      const token = sessionStorage.getItem('jms_auth_token') || localStorage.getItem('jms_auth_token');
      if (token) fetch('/api/auth-session', {method:'POST', cache:'no-store',headers:{Authorization:'Bearer '+token}})
        .then(async response => {
          if (response.status === 401 || response.status === 403) { standaloneAccount=null; return refresh(); }
          if (!response.ok) return;
          const result=await response.json();
          if (result.ok && result.user && token === (sessionStorage.getItem('jms_auth_token') || localStorage.getItem('jms_auth_token'))) {
            standaloneAccount=result.user; return refresh();
          }
        }).catch(() => {});
    }
    mount(); refresh();
    observer = new MutationObserver(records => {
      // Translate only explicit UI markers, never customer records or arbitrary text.
      for (const record of records) {
        if (record.type === 'childList') {
          if (record.target.nodeType === 1 && record.target.matches(selector)) renderElement(record.target);
          record.addedNodes.forEach(node => { if (node.nodeType === 1) translate(node); });
        }
      }
      if ((user()?.id || null) !== accountId) refresh();
    });
    observer.observe(document.body, {childList:true,subtree:true});
    window.addEventListener('jms:session-refreshed', refresh);
  }
  window.JMSI18n = {t, label, setText, setLanguage, refresh, mount, translate, get language(){return language;}};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
