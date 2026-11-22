export const OWNER_METERED_TOOL_ACCOUNTING='metered-only@1';
export const OWNER_TOOL_ACCOUNTING_BINDING=Object.freeze({id:'owner-tool-accounting',version:OWNER_METERED_TOOL_ACCOUNTING});
export const hasOwnerMeteredTools=bindings=>Array.isArray(bindings?.adapters)&&bindings.adapters.some(b=>b?.id===OWNER_TOOL_ACCOUNTING_BINDING.id&&
  b.version===OWNER_TOOL_ACCOUNTING_BINDING.version&&Object.keys(b).length===2)===true;
