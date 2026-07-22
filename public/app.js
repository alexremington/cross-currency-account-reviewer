import { parseCsv } from '/core/csv.js';
import { generatePairs } from '/core/scoring.js';
import { buildProposal } from '/core/proposals.js';
import { buildExports } from '/core/export.js';

const state = { records: [], pairs: [], selected: 0, proposals: new Map(), fileName: '' };
const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const recordsById = () => new Map(state.records.map((record) => [record.id, record]));
function setStatus(text, kind = '') { const pill = $('#status-pill'); pill.textContent = text; pill.className = `status-pill ${kind}`; }
function toast(text) { const node = $('#toast'); node.textContent = text; node.classList.add('visible'); setTimeout(() => node.classList.remove('visible'), 3500); }
function value(value) { return value ? escapeHtml(value) : '<span class="muted">Blank</span>'; }
function renderSummary() {
  const currencies = [...new Set(state.records.map((record) => record.currencyisocode).filter(Boolean))].sort();
  $('#dataset-summary').hidden = false;
  $('#dataset-summary').innerHTML = `<div class="summary-card"><strong>${state.records.length}</strong><span>Account rows</span></div><div class="summary-card"><strong>${currencies.length}</strong><span>Currencies</span></div><div class="summary-card"><strong>${escapeHtml(currencies.join(', ') || 'None')}</strong><span>Detected currencies</span></div>`;
}
function renderQueue() {
  $('#queue-summary').textContent = state.pairs.length ? `${state.pairs.length} candidate pairs · highest confidence first` : 'No candidate pairs found.';
  $('#queue').innerHTML = state.pairs.map((pair, index) => `<button class="queue-item ${index === state.selected ? 'selected' : ''}" data-index="${index}" type="button"><strong>${escapeHtml(pair.leftId)} ↔ ${escapeHtml(pair.rightId)}</strong><span><span class="score ${pair.score === 100 ? 'exact' : ''}">${pair.score}/100</span> · ${escapeHtml(pair.band)} · ${escapeHtml(pair.currencyLeft)} / ${escapeHtml(pair.currencyRight)}</span></button>`).join('');
  $('#queue').querySelectorAll('[data-index]').forEach((button) => button.addEventListener('click', () => { state.selected = Number(button.dataset.index); renderQueue(); renderDetail(); }));
}
function recordCard(record, label) {
  const fields = ['name', 'currencyisocode', 'website', 'phone', 'billingstreet', 'billingcity', 'billingstate', 'billingpostalcode', 'billingcountry', 'ultimate_parent_account__c'];
  return `<article class="record-card"><h3>${label}</h3><p class="muted">Salesforce ID: ${escapeHtml(record.id)} · CSV row ${escapeHtml(record.__row)}</p><dl>${fields.map((field) => `<dt>${escapeHtml(field)}</dt><dd>${value(record[field])}</dd>`).join('')}</dl></article>`;
}
function renderDetail() {
  const pair = state.pairs[state.selected];
  if (!pair) { $('#detail').innerHTML = '<div class="empty-state"><h2>3. Review a proposal</h2><p>No scored pair is available.</p></div>'; return; }
  const map = recordsById(); const left = map.get(pair.leftId); const right = map.get(pair.rightId);
  const proposal = state.proposals.get(pair.leftId + '|' + pair.rightId) || buildProposal(left, right, pair);
  state.proposals.set(pair.leftId + '|' + pair.rightId, proposal);
  $('#detail').innerHTML = `<div class="decision-header"><div><p class="eyebrow">Pair decision</p><h2>${escapeHtml(pair.leftId)} ↔ ${escapeHtml(pair.rightId)}</h2><p>${escapeHtml(pair.reasons.join(' '))}</p></div><div><div class="decision-score ${pair.score === 100 ? 'exact' : ''}">${pair.score}/100</div><div class="muted">${escapeHtml(pair.band)}</div></div></div>
    <div class="section"><h3>Why this score?</h3><div class="evidence-list">${pair.evidence.map((item) => `<div class="evidence-row ${item.status}"><small>${escapeHtml(item.label)}</small><span>${value(item.left)}</span><span>${value(item.right)}</span></div>`).join('')}</div></div>
    <div class="section"><h3>Source Accounts</h3><div class="records">${recordCard(left, 'Child A')} ${recordCard(right, 'Child B')}</div></div>
    <div class="section proposal-card"><h3>Proposed multicurrency parent</h3><p class="muted">Defaults use deterministic completeness and quality rules. Every selected value keeps its source. V1 exports only; it never writes to Salesforce.</p><label for="parent-currency">Parent currency</label><select id="parent-currency"><option value="">Choose before export</option>${[pair.currencyLeft, pair.currencyRight].map((currency) => `<option value="${escapeHtml(currency)}" ${proposal.parentCurrency === currency ? 'selected' : ''}>${escapeHtml(currency)}</option>`).join('')}</select><table class="proposal-table"><thead><tr><th scope="col">Field</th><th scope="col">Value / override</th><th scope="col">Source</th></tr></thead><tbody>${Object.entries(proposal.fields).map(([field, detail]) => `<tr><th scope="row">${escapeHtml(field)}</th><td><label for="value-${escapeHtml(field)}">${escapeHtml(field)} value</label><textarea id="value-${escapeHtml(field)}" aria-label="${escapeHtml(field)} value" data-field="${escapeHtml(field)}">${escapeHtml(detail.value)}</textarea><label class="override-label"><input type="checkbox" data-override="${escapeHtml(field)}" ${detail.overridden ? 'checked' : ''}> Override this default</label><label for="reason-${escapeHtml(field)}">Override reason</label><input id="reason-${escapeHtml(field)}" aria-label="${escapeHtml(field)} override reason" data-reason="${escapeHtml(field)}" placeholder="Explain the override" value="${escapeHtml(detail.overrideReason)}" ${detail.overridden ? '' : 'disabled'}></td><td>${escapeHtml(detail.sourceId || 'No value')}</td></tr>`).join('')}</tbody></table><div class="actions"><button id="save-proposal" class="button" type="button">Save proposal changes</button><button id="export-proposal" class="button button-primary" type="button">Export reviewed proposal</button><span class="export-note">Exports parent, child associations, and audit metadata.</span></div></div>`;
  $('#parent-currency').addEventListener('change', (event) => { proposal.parentCurrency = event.target.value; });
  $('#detail').querySelectorAll('[data-override]').forEach((checkbox) => checkbox.addEventListener('change', () => { const reason = $(`[data-reason="${checkbox.dataset.override}"]`); reason.disabled = !checkbox.checked; }));
  $('#save-proposal').addEventListener('click', () => { try { saveProposal(pair, left, right); } catch (error) { toast(error.message); } });
  $('#export-proposal').addEventListener('click', () => { try { saveProposal(pair, left, right); exportReviewed([state.proposals.get(pair.leftId + '|' + pair.rightId)]); } catch (error) { toast(error.message); } });
}
function saveProposal(pair, left, right) {
  const key = pair.leftId + '|' + pair.rightId; const current = state.proposals.get(key); const overrides = {};
  Object.keys(current.fields).forEach((field) => { const checked = $(`[data-override="${field}"]`).checked; const fieldValue = $(`[data-field="${field}"]`).value; const reason = $(`[data-reason="${field}"]`).value.trim(); if (checked && !reason) throw new Error(`${field} override requires a reason.`); if (checked) overrides[field] = { value: fieldValue, reason }; });
  overrides.parentCurrency = $('#parent-currency').value; state.proposals.set(key, buildProposal(left, right, pair, overrides)); renderDetail(); toast('Proposal saved locally.');
}
function download(name, content, type) { const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([content], { type })); link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000); }
function exportReviewed(proposals) {
  if (proposals.some((proposal) => !proposal.parentCurrency)) { toast('Choose a parent currency before exporting.'); return; }
  const result = buildExports(proposals.map((proposal) => ({ proposal, pair: state.pairs.find((pair) => pair.leftId + '|' + pair.rightId === proposal.pairKey) })));
  download('parent-proposals.csv', result.parentCsv, 'text/csv'); download('child-associations.csv', result.associationCsv, 'text/csv'); download('review-audit.json', result.auditJson, 'application/json'); toast('Exported parent, association, and audit files.');
}
$('#csv-input').addEventListener('change', async (event) => { const file = event.target.files[0]; if (!file) return; setStatus('Reading…', 'busy'); try { const result = parseCsv(await file.text()); state.fileName = file.name; state.records = result.rows; state.pairs = []; state.selected = 0; $('#validation').className = `message ${result.errors.length ? 'error' : 'success'}`; $('#validation').textContent = result.errors.length ? result.errors.join(' ') : `${file.name} is valid and ready to match.`; $('#match-button').disabled = result.errors.length > 0; if (!result.errors.length) renderSummary(); setStatus(result.errors.length ? 'Fix CSV' : 'Ready'); } catch (error) { $('#validation').className = 'message error'; $('#validation').textContent = `Could not read CSV: ${error.message}`; $('#match-button').disabled = true; setStatus('Fix CSV', 'error'); } });
$('#match-button').addEventListener('click', () => { setStatus('Matching…', 'busy'); state.pairs = generatePairs(state.records); state.selected = 0; renderQueue(); renderDetail(); setStatus('Matched'); toast(`${state.pairs.length} candidate pair${state.pairs.length === 1 ? '' : 's'} ready for review.`); });
