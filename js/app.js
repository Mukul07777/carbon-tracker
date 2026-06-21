/**
 * CarbonSense – Application Logic
 * Emission calculations, input validation, security, AI tips integration
 * @version 2.0.0
 */

'use strict';

// ── EMISSION FACTORS (IPCC AR6 / DEFRA 2023 / CEA 2023) ─────────────────────
const EMISSION_FACTORS = {
  transport: {
    car_petrol: 0.192,  // kg CO2 per km
    car_diesel: 0.171,
    car_ev: 0.053,      // India grid-adjusted
    motorbike: 0.114,
    bus: 0.089,
    train: 0.041,
    cycle: 0
  },
  diet: {
    vegan: 2.89,        // kg CO2 per day
    vegetarian: 3.81,
    pescatarian: 4.67,
    meat_low: 5.63,
    meat_medium: 7.19,
    meat_high: 10.24
  },
  energy_source: {
    grid: 1.0,          // India grid: 0.71 kg CO2/kWh (CEA 2023)
    solar_partial: 0.6,
    solar_full: 0.15
  }
};

// ── SECURITY: INPUT SANITIZATION ─────────────────────────────────────────────
/**
 * Strips HTML special characters to prevent XSS attacks
 * @param {string|number} value - Raw user input
 * @returns {string} Sanitized value
 */
function sanitizeInput(value) {
  if (typeof value === 'string') {
    return value.replace(/[<>'"&]/g, '').trim();
  }
  return value;
}

// ── INPUT VALIDATION ──────────────────────────────────────────────────────────
/**
 * Validates all form inputs before calculation
 * @param {string} transport - Transport mode key
 * @param {string} diet - Diet type key
 * @param {number} km - Daily distance in km
 * @param {number} electricity - Monthly electricity bill in INR
 * @returns {string[]} Array of error messages (empty if valid)
 */
function validateInput(transport, diet, km, electricity) {
  const errors = [];
  if (!transport || transport === '') errors.push('Transport mode is required');
  if (!diet || diet === '') errors.push('Diet type is required');
  if (isNaN(km) || km <= 0) errors.push('Distance must be a positive number');
  if (km > 500) errors.push('Distance exceeds maximum allowed value (500 km)');
  if (isNaN(electricity) || electricity <= 0) errors.push('Electricity bill must be positive');
  if (electricity > 100000) errors.push('Electricity bill exceeds maximum allowed value');
  if (!EMISSION_FACTORS.transport.hasOwnProperty(sanitizeInput(transport))) {
    errors.push('Invalid transport mode selected');
  }
  if (!EMISSION_FACTORS.diet.hasOwnProperty(sanitizeInput(diet))) {
    errors.push('Invalid diet type selected');
  }
  return errors;
}

// ── EMISSION CALCULATION ──────────────────────────────────────────────────────
/**
 * Calculates daily CO2 emissions across transport, diet, and energy categories
 * @param {string} transport - Transport mode
 * @param {number} km - Daily commute distance
 * @param {string} diet - Diet type
 * @param {number} electricity - Monthly electricity bill (INR)
 * @param {string} energySource - Energy source type
 * @returns {{transport: number, diet: number, energy: number, total: number}}
 */
function calcEmissions(transport, km, diet, electricity, energySource) {
  if (!EMISSION_FACTORS.transport.hasOwnProperty(transport)) throw new Error('Invalid transport mode');
  if (!EMISSION_FACTORS.diet.hasOwnProperty(diet)) throw new Error('Invalid diet type');
  if (!EMISSION_FACTORS.energy_source.hasOwnProperty(energySource)) throw new Error('Invalid energy source');
  if (km < 0 || km > 500) throw new Error('Distance out of valid range');
  if (electricity < 0 || electricity > 100000) throw new Error('Electricity bill out of valid range');

  const transportKg = EMISSION_FACTORS.transport[transport] * km;
  const dietKg = EMISSION_FACTORS.diet[diet];
  const elecKg = (electricity / 1500) * 2.1 * EMISSION_FACTORS.energy_source[energySource];

  return {
    transport: Math.round(transportKg * 100) / 100,
    diet: Math.round(dietKg * 100) / 100,
    energy: Math.round(elecKg * 100) / 100,
    total: Math.round((transportKg + dietKg + elecKg) * 100) / 100
  };
}

/**
 * Returns verdict label and color based on total daily emissions
 * @param {number} total - Total daily kg CO2
 * @returns {{text: string, color: string, label: string}}
 */
function getScoreLabel(total) {
  if (total < 0) return null;
  if (total < 4) return { text: '🌱 Low impact — you\'re doing well', color: '#00c853', label: 'low' };
  if (total < 8) return { text: '🟡 Moderate impact — room to improve', color: '#ffd600', label: 'moderate' };
  if (total < 13) return { text: '🔴 High impact — action needed', color: '#ff6d00', label: 'high' };
  return { text: '🚨 Very high — urgent changes needed', color: '#ff1744', label: 'very_high' };
}

// ── AI TIPS ───────────────────────────────────────────────────────────────────
/**
 * Fetches personalised reduction tips from Anthropic Claude API
 * Falls back to curated static tips on failure
 * @param {string} transport - Transport mode
 * @param {string} diet - Diet type
 * @param {number} electricity - Monthly bill
 * @param {string} energySource - Energy source
 * @param {number} total - Total daily emissions
 * @returns {Promise<Array<{title: string, tip: string}>>}
 */
async function fetchAITips(transport, diet, electricity, energySource, total) {
  const prompt = `You are a climate action expert for India. A person has this daily carbon footprint:
- Total: ${total} kg CO2/day
- Transport: ${transport.replace(/_/g, ' ')}
- Diet: ${diet.replace(/_/g, ' ')}
- Monthly electricity: Rs ${electricity} (${energySource.replace(/_/g, ' ')})

Give exactly 4 highly specific, actionable tips to reduce their carbon footprint. Reference Indian government schemes, Indian brands, or India-specific options where relevant. Be concrete — name specific apps, subsidies, products, or behaviors.

Return ONLY a JSON array. No markdown, no preamble. Format:
[{"title":"5 words max","tip":"2 specific sentences with numbers or names"}]`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);

    const data = await response.json();
    const text = data.content.map(b => b.text || '').join('');
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);

  } catch (e) {
    console.warn('AI tips fallback activated:', e.message);
    return [
      { title: 'Switch to metro or bus', tip: 'Delhi Metro alone displaces 630,000 tonnes of CO₂ annually. Using metro instead of a petrol car for a 20 km commute saves ~3.8 kg CO₂ per day.' },
      { title: 'Try plant-based two days', tip: 'Replacing meat with dal, rajma, or paneer twice a week cuts diet emissions by ~25%. India\'s lentil-based cuisine is one of the lowest-carbon diets globally.' },
      { title: 'Apply for PM-KUSUM solar', tip: 'PM-KUSUM and MNRE\'s rooftop solar scheme covers 40% of installation costs. A 2kW system eliminates ~2,900 kg CO₂/year and typically pays back in 4–5 years.' },
      { title: 'Set AC to 24°C exactly', tip: 'BEE mandates factory default of 24°C — each degree lower increases energy use by 6%. Pair with a 5-star BEE-rated AC to cut cooling emissions by up to 50%.' }
    ];
  }
}

