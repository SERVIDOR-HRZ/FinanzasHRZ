// ── DIVISAS.JS ──
// rates[code] = cuantos COP vale 1 unidad de [code]

const RATES_FALLBACK = {
  COP: 1,
  USD: 3805,
  EUR: 4290,
  GBP: 5010,
  JPY: 25.8,
  BRL: 690,
  MXN: 192,
  ARS: 3.9,
  CLP: 4.2,
  PEN: 1020,
  CAD: 2790,
  CHF: 4480,
  CNY: 524,
  KRW: 2.75,
  AUD: 2440,
};

const CURRENCIES = [
  { code: 'COP', name: 'Peso colombiano',      emoji: '🇨🇴' },
  { code: 'USD', name: 'Dolar estadounidense', emoji: '🇺🇸' },
  { code: 'EUR', name: 'Euro',                 emoji: '🇪🇺' },
  { code: 'GBP', name: 'Libra esterlina',      emoji: '🇬🇧' },
  { code: 'JPY', name: 'Yen japones',          emoji: '🇯🇵' },
  { code: 'BRL', name: 'Real brasileno',       emoji: '🇧🇷' },
  { code: 'MXN', name: 'Peso mexicano',        emoji: '🇲🇽' },
  { code: 'ARS', name: 'Peso argentino',       emoji: '🇦🇷' },
  { code: 'CLP', name: 'Peso chileno',         emoji: '🇨🇱' },
  { code: 'PEN', name: 'Sol peruano',          emoji: '🇵🇪' },
  { code: 'CAD', name: 'Dolar canadiense',     emoji: '🇨🇦' },
  { code: 'CHF', name: 'Franco suizo',         emoji: '🇨🇭' },
  { code: 'CNY', name: 'Yuan chino',           emoji: '🇨🇳' },
  { code: 'KRW', name: 'Won surcoreano',       emoji: '🇰🇷' },
  { code: 'AUD', name: 'Dolar australiano',    emoji: '🇦🇺' },
];

const FEATURED = ['USD', 'EUR', 'GBP', 'BRL', 'MXN', 'ARS', 'CLP', 'PEN'];

let rates = Object.assign({}, RATES_FALLBACK);

function getCurrency(code) {
  return CURRENCIES.find(function(c) { return c.code === code; });
}

// Bandera como span con emoji — Twemoji lo convierte a SVG
function flagSpan(emoji) {
  return '<span class="flag-emoji">' + emoji + '</span>';
}

function getRawNumber() {
  var val = document.getElementById('amountInput').value;
  var clean = val.replace(/\./g, '').replace(',', '.');
  return parseFloat(clean);
}

function formatThousands(digits) {
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(parseInt(digits, 10));
}

function populateSelects() {
  var fromSel = document.getElementById('fromCurrency');
  var toSel   = document.getElementById('toCurrency');
  CURRENCIES.forEach(function(c) {
    fromSel.appendChild(new Option(c.code + ' - ' + c.name, c.code));
    toSel.appendChild(new Option(c.code + ' - ' + c.name, c.code));
  });
  fromSel.value = 'COP';
  toSel.value   = 'USD';
  updateFromFlag();
}

function updateFromFlag() {
  var code = document.getElementById('fromCurrency').value;
  var c    = getCurrency(code);
  var flagEl = document.getElementById('fromFlag');
  flagEl.innerHTML = c ? flagSpan(c.emoji) : '';
  document.getElementById('fromLabel').textContent = code;
  // Re-parsear twemoji en el flag del input
  if (window.twemoji) twemoji.parse(flagEl, twemojiOpts());
  autoConvert();
}

function twemojiOpts() {
  return {
    folder: 'svg',
    ext: '.svg',
    base: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/',
    className: 'twemoji-flag'
  };
}

function autoConvert() {
  var amount   = getRawNumber();
  var fromCode = document.getElementById('fromCurrency').value;
  var toCode   = document.getElementById('toCurrency').value;

  if (isNaN(amount) || amount <= 0) {
    document.getElementById('resultCard').classList.remove('visible');
    return;
  }

  var result     = amount * rates[fromCode] / rates[toCode];
  var directRate = rates[fromCode] / rates[toCode];
  var fromC      = getCurrency(fromCode);
  var toC        = getCurrency(toCode);

  var flagsEl = document.getElementById('resultFlags');
  flagsEl.innerHTML =
    flagSpan(fromC.emoji) +
    '<span class="result-arrow">&#8594;</span>' +
    flagSpan(toC.emoji);
  if (window.twemoji) twemoji.parse(flagsEl, twemojiOpts());

  document.getElementById('resultAmount').textContent = formatAmount(result, toCode);
  document.getElementById('resultDetail').textContent =
    formatAmount(amount, fromCode) + ' ' + fromCode + ' = ' + formatAmount(result, toCode) + ' ' + toCode;
  document.getElementById('resultRate').textContent =
    '1 ' + fromCode + ' = ' + formatRate(directRate) + ' ' + toCode;

  document.getElementById('resultCard').classList.add('visible');
}

