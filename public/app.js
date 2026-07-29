import { IMPORT_FIELD_CATALOG, parseCsv } from '/core/csv.js';
import { generatePairs } from '/core/scoring.js';
import { buildScoreLedger } from '/core/export.js';

const state = { records: [], skippedRows: [], pairs: [], fileName: '', headers: [], hasMatched: false, matching: false };
const MATCHING_FEEDBACK_MIN_MS = 180;
const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

function setStatus(text, kind = '') {
  const pill = $('#status-pill');
  pill.textContent = text;
  pill.className = `status-pill ${kind}`;
}

function toast(text) {
  const node = $('#toast');
  node.textContent = text;
  node.classList.add('visible');
  setTimeout(() => node.classList.remove('visible'), 3500);
}

function renderFieldGuide() {
  $('#field-guide-content').innerHTML = IMPORT_FIELD_CATALOG.map((group) => `<div><h3>${escapeHtml(group.label)}</h3><p>${group.fields.map((field) => `<code>${escapeHtml(field)}</code>`).join(', ')}</p><p class="muted">${escapeHtml(group.description)}</p></div>`).join('');
}

function renderSummary() {
  const currencies = [...new Set(state.records.map((record) => record.currencyisocode).filter(Boolean))].sort();
  $('#dataset-summary').hidden = false;
  $('#dataset-summary').innerHTML = `<div class="summary-card"><strong>${state.records.length}</strong><span>Account rows</span></div><div class="summary-card"><strong>${state.skippedRows.length}</strong><span>Skipped unavailable names</span></div><div class="summary-card"><strong>${currencies.length}</strong><span>Currencies</span></div><div class="summary-card"><strong>${escapeHtml(currencies.join(', ') || 'None')}</strong><span>Detected currencies</span></div><div class="summary-card"><strong>${state.pairs.length}</strong><span>Scored pairs</span></div>`;
}

function ledger() {
  return buildScoreLedger(state.pairs, state.records, { fileName: state.fileName, headers: state.headers, skippedRows: state.skippedRows });
}

function renderExports() {
  const panel = $('#exports-panel');
  panel.hidden = false;
  $('#exports-summary').textContent = state.pairs.length ? `Complete ledger ready: ${state.pairs.length} scored candidate pair${state.pairs.length === 1 ? '' : 's'}.` : 'No scored pairs were found. The ledger will contain zero records.';
  $('#export-ledger-csv').disabled = false;
  $('#export-ledger-json').disabled = false;
  $('#export-ledger-summary').disabled = false;
}

function download(name, content, type) {
  const link = document.createElement('a');
  const url = URL.createObjectURL(new Blob([content], { type }));
  link.href = url;
  link.download = name;
  link.className = 'download-anchor';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function setMatchingState(active) {
  state.matching = active;
  const controls = ['#match-button', '#match-and-download-button'];
  controls.forEach((selector) => {
    const button = $(selector);
    button.disabled = active || !state.records.length || (selector === '#match-and-download-button' && state.hasMatched);
    button.setAttribute('aria-busy', active ? 'true' : 'false');
  });
}

function matchRecords() {
  state.pairs = generatePairs(state.records);
  renderSummary();
  renderExports();
}

function waitForPaint(startedAt) {
  return new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, Math.max(0, MATCHING_FEEDBACK_MIN_MS - (performance.now() - startedAt)))));
}

async function runMatch({ downloadCsv = false } = {}) {
  if (state.matching || !state.records.length || (downloadCsv && state.hasMatched)) return;
  setMatchingState(true);
  setStatus('Matching…', 'busy');
  const startedAt = performance.now();
  try {
    await waitForPaint(startedAt);
    matchRecords();
    if (downloadCsv) {
      const result = ledger();
      download('score-ledger.csv', result.csv, 'text/csv');
      state.hasMatched = true;
      toast(`Matched ${result.records.length} scored pair${result.records.length === 1 ? '' : 's'} and downloaded score-ledger.csv.`);
    } else {
      state.hasMatched = true;
      toast(`${state.pairs.length} candidate pair${state.pairs.length === 1 ? '' : 's'} ready. The full ledger is available in Outputs.`);
    }
    setStatus('Matched');
  } catch (error) {
    setStatus('Match failed', 'error');
    toast(`Could not match this file: ${error.message}`);
  } finally {
    setMatchingState(false);
    if (downloadCsv && state.hasMatched) $('#match-button').focus();
  }
}

$('#export-ledger-csv').addEventListener('click', () => {
  try {
    const result = ledger();
    download('score-ledger.csv', result.csv, 'text/csv');
    toast(`Downloaded score-ledger.csv with ${result.records.length} scored pair${result.records.length === 1 ? '' : 's'}.`);
  } catch (error) {
    setStatus('Download failed', 'error');
    toast(`Could not download the score ledger: ${error.message}`);
  }
});

$('#export-ledger-json').addEventListener('click', () => {
  try {
    const result = ledger();
    download('score-ledger.json', result.json, 'application/json');
    toast(`Downloaded score-ledger.json with ${result.records.length} scored pair${result.records.length === 1 ? '' : 's'}.`);
  } catch (error) {
    setStatus('Download failed', 'error');
    toast(`Could not download the full ledger: ${error.message}`);
  }
});

$('#export-ledger-summary').addEventListener('click', () => {
  try {
    const result = ledger();
    download('score-ledger-summary.json', result.summaryJson, 'application/json');
    toast('Downloaded score-ledger-summary.json with batch metadata and column definitions.');
  } catch (error) {
    setStatus('Download failed', 'error');
    toast(`Could not download the ledger summary: ${error.message}`);
  }
});

$('#match-button').addEventListener('click', () => runMatch());
$('#match-and-download-button').addEventListener('click', () => runMatch({ downloadCsv: true }));

$('#csv-input').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  setStatus('Reading…', 'busy');
  try {
    const result = parseCsv(await file.text());
    state.fileName = file.name;
    state.headers = result.headers;
    state.records = result.rows;
    state.skippedRows = result.skippedRows || [];
    state.pairs = [];
    state.hasMatched = false;
    $('#exports-panel').hidden = true;
    const skippedNotice = state.skippedRows.length ? ` Skipped ${state.skippedRows.length} row${state.skippedRows.length === 1 ? '' : 's'} with unavailable Account Name: ${state.skippedRows.map((row) => `CSV row ${row.row} (${row.id || 'no ID'})`).join(', ')}.` : '';
    $('#validation').className = `message ${result.errors.length ? 'error' : state.skippedRows.length ? 'warning' : 'success'}`;
    $('#validation').textContent = result.errors.length ? result.errors.join(' ') : `${file.name} is valid and ready to match.${skippedNotice}`;
    $('#match-button').disabled = result.errors.length > 0;
    $('#match-and-download-button').disabled = result.errors.length > 0;
    if (!result.errors.length) renderSummary();
    setStatus(result.errors.length ? 'Fix CSV' : 'Ready');
  } catch (error) {
    $('#validation').className = 'message error';
    $('#validation').textContent = `Could not read CSV: ${error.message}`;
    $('#match-button').disabled = true;
    $('#match-and-download-button').disabled = true;
    setStatus('Fix CSV', 'error');
  }
});

renderFieldGuide();
