'use strict';

/* Sprache: Die Oberfläche ist auf Deutsch geschrieben. Bei Englisch übersetzt ein Beobachter jeden Text,
   der im Fenster erscheint, über das Wörterbuch in i18n-en.js. Muster: # steht für eine Zahl, * für beliebigen Text.
   Ein Sprachwechsel speichert und lädt das Fenster neu. */

const isEn = () => state.settings?.lang === 'en';
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
let i18nRules = null;

function compileI18n() {
  i18nRules = (typeof I18N_EN_PATTERNS !== 'undefined' ? I18N_EN_PATTERNS : []).map(([de, en]) => {
    const tokens = [];
    const src = de.split(/([#*])/).map((p) => {
      if (p === '#') { tokens.push('#'); return '([−+-]?[\\d.,:]+)'; }
      if (p === '*') { tokens.push('*'); return '(.+?)'; }
      return escRe(p);
    }).join('');
    return { re: new RegExp(`^${src}$`, 's'), en };
  });
}

// Einen Text übersetzen; unbekannte Texte bleiben, wie sie sind
function tr(text) {
  if (!isEn() || !text) return text;
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(text);
  const core = m[2].replace(/\s+/g, ' ');
  if (!core || !/[A-Za-zÄÖÜäöüß„]/.test(core)) return text;
  let out = I18N_EN[core];
  if (out === undefined) {
    for (const r of i18nRules || []) {
      const mm = r.re.exec(core);
      if (!mm) continue;
      if (r.en.includes('$')) out = r.en.replace(/\$(\d)/g, (_, n) => tr(mm[Number(n)]));
      else { let k = 1; out = r.en.replace(/[#*]/g, () => tr(mm[k++])); }
      break;
    }
  }
  return out === undefined ? text : m[1] + out + m[3];
}

const I18N_ATTRS = ['title', 'placeholder', 'aria-label'];

// Bereits übersetzte Texte merken, damit nichts doppelt übersetzt wird oder hin und her springt
const doneText = new WeakMap();
const doneAttr = new WeakMap();

function translateText(node) {
  const v = node.nodeValue;
  if (doneText.get(node) === v) return;
  const t = tr(v);
  doneText.set(node, t);
  if (t !== v) node.nodeValue = t;
}

function translateEl(el) {
  if (!el.getAttribute) return;
  let seen = doneAttr.get(el);
  for (const a of I18N_ATTRS) {
    const v = el.getAttribute(a);
    if (!v || seen?.[a] === v) continue;
    const t = tr(v);
    seen = { ...(seen || {}), [a]: t };
    doneAttr.set(el, seen);
    if (t !== v) el.setAttribute(a, t);
  }
}

function translateTree(root) {
  if (root.nodeType === 3) { translateText(root); return; }
  if (root.nodeType !== 1 || root.closest?.('.notranslate')) return;
  translateEl(root);
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let n;
  while ((n = w.nextNode())) {
    if (n.nodeType === 3) { if (!n.parentElement?.closest('.notranslate, textarea, script, style')) translateText(n); }
    else translateEl(n);
  }
}

function i18nInit() {
  const en = isEn();
  document.documentElement.lang = en ? 'en' : 'de';
  if (!en) return;
  // Wochentage und Tagesnamen direkt umstellen (werden an vielen Stellen als Kürzel genutzt)
  WD.splice(0, 7, 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su');
  if (typeof WD_LONG !== 'undefined') WD_LONG.splice(0, 7, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday');
  compileI18n();
  translateTree(document.body);
  new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'characterData') translateText(m.target);
      else if (m.type === 'attributes') translateEl(m.target);
      else for (const n of m.addedNodes) translateTree(n);
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: I18N_ATTRS });
}

async function setLanguage(lang) {
  if ((state.settings.lang || 'de') === lang) return;
  state.settings.lang = lang;
  try {
    if (window.api) await window.api.save(state);
    else localStorage.setItem('tageswerk', JSON.stringify(state));
  } catch { /* wird beim nächsten Speichern nachgeholt */ }
  window.api?.applySettings?.({ lang });
  location.reload();
}
