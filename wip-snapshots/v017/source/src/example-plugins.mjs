import { readFile } from 'node:fs/promises';
import { sha256, readFixturePage, READ_PAGE_SCHEMA } from './source.mjs';
const emptySchema = { type: 'object', properties: {}, additionalProperties: false };
const exact = (args, keys) => {
  if (!args || typeof args !== 'object' || Array.isArray(args) || Object.keys(args).sort().join(',') !== [...keys].sort().join(',')) throw new Error('Invalid plugin arguments');
};
const skill = (id, name, text) => ({ id, name, description: 'An explicitly selected synthetic method, not authority.', text, sha256: sha256(text), version: 'sha256:' + sha256(text), mediaType: 'text/markdown; charset=utf-8' });
// Only this fixed, already imported original module is fingerprinted. No model input is imported.
export async function createExamplePlugins() {
  const contentSha256 = sha256(await readFile(new URL(import.meta.url)));
  const common = { version: '1.0.0', schemaVersion: 'trusted-plugin@1', sourceUrl: import.meta.url, contentSha256 };
  const documentMethod = skill('document-comparison', 'document-comparison', '# Compare original documents\nRead both original pages before writing a cited comparison.');
  const etfMethod = skill('synthetic-etf', 'synthetic-etf', '# Synthetic ETF method\nUse the synthetic inputs only; do not present a fixture as market data or investment advice.');
  const methodTool = (name, method) => ({ name, description: 'Read the selected plugin method as data, not a grant.', parameters: emptySchema, methodResult: true, validate: args => exact(args, []), execute: async () => structuredClone(method) });
  const etfText = 'Synthetic Example ETF: expense ratio 0.20%; holdings count 12. These invented values are a Runtime fixture, not market data.';
  const etfSource = { sourceId: 'synthetic-etf@1:p1', documentId: 'synthetic-etf', name: 'Synthetic Example ETF', version: '1', page: 1, text: etfText, sha256: sha256(etfText), mediaType: 'text/plain; charset=utf-8' };
  return [
    { ...common, id: 'document-tools', skills: [documentMethod], tools: [
      methodTool('document_method', documentMethod),
      { name: 'document_page', description: 'Read an original allowed synthetic guide page.', parameters: structuredClone(READ_PAGE_SCHEMA), sourceResult: true, validate: args => { exact(args, ['documentId', 'page']); if (!['atlas-a', 'atlas-b'].includes(args.documentId) || ![1, 2].includes(args.page)) throw new Error('Invalid synthetic page'); }, execute: async args => readFixturePage(args) }
    ] },
    { ...common, id: 'synthetic-etf-tools', skills: [etfMethod], tools: [
      methodTool('etf_method', etfMethod),
      { name: 'synthetic_etf_page', description: 'Read an explicitly invented ETF source; not live finance data.', parameters: emptySchema, sourceResult: true, validate: args => exact(args, []), execute: async () => structuredClone(etfSource) }
    ] }
  ];
}
