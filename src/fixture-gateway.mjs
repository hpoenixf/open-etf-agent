// A transparent scripted model substitute, not semantic intelligence.
// It proposes calls only; every read/calculation/save goes through the Runtime.
export function createFixtureGateway(caseId) {
  if (!['T1', 'T2', 'T3', 'T4'].includes(caseId)) throw new Error('Unknown fixture case');
  let step = 0;
  const call = (name, args) => ({ kind: 'calls', calls: [{ id: `${caseId}-step-${step}`, name, arguments: args }], usage: null });
  return {
    mode: 'fixture',
    async next({ messages }) {
      step++;
      const results = messages.filter(m => m.role === 'tool').map(m => m.result);
      if (results.some(r => r.status !== 'succeeded')) throw new Error('Fixture observed failed tool');
      const page = caseId === 'T2' ? 2 : 1;
      if (step === 1) return call('read_page', { documentId: 'atlas-a', page });
      if (step === 2) return call('read_page', { documentId: 'atlas-b', page });
      if (caseId === 'T3' && step === 3) return call('calculate_change', { baseline: 120, current: 300, baselineUnit: 'rows/export', currentUnit: 'rows/export' });
      const saved = results.find(r => r.value?.fileId);
      if (saved) return { kind: 'final', text: `Synthetic ${caseId} report saved with receipt ${saved.value.fileId}. Semantic quality remains unreviewed.`, usage: null };
      const sources = results.filter(r => r.value?.sourceId).map(r => r.value.sourceId);
      if (sources.length !== 2) throw new Error('Fixture requires both acquired sources');
      let body;
      if (caseId === 'T2') {
        body = 'Both free editions allow offline viewing of previously downloaded notes; neither permits offline editing. Initial download and synchronization require an online connection. Offline editing belongs only to the enterprise edition and must not be attributed to the free edition.';
      } else if (caseId === 'T3') {
        const calculation = results.find(r => r.value?.calculation)?.value;
        if (!calculation) throw new Error('Fixture requires actual calculation receipt');
        body = `Baseline A: ${calculation.inputs.baseline} ${calculation.unit}. Current B: ${calculation.inputs.current} ${calculation.unit}.\n\nDifference B minus A: ${calculation.difference} ${calculation.unit}. Total ratio B/A: ${calculation.ratio}. Increase ratio (B-A)/A: ${calculation.increaseRatio} (150%). Both free-edition export limits require online export; PDF is enterprise-only.\n\nCalculation: ${JSON.stringify(calculation)}.`;
      } else {
        body = 'The free edition in A exports CSV; B exports CSV and Markdown. Both require an online connection for every export. PDF remains enterprise-only in both versions. This comparison does not claim offline export. This file can be reopened locally without another research run.';
      }
      return call('save_report', { text: `# ${caseId} — Synthetic document comparison\n\nMode: scripted fixture. This is not live model evidence; semantic review: unreviewed.\n\n${body}`, sourceIds: sources });
    }
  };
}
