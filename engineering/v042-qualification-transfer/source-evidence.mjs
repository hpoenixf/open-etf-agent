export const hostMatches=(host,approved=[])=>typeof host==='string'&&approved.some(g=>host===g||host.endsWith('.'+g));
export function scopeEvidence(caseSpec,pages,unavailableSha){
 const originals=pages.filter(p=>p.traceState==='succeeded'&&/^[0-9a-f]{64}$/.test(p.originalSha256??'')&&hostMatches(p.finalHost,caseSpec.hosts)&&caseSpec.primaryUrls?.includes(p.finalUrl));
 const hasPrimary=originals.length>0;
 const eligibleRefusal=p=>p.traceState==='failed'&&p.knownNoUnsettledDispatch===true;
 const approvedFailure=pages.some(p=>eligibleRefusal(p)&&hostMatches(p.host,caseSpec.hosts));
 const expectedReject=unavailableSha?pages.some(p=>p.urlSha256===unavailableSha&&eligibleRefusal(p)):null;
 const [a,b]=caseSpec.dualPrimaryHosts??[];
 const sponsors=a&&b&&a!==b&&originals.some(p=>hostMatches(p.finalHost,[a])&&originals.some(q=>hostMatches(q.finalHost,[b])&&q.originalSha256!==p.originalSha256));
 return {hasPrimary,approvedFailure,expectedReject,scopeVerified:unavailableSha?expectedReject:caseSpec.id==='10'?Boolean(sponsors):hasPrimary};
}