// ── DOM ELEMENT CACHE ─────────────────────────────────────────────────────────
const DOM = {
  form: document.getElementById('carbon-form'),
  transport: document.getElementById('transport'),
  diet: document.getElementById('diet'),
  km: document.getElementById('km'),
  kmVal: document.getElementById('km-val'),
  electricity: document.getElementById('electricity'),
  elecVal: document.getElementById('elec-val'),
  energySource: document.getElementById('energy_source'),
  results: document.getElementById('results'),
  calcSection: document.querySelector('.calc-section'),
  gaugeArc: document.getElementById('gauge-arc'),
  gaugeNum: document.getElementById('gauge-num'),
  resultVerdict: document.getElementById('result-verdict'),
  compareText: document.getElementById('compare-text'),
  breakdownBars: document.getElementById('breakdown-bars'),
  tipsOutput: document.getElementById('tips-output'),
  tipsLoading: document.getElementById('tips-loading'),
  recalcBtn: document.getElementById('recalc-btn')
};

// ── SLIDER UPDATES ────────────────────────────────────────────────────────────
function updateSlider(input) {
  const min = +input.min, max = +input.max, val = +input.value;
  const pct = ((val - min) / (max - min) * 100) + '%';
  input.style.setProperty('--pct', pct);
  input.setAttribute('aria-valuenow', val);
}

DOM.km.addEventListener('input', () => {
  DOM.kmVal.textContent = DOM.km.value;
  updateSlider(DOM.km);
});

DOM.electricity.addEventListener('input', () => {
  DOM.elecVal.textContent = Number(DOM.electricity.value).toLocaleString('en-IN');
  updateSlider(DOM.electricity);
});

updateSlider(DOM.km);
updateSlider(DOM.electricity);

