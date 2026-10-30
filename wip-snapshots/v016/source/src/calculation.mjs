export function validateCalculation(value) {
  const exact=(item,keys)=>item && typeof item==='object' && !Array.isArray(item) && Object.keys(item).sort().join(',')===keys.slice().sort().join(',');
  if(!exact(value,['inputs','difference','unit','ratio','increaseRatio','calculation','arithmetic',...(Object.hasOwn(value||{},'binding')?['binding']:[])]) || !exact(value.inputs,['baseline','current','baselineUnit','currentUnit'])) throw new Error('Invalid derived calculation record');
  const {baseline,current,baselineUnit,currentUnit}=value.inputs;
  if(!Number.isFinite(baseline)||!Number.isFinite(current)||baseline===0||typeof baselineUnit!=='string'||!/^[A-Za-z][A-Za-z0-9 /%_-]{0,39}$/.test(baselineUnit)||baselineUnit!==currentUnit||value.unit!==baselineUnit||value.calculation!=='calculate_change@1'||value.arithmetic!=='IEEE-754 binary64; no rounding applied') throw new Error('Invalid calculation identity or units');
  const difference=current-baseline,ratio=current/baseline,increaseRatio=(current-baseline)/baseline;
  if(![difference,ratio,increaseRatio].every(Number.isFinite)||value.difference!==difference||value.ratio!==ratio||value.increaseRatio!==increaseRatio) throw new Error('Invalid calculation values');
  if (value.binding !== undefined) validateComparisonBinding(value.binding);
  return {inputs:{baseline,current,baselineUnit,currentUnit},difference,unit:baselineUnit,ratio,increaseRatio,calculation:value.calculation,arithmetic:value.arithmetic,...(value.binding===undefined?{}:{binding:structuredClone(value.binding)})};
}

// Shape validation is not source qualification; Result resolves the original bytes.
function validateComparisonBinding(binding) {
  const exact=(v,keys)=>v && typeof v==='object' && !Array.isArray(v) && Object.keys(v).sort().join(',')===keys.slice().sort().join(',');
  if (!exact(binding,['schemaVersion','sourceRef','contentHash','selection','coverage','baseline','current','unit','currency','dataAsOf']) || binding.schemaVersion!=='comparison-binding@1'
    || !/^result:sha256:[a-f0-9]{64}$/.test(binding.sourceRef) || !/^[a-f0-9]{64}$/.test(binding.contentHash)
    || !exact(binding.selection,['offset','limit']) || !exact(binding.coverage,['offset','requested','total','returned','rowIndices','complete','storedTableComplete'])
    || !Array.isArray(binding.coverage.rowIndices) || binding.coverage.rowIndices.length>32
    || ![binding.unit,binding.currency,binding.dataAsOf].every(v=>typeof v==='string'&&v.length>0&&v.length<=40)) throw new Error('Invalid comparison binding');
  for (const operand of [binding.baseline,binding.current]) if (!exact(operand,['rowIndex','rowId','field']) || !Number.isSafeInteger(operand.rowIndex) || operand.rowIndex<0 || operand.rowIndex>31 || typeof operand.rowId!=='string' || !/^[A-Za-z0-9_-]{1,64}$/.test(operand.rowId) || operand.field!=='value') throw new Error('Invalid comparison operand binding');
}

export function calculateChange(inputs,binding) {
  const {baseline,current,baselineUnit}=inputs;
  return validateCalculation({inputs:structuredClone(inputs),difference:current-baseline,unit:baselineUnit,ratio:current/baseline,increaseRatio:(current-baseline)/baseline,calculation:'calculate_change@1',arithmetic:'IEEE-754 binary64; no rounding applied',...(binding===undefined?{}:{binding})});
}
