// Original synthetic fixture. stdout belongs exclusively to the official SDK.
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { readFixturePage, READ_PAGE_SCHEMA } from './tools.mjs';
const mode = process.argv[2] || 'normal';
const inputSchema = structuredClone(READ_PAGE_SCHEMA);
const tool = { name: 'read_page', description: 'Read one original synthetic document physical page.', inputSchema };
if (mode === 'bad-schema') tool.inputSchema = { ...inputSchema, properties: { ...inputSchema.properties, documentId: { type: 'number' } } };
let pages = 0;
if (mode === 'pollution') process.stdout.write('deliberate non-JSON fixture pollution\n');
async function start() {
  const server = new Server({ name: 'open-etf-synthetic-pages', version: '0.2.0' }, { capabilities: { tools: {} }, supportedProtocolVersions: ['2025-11-25'] });
  server.setRequestHandler(ListToolsRequestSchema, async request => {
    pages++;
    if (mode === 'endless-pages') return { tools: [pages === 1 ? tool : { name: `unapproved_${pages}`, description: 'Unapproved pagination fixture.', inputSchema: { type: 'object', properties: {} } }], nextCursor: 'page-' + pages };
    if (!request.params?.cursor) return { tools: [tool], nextCursor: 'second' };
    if (request.params.cursor !== 'second') throw new Error('Unknown synthetic cursor');
    return { tools: [mode === 'duplicate' ? tool : { name: 'unapproved_note', description: 'Advertised but never authorized.', inputSchema: { type: 'object', properties: {} } }] };
  });
  server.setRequestHandler(CallToolRequestSchema, async request => {
    if (mode === 'exit-on-call') process.exit(7);
    if (mode === 'stall-call') await new Promise(() => {});
    if (request.params.name !== 'read_page') return { isError: true, content: [{ type: 'text', text: 'Tool not authorized by fixture.' }] };
    const args = request.params.arguments;
    if (!args || Object.keys(args).sort().join(',') !== 'documentId,page') return { isError: true, content: [{ type: 'text', text: 'Invalid arguments.' }] };
    if (mode === 'business-error') return { isError: true, content: [{ type: 'text', text: 'Synthetic read failure.' }] };
    if (mode === 'unsupported-content') return { content: [{ type: 'image', data: '', mimeType: 'image/png' }] };
    const page = await readFixturePage(mode === 'wrong-page' ? { ...args, page: args.page === 1 ? 2 : 1 } : args);
    if (mode === 'bad-result') page.sha256 = 'incorrect';
    return { content: [{ type: 'text', text: page.text }], structuredContent: page };
  });
  await server.connect(new StdioServerTransport());
  return server;
}
const handle = await start();
process.on('SIGINT', () => { void handle.close(); });
process.on('SIGTERM', () => { void handle.close(); });
