// CarbonSense Test Suite
// Tests for emission calculations, input validation, and data integrity

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

function validateInput(transport, diet, km, electricity) {
  const errors = [];
  if (!transport || transport === '') errors.push('Transport mode is required');
  if (!diet || diet === '') errors.push('Diet type is required');
  if (isNaN(km) || km <= 0) errors.push('Distance must be a positive number');
  if (isNaN(electricity) || electricity <= 0) errors.push('Electricity bill must be a positive number');
  return errors;
}

function sanitizeInput(value) {
  if (typeof value === 'string') {
    return value.replace(/[<>'"&]/g, '').trim();
  }
  return value;
}

function getScoreLabel(total) {
  if (total < 0) return null;
  if (total < 4) return 'low';
  if (total < 8) return 'moderate';
  if (total < 13) return 'high';
  return 'very_high';
}

// ── TEST RUNNER ──────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ❌ FAIL: ${name} — ${e.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertApprox(a, b, msg, tolerance = 0.01) {
  if (Math.abs(a - b) > tolerance) throw new Error(`${msg}: expected ${b}, got ${a}`);
}

function assertThrows(fn, message) {
  try { fn(); throw new Error('Expected error but none thrown'); }
  catch (e) { if (e.message === 'Expected error but none thrown') throw e; }
}

// ── EMISSION CALCULATION TESTS ───────────────────────────────────────────────
console.log('\n🧪 Emission Calculation Tests');

test('Cycle/walk produces zero transport emissions', () => {
  const result = calcEmissions('cycle', 20, 'vegan', 1500, 'grid');
  assert(result.transport === 0, 'Cycle transport emissions should be 0');
});

test('Vegan diet has lowest diet emissions', () => {
  const vegan = calcEmissions('cycle', 0, 'vegan', 0, 'grid');
  const meatHigh = calcEmissions('cycle', 0, 'meat_high', 0, 'grid');
  assert(vegan.diet < meatHigh.diet, 'Vegan diet should emit less than heavy meat diet');
});

test('EV emits less than petrol car for same distance', () => {
  const ev = calcEmissions('car_ev', 30, 'vegan', 0, 'grid');
  const petrol = calcEmissions('car_petrol', 30, 'vegan', 0, 'grid');
  assert(ev.transport < petrol.transport, 'EV should emit less than petrol');
});

test('Solar reduces energy emissions vs grid', () => {
  const grid = calcEmissions('cycle', 0, 'vegan', 1500, 'grid');
  const solar = calcEmissions('cycle', 0, 'vegan', 1500, 'solar_full');
  assert(solar.energy < grid.energy, 'Solar should produce less emissions than grid');
});

test('Total equals sum of components', () => {
  const r = calcEmissions('car_petrol', 20, 'meat_medium', 2000, 'grid');
  const sum = Math.round((r.transport + r.diet + r.energy) * 100) / 100;
  assertApprox(r.total, sum, 'Total should equal sum of components');
});

test('Petrol car emission factor is correct (0.192 kg/km)', () => {
  const r = calcEmissions('car_petrol', 10, 'vegan', 0, 'solar_full');
  assertApprox(r.transport, 1.92, 'Petrol car 10km should emit ~1.92 kg CO2');
});

test('Zero distance produces zero transport emissions', () => {
  const r = calcEmissions('car_petrol', 0, 'vegan', 1500, 'grid');
  assert(r.transport === 0, 'Zero distance should produce zero transport emissions');
});

test('Higher electricity bill produces higher energy emissions', () => {
  const low = calcEmissions('cycle', 0, 'vegan', 500, 'grid');
  const high = calcEmissions('cycle', 0, 'vegan', 5000, 'grid');
  assert(high.energy > low.energy, 'Higher bill should produce more emissions');
});

test('meat_high diet emits more than vegetarian', () => {
  const veg = calcEmissions('cycle', 0, 'vegetarian', 0, 'grid');
  const meat = calcEmissions('cycle', 0, 'meat_high', 0, 'grid');
  assert(meat.diet > veg.diet, 'Meat heavy diet should exceed vegetarian');
});

test('All transport modes return non-negative emissions', () => {
  Object.keys(EMISSION_FACTORS.transport).forEach(mode => {
    const r = calcEmissions(mode, 20, 'vegan', 1500, 'grid');
    assert(r.transport >= 0, `Transport mode ${mode} should not return negative emissions`);
  });
});

// ── INPUT VALIDATION TESTS ───────────────────────────────────────────────────
console.log('\n🔒 Input Validation Tests');

test('Empty transport returns validation error', () => {
  const errors = validateInput('', 'vegan', 20, 1500);
  assert(errors.length > 0, 'Empty transport should fail validation');
});

test('Empty diet returns validation error', () => {
  const errors = validateInput('car_petrol', '', 20, 1500);
  assert(errors.length > 0, 'Empty diet should fail validation');
});

test('Negative km returns validation error', () => {
  const errors = validateInput('car_petrol', 'vegan', -5, 1500);
  assert(errors.length > 0, 'Negative distance should fail validation');
});

test('Zero electricity returns validation error', () => {
  const errors = validateInput('car_petrol', 'vegan', 20, 0);
  assert(errors.length > 0, 'Zero electricity should fail validation');
});

test('Valid inputs pass validation', () => {
  const errors = validateInput('car_petrol', 'vegan', 20, 1500);
  assert(errors.length === 0, 'Valid inputs should pass validation');
});

test('Invalid transport throws error in calculation', () => {
  assertThrows(() => calcEmissions('rocket', 20, 'vegan', 1500, 'grid'));
});

test('Invalid diet throws error in calculation', () => {
  assertThrows(() => calcEmissions('car_petrol', 20, 'carnivore', 1500, 'grid'));
});

test('Extreme km value throws error', () => {
  assertThrows(() => calcEmissions('car_petrol', 9999, 'vegan', 1500, 'grid'));
});

// ── SANITIZATION TESTS ───────────────────────────────────────────────────────
console.log('\n🛡️ Security & Sanitization Tests');

test('XSS script tag is stripped from input', () => {
  const result = sanitizeInput('<script>alert("xss")</script>');
  assert(!result.includes('<script>'), 'Script tags should be stripped');
});

test('HTML angle brackets are removed', () => {
  const result = sanitizeInput('<div>hello</div>');
  assert(!result.includes('<') && !result.includes('>'), 'HTML brackets should be removed');
});

test('Single quotes are sanitized', () => {
  const result = sanitizeInput("it's a test");
  assert(!result.includes("'"), 'Single quotes should be removed');
});

test('Normal text passes through sanitization unchanged', () => {
  const result = sanitizeInput('car_petrol');
  assert(result === 'car_petrol', 'Normal text should pass through unchanged');
});

test('Whitespace is trimmed', () => {
  const result = sanitizeInput('  vegan  ');
  assert(result === 'vegan', 'Leading/trailing whitespace should be trimmed');
});

// ── SCORE LABEL TESTS ────────────────────────────────────────────────────────
console.log('\n📊 Score Classification Tests');

test('Score below 4 is classified as low', () => {
  assert(getScoreLabel(2.5) === 'low', '2.5 kg should be low impact');
});

test('Score 4-8 is classified as moderate', () => {
  assert(getScoreLabel(6) === 'moderate', '6 kg should be moderate impact');
});

test('Score 8-13 is classified as high', () => {
  assert(getScoreLabel(10) === 'high', '10 kg should be high impact');
});

test('Score above 13 is classified as very high', () => {
  assert(getScoreLabel(15) === 'very_high', '15 kg should be very high impact');
});

test('Score exactly 4 is moderate not low', () => {
  assert(getScoreLabel(4) === 'moderate', 'Score of 4 should be moderate');
});

// ── SUMMARY ──────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📊 Total:  ${passed + failed}`);
console.log(`🎯 Score:  ${Math.round(passed/(passed+failed)*100)}%`);
console.log('─'.repeat(50));

if (failed === 0) {
  console.log('🎉 All tests passed!');
} else {
  console.log(`⚠️  ${failed} test(s) failed.`);
  process.exit(1);
}

module.exports = { calcEmissions, validateInput, sanitizeInput, getScoreLabel };