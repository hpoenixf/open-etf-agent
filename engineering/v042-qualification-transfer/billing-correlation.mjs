const amount=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0?n:null;
function projection(usage){
  const o=usage?.opencode;
  return {cost:amount(usage?.cost),billingSource:['go','go-plus','balance'].includes(o?.billing_source)?o.billing_source:null,
    allowance:amount(o?.allowance),listCost:amount(o?.list_cost),estimated:typeof o?.estimated==='boolean'?o.estimated:null};
}
const sha=/^[a-f0-9]{64}$/;
// No ordering fallback: neither a missing row nor a completed ticket alone proves billing.
export function correlateBilling(witnessed,tickets,events){
  return witnessed.map(w=>{
    const matches=tickets.filter(t=>t?.modelOrdinal===w.ordinal);
    const ticket=matches.length===1?matches[0]:null;
    const proposals=events.filter(e=>e?.type==='model_proposal'&&e.runId===w.runId&&e.rootId===w.runId&&e.modelOrdinal===w.ordinal);
    const evidence=w.httpStatus===200&&ticket?.state==='completed'&&ticket.runId===w.runId&&ticket.rootId===w.runId&&sha.test(w.inputSha256)&&ticket.inputHash===w.inputSha256&&
      witnessed.filter(x=>x.runId===w.runId&&x.ordinal===w.ordinal).length===1&&proposals.length===1&&proposals[0].inputHash===w.inputSha256;
    return {ordinal:w.ordinal,ticketState:ticket?.state??'missing',attribution:evidence?'native-reservation-exact':'unverified',...(evidence?{observed:projection(proposals[0].usage)}:{})};
  });
}
