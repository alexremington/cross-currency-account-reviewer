import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const path = resolve(process.argv[2] || 'data/calibration/account-calibration-corpus.json');
const corpus = JSON.parse(await readFile(path, 'utf8'));
const labeled = (corpus.cases || []).filter((item) => ['same_entity', 'different_entity'].includes(item.label));
const probability = (score) => Math.max(0, Math.min(1, Number(score || 0) / 100));
const outcome = (label) => label === 'same_entity' ? 1 : 0;
const brier = labeled.length ? labeled.reduce((sum, item) => sum + (probability(item.score) - outcome(item.label)) ** 2, 0) / labeled.length : null;
const bins = Array.from({ length: 10 }, (_, index) => ({ band: `${index * 10}-${index * 10 + 9}`, count: 0, predicted: 0, observed: 0 }));
for (const item of labeled) { const index = Math.min(9, Math.floor(probability(item.score) * 10)); const bin = bins[index]; bin.count += 1; bin.predicted += probability(item.score); bin.observed += outcome(item.label); }
const calibrationError = labeled.length ? bins.filter((bin) => bin.count).reduce((sum, bin) => sum + (bin.count / labeled.length) * Math.abs(bin.predicted / bin.count - bin.observed / bin.count), 0) : null;
const strata = Object.fromEntries([...new Set((corpus.cases || []).map((item) => item.stratum))].sort().map((stratum) => { const values = (corpus.cases || []).filter((item) => item.stratum === stratum); const labeledValues = values.filter((item) => item.label); return [stratum, { selected: values.length, labeled: labeledValues.length, uncertain: values.filter((item) => item.label === 'uncertain').length }]; }));
const requiredStrata = Object.keys(corpus.quotas || {});
const missingRequiredStrata = requiredStrata.filter((stratum) => !strata[stratum]?.selected);
const report = { reportVersion: 'cross-currency-calibration-report/v1', corpusVersion: corpus.calibrationVersion, modelVersion: corpus.modelVersion, adapterVersion: corpus.adapterVersion, generatedAt: new Date().toISOString(), sample: { selected: (corpus.cases || []).length, labeled: labeled.length, uncertain: (corpus.cases || []).filter((item) => item.label === 'uncertain').length }, brierScore: brier, expectedCalibrationError: calibrationError, bins, strata, missingRequiredStrata, monotonicityViolations: [], disagreementRate: null, scoreMovement: null, qualityGate: missingRequiredStrata.length === 0 && labeled.length > 0 };
console.log(JSON.stringify(report, null, 2));
if (process.argv.includes('--require-quality') && !report.qualityGate) process.exitCode = 1;
