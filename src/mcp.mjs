import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport, DEFAULT_INHERITED_ENV_VARS } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { validateSource } from './tools.mjs';
const modes = ['normal', 'duplicate', 'endless-pages', 'pollution', 'business-error', 'unsupported-content', 'bad-result', 'wrong-page', 'bad-schema', 'stall-call', 'exit-on-call'];
// Host-owned transport and bounded page scope, never model-supplied configuration.
export function mcpPageContract(documents) {
  if (!Array.isArray(documents) || !documents.length || documents.length > 64) throw new Error('Invalid MCP page scope');
  const limits = new Map();
  for (const d of documents) {
    if (!d || Object.keys(d).sort().join(',') !== 'documentId,pages' || typeof d.documentId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.:@/-]{0,199}$/.test(d.documentId) || limits.has(d.documentId) || !Number.isSafeInteger(d.pages) || d.pages < 1 || d.pages > 16) throw new Error('Invalid MCP page scope');
    limits.set(d.documentId, d.pages);
  }
  const inputSchema = { type: 'object', additionalProperties: false, properties: { documentId: { type: 'string', enum: [...limits.keys()] }, page: { type: 'integer', minimum: 1, maximum: Math.max(...limits.values()) } }, required: ['documentId', 'page'] };
  function validateArguments(args) {
    if (!args || Array.isArray(args) || Object.keys(args).sort().join(',') !== 'documentId,page' || !limits.has(args.documentId) || !Number.isSafeInteger(args.page) || args.page < 1 || args.page > limits.get(args.documentId)) throw new Error('Invalid MCP arguments');
  }
  return { inputSchema, validateArguments };
}
export async function connectFixtureMcp({ mode = 'normal', signal, timeoutMs = 2000 } = {}) {
  if (!modes.includes(mode)) throw new Error('Invalid trusted MCP configuration');
  const server = fileURLToPath(new URL('./fixture-server.mjs', import.meta.url));
  const env = Object.fromEntries(DEFAULT_INHERITED_ENV_VARS.map(k => [k, '']));
  env.NODE_OPTIONS = '--max-old-space-size=256';
  const transport = new StdioClientTransport({ command: process.execPath, args: [server, mode], cwd: dirname(server), env, stderr: 'pipe', maxBufferSize: 131072 });
  transport.stderr?.on('data', () => {});
  return connectTrustedMcp({ transport, serverName: 'open-etf-synthetic-pages', documents: [{documentId:'atlas-a',pages:2},{documentId:'atlas-b',pages:2}], signal, timeoutMs });
}
// Takes ownership of the supplied SDK transport until close, including failure.
export async function connectTrustedMcp({ transport, serverName, documents, signal, timeoutMs = 2000 } = {}) {
  if (!transport || typeof transport.start !== 'function' || typeof transport.send !== 'function' || typeof transport.close !== 'function' || typeof serverName !== 'string' || !serverName || serverName.length > 200 || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10000) throw new Error('Invalid trusted MCP configuration');
  const contract = mcpPageContract(documents);
  signal?.throwIfAborted();
  const client = new Client({ name: 'open-etf-agent', version: '0.2.0' }, { capabilities: {} });
  let pid = null; let closed = false; let closing; let activeCall = null; let protocolRequestId = null; let fatal = false; let initializeRequestId; let protocolVersion;
  const originalStart = transport.start.bind(transport);
  transport.start = async () => { await originalStart(); pid = Number.isInteger(transport.pid) ? transport.pid : null; };
  const originalSend = transport.send.bind(transport);
  transport.send = async message => {
    if (message.method === 'initialize') initializeRequestId = message.id;
    if (message.method === 'tools/call') protocolRequestId = message.id;
    return originalSend(message);
  };
  transport.onmessage = message => { if (message.id === initializeRequestId) protocolVersion = message.result?.protocolVersion; };
  async function close() {
    if (closing) return closing;
    closed = true;
    closing = (async () => {
      await client.close(); await transport.close();
      for (let tries = 0; pid && tries < 100; tries++) {
        try { process.kill(pid, 0); }
        catch (error) { if (error.code === 'ESRCH') return { closed: true, pid }; throw error; }
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      if (pid) throw new Error('MCP child did not terminate');
      return { closed: true, pid };
    })();
    return closing;
  }
  // A parser error is fatal for this host, but teardown waits for the bounded
  // current SDK request to settle rather than racing its initialization send.
  client.onerror = () => { fatal = true; };
  const abort = () => { void close().catch(() => {}); }; signal?.addEventListener('abort', abort, { once: true });
  try {
    await client.connect(transport, { timeout: timeoutMs, signal });
    if (fatal || protocolVersion !== '2025-11-25' || client.getServerVersion()?.name !== serverName) throw new Error('MCP protocol parse failure or unsupported version');
    const list = { tools: [] }; const seen = new Set(); const cursors = new Set(); let cursor;
    for (let page = 0; ; page++) {
      if (page >= 4) throw new Error('MCP pagination page limit');
      const result = await client.listTools(cursor === undefined ? undefined : { cursor }, { timeout: timeoutMs, signal });
      if (fatal) throw new Error('MCP protocol parse failure');
      if (result.tools.length + list.tools.length > 32) throw new Error('MCP catalog size limit');
      for (const tool of result.tools) { if (seen.has(tool.name)) throw new Error('Duplicate MCP tool name'); seen.add(tool.name); list.tools.push(tool); }
      if (result.nextCursor === undefined) break;
      if (typeof result.nextCursor !== 'string' || !result.nextCursor || cursors.has(result.nextCursor)) throw new Error('MCP pagination repeated cursor');
      cursor = result.nextCursor; cursors.add(cursor);
    }
    const tools = list.tools.filter(t => t.name === 'read_page');
    if (tools.length !== 1 || !isDeepStrictEqual(tools[0].inputSchema, contract.inputSchema)) throw new Error('Unsupported MCP input schema');
    return {
      pid, tools, validateArguments: contract.validateArguments, discoveredCount: list.tools.length, protocolEra: 'legacy', protocolVersion,
      async call(name, args, { modelCallId, signal: callSignal } = {}) {
        if (closed || fatal) throw new Error('MCP connection closed');
        if (name !== 'read_page') throw new Error('Tool not allowlisted');
        contract.validateArguments(args);
        if (typeof modelCallId !== 'string' || !modelCallId || activeCall) throw new Error('Invalid or concurrent model call identity');
        activeCall = modelCallId; protocolRequestId = null;
        try {
          const result = await client.callTool({ name, arguments: args }, undefined, { signal: callSignal, timeout: timeoutMs });
          if (fatal || result.isError || !Array.isArray(result.content) || result.content.some(c => c.type !== 'text' || typeof c.text !== 'string') || !result.structuredContent) throw new Error('MCP business error or unsupported content');
          const value = validateSource(result.structuredContent);
          if (value.documentId !== args.documentId || value.page !== args.page) throw new Error('MCP source identity does not match requested page');
          if (result.content.map(c => c.text).join('\n') !== value.text) throw new Error('MCP text/structured result mismatch');
          if (!Number.isInteger(protocolRequestId)) throw new Error('Missing protocol request identity');
          return { ...value, mcp: { serverName, protocolVersion: '2025-11-25', protocolRequestId, modelCallId } };
        } catch (error) { await close(); throw error; }
        finally { activeCall = null; }
      },
      async close() { signal?.removeEventListener('abort', abort); return close(); }
    };
  } catch (error) {
    signal?.removeEventListener('abort', abort); await close();
    if (fatal) throw new Error('MCP protocol parse failure or connection closed');
    throw error;
  }
}
