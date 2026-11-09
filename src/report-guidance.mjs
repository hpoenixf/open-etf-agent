// Frozen task input profile. Changing these bytes requires a new profile version.
export const REPORT_GUIDANCE_PROFILE='source-faithful-report@1';
const TEXT='Report fidelity guidance: For conclusions involving ordered operations, comparisons or conditions, preserve the source operand identities, execution order and prerequisites. When useful, check a simple illustrative derivation against the source and explicitly label it as your own illustration rather than source evidence. Before saving, check that the report body and summary agree, and cite only passages that support the associated claims. If the source is ambiguous or insufficient, state that limitation instead of silently choosing an interpretation. This is guidance for your reasoning, not a claim of Host semantic verification; it does not require extra tool or model calls or grant any new permissions.';
export function reportGuidanceFor(definition){
 if(!Object.hasOwn(definition,'reportGuidance'))return '';
 if(definition.reportGuidance!==REPORT_GUIDANCE_PROFILE)throw Object.assign(new Error('PROJECT_REPORT_GUIDANCE_PROFILE'),{code:'PROJECT_REPORT_GUIDANCE_PROFILE'});
 return '\n'+TEXT;
}
