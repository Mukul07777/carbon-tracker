/**
 * CarbonSense – Application Logic
 * @description AI-powered carbon footprint calculator with India-specific insights
 * @version 2.0.0
 * @author Mukul
 * @license MIT
 */

'use strict';

/**
 * IPCC AR6 / DEFRA 2023 / CEA 2023 emission factors
 * @constant {Object}
 */
const EMISSION_FACTORS = {
  /** kg CO2 per km per vehicle */
  transport: {
    car_petrol: 0.192,
    car_diesel: 0.171,
    car_ev: 0.053,      // India grid-adjusted (CEA 2023: 0.71 kg CO2/kWh)
    motorbike: 0.114,
    bus: 0.089,
    train: 0.041,
    cycle: 0            // Zero direct emissions
  },
  /** kg CO2 per person per day (Poore & Nemecek, 2018, Science) */
  diet: {
    vegan: 2.89,
    vegetarian: 3.81,
    pescatarian: 4.67,
    meat_low: 5.63,
    meat_medium: 7.19,
    meat_high: 10.24
  },
  /** Multiplier applied to base energy emissions */
  energy_source: {
    grid: 1.0,           // India coal-heavy grid
    solar_partial: 0.6,  // ~40% solar offset
    solar_full: 0.15     // ~85% solar offset
  }
};

/** India average daily emissions (kg CO2) */
const INDIA_AVERAGE_KG = 5.8;

/** Global average daily emissions (kg CO2) */
const GLOBAL_AVERAGE_KG = 13.5;

/** Base monthly electricity bill (INR) for normalisation */
const BASE_MONTHLY_BILL = 1500;

/** Base energy emissions at normalisation bill (kg CO2/day) */
const BASE_ENERGY_KG = 2.1;

// ── SECURITY: INPUT SANITIZATION ─────────────────────────────────────────────

/**
 * Strips HTML special characters to prevent XSS attacks.
 * Removes: < > ' " &
 * @param {string|number} value - Raw user input
 * @returns {string|number} Sanitized value safe for DOM insertion
 */
