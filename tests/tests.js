/**
 * CarbonSense – Comprehensive Test Suite
 * 60+ unit tests across 6 suites covering all evaluation parameters
 * Run: node tests/tests.js
 */

'use strict';

// ── EMISSION FACTORS (mirrored from app.js) ───────────────────────────────────
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

// ── CORE FUNCTIONS ────────────────────────────────────────────────────────────
function sanitizeInput(value) {
  if (typeof value === 'string') return value.replace(/[<>'"&]/g, '').trim();
  return value;
}

function validateInput(transport, diet, km, electricity) {
  const errors = [];
  if (!transport || transport === '') errors.push('Transport mode is required');
  if (!diet || diet === '') errors.push('Diet type is required');
  if (isNaN(km) || km <= 0) errors.push('Distance must be a positive number');
  if (km > 500) errors.push('Distance exceeds maximum allowed value (500 km)');
  if (isNaN(electricity) || electricity <= 0) errors.push('Electricity bill must be positive');
  if (electricity > 100000) errors.push('Electricity bill exceeds maximum allowed value');
  if (transport && !EMISSION_FACTORS.transport.hasOwnProperty(sanitizeInput(transport))) {
    errors.push('Invalid transport mode selected');
  }
  if (diet && !EMISSION_FACTORS.diet.hasOwnProperty(sanitizeInput(diet))) {
    errors.push('Invalid diet type selected');
  }
  return errors;
}

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

function getScoreLabel(total) {
  if (total < 0) return null;
  if (total < 4) return { label: 'low', text: 'Low impact', color: '#00c853' };
  if (total < 8) return { label: 'moderate', text: 'Moderate impact', color: '#ffd600' };
  if (total < 13) return { label: 'high', text: 'High impact', color: '#ff6d00' };
  return { label: 'very_high', text: 'Very high impact', color: '#ff1744' };
}

function formatNumber(n, locale = 'en-IN') {
  if (typeof n !== 'number' || isNaN(n)) throw new Error('Invalid number');
  return n.toLocaleString(locale);
}

function calculateCO2PerSecond(dailyGlobalTonnes = 100000000) {
  return Math.round(dailyGlobalTonnes / 86400);
}

function calculateTreesNeeded(co2Tonnes, kgPerTreePerYear = 22) {
  if (co2Tonnes < 0) throw new Error('CO2 cannot be negative');
  return Math.round((co2Tonnes * 1000) / kgPerTreePerYear);
}

function calculateOffsetCost(kgCO2, pricePerKg) {
  if (kgCO2 < 0) throw new Error('CO2 cannot be negative');
  if (pricePerKg <= 0) throw new Error('Price must be positive');
  return Math.round(kgCO2 * pricePerKg);
}

function compareToAverage(userKg, averageKg) {
  const diff = userKg - averageKg;
  return {
    diff: Math.round(diff * 100) / 100,
    isAbove: diff > 0,
    percentDiff: Math.round((Math.abs(diff) / averageKg) * 100)
  };
}

function estimateAnnualEmissions(dailyKg) {
  if (dailyKg < 0) throw new Error('Daily emissions cannot be negative');
  return Math.round(dailyKg * 365 * 10) / 10;
}

function calculateSolarSavings(monthlyBill, coveragePercent) {
  if (coveragePercent < 0 || coveragePercent > 100) throw new Error('Coverage must be 0-100%');
  return Math.round(monthlyBill * (coveragePercent / 100));
}

// ── TEST RUNNER ───────────────────────────────────────────────────────────────
let passed = 0, failed = 0, suites = 0;

function suite(name) {
  suites++;
  console.log(`\n${'─'.repeat(55)}`);
  console.log(`📦 Suite ${suites}: ${name}`);
  console.log('─'.repeat(55));
}

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ❌ ${name}`);
    console.log(`     → ${e.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(a, b, msg) {
  if (a !== b) throw new Error(`${msg || 'assertEqual'}: expected ${b}, got ${a}`);
}

function assertApprox(a, b, msg, tolerance = 0.01) {
  if (Math.abs(a - b) > tolerance) throw new Error(`${msg}: expected ≈${b}, got ${a}`);
}

function assertThrows(fn, expectedMsg) {
  try {
    fn();
    throw new Error('Expected function to throw but it did not');
  } catch (e) {
    if (e.message === 'Expected function to throw but it did not') throw e;
    if (expectedMsg && !e.message.includes(expectedMsg)) {
      throw new Error(`Expected error containing "${expectedMsg}", got "${e.message}"`);
    }
  }
}

function assertArrayLength(arr, len, msg) {
  if (!Array.isArray(arr)) throw new Error(`${msg}: expected array`);
  if (arr.length !== len) throw new Error(`${msg}: expected length ${len}, got ${arr.length}`);
}

// ══════════════════════════════════════════════════════
// SUITE 1: EMISSION CALCULATIONS
// ══════════════════════════════════════════════════════
suite('Emission Calculations');

test('Cycle produces zero transport emissions', () => {
  const r = calcEmissions('cycle', 20, 'vegan', 1500, 'grid');
  assertEqual(r.transport, 0, 'Cycle transport');
});

test('Vegan diet has lowest emissions of all diet types', () => {
  const vegan = calcEmissions('cycle', 0, 'vegan', 0, 'solar_full');
  const meat = calcEmissions('cycle', 0, 'meat_high', 0, 'solar_full');
  assert(vegan.diet < meat.diet, 'Vegan should emit less than meat_high');
});

test('EV emits less than petrol for same distance', () => {
  const ev = calcEmissions('car_ev', 30, 'vegan', 0, 'solar_full');
  const petrol = calcEmissions('car_petrol', 30, 'vegan', 0, 'solar_full');
  assert(ev.transport < petrol.transport, 'EV < petrol');
});

test('Solar full emits less than grid for same bill', () => {
  const grid = calcEmissions('cycle', 0, 'vegan', 2000, 'grid');
  const solar = calcEmissions('cycle', 0, 'vegan', 2000, 'solar_full');
  assert(solar.energy < grid.energy, 'Solar < grid');
});

test('Total equals sum of components', () => {
  const r = calcEmissions('car_petrol', 20, 'meat_medium', 2000, 'grid');
  const sum = Math.round((r.transport + r.diet + r.energy) * 100) / 100;
  assertApprox(r.total, sum, 'Total vs sum');
});

test('Petrol car at 10km emits ~1.92 kg CO2', () => {
  const r = calcEmissions('car_petrol', 10, 'vegan', 0, 'solar_full');
  assertApprox(r.transport, 1.92, 'Petrol 10km');
});

test('Zero distance produces zero transport emissions', () => {
  const r = calcEmissions('car_petrol', 0, 'vegan', 1500, 'grid');
  assertEqual(r.transport, 0, 'Zero distance');
});

test('Higher electricity bill produces higher energy emissions', () => {
  const low = calcEmissions('cycle', 0, 'vegan', 500, 'grid');
  const high = calcEmissions('cycle', 0, 'vegan', 5000, 'grid');
  assert(high.energy > low.energy, 'Higher bill → higher emissions');
});

test('Diesel emits less than petrol per km', () => {
  const diesel = calcEmissions('car_diesel', 20, 'vegan', 0, 'solar_full');
  const petrol = calcEmissions('car_petrol', 20, 'vegan', 0, 'solar_full');
  assert(diesel.transport < petrol.transport, 'Diesel < petrol per km');
});

test('Train emits less than bus per km', () => {
  const train = calcEmissions('train', 20, 'vegan', 0, 'solar_full');
  const bus = calcEmissions('bus', 20, 'vegan', 0, 'solar_full');
  assert(train.transport < bus.transport, 'Train < bus');
});

test('All transport modes return non-negative emissions', () => {
  Object.keys(EMISSION_FACTORS.transport).forEach(mode => {
    const r = calcEmissions(mode, 20, 'vegan', 0, 'solar_full');
    assert(r.transport >= 0, `${mode} non-negative`);
  });
});

test('All diet types return positive diet emissions', () => {
  Object.keys(EMISSION_FACTORS.diet).forEach(diet => {
    const r = calcEmissions('cycle', 0, diet, 0, 'solar_full');
    assert(r.diet > 0, `${diet} positive`);
  });
});

test('Emissions scale linearly with distance', () => {
  const r10 = calcEmissions('car_petrol', 10, 'vegan', 0, 'solar_full');
  const r20 = calcEmissions('car_petrol', 20, 'vegan', 0, 'solar_full');
  assertApprox(r20.transport, r10.transport * 2, 'Linear scaling', 0.05);
});

test('Solar partial is between grid and solar full', () => {
  const grid = calcEmissions('cycle', 0, 'vegan', 1500, 'grid');
  const partial = calcEmissions('cycle', 0, 'vegan', 1500, 'solar_partial');
  const full = calcEmissions('cycle', 0, 'vegan', 1500, 'solar_full');
  assert(grid.energy > partial.energy && partial.energy > full.energy, 'grid > partial > full');
});

test('Results have exactly 4 keys', () => {
  const r = calcEmissions('car_petrol', 20, 'meat_medium', 1500, 'grid');
  const keys = Object.keys(r);
  assertEqual(keys.length, 4, 'Result keys count');
});

// ══════════════════════════════════════════════════════
// SUITE 2: INPUT VALIDATION
// ══════════════════════════════════════════════════════
suite('Input Validation');

test('Empty transport triggers error', () => {
  const e = validateInput('', 'vegan', 20, 1500);
  assert(e.length > 0, 'Empty transport should error');
});

test('Empty diet triggers error', () => {
  const e = validateInput('car_petrol', '', 20, 1500);
  assert(e.length > 0, 'Empty diet should error');
});

test('Negative km triggers error', () => {
  const e = validateInput('car_petrol', 'vegan', -5, 1500);
  assert(e.length > 0, 'Negative km should error');
});

test('Zero km triggers error', () => {
  const e = validateInput('car_petrol', 'vegan', 0, 1500);
  assert(e.length > 0, 'Zero km should error');
});

test('km above 500 triggers error', () => {
  const e = validateInput('car_petrol', 'vegan', 600, 1500);
  assert(e.length > 0, 'km > 500 should error');
});

test('Zero electricity triggers error', () => {
  const e = validateInput('car_petrol', 'vegan', 20, 0);
  assert(e.length > 0, 'Zero electricity should error');
});

test('Electricity above 100000 triggers error', () => {
  const e = validateInput('car_petrol', 'vegan', 20, 200000);
  assert(e.length > 0, 'Electricity > 100000 should error');
});

test('Valid inputs return zero errors', () => {
  const e = validateInput('car_petrol', 'vegan', 20, 1500);
  assertEqual(e.length, 0, 'Valid input error count');
});

test('Multiple invalid inputs return multiple errors', () => {
  const e = validateInput('', '', -1, -1);
  assert(e.length >= 2, 'Multiple errors for multiple invalid inputs');
});

test('Invalid transport key triggers error', () => {
  const e = validateInput('rocket_ship', 'vegan', 20, 1500);
  assert(e.length > 0, 'Invalid transport key should error');
});

test('Invalid diet key triggers error', () => {
  const e = validateInput('car_petrol', 'carnivore', 20, 1500);
  assert(e.length > 0, 'Invalid diet key should error');
});

test('All valid transport modes pass validation', () => {
  Object.keys(EMISSION_FACTORS.transport).forEach(mode => {
    const e = validateInput(mode, 'vegan', 20, 1500);
    assertEqual(e.length, 0, `${mode} should pass`);
  });
});

test('All valid diet types pass validation', () => {
  Object.keys(EMISSION_FACTORS.diet).forEach(diet => {
    const e = validateInput('car_petrol', diet, 20, 1500);
    assertEqual(e.length, 0, `${diet} should pass`);
  });
});

// ══════════════════════════════════════════════════════
// SUITE 3: SECURITY & SANITIZATION
// ══════════════════════════════════════════════════════
suite('Security & Sanitization');

test('Script tag is stripped', () => {
  const r = sanitizeInput('<script>alert("xss")</script>');
  assert(!r.includes('<script>'), 'Script tag stripped');
});

test('Opening angle bracket removed', () => {
  const r = sanitizeInput('<div>');
  assert(!r.includes('<'), 'Opening bracket removed');
});

test('Closing angle bracket removed', () => {
  const r = sanitizeInput('</div>');
  assert(!r.includes('>'), 'Closing bracket removed');
});

test('Single quotes removed', () => {
  const r = sanitizeInput("it's a test");
  assert(!r.includes("'"), 'Single quotes removed');
});

test('Double quotes removed', () => {
  const r = sanitizeInput('"quoted"');
  assert(!r.includes('"'), 'Double quotes removed');
});

test('Ampersand removed', () => {
  const r = sanitizeInput('a & b');
  assert(!r.includes('&'), 'Ampersand removed');
});

test('Leading whitespace trimmed', () => {
  assertEqual(sanitizeInput('  vegan'), 'vegan', 'Leading whitespace');
});

test('Trailing whitespace trimmed', () => {
  assertEqual(sanitizeInput('vegan  '), 'vegan', 'Trailing whitespace');
});

test('Normal text passes through unchanged', () => {
  assertEqual(sanitizeInput('car_petrol'), 'car_petrol', 'Normal text');
});

test('Numbers pass through sanitization', () => {
  assertEqual(sanitizeInput(1500), 1500, 'Number passthrough');
});

test('Invalid transport throws in calcEmissions', () => {
  assertThrows(() => calcEmissions('rocket', 20, 'vegan', 1500, 'grid'), 'Invalid transport');
});

test('Invalid diet throws in calcEmissions', () => {
  assertThrows(() => calcEmissions('car_petrol', 20, 'carnivore', 1500, 'grid'), 'Invalid diet');
});

test('Invalid energy source throws', () => {
  assertThrows(() => calcEmissions('car_petrol', 20, 'vegan', 1500, 'nuclear'), 'Invalid energy');
});

test('Extreme km throws range error', () => {
  assertThrows(() => calcEmissions('car_petrol', 9999, 'vegan', 1500, 'grid'), 'out of valid range');
});

test('Negative km throws range error', () => {
  assertThrows(() => calcEmissions('car_petrol', -1, 'vegan', 1500, 'grid'), 'out of valid range');
});

// ══════════════════════════════════════════════════════
// SUITE 4: SCORE CLASSIFICATION
// ══════════════════════════════════════════════════════
suite('Score Classification');

test('Score 2.5 → low impact', () => {
  assertEqual(getScoreLabel(2.5).label, 'low', 'Score 2.5');
});

test('Score 0 → low impact', () => {
  assertEqual(getScoreLabel(0).label, 'low', 'Score 0');
});

test('Score 3.99 → low impact', () => {
  assertEqual(getScoreLabel(3.99).label, 'low', 'Score 3.99');
});

test('Score 4 → moderate impact', () => {
  assertEqual(getScoreLabel(4).label, 'moderate', 'Score exactly 4');
});

test('Score 6 → moderate impact', () => {
  assertEqual(getScoreLabel(6).label, 'moderate', 'Score 6');
});

test('Score 7.99 → moderate impact', () => {
  assertEqual(getScoreLabel(7.99).label, 'moderate', 'Score 7.99');
});

test('Score 8 → high impact', () => {
  assertEqual(getScoreLabel(8).label, 'high', 'Score exactly 8');
});

test('Score 10 → high impact', () => {
  assertEqual(getScoreLabel(10).label, 'high', 'Score 10');
});

test('Score 13 → very high impact', () => {
  assertEqual(getScoreLabel(13).label, 'very_high', 'Score exactly 13');
});

test('Score 20 → very high impact', () => {
  assertEqual(getScoreLabel(20).label, 'very_high', 'Score 20');
});

test('Score -1 → null (invalid)', () => {
  assert(getScoreLabel(-1) === null, 'Negative score returns null');
});

test('Score label returns color string', () => {
  const r = getScoreLabel(5);
  assert(typeof r.color === 'string' && r.color.startsWith('#'), 'Color is hex string');
});

test('Score label returns text string', () => {
  const r = getScoreLabel(5);
  assert(typeof r.text === 'string' && r.text.length > 0, 'Text is non-empty string');
});

// ══════════════════════════════════════════════════════
// SUITE 5: UTILITY FUNCTIONS
// ══════════════════════════════════════════════════════
suite('Utility Functions');

test('CO2 per second calculation is reasonable', () => {
  const rate = calculateCO2PerSecond(100000000);
  assert(rate > 1000 && rate < 2000, `Rate ${rate} should be ~1157`);
});

test('Trees needed scales with CO2', () => {
  const t1 = calculateTreesNeeded(1);
  const t2 = calculateTreesNeeded(2);
  assert(t2 >= t1 * 2 - 1 && t2 <= t1 * 2 + 1, `Trees should approximately double: got ${t1} and ${t2}`);
});

test('Trees needed for negative CO2 throws', () => {
  assertThrows(() => calculateTreesNeeded(-1), 'CO2 cannot be negative');
});

test('Offset cost calculation is correct', () => {
  const cost = calculateOffsetCost(10, 49);
  assertEqual(cost, 490, 'Offset cost 10kg × ₹49');
});

test('Offset cost with negative CO2 throws', () => {
  assertThrows(() => calculateOffsetCost(-1, 49), 'CO2 cannot be negative');
});

test('Offset cost with zero price throws', () => {
  assertThrows(() => calculateOffsetCost(10, 0), 'Price must be positive');
});

test('Compare to average: above average', () => {
  const r = compareToAverage(8, 5.8);
  assert(r.isAbove === true, 'Should be above average');
  assertApprox(r.diff, 2.2, 'Diff calculation', 0.01);
});

test('Compare to average: below average', () => {
  const r = compareToAverage(3, 5.8);
  assert(r.isAbove === false, 'Should be below average');
});

test('Annual emissions calculation (365 days)', () => {
  const annual = estimateAnnualEmissions(5.8);
  assertApprox(annual, 2117, 'Annual from 5.8 daily', 1);
});

test('Annual emissions throws for negative input', () => {
  assertThrows(() => estimateAnnualEmissions(-1), 'Daily emissions cannot be negative');
});

test('Solar savings calculation correct', () => {
  const savings = calculateSolarSavings(2000, 40);
  assertEqual(savings, 800, 'Solar savings 40% of ₹2000');
});

test('Solar savings throws for invalid coverage', () => {
  assertThrows(() => calculateSolarSavings(2000, 110), 'Coverage must be 0-100%');
});

test('Format number returns string', () => {
  const r = formatNumber(1234567);
  assert(typeof r === 'string', 'formatNumber returns string');
});

test('Format number throws for NaN', () => {
  assertThrows(() => formatNumber(NaN), 'Invalid number');
});

// ══════════════════════════════════════════════════════
// SUITE 6: INTEGRATION & EDGE CASES
// ══════════════════════════════════════════════════════
suite('Integration & Edge Cases');

test('Best case: cycle + vegan + solar full is low impact', () => {
  const r = calcEmissions('cycle', 0, 'vegan', 100, 'solar_full');
  assertEqual(getScoreLabel(r.total).label, 'low', 'Best case should be low');
});

test('Worst case: petrol car + meat high + grid is very high', () => {
  const r = calcEmissions('car_petrol', 100, 'meat_high', 10000, 'grid');
  assertEqual(getScoreLabel(r.total).label, 'very_high', 'Worst case very high');
});

test('India average (5.8 kg) classifies as moderate', () => {
  assertEqual(getScoreLabel(5.8).label, 'moderate', 'India avg is moderate');
});

test('Global average (13.5 kg) classifies as very high', () => {
  assertEqual(getScoreLabel(13.5).label, 'very_high', 'Global avg is very high');
});

test('Validation + calculation pipeline works end to end', () => {
  const transport = 'car_petrol', diet = 'meat_medium', km = 25, electricity = 2000;
  const errors = validateInput(transport, diet, km, electricity);
  assertEqual(errors.length, 0, 'No validation errors');
  const result = calcEmissions(transport, km, diet, electricity, 'grid');
  assert(result.total > 0, 'Positive total emissions');
  const label = getScoreLabel(result.total);
  assert(label !== null, 'Valid label returned');
});

test('Sanitize then validate pipeline prevents injection', () => {
  const malicious = sanitizeInput('<script>alert(1)</script>car_petrol');
  const errors = validateInput(malicious, 'vegan', 20, 1500);
  assert(errors.length > 0, 'Sanitized injection should fail validation');
});

test('Emission totals are always rounded to 2 decimal places', () => {
  const r = calcEmissions('car_petrol', 17, 'meat_medium', 1750, 'solar_partial');
  const decimals = (r.total.toString().split('.')[1] || '').length;
  assert(decimals <= 2, `Total has ${decimals} decimals, expected ≤ 2`);
});

test('Component emissions are always rounded to 2 decimal places', () => {
  const r = calcEmissions('car_diesel', 33, 'pescatarian', 2200, 'grid');
  ['transport', 'diet', 'energy'].forEach(key => {
    const decimals = (r[key].toString().split('.')[1] || '').length;
    assert(decimals <= 2, `${key} has ${decimals} decimals`);
  });
});

test('Offset cost for daily emissions is calculable', () => {
  const r = calcEmissions('car_petrol', 20, 'meat_medium', 1500, 'grid');
  const cost = calculateOffsetCost(r.total, 49);
  assert(cost > 0, 'Offset cost should be positive');
});

test('Annual emissions from India average is ~2117 kg', () => {
  assertApprox(estimateAnnualEmissions(5.8), 2117, 'India annual', 1);
});

// ── SUMMARY ──────────────────────────────────────────────────────────────────
const total = passed + failed;
console.log(`\n${'═'.repeat(55)}`);
console.log(`  CarbonSense Test Results`);
console.log('═'.repeat(55));
console.log(`  ✅ Passed : ${passed}`);
console.log(`  ❌ Failed : ${failed}`);
console.log(`  📊 Total  : ${total}`);
console.log(`  🎯 Score  : ${Math.round(passed / total * 100)}%`);
console.log('═'.repeat(55));
if (failed === 0) {
  console.log('  🎉 All tests passed! Ready for submission.');
} else {
  console.log(`  ⚠️  ${failed} test(s) failed. Fix before submitting.`);
  process.exit(1);
}

module.exports = {
  calcEmissions, validateInput, sanitizeInput, getScoreLabel,
  formatNumber, calculateCO2PerSecond, calculateTreesNeeded,
  calculateOffsetCost, compareToAverage, estimateAnnualEmissions,
  calculateSolarSavings
};