import { fileURLToPath } from 'node:url';
import { createSkillCatalog } from './skills.mjs';
import { connectFixtureMcp } from './mcp.mjs';
const exact = (args, keys) => {
  if (!args || Array.isArray(args) || Object.keys(args).sort().join(',') !== keys.slice().sort().join(',')) throw new Error('Invalid tool argument fields');
};
export async function prepareSkillMcp({ signal } = {}) {
  const catalog = await createSkillCatalog({ root: fileURLToPath(new URL('../fixtures/skills', import.meta.url)) });
  const session = await connectFixtureMcp({ signal });
  const extensions = [
    { name: 'list_skills', description: 'List explicitly enabled local Skill metadata only.', parameters: { type: 'object', properties: {}, additionalProperties: false }, validate: args => exact(args, []), execute: async () => ({ skills: catalog.list() }) },
    { name: 'read_skill', description: 'Read one known Skill as data; it grants no permissions.', parameters: { type: 'object', properties: { skillId: { type: 'string' } }, required: ['skillId'], additionalProperties: false }, methodResult: true, validate: args => { exact(args, ['skillId']); if (typeof args.skillId !== 'string') throw new Error('Invalid Skill ID'); }, execute: async args => catalog.read(args.skillId) },
    { name: 'read_skill_resource', description: 'Read a bounded nonsymlink resource beneath an enabled Skill.', parameters: { type: 'object', properties: { skillId: { type: 'string' }, path: { type: 'string' } }, required: ['skillId', 'path'], additionalProperties: false }, validate: args => exact(args, ['skillId', 'path']), execute: async args => catalog.resource(args.skillId, args.path) },
    { name: 'mcp_read_page', description: session.tools[0].description, parameters: session.tools[0].inputSchema, sourceResult: true, validate: args => { exact(args, ['documentId', 'page']); if (!['atlas-a', 'atlas-b'].includes(args.documentId) || !Number.isSafeInteger(args.page) || args.page < 1 || args.page > 2) throw new Error('Invalid page arguments'); }, execute: (args, { callId, signal: callSignal }) => session.call('read_page', args, { modelCallId: callId, signal: callSignal }) }
  ];
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
  return { extensions, gateway, close: () => session.close(), pid: session.pid };
}