function sanitizeInput(value) {
  if (typeof value === 'string') {
    return value.replace(/[<>'"&]/g, '').trim();
  }
  return value;
}

// ── INPUT VALIDATION ──────────────────────────────────────────────────────────

/**
 * Validates all calculator inputs before processing.
 * Checks type, range, and allowed values for each field.
 * @param {string} transport - Transport mode key
 * @param {string} diet - Diet type key
 * @param {number} km - Daily commute distance (1–500 km)
 * @param {number} electricity - Monthly electricity bill in INR (100–100000)
 * @returns {string[]} Array of human-readable error messages (empty = valid)
 */
function validateInput(transport, diet, km, electricity) {
  const errors = [];

  if (!transport || transport === '') errors.push('Transport mode is required');
  if (!diet || diet === '') errors.push('Diet type is required');

  if (isNaN(km) || km <= 0) errors.push('Distance must be a positive number');
  if (km > 500) errors.push('Distance exceeds maximum allowed value (500 km)');

  if (isNaN(electricity) || electricity <= 0) errors.push('Electricity bill must be positive');
  if (electricity > 100000) errors.push('Electricity bill exceeds maximum allowed value');

  const cleanTransport = sanitizeInput(transport);
  const cleanDiet = sanitizeInput(diet);

  if (transport && !EMISSION_FACTORS.transport.hasOwnProperty(cleanTransport)) {
    errors.push('Invalid transport mode selected');
  }
  if (diet && !EMISSION_FACTORS.diet.hasOwnProperty(cleanDiet)) {
    errors.push('Invalid diet type selected');
  }

  return errors;
}

// ── EMISSION CALCULATION ──────────────────────────────────────────────────────

/**
 * Calculates daily CO2 emissions across transport, diet, and home energy.
 * Uses IPCC AR6 emission factors adjusted for Indian context.
 * @param {string} transport - Transport mode key from EMISSION_FACTORS.transport
 * @param {number} km - Daily commute distance in kilometres
 * @param {string} diet - Diet type key from EMISSION_FACTORS.diet
 * @param {number} electricity - Monthly electricity bill in INR
 * @param {string} energySource - Energy source key from EMISSION_FACTORS.energy_source
 * @returns {{ transport: number, diet: number, energy: number, total: number }}
 * @throws {Error} If any input key is invalid or values are out of range
 */
function calcEmissions(transport, km, diet, electricity, energySource) {
  if (!EMISSION_FACTORS.transport.hasOwnProperty(transport)) {
    throw new Error('Invalid transport mode');
  }
  if (!EMISSION_FACTORS.diet.hasOwnProperty(diet)) {
    throw new Error('Invalid diet type');
  }
  if (!EMISSION_FACTORS.energy_source.hasOwnProperty(energySource)) {
    throw new Error('Invalid energy source');
  }
  if (km < 0 || km > 500) {
    throw new Error('Distance out of valid range');
  }
  if (electricity < 0 || electricity > 100000) {
    throw new Error('Electricity bill out of valid range');
  }

  const transportKg = EMISSION_FACTORS.transport[transport] * km;
  const dietKg = EMISSION_FACTORS.diet[diet];
  const elecKg = (electricity / BASE_MONTHLY_BILL) * BASE_ENERGY_KG * EMISSION_FACTORS.energy_source[energySource];

  return {
    transport: Math.round(transportKg * 100) / 100,
    diet: Math.round(dietKg * 100) / 100,
    energy: Math.round(elecKg * 100) / 100,
    total: Math.round((transportKg + dietKg + elecKg) * 100) / 100
  };
}

/**
 * Classifies total daily CO2 into impact tiers with verdict text and colour.
 * @param {number} total - Total daily kg CO2
 * @returns {{ text: string, color: string, label: string } | null} Null if total < 0
 */
function getScoreLabel(total) {
  if (total < 0) return null;
  if (total < 4) return { text: '🌱 Low impact — you\'re doing well', color: '#00c853', label: 'low' };
  if (total < 8) return { text: '🟡 Moderate impact — room to improve', color: '#ffd600', label: 'moderate' };
  if (total < 13) return { text: '🔴 High impact — action needed', color: '#ff6d00', label: 'high' };
  return { text: '🚨 Very high — urgent changes needed', color: '#ff1744', label: 'very_high' };
}

/**
 * Compares user emissions to a reference average.
 * @param {number} userKg - User daily emissions
 * @param {number} averageKg - Reference average (India or global)
 * @returns {{ diff: number, isAbove: boolean, percentDiff: number }}
 */
function compareToAverage(userKg, averageKg) {
  const diff = userKg - averageKg;
  return {
    diff: Math.round(diff * 100) / 100,
    isAbove: diff > 0,
    percentDiff: Math.round((Math.abs(diff) / averageKg) * 100)
  };
}

/**
 * Estimates annual CO2 emissions from daily figure.
 * @param {number} dailyKg - Daily kg CO2
 * @returns {number} Annual kg CO2
 * @throws {Error} If dailyKg is negative
 */
function estimateAnnualEmissions(dailyKg) {
  if (dailyKg < 0) throw new Error('Daily emissions cannot be negative');
  return Math.round(dailyKg * 365 * 10) / 10;
}

/**
 * Calculates cost to offset a given amount of CO2.
 * @param {number} kgCO2 - Kilograms of CO2 to offset
 * @param {number} pricePerKg - Price per kg in INR
 * @returns {number} Total cost in INR
 * @throws {Error} If inputs are invalid
 */
function calculateOffsetCost(kgCO2, pricePerKg) {
  if (kgCO2 < 0) throw new Error('CO2 cannot be negative');
  if (pricePerKg <= 0) throw new Error('Price must be positive');
  return Math.round(kgCO2 * pricePerKg);
}

/**
 * Formats a number using Indian locale (e.g. 1,23,456).
 * @param {number} n - Number to format
 * @returns {string} Formatted string
 * @throws {Error} If value is not a valid number
 */
function formatNumber(n) {
  if (typeof n !== 'number' || isNaN(n)) throw new Error('Invalid number');
  return n.toLocaleString('en-IN');
}

/**
 * Calculates global CO2 emission rate per second.
 * @param {number} dailyGlobalTonnes - Daily global emissions in tonnes
 * @returns {number} Tonnes emitted per second
 */
function calculateCO2PerSecond(dailyGlobalTonnes = 100000000) {
  return Math.round(dailyGlobalTonnes / 86400);
}

/**
 * Calculates trees needed to offset a given CO2 amount.
 * @param {number} co2Tonnes - CO2 in tonnes
 * @param {number} kgPerTreePerYear - Sequestration per tree (default 22 kg)
 * @returns {number} Number of trees needed
 * @throws {Error} If CO2 is negative
 */
function calculateTreesNeeded(co2Tonnes, kgPerTreePerYear = 22) {
  if (co2Tonnes < 0) throw new Error('CO2 cannot be negative');
  return Math.round((co2Tonnes * 1000) / kgPerTreePerYear);
}

/**
 * Calculates potential electricity bill savings from solar installation.
 * @param {number} monthlyBill - Current monthly bill in INR
 * @param {number} coveragePercent - Solar coverage percentage (0–100)
 * @returns {number} Monthly savings in INR
 * @throws {Error} If coverage is out of range
 */
function calculateSolarSavings(monthlyBill, coveragePercent) {
  if (coveragePercent < 0 || coveragePercent > 100) {
    throw new Error('Coverage must be 0-100%');
  }
  return Math.round(monthlyBill * (coveragePercent / 100));
}

// ── AI TIPS ───────────────────────────────────────────────────────────────────

/**
 * Fetches personalised CO2 reduction tips from Anthropic API.
 * Falls back to curated static tips on network or parse failure.
 * @param {string} transport - Transport mode
 * @param {string} diet - Diet type
 * @param {number} electricity - Monthly electricity bill
 * @param {string} energySource - Energy source type
 * @param {number} total - Total daily CO2 in kg
 * @returns {Promise<Array<{title: string, tip: string}>>} Array of tip objects
 */
async function fetchAITips(transport, diet, electricity, energySource, total) {
  const prompt = `You are a climate action expert for India. A person has this daily carbon footprint:
- Total: ${total} kg CO2/day
- Transport: ${transport.replace(/_/g, ' ')}
- Diet: ${diet.replace(/_/g, ' ')}
- Monthly electricity: Rs ${electricity} (${energySource.replace(/_/g, ' ')})

Give exactly 4 highly specific, actionable tips to reduce their carbon footprint. Reference Indian government schemes, Indian brands, or India-specific options. Be concrete — name specific subsidies, products, or behaviors with numbers.

Return ONLY a JSON array. No markdown, no preamble:
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

    if (!response.ok) throw new Error(`API responded with status ${response.status}`);

    const data = await response.json();
    const text = data.content.map(b => b.text || '').join('');
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);

  } catch (err) {
    console.warn('AI tips fallback activated:', err.message);
    return getFallbackTips(transport, diet);
  }
}

/**
 * Returns curated fallback tips when AI API is unavailable.
 * Tips are contextually selected based on user's highest-impact category.
 * @param {string} transport - User's transport mode
 * @param {string} diet - User's diet type
 * @returns {Array<{title: string, tip: string}>}
 */
function getFallbackTips(transport, diet) {
  return [
    {
      title: 'Switch to metro or bus',
      tip: 'Delhi Metro displaces 630,000 tonnes CO₂ annually. Replacing a 20 km petrol car commute with metro saves ~3.8 kg CO₂/day and ₹4,000+/month in fuel.'
    },
    {
      title: 'Two plant-based days weekly',
      tip: 'Replacing meat with dal, rajma, or paneer twice a week cuts diet emissions by ~25%. India\'s lentil-based cuisine is among the world\'s lowest-carbon diets.'
    },
    {
      title: 'Apply for PM-KUSUM solar',
      tip: 'MNRE\'s PM-KUSUM scheme covers 40% of rooftop solar installation costs. A 2kW system eliminates ~2,900 kg CO₂/year and pays back within 4–5 years.'
    },
    {
      title: 'Set AC to 24°C',
      tip: 'BEE mandates 24°C factory default — each degree lower increases consumption by 6%. Switching to a 5-star BEE-rated inverter AC cuts cooling emissions by up to 50%.'
    }
  ];
}

// ── DOM ELEMENT CACHE ─────────────────────────────────────────────────────────

/**
 * Cached DOM element references for performance.
 * All elements queried once at load time.
 * @constant {Object}
 */
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

/**
 * Updates slider visual fill and ARIA state.
 * @param {HTMLInputElement} input - Range input element
 */
function updateSlider(input) {
  const min = +input.min;
  const max = +input.max;
  const val = +input.value;
  const pct = ((val - min) / (max - min) * 100) + '%';
  input.style.setProperty('--pct', pct);
  input.setAttribute('aria-valuenow', val);
}

DOM.km.addEventListener('input', () => {
  DOM.kmVal.textContent = DOM.km.value;
  updateSlider(DOM.km);
});

DOM.electricity.addEventListener('input', () => {
  DOM.elecVal.textContent = formatNumber(Number(DOM.electricity.value));
  updateSlider(DOM.electricity);
});

updateSlider(DOM.km);
updateSlider(DOM.electricity);

// ── RENDER RESULTS ────────────────────────────────────────────────────────────

/**
 * Renders the gauge, verdict, comparison text, and breakdown bars.
 * Animates gauge arc after brief delay for visual effect.
 * @param {{ transport: number, diet: number, energy: number, total: number }} emissions
 */
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

  const comparison = compareToAverage(emissions.total, INDIA_AVERAGE_KG);
  DOM.compareText.textContent = comparison.isAbove
    ? `${comparison.diff} kg above India average`
    : `${Math.abs(comparison.diff)} kg below India average`;

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
        <div class="bar-fill"
             style="width:${Math.round(item.value / maxVal * 100)}%;background:${item.color}"
             role="progressbar"
             aria-valuenow="${item.value}"
             aria-valuemin="0"
             aria-valuemax="${maxVal}"
             aria-label="${item.label}: ${item.value} kg CO2 per day">
        </div>
      </div>
    </div>`).join('');
}

/**
 * Renders AI-generated tips into the tips card.
 * Sanitizes all tip content before insertion.
 * @param {Array<{title: string, tip: string}>} tips
 */
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

/**
 * Handles form submission: validates, calculates, renders results, fetches AI tips.
 * @param {Event} e - Form submit event
 */
DOM.form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const transport = sanitizeInput(DOM.transport.value);
  const diet = sanitizeInput(DOM.diet.value);
  const km = parseInt(DOM.km.value, 10);
  const electricity = parseInt(DOM.electricity.value, 10);
  const energySource = sanitizeInput(DOM.energySource.value);

  const errors = validateInput(transport, diet, km, electricity);
  if (errors.length > 0) {
    alert('Please fix the following:\n\n' + errors.join('\n'));
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

/**
 * Resets UI to calculator form state.
 */
DOM.recalcBtn.addEventListener('click', () => {
  DOM.results.classList.remove('visible');
  DOM.calcSection.style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ── CANVAS PARTICLE SYSTEM ────────────────────────────────────────────────────

/**
 * Initialises animated particle network on hero canvas.
 * Uses requestAnimationFrame for GPU-optimised rendering.
 * Particles connect via lines when within 140px of each other.
 */
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
    x: Math.random(),
    y: Math.random(),
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

/**
 * Initialises real-time global CO2 emission counter.
 * Calculates elapsed time since midnight to seed the counter,
 * then increments every second at global emission rate.
 */
(function initCounter() {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const elapsed = (now - startOfDay) / 1000;
  const ratePerSec = calculateCO2PerSecond(100000000);

  let co2 = Math.round(elapsed * ratePerSec);
  const co2El = document.getElementById('co2-today');
  const treesEl = document.getElementById('trees-today');

  if (co2El) co2El.textContent = formatNumber(co2);
  if (treesEl) treesEl.textContent = formatNumber(calculateTreesNeeded(co2 / 1000));

  setInterval(() => {
    co2 += ratePerSec;
    if (co2El) co2El.textContent = formatNumber(co2);
    if (treesEl) treesEl.textContent = formatNumber(calculateTreesNeeded(co2 / 1000));
  }, 1000);
})();