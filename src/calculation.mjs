export function validateCalculation(value) {
  const exact=(item,keys)=>item && typeof item==='object' && !Array.isArray(item) && Object.keys(item).sort().join(',')===keys.slice().sort().join(',');
  if(!exact(value,['inputs','difference','unit','ratio','increaseRatio','calculation','arithmetic']) || !exact(value.inputs,['baseline','current','baselineUnit','currentUnit'])) throw new Error('Invalid derived calculation record');
  const {baseline,current,baselineUnit,currentUnit}=value.inputs;
  if(!Number.isFinite(baseline)||!Number.isFinite(current)||baseline===0||typeof baselineUnit!=='string'||!/^[A-Za-z][A-Za-z0-9 /%_-]{0,39}$/.test(baselineUnit)||baselineUnit!==currentUnit||value.unit!==baselineUnit||value.calculation!=='calculate_change@1'||value.arithmetic!=='IEEE-754 binary64; no rounding applied') throw new Error('Invalid calculation identity or units');
  const difference=current-baseline,ratio=current/baseline,increaseRatio=(current-baseline)/baseline;
  if(![difference,ratio,increaseRatio].every(Number.isFinite)||value.difference!==difference||value.ratio!==ratio||value.increaseRatio!==increaseRatio) throw new Error('Invalid calculation values');
  return {inputs:{baseline,current,baselineUnit,currentUnit},difference,unit:baselineUnit,ratio,increaseRatio,calculation:value.calculation,arithmetic:value.arithmetic};
}