// ── RENDER RESULTS ────────────────────────────────────────────────────────────
function renderResults(emissions) {
  DOM.results.classList.add('visible');
  DOM.results.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const verdict = getScoreLabel(emissions.total);
  const circumference = 2 * Math.PI * 58;
  const pct = Math.min(emissions.total / 20, 1);

  setTimeout(() => {
    DOM.gaugeArc.style.strokeDashoffset = circumference * (1 - pct);
    DOM.gaugeArc.style.stroke = verdict.color;
  }, 200);

  DOM.gaugeNum.textContent = emissions.total.toFixed(1);
  DOM.gaugeNum.style.color = verdict.color;
  DOM.resultVerdict.textContent = verdict.text;
  DOM.resultVerdict.style.color = verdict.color;

  const diff = emissions.total - 5.8;
  DOM.compareText.textContent = diff > 0
    ? `${diff.toFixed(1)} kg above India average`
    : `${Math.abs(diff).toFixed(1)} kg below India average`;

  const items = [
    { label: '🚗 Transport', value: emissions.transport, color: '#00c853' },
    { label: '🥗 Diet', value: emissions.diet, color: '#ffd600' },
    { label: '⚡ Energy', value: emissions.energy, color: '#00e5ff' }
  ];
  const maxVal = Math.max(...items.map(i => i.value)) || 1;

  DOM.breakdownBars.innerHTML = items.map(item => `
    <div class="bar-row" role="listitem">
      <div class="bar-meta">
        <span class="bar-name">${item.label}</span>
        <span class="bar-kg">${item.value} kg CO₂</span>
      </div>
      <div class="bar-track">
        <div class="bar-fill" style="width:${Math.round(item.value / maxVal * 100)}%;background:${item.color}"
             role="progressbar" aria-valuenow="${item.value}" aria-valuemin="0" aria-valuemax="${maxVal}"
             aria-label="${item.label}: ${item.value} kg CO2"></div>
      </div>
    </div>`).join('');
}

function renderTips(tips) {
  DOM.tipsLoading.style.display = 'none';
  DOM.tipsOutput.innerHTML = tips.map((t, i) => `
    <div class="tip-item">
      <div class="tip-num" aria-hidden="true">${i + 1}</div>
      <div class="tip-body">
        <div class="tip-title">${sanitizeInput(t.title)}</div>
        <div class="tip-text">${sanitizeInput(t.tip)}</div>
      </div>
    </div>`).join('');
}

// ── FORM SUBMIT ───────────────────────────────────────────────────────────────
DOM.form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const transport = sanitizeInput(DOM.transport.value);
  const diet = sanitizeInput(DOM.diet.value);
  const km = parseInt(DOM.km.value, 10);
  const electricity = parseInt(DOM.electricity.value, 10);
  const energySource = sanitizeInput(DOM.energySource.value);

  const errors = validateInput(transport, diet, km, electricity);
  if (errors.length > 0) {
    alert('Please fix the following:\n' + errors.join('\n'));
    return;
  }

  let emissions;
  try {
    emissions = calcEmissions(transport, km, diet, electricity, energySource);
  } catch (err) {
    alert('Calculation error: ' + err.message);
    return;
  }

  DOM.calcSection.style.display = 'none';
  renderResults(emissions);

  DOM.tipsLoading.style.display = 'flex';
  const tips = await fetchAITips(transport, diet, electricity, energySource, emissions.total);
  renderTips(tips);
});

DOM.recalcBtn.addEventListener('click', () => {
  DOM.results.classList.remove('visible');
  DOM.calcSection.style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ── CANVAS PARTICLE SYSTEM ────────────────────────────────────────────────────
(function initParticles() {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H;

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  const particles = Array.from({ length: 120 }, () => ({
    x: Math.random(), y: Math.random(),
    vx: (Math.random() - 0.5) * 0.0004,
    vy: (Math.random() - 0.5) * 0.0002,
    r: 0.8 + Math.random() * 1.7,
    a: 0.2 + Math.random() * 0.7
  }));

  function draw() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach(p => {
      p.x = (p.x + p.vx + 1) % 1;
      p.y = (p.y + p.vy + 1) % 1;
      ctx.beginPath();
      ctx.arc(p.x * W, p.y * H, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0,200,83,${p.a})`;
      ctx.fill();
    });
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = (particles[i].x - particles[j].x) * W;
        const dy = (particles[i].y - particles[j].y) * H;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 140) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x * W, particles[i].y * H);
          ctx.lineTo(particles[j].x * W, particles[j].y * H);
          ctx.strokeStyle = `rgba(0,200,83,${0.15 * (1 - d / 140)})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(draw);
  }
  draw();
})();

// ── LIVE CO2 COUNTER ──────────────────────────────────────────────────────────
(function initCounter() {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const elapsed = (now - startOfDay) / 1000;
  const ratePerSec = 1200;

  let co2 = Math.round(elapsed * ratePerSec);
  const co2El = document.getElementById('co2-today');
  const treesEl = document.getElementById('trees-today');

  function fmt(n) { return n.toLocaleString('en-IN'); }
  if (co2El) co2El.textContent = fmt(co2);
  if (treesEl) treesEl.textContent = fmt(Math.round(co2 / 22));

  setInterval(() => {
    co2 += ratePerSec;
    if (co2El) co2El.textContent = fmt(co2);
    if (treesEl) treesEl.textContent = fmt(Math.round(co2 / 22));
  }, 1000);
})();