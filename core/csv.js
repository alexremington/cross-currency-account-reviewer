const REQUIRED_HEADERS = ['id', 'name', 'currencyisocode'];
const HEADER_ALIASES = new Map([
  ['accountid', 'id'], ['salesforceid', 'id'], ['currency', 'currencyisocode'],
  ['currencyiso', 'currencyisocode'], ['accountcurrency', 'currencyisocode'],
  ['accountname', 'name'], ['account_name', 'name'], ['url', 'website'],
  ['billingpostalcode', 'billingpostalcode'], ['billingzip', 'billingpostalcode']
]);

export const OPTIONAL_HEADERS = ['website', 'phone', 'billingstreet', 'billingcity', 'billingstate', 'billingpostalcode', 'billingcountry', 'ultimate_parent_account__c', 'lastmodifieddate'];

export function canonicalHeader(value) {
  const raw = String(value ?? '').replace(/^\uFEFF/, '').trim();
  const key = raw.toLowerCase().replace(/[\s-]+/g, '_');
  return HEADER_ALIASES.get(key) || key;
}

export function parseCsv(text) {
  const input = String(text ?? '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') { cell += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && input[i + 1] === '\n') i += 1;
      row.push(cell); cell = '';
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  if (quoted) throw new Error('CSV contains an unterminated quoted value.');
  if (cell !== '' || row.length) { row.push(cell); if (row.some((value) => value !== '')) rows.push(row); }
  if (!rows.length) return { headers: [], rows: [], errors: ['CSV has no rows.'] };
  const headers = rows.shift().map(canonicalHeader);
  const errors = [];
  const missing = REQUIRED_HEADERS.filter((header) => !headers.includes(header));
  if (missing.length) errors.push(`Missing required headers: ${missing.join(', ')}`);
  const duplicateHeaders = headers.filter((header, index) => headers.indexOf(header) !== index);
  if (duplicateHeaders.length) errors.push(`Duplicate headers: ${[...new Set(duplicateHeaders)].join(', ')}`);
  const records = rows.map((values, rowIndex) => {
    const record = { __row: rowIndex + 2, __raw: {} };
    headers.forEach((header, index) => { record[header] = String(values[index] ?? '').trim(); record.__raw[header] = values[index] ?? ''; });
    return record;
  });
  const ids = new Set();
  records.forEach((record) => {
    if (!record.id) errors.push(`Row ${record.__row}: Id is blank.`);
    else if (ids.has(record.id)) errors.push(`Row ${record.__row}: duplicate Id ${record.id}.`);
    else ids.add(record.id);
    if (!record.name) errors.push(`Row ${record.__row}: Name is blank.`);
    if (!record.currencyisocode) errors.push(`Row ${record.__row}: CurrencyIsoCode is blank.`);
  });
  return { headers, rows: records, errors };
}

export function normalizeText(value) {
  return String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
}

export function normalizeWebsite(value) {
  return normalizeText(String(value ?? '').replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0]);
}

export function normalizePhone(value) { return String(value ?? '').replace(/\D/g, ''); }

export function normalizeAddress(record) {
  return normalizeText(['billingstreet', 'billingcity', 'billingstate', 'billingpostalcode', 'billingcountry'].map((field) => record[field]).filter(Boolean).join(' '));
}
