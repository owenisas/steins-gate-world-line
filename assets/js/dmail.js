/* ==========================================================================
   dmail.js: the D-mail composer (DESIGN.md section 9)
   --------------------------------------------------------------------------
   What it does
     - Counts bytes the Shift-JIS way: ASCII (U+0000-U+007F) and half-width katakana
       (U+FF61-U+FF9F) are 1 byte, every other character is 2. Hard limit 36 bytes:
       typing, pasting and the keypad are all held to it, and IME text that lands past
       the limit is trimmed back. At 36 / 36 the counter turns neon (the site's one
       live UI neon state).
     - "Send back" takes 1 to 48 hours. On send, the message and the hours hash
       (FNV-1a, 32-bit) to a deterministic world line: 0.xxxxxx, or 1.xxxxxx when the
       message contains "beta". Easter eggs from lore 2.10 override the hash.
     - The nav meter shifts through shift.js, and the phone screen answers:
       "Sent 12h back. World line 0.4xxxxx. Only you remember."
     - Nothing leaves the browser: the textarea and select carry no `name`, so even the
       no-JS form submission sends no data; JS cancels the submission entirely.
   Events
     document 'dmail:key'   { key }            per typed character or keypad press (sound.js: DTMF)
     document 'dmail:sent'  { value, hours }   after a send
   Fallback
     No JS: the form still renders; submitting jumps to the static note (#dmail-offline).
   ========================================================================== */

export const LIMIT = 36;

/** Shift-JIS byte length of one code point. */
export const sjisWidth = (cp) => (cp <= 0x7f || (cp >= 0xff61 && cp <= 0xff9f) ? 1 : 2);

/** Shift-JIS byte length of a string. */
export function sjisBytes(str) {
  let n = 0;
  for (const ch of str) n += sjisWidth(ch.codePointAt(0));
  return n;
}

/** Longest prefix of `str` that fits in `max` bytes. */
export function fitBytes(str, max) {
  let n = 0, out = '';
  for (const ch of str) {
    const w = sjisWidth(ch.codePointAt(0));
    if (n + w > max) break;
    n += w;
    out += ch;
  }
  return out;
}

/** FNV-1a 32-bit over UTF-8. */
export function fnv1a(str) {
  let h = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(str)) {
    h ^= byte;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

const EGGS = [
  { test: /el\s*psy\s*[kc]ongroo/i, value: '1.048596', note: 'The Steins Gate line.' },
  { test: /tu+t+u*ru/i, value: '0.337187', note: 'Somebody says hello.' },
  { test: /fibonacci/i, value: '1.123581', note: 'A line that should not be here.' },
  { test: /gamma/i, value: '2.615074', note: 'Neither alpha nor beta.' },
  { test: /faris/i, value: ' .275349', display: '-0.275349', note: 'No minus sign on the meter: the first tube stays dark.' },
];

/** The world line a message lands on. Returns { value, display, note }. */
export function worldlineFor(message, hours) {
  const text = message.normalize('NFC').trim();
  for (const egg of EGGS) {
    if (egg.test.test(text)) return { value: egg.value, display: egg.display || egg.value, note: egg.note };
  }
  const h = fnv1a(`${text.toLowerCase()}|${hours}`);
  const digits = String(h % 1000000).padStart(6, '0');
  const value = `${/beta/i.test(text) ? '1' : '0'}.${digits}`;
  return { value, display: value, note: '' };
}

export function initDmail({ shift } = {}) {
  const form = document.getElementById('dmail-form');
  if (!form) return null;
  const text = form.querySelector('#dmail-msg');
  const hours = form.querySelector('#dmail-hours');
  const count = form.querySelector('#dmail-count');
  const countNum = form.querySelector('[data-byte-count]');
  const response = form.querySelector('#dmail-response');
  const keypad = form.querySelector('[data-keypad]');
  const offline = form.querySelector('[data-nojs-note]');

  if (offline) offline.hidden = true;
  if (keypad) keypad.hidden = false;
  let wasFull = false;

  const emit = (name, detail) => document.dispatchEvent(new CustomEvent(name, { detail }));

  function update() {
    const n = sjisBytes(text.value);
    countNum.textContent = String(n);
    const full = n >= LIMIT;
    count.classList.toggle('is-full', full);
    if (full && !wasFull) response.textContent = '36 of 36 bytes. That is all a D-mail can carry.';
    else if (!full && wasFull && response.textContent.startsWith('36 of 36')) response.textContent = '';
    wasFull = full;
  }

  /** Insert `str` at the caret, trimmed to what still fits. Returns what was inserted. */
  function insert(str) {
    // A focused textarea inserts at the caret; the keypad (textarea blurred) appends, like a phone.
    const focused = document.activeElement === text;
    const value = text.value;
    const a = focused ? text.selectionStart : value.length;
    const b = focused ? text.selectionEnd : value.length;
    const room = LIMIT - sjisBytes(value.slice(0, a) + value.slice(b));
    const fit = fitBytes(str, Math.max(0, room));
    if (!fit) return '';
    text.setRangeText(fit, a, b, 'end');
    return fit;
  }

  // Hold every input path to 36 bytes. beforeinput covers typing and paste; the input
  // handler trims whatever slips through (IME composition, autofill, drag and drop).
  text.addEventListener('beforeinput', (e) => {
    if (e.isComposing) return;
    if (!/^insert(Text|FromPaste|FromDrop|ReplacementText|LineBreak)$/.test(e.inputType)) return;
    const data = e.inputType === 'insertLineBreak' ? '\n' : (e.data ?? e.dataTransfer?.getData('text/plain') ?? '');
    if (!data) return;
    const { selectionStart: a, selectionEnd: b, value } = text;
    const next = value.slice(0, a) + data + value.slice(b);
    if (sjisBytes(next) <= LIMIT) return;
    e.preventDefault();
    const fit = insert(data);
    if (fit) text.dispatchEvent(new Event('input', { bubbles: true }));
  });
  text.addEventListener('input', (e) => {
    if (!e.isComposing && sjisBytes(text.value) > LIMIT) {
      const caret = text.selectionStart;
      text.value = fitBytes(text.value, LIMIT);
      text.setSelectionRange(Math.min(caret, text.value.length), Math.min(caret, text.value.length));
    }
    update();
    if (e.inputType === 'insertText' && e.data) emit('dmail:key', { key: e.data.slice(-1) });
  });
  text.addEventListener('compositionend', () => {
    if (sjisBytes(text.value) > LIMIT) text.value = fitBytes(text.value, LIMIT);
    update();
  });

  keypad?.addEventListener('click', (e) => {
    const key = e.target.closest('[data-key]')?.dataset.key;
    if (!key) return;
    const put = insert(key);
    emit('dmail:key', { key });
    if (put) update();
    else response.textContent = '36 of 36 bytes. That is all a D-mail can carry.';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = text.value;
    const h = Number(hours.value) || 12;
    if (!message.trim()) {
      response.textContent = 'Nothing to send. Type a message first.';
      text.focus();
      return;
    }
    const { value, display, note } = worldlineFor(message, h);
    response.textContent = `Sent ${h}h back. World line ${display}. ${note ? note + ' ' : ''}Only you remember.`;
    emit('dmail:sent', { value, hours: h });
    try {
      await shift?.shiftTo(value, { source: 'dmail', announce: false, chapter: 'dmail' });
    } catch (err) { console.warn('[dmail] shift failed', err); }
  });

  update();
  return { worldlineFor, sjisBytes };
}
