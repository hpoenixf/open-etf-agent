import { createMemoryBindings } from './memory-tools.mjs';

// The mode decision precedes the owner import and all selected-library IO.
export async function openMemoryConsumer({ directory, temporary = false } = {}) {
  if (typeof temporary !== 'boolean') throw new Error('Invalid temporary Memory mode');
  if (temporary) return Object.freeze({ mode: 'temporary', libraryId: null, extensions: [], workingInput: undefined, close: async () => {} });
  const { openMemoryLibrary } = await import('./memory.mjs');
  const library = await openMemoryLibrary({ directory, writable: false });
  try {
    const extensions = createMemoryBindings({ library }).filter(binding => ['memory_search', 'memory_read', 'memory_list'].includes(binding.name));
    return Object.freeze({ mode: 'read-only', libraryId: library.libraryId, extensions, workingInput: { memoryLibrary: library }, close: () => library.close() });
  } catch (error) { await library.close(); throw error; }
}
