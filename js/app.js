const EMISSION_FACTORS = {
  transport: {
    car_petrol: 0.192, car_diesel: 0.171, car_ev: 0.053,
    motorbike: 0.114, bus: 0.089, train: 0.041, cycle: 0
  },
  diet: {
    vegan: 2.89, vegetarian: 3.81, pescatarian: 4.67,
    meat_low: 5.63, meat_medium: 7.19, meat_high: 10.24
  },
  energy_source: {
    grid: 1.0, solar_partial: 0.6, solar_full: 0.15
  }
};

const kmSlider = document.getElementById('km');
const kmVal = document.getElementById('km-val');
const elecSlider = document.getElementById('electricity');
const elecVal = document.getElementById('elec-val');

kmSlider.addEventListener('input', () => {
  kmVal.textContent = kmSlider.value;
  kmSlider.setAttribute('aria-valuenow', kmSlider.value);
});
elecSlider.addEventListener('input', () => {
  elecVal.textContent = Number(elecSlider.value).toLocaleString('en-IN');
  elecSlider.setAttribute('aria-valuenow', elecSlider.value);
});

function calcEmissions(transport, km, diet, electricity, energySource) {
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

function getScoreLabel(total) {
  if (total < 4) return { label: '🌱 Low impact – you\'re doing well!', color: '#16a34a' };
  if (total < 8) return { label: '🟡 Moderate impact – room to improve', color: '#d97706' };
  if (total < 13) return { label: '🔴 High impact – action needed', color: '#dc2626' };
  return { label: '🚨 Very high impact – urgent changes needed', color: '#991b1b' };
}

function animateArc(total) {
  const max = 20;
  const pct = Math.min(total / max, 1);
  const circumference = 2 * Math.PI * 52;
  const offset = circumference * (1 - pct);
  const arc = document.getElementById('score-arc');
  const { color } = getScoreLabel(total);
  arc.style.strokeDashoffset = offset;
  arc.style.stroke = color;
  document.getElementById('score-number').textContent = total.toFixed(1);
  document.getElementById('score-number').style.color = color;
}

function renderBreakdown(emissions) {
  const container = document.getElementById('breakdown-bars');
  const total = emissions.total || 1;
  const items = [
    { label: 'Transport', value: emissions.transport },
    { label: 'Diet', value: emissions.diet },
    { label: 'Energy', value: emissions.energy }
  ];
  container.innerHTML = items.map(item => {
    const pct = Math.round((item.value / total) * 100);
    return `
      <div class="bar-item" role="listitem">
        <div class="bar-label">
          <span>${item.label}</span>
          <span>${item.value} kg CO₂ (${pct}%)</span>
        </div>
        <div class="bar-track">
          <div class="bar-fill" style="width: ${pct}%" role="progressbar"
               aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"
               aria-label="${item.label} emissions: ${pct}%"></div>
        </div>
      </div>`;
  }).join('');
}

async function fetchAITips(transport, diet, electricity, energySource, total) {
  const prompt = `You are a climate action expert. A person in India has the following daily carbon footprint:
- Total: ${total} kg CO₂/day
- Transport: ${transport.replace('_', ' ')}, daily commute
- Diet: ${diet.replace('_', ' ')}
- Monthly electricity: ₹${electricity} (source: ${energySource.replace('_', ' ')})

Give them exactly 4 personalised, actionable tips to reduce their carbon footprint. Be specific to India (mention Indian options where relevant). Format as JSON array with objects having "title" (short, 5 words max) and "tip" (2 sentences, specific action). Return ONLY the JSON array, no other text.`;

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
    const data = await response.json();
    const text = data.content.map(b => b.text || '').join('');
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch (e) {
    return [
      { title: 'Switch to public transit', tip: 'Metro and buses in Indian cities produce 70% less CO₂ than private cars. Try commuting by train or bus at least 3 days a week.' },
      { title: 'Reduce meat consumption', tip: 'Switching from daily meat to plant-based meals twice a week can cut diet emissions by 30%. Lentils, chickpeas, and paneer are excellent protein sources.' },
      { title: 'Install rooftop solar', tip: 'MNRE subsidies cover up to 40% of rooftop solar installation costs in India. A 1kW system can offset 1,500 kg of CO₂ per year.' },
      { title: 'Reduce energy waste', tip: 'Set AC to 24°C instead of 18°C — each degree warmer saves 6% electricity. Use 5-star BEE-rated appliances to cut energy use by up to 50%.' }
    ];
  }
}

function renderTips(tips) {
  const container = document.getElementById('ai-tips-content');
  container.innerHTML = tips.map(t => `
    <div class="tip-card">
      <strong>${t.title}</strong>
      ${t.tip}
    </div>`).join('');
}

document.getElementById('carbon-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const transport = document.getElementById('transport').value;
  const diet = document.getElementById('diet').value;
  if (!transport || !diet) {
    alert('Please select your transport mode and diet type.');
    return;
  }
  const km = parseInt(kmSlider.value);
  const electricity = parseInt(elecSlider.value);
  const energySource = document.getElementById('energy_source').value;

  const emissions = calcEmissions(transport, km, diet, electricity, energySource);
  const { label, color } = getScoreLabel(emissions.total);

  document.getElementById('carbon-form').classList.add('hidden');
  const results = document.getElementById('results');
  results.classList.remove('hidden');

  setTimeout(() => animateArc(emissions.total), 100);
  const scoreLabel = document.getElementById('score-label');
  scoreLabel.textContent = label;
  scoreLabel.style.color = color;

  renderBreakdown(emissions);

  document.getElementById('tips-loading').style.display = 'flex';
  const tips = await fetchAITips(transport, diet, electricity, energySource, emissions.total);
  document.getElementById('tips-loading').style.display = 'none';
  renderTips(tips);
});

document.getElementById('recalculate').addEventListener('click', () => {
  document.getElementById('results').classList.add('hidden');
  document.getElementById('carbon-form').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
});