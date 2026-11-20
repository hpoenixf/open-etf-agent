// Operator diagnostic only. Output uses constant labels and small structural counters,
// never a vendor value, a free-form error, or an unrecognized field/column name.
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const wrappedKeys = ['data', 'result', 'output', 'table', 'tables', 'response', 'value'];
const recognizedKeys = [...wrappedKeys, 'code', 'columns', 'rows', 'error', 'ok', 'mcp_tool_error_code', 'mcp_tool_error_msg'];
const recognizedColumns = ['TIME', 'MATCH', 'Wind代码', 'WIND代码', 'windcode'];
const contentKinds = ['text', 'image', 'audio', 'resource', 'resource_link'];
const own = (object, key) => Object.hasOwn(object, key);
const cap = value => Math.min(value, 257);

function kind(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function jsonText(text) {
  try { return { encoding: 'json', value: JSON.parse(text) }; }
  catch { return { encoding: text.trimStart().startsWith('```') ? 'fenced-text' : 'plain-text' }; }
}

function dateKind(value) {
  if (typeof value !== 'string') return kind(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'calendar-dash';
  if (/^\d{4}-\d{2}-\d{2}[T ]/.test(value)) return 'calendar-with-time';
  if (/^\d{8}$/.test(value)) return 'calendar-compact';
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(value)) return 'calendar-slash';
  return 'other-string';
}

function closeKind(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? (value > 0 ? 'positive-number' : 'nonpositive-number') : 'nonfinite-number';
  if (typeof value === 'string') return /^\d+(\.\d+)?$/.test(value) ? 'decimal-string' : 'other-string';
  return kind(value);
}

function summarize(value, depth = 0) {
  const type = kind(value);
  if (Array.isArray(value)) return { type, count: cap(value.length), ...(depth < 3 && value.length ? { first: summarize(value[0], depth + 1) } : {}) };
  if (!isRecord(value)) return { type };
  const knownKeys = recognizedKeys.filter(key => own(value, key));
  const summary = { type, knownKeys, unknownKeyCount: cap(Object.keys(value).length - knownKeys.length) };
  if (depth < 3) {
    const wrappers = Object.fromEntries(wrappedKeys.filter(key => own(value, key)).map(key => [key, summarize(value[key], depth + 1)]));
    if (Object.keys(wrappers).length) summary.wrappers = wrappers;
  }
  if (own(value, 'columns')) {
    const columns = value.columns;
    summary.columns = { type: kind(columns) };
    if (Array.isArray(columns)) {
      const sampled = columns.slice(0, 64);
      const names = sampled.map(column => typeof column === 'string' ? column : column?.name);
      summary.columns.count = cap(columns.length);
      summary.columns.entryKinds = [...new Set(sampled.map(kind))];
      summary.columns.recognized = recognizedColumns.filter(name => names.includes(name));
      if (Array.isArray(value.rows)) {
        const samples = value.rows.slice(0, 8).filter(Array.isArray);
        const dateIndex = names.indexOf('TIME'), closeIndex = names.indexOf('MATCH');
        if (dateIndex >= 0) summary.columns.dateKinds = [...new Set(samples.map(row => dateKind(row[dateIndex])))];
        if (closeIndex >= 0) summary.columns.closeKinds = [...new Set(samples.map(row => closeKind(row[closeIndex])))];
      }
    }
  }
  if (own(value, 'rows')) {
    const rows = value.rows;
    summary.rows = { type: kind(rows) };
    if (Array.isArray(rows)) {
      summary.rows.count = cap(rows.length);
      summary.rows.entryKinds = [...new Set(rows.slice(0, 8).map(kind))];
      summary.rows.widths = [...new Set(rows.slice(0, 8).filter(Array.isArray).map(row => cap(row.length)))];
    }
  }
  return summary;
}

export function windResponseShape(result) {
  const shape = { schemaVersion: 'wind-fund-response-shape@1', hasExplicitMcpError: result.isError === true, contentCount: Array.isArray(result.content) ? cap(result.content.length) : null };
  if (own(result, 'structuredContent')) shape.structured = summarize(result.structuredContent);
  if (Array.isArray(result.content)) {
    shape.content = result.content.slice(0, 4).map(item => {
      const type = contentKinds.includes(item?.type) ? item.type : 'other';
      if (type !== 'text' || typeof item.text !== 'string') return { type };
      const parsed = jsonText(item.text);
      return { type, encoding: parsed.encoding, ...(parsed.encoding === 'json' ? { shape: summarize(parsed.value) } : {}) };
    });
  }
  return shape;
}
