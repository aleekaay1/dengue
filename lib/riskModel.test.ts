import { calculateRisk, RISK_THRESHOLDS, scoreToRiskLevel } from './riskModel.ts';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const hotHumid = calculateRisk({
  temperature: 28.5,
  humidity: 80,
  vegetationIndex: 0.8,
  rainfallRecent: 35,
  pastCases: [
    { week: 'W27', count: 18 },
    { week: 'W28', count: 25 },
  ],
});

assert(hotHumid.riskScore >= RISK_THRESHOLDS.HIGH, 'peak conditions should be high risk');
assert(hotHumid.riskLevel === 'high', 'level should be high');
assert(hotHumid.contributingFactors.length > 0, 'should explain factors');

const coolDry = calculateRisk({
  temperature: 18,
  humidity: 35,
  vegetationIndex: 0.2,
  rainfallRecent: 0,
  pastCases: [{ week: 'W28', count: 0 }],
});

assert(coolDry.riskScore < RISK_THRESHOLDS.MEDIUM, 'cool dry should be low/medium');
assert(scoreToRiskLevel(75) === 'high', '75 => high');
assert(scoreToRiskLevel(50) === 'medium', '50 => medium');
assert(scoreToRiskLevel(20) === 'low', '20 => low');

console.log('riskModel tests passed');
console.log('  peak score:', hotHumid.riskScore, hotHumid.riskLevel);
console.log('  cool score:', coolDry.riskScore, coolDry.riskLevel);
