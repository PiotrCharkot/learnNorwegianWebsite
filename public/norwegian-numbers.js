// Bokmål, modern counting order. No network or personal data is needed.
const SMALL = ['null', 'en', 'to', 'tre', 'fire', 'fem', 'seks', 'sju', 'åtte', 'ni', 'ti', 'elleve', 'tolv', 'tretten', 'fjorten', 'femten', 'seksten', 'sytten', 'atten', 'nitten'];
const TENS = ['', '', 'tjue', 'tretti', 'førti', 'femti', 'seksti', 'sytti', 'åtti', 'nitti'];
const ORDINALS = ['', 'første', 'andre', 'tredje', 'fjerde', 'femte', 'sjette', 'sjuende', 'åttende', 'niende', 'tiende', 'ellevte', 'tolvte', 'trettende', 'fjortende', 'femtende', 'sekstende', 'syttende', 'attende', 'nittende'];
const ORDINAL_TENS = ['', '', 'tjuende', 'trettiende', 'førtiende', 'femtiende', 'sekstiende', 'syttiende', 'åttiende', 'nittiende'];

export function cardinal(n) {
  if (!Number.isInteger(n) || n < 0 || n > 999999) throw new RangeError('Use a whole number from 0 to 999 999.');
  if (n < 20) return SMALL[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? SMALL[n % 10] : '');
  if (n < 1000) {
    const hundreds = Math.floor(n / 100);
    return (hundreds === 1 ? 'ett' : SMALL[hundreds]) + ' hundre' + (n % 100 ? ' og ' + cardinal(n % 100) : '');
  }
  const thousands = Math.floor(n / 1000), rest = n % 1000;
  return (thousands === 1 ? 'ett' : cardinal(thousands)) + ' tusen' + (rest ? (rest < 100 ? ' og ' : ' ') + cardinal(rest) : '');
}

export function ordinal(n) {
  if (!Number.isInteger(n) || n < 1 || n > 100) throw new RangeError('Use a whole number from 1 to 100.');
  if (n === 100) return 'hundrede';
  if (n < 20) return ORDINALS[n];
  return n % 10 ? TENS[Math.floor(n / 10)] + ORDINALS[n % 10] : ORDINAL_TENS[n / 10];
}

// Accept ungrouped digits or correctly grouped Norwegian thousands. Do not
// silently turn a mistyped "1 2" or an English thousands comma into another value.
function digits(raw) {
  const text = raw.trim().replace(/[\u00a0\u202f]/g, ' ');
  if (!/^(?:\d+|\d{1,3}(?: \d{3})+)$/.test(text)) throw new Error('Use digits, with optional spaces between thousands (for example, 1 250).');
  return Number(text.replace(/ /g, ''));
}
const format = n => new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 }).format(n);

export function convertNumber(mode, raw) {
  if (!raw.trim()) throw new Error('Enter a number first.');
  if (mode === 'phone') {
    const clean = raw.trim().replace(/[ \u00a0\u202f-]/g, '');
    if (!/^(?:\+47)?\d{8}$/.test(clean)) throw new Error('Enter eight digits, optionally beginning with +47. Spaces and hyphens are welcome.');
    const international = clean.startsWith('+47');
    const local = international ? clean.slice(3) : clean;
    return { digits: (international ? '+47 ' : '') + local.match(/.{2}/g).join(' '), words: (international ? 'pluss førtisju · ' : '') + [...local].map(n => SMALL[Number(n)]).join(' · '), note: 'A clear digit-by-digit reading. People also group digits into pairs. This reads the number; it does not check whether it is a real phone number.' };
  }
  if (mode === 'price') {
    const parts = raw.trim().split(/[,.]/);
    if (parts.length > 2 || (parts.length === 2 && !/^\d{1,2}$/.test(parts[1]))) throw new Error('Use up to two decimal places, for example 149,50 or 149.50. Use spaces, not commas, for thousands.');
    const kroner = digits(parts[0]);
    if (kroner > 999999) throw new Error('Enter a price from 0 to 999 999,99 kroner.');
    const ore = Number((parts[1] || '').padEnd(2, '0'));
    const whole = kroner === 1 ? 'én krone' : cardinal(kroner) + ' kroner';
    const fraction = ore === 1 ? 'ett øre' : cardinal(ore) + ' øre';
    return { digits: format(kroner) + ',' + String(ore).padStart(2, '0') + ' kr', words: ore ? (kroner ? whole + ' og ' : '') + fraction : whole, note: 'The full reading in kroner and øre. Norwegian prices use a decimal comma; in conversation people often shorten the amount.' };
  }
  const n = digits(raw);
  if (mode === 'ordinal') return { digits: format(n) + '.', words: ordinal(n), note: 'The dot turns a written number into an ordinal. For dates: 17. mai is syttende mai. This converter covers 1st–100th.' };
  if (mode === 'year') {
    if (n < 1000 || n > 2099) throw new Error('Enter a four-digit year from 1000 to 2099.');
    const century = Math.floor(n / 100), rest = n % 100;
    const reading = n >= 2000 ? cardinal(n) : n < 1100 ? cardinal(n).replace(/^ett /, '') : cardinal(century) + (rest >= 10 ? cardinal(rest) : 'hundre' + (rest ? 'og' + cardinal(rest) : ''));
    return { digits: String(n), words: reading.replace(/ /g, ''), note: 'Years written out in words are joined together. This gives one common reading: usually century-based before 2000, and a full thousands reading from 2000. Other spoken readings are also possible.' };
  }
  if (mode !== 'cardinal') throw new Error('Choose a number type.');
  return { digits: format(n), words: cardinal(n), note: 'Modern Bokmål counting, using sju and tjue. Syv and tyve are also used. For “one” before a noun, choose en, ei or ett to match its gender.' };
}

const MODES = {
  cardinal: { hint: 'Whole numbers from 0 to 999 999.', value: '1250', samples: ['21', '105', '1250', '999999'], label: 'Number' },
  ordinal: { hint: 'Positions and dates: 1–100. Enter digits without a dot.', value: '17', samples: ['1', '3', '17', '21'], label: 'Position' },
  year: { hint: 'Four-digit years from 1000 to 2099.', value: '2026', samples: ['1814', '1905', '1998', '2026'], label: 'Year' },
  price: { hint: '0–999 999,99 kr. A comma or dot can separate the decimals.', value: '149,50', samples: ['1', '21,50', '149,50', '1250'], label: 'Price in kroner' },
  phone: { hint: 'Eight digits, optionally with +47. Reading practice only.', value: '12 34 56 78', samples: ['12 34 56 78', '+47 12 34 56 78'], label: 'Phone number' }
};

function initNumbers() {
  const form = document.getElementById('number-form');
  if (!form) return;
  const mode = document.getElementById('number-mode');
  const input = document.getElementById('number-input');
  const status = document.getElementById('number-status');
  const result = document.getElementById('number-result');
  const samples = document.getElementById('number-samples');
  function update() {
    try {
      const value = convertNumber(mode.value, input.value);
      document.getElementById('number-digits').textContent = value.digits;
      document.getElementById('number-words').textContent = value.words;
      document.getElementById('number-note').textContent = value.note;
      result.hidden = false;
      input.removeAttribute('aria-invalid');
      status.dataset.state = 'success';
      status.textContent = 'In Norwegian: ' + value.words;
    } catch (error) {
      result.hidden = true;
      input.setAttribute('aria-invalid', 'true');
      status.dataset.state = 'error';
      status.textContent = error.message;
    }
  }
  function chooseMode() {
    const config = MODES[mode.value];
    document.getElementById('number-hint').textContent = config.hint;
    document.getElementById('number-label').textContent = config.label;
    input.inputMode = mode.value === 'price' ? 'decimal' : mode.value === 'phone' ? 'tel' : 'numeric';
    input.value = config.value;
    samples.replaceChildren();
    for (const value of config.samples) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'learning-chip'; button.textContent = value;
      button.addEventListener('click', () => { input.value = value; update(); });
      samples.append(button);
    }
    update();
  }
  form.addEventListener('submit', event => { event.preventDefault(); update(); });
  mode.addEventListener('change', chooseMode);
  // Do not leave a previous number on screen while the input has changed.
  input.addEventListener('input', () => { result.hidden = true; status.textContent = ''; input.removeAttribute('aria-invalid'); });
  chooseMode();
}
if (typeof document !== 'undefined') initNumbers();