function formatAmount(n, code) {
  var noDecimals = ['JPY', 'KRW', 'COP', 'CLP', 'ARS'].indexOf(code) !== -1;
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: noDecimals ? 0 : 2,
    maximumFractionDigits: noDecimals ? 0 : 2,
  }).format(n);
}

function formatRate(n) {
  if (n >= 1000) return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(n);
  if (n >= 1)    return n.toFixed(4);
  return n.toFixed(6);
}

function shakeInput() {
  var input = document.getElementById('amountInput');
  input.classList.add('shake');
  setTimeout(function() { input.classList.remove('shake'); }, 500);
}

function swapCurrencies() {
  var fromSel = document.getElementById('fromCurrency');
  var toSel   = document.getElementById('toCurrency');
  var tmp     = fromSel.value;
  fromSel.value = toSel.value;
  toSel.value   = tmp;
  updateFromFlag();
}

function renderRatesGrid() {
  var grid = document.getElementById('ratesGrid');
  grid.innerHTML = '';
  FEATURED.forEach(function(code) {
    var c      = getCurrency(code);
    var copVal = rates[code];
    var card   = document.createElement('div');
    card.className = 'rate-card glass';
    card.innerHTML =
      '<div class="rate-card-top">' +
        '<span class="rate-flag">' + flagSpan(c.emoji) + '</span>' +
        '<span class="rate-code-badge">' + c.code + '</span>' +
      '</div>' +
      '<div class="rate-name">' + c.name + '</div>' +
      '<div class="rate-value">' + formatAmount(copVal, 'COP') + ' COP</div>' +
      '<div class="rate-sub">por 1 ' + c.code + '</div>';

    if (window.twemoji) twemoji.parse(card, twemojiOpts());

    card.addEventListener('click', function() {
      document.getElementById('fromCurrency').value = 'COP';
      document.getElementById('toCurrency').value   = code;
      updateFromFlag();
      document.getElementById('amountInput').focus();
    });
    grid.appendChild(card);
  });
}

function applyRates(apiRates) {
  CURRENCIES.forEach(function(c) {
    if (c.code === 'COP') return;
    var r = apiRates[c.code];
    if (r && r > 0) rates[c.code] = 1 / r;
  });
  renderRatesGrid();
  autoConvert();
}

async function fetchRates() {
  try {
    var res  = await fetch('https://open.er-api.com/v6/latest/COP');
    var data = await res.json();
    if (data && data.result === 'success' && data.rates) {
      applyRates(data.rates);
      return;
    }
  } catch(e) {}
  try {
    var res2  = await fetch('https://api.frankfurter.app/latest?from=COP&to=USD,EUR,GBP,JPY,BRL,MXN,ARS,CLP,PEN,CAD,CHF,CNY,KRW,AUD');
    var data2 = await res2.json();
    if (data2 && data2.rates) applyRates(data2.rates);
  } catch(e) {}
}

document.addEventListener('DOMContentLoaded', function() {
  var amountInput = document.getElementById('amountInput');
  amountInput.setAttribute('type', 'text');
  amountInput.setAttribute('inputmode', 'numeric');

  populateSelects();
  renderRatesGrid();
  fetchRates();

  amountInput.addEventListener('input', function(e) {
    var digits = e.target.value.replace(/[^0-9]/g, '');
    if (digits === '') { e.target.value = ''; autoConvert(); return; }
    e.target.value = formatThousands(digits);
    autoConvert();
  });

  document.getElementById('fromCurrency').addEventListener('change', updateFromFlag);
  document.getElementById('toCurrency').addEventListener('change', function() { autoConvert(); });
  document.getElementById('swapBtn').addEventListener('click', swapCurrencies);
  document.getElementById('convertBtn').addEventListener('click', function() {
    var v = getRawNumber();
    if (isNaN(v) || v <= 0) shakeInput();
    else autoConvert();
  });
});
