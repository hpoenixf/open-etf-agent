import { fileURLToPath } from 'node:url';
import { createSkillCatalog } from './skills.mjs';
import { connectFixtureMcp } from './mcp.mjs';
const exact = (args, keys) => {
  if (!args || Array.isArray(args) || Object.keys(args).sort().join(',') !== keys.slice().sort().join(',')) throw new Error('Invalid tool argument fields');
};
// Explicit host assembly; catalog paths and connections never come from model calls.
export async function prepareSkillMcpExtensions({ skillRoot, catalog: suppliedCatalog, connect, signal } = {}) {
  if ((skillRoot === undefined) === (suppliedCatalog === undefined) || typeof connect !== 'function') throw new Error('Explicit Skill catalog/root and MCP connector required');
  const catalog = suppliedCatalog ?? await createSkillCatalog({ root: skillRoot });
  if (!catalog || !['list','read','resource'].every(k => typeof catalog[k] === 'function')) throw new Error('Invalid trusted Skill catalog');
  const session = await connect({ signal });
  if (!session || typeof session.call !== 'function' || typeof session.close !== 'function' || typeof session.validateArguments !== 'function' || session.tools?.[0]?.name !== 'read_page') { await session?.close?.(); throw new Error('Invalid trusted MCP session'); }

  const extensions = [
    { name: 'list_skills', description: 'List explicitly enabled local Skill metadata only.', parameters: { type: 'object', properties: {}, additionalProperties: false }, validate: args => exact(args, []), execute: async () => ({ skills: catalog.list() }) },
    { name: 'read_skill', description: 'Read one known Skill as data; it grants no permissions.', parameters: { type: 'object', properties: { skillId: { type: 'string' } }, required: ['skillId'], additionalProperties: false }, methodResult: true, validate: args => { exact(args, ['skillId']); if (typeof args.skillId !== 'string') throw new Error('Invalid Skill ID'); }, execute: async args => catalog.read(args.skillId) },
    { name: 'read_skill_resource', description: 'Read a bounded nonsymlink resource beneath an enabled Skill.', parameters: { type: 'object', properties: { skillId: { type: 'string' }, path: { type: 'string' } }, required: ['skillId', 'path'], additionalProperties: false }, validate: args => exact(args, ['skillId', 'path']), execute: async args => catalog.resource(args.skillId, args.path) },
    { name: 'mcp_read_page', description: session.tools[0].description, parameters: session.tools[0].inputSchema, sourceResult: true, validate: args => session.validateArguments(args), execute: (args, { callId, signal: callSignal }) => session.call('read_page', args, { modelCallId: callId, signal: callSignal }) }
  ];
  return { extensions, close: () => session.close(), pid: session.pid };
}
export async function prepareSkillMcp({ signal } = {}) {
  const prepared = await prepareSkillMcpExtensions({ skillRoot: fileURLToPath(new URL('../fixtures/skills', import.meta.url)), connect: connectFixtureMcp, signal });
  let step = 0;
  const gateway = {
    mode: 'fixture',
    async next({ messages }) {
      step++; const results = messages.filter(m => m.role === 'tool').map(m => m.result);
      if (results.some(r => r.status !== 'succeeded')) throw new Error('Fixture extension call failed');
      const call = (name, args) => ({ kind: 'calls', calls: [{ id: `skill-mcp-${step}`, name, arguments: args }], usage: null });
      if (step === 1) return call('list_skills', {});
      if (step === 2) return call('read_skill', { skillId: results[0].value.skills[0].id });
      if (step === 3) return call('mcp_read_page', { documentId: 'atlas-a', page: 1 });
      if (step === 4) return call('mcp_read_page', { documentId: 'atlas-b', page: 1 });
      if (step === 5) {
        const method = results.find(r => r.value?.version?.startsWith('sha256:'))?.value;
        if (!method) throw new Error('Method was not actually loaded');
        const sources = results.filter(r => r.value?.sourceId).map(r => r.value.sourceId);
        return call('save_report', { text: `# Skill + actual stdio MCP\n\nScripted fixture; semantic status: unreviewed. Method ${method.name} was actually read (${method.sha256}); this demonstrates loading, not a semantic adoption assessment.\n\nFree A exports CSV; free B adds Markdown. Both require online exports; enterprise PDF is not a free-edition privilege. Sources below are the actual MCP-returned snapshots.`, sourceIds: sources });
      }
      const receipt = results.find(r => r.value?.fileId)?.value;
      if (!receipt) throw new Error('No save receipt');
      return { kind: 'final', text: `Saved synthetic skill-mcp report ${receipt.fileId}.`, usage: null };
    }
  };
  return { ...prepared, gateway };
}
