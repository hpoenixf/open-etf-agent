import {sha256} from './source.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const canonical=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const hash=v=>sha256(canonical(v));
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const hex=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
export const knowledgeQuerySchemas=[
 'CREATE TABLE knowledge_query_usage (run_id TEXT PRIMARY KEY REFERENCES runs(run_id), reserved INTEGER NOT NULL CHECK(reserved>=0)) STRICT',
 'CREATE TABLE knowledge_query_effects (run_id TEXT NOT NULL REFERENCES runs(run_id), call_id TEXT NOT NULL, tool_ordinal INTEGER NOT NULL, fact TEXT NOT NULL, PRIMARY KEY(run_id,call_id), UNIQUE(run_id,tool_ordinal)) STRICT'
];
export function hasKnowledgeQueryTables(db){
 const n=db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name IN ('knowledge_query_usage','knowledge_query_effects')").get().n;
 if(n!==0&&n!==2)fail('KNOWLEDGE_QUERY_RECORD_CHANGED');return n===2;
}
export function validateKnowledgeQueryConfig(v){
 if(!exact(v,['schemaVersion','model','manifestSha256','catalogSha256','sourceManifestSha256','pageEvidenceSha256','dimensions','maxTokens','maxQueries'])||v.schemaVersion!=='local-knowledge-query@1'||typeof v.model!=='string'||!/^[-A-Za-z0-9._/]{1,128}$/.test(v.model)||!['manifestSha256','catalogSha256','sourceManifestSha256','pageEvidenceSha256'].every(k=>hex(v[k]))||!Number.isSafeInteger(v.dimensions)||v.dimensions<1||v.dimensions>1024||!Number.isSafeInteger(v.maxTokens)||v.maxTokens<1||v.maxTokens>1048576||!Number.isSafeInteger(v.maxQueries)||v.maxQueries<1||v.maxQueries>16)fail('KNOWLEDGE_QUERY_CONFIG');return v;
}
function scope(db,runId){
 const row=db.prepare('SELECT * FROM runs WHERE run_id=?').get(runId);if(!row)fail('UNKNOWN_RUN');
 const definition=JSON.parse(row.definition),config=definition.config.knowledgeQueryEffects;
 if(!config)return null;validateKnowledgeQueryConfig(config);
 const binding=definition.bindings.adapters.find(b=>b.id==='knowledge-query-effect');
 if(definition.bindings.plugins.length||definition.bindings.adapters.some(b=>!['knowledge-query-effect','publication'].includes(b.id))||definition.config.allowedTools?.some(n=>!['knowledge_query','read_page','read_result','save_report'].includes(n))||definition.config.documentCatalog?.sha256!==config.catalogSha256||['workingInput','ordinaryResponse','documentProtection','pdfSnapshot','taskTime'].some(k=>definition.config[k]!==undefined))fail('KNOWLEDGE_QUERY_SCOPE');
 if(row.parent_run_id!==null||row.root_id!==runId||canonical(binding)!==canonical({id:'knowledge-query-effect',version:config.schemaVersion,contentSha256:hash(config)})||!definition.config.allowedTools?.includes('knowledge_query'))fail('KNOWLEDGE_QUERY_SCOPE');
 return {row,definition,config};
}
function currentCall(row){const s=JSON.parse(row.snapshot);return s.phase==='tool-dispatched'?s.proposal?.calls?.[s.cursor]:null;}
function validateEncoded(encoded,call,config){
 const input={kind:'query',id:sha256(call.arguments.query),text:call.arguments.query};
 if(!exact(encoded,['kind','id','inputSha256','tokenIdsSha256','tokenCount','vector'])||encoded.kind!=='query'||encoded.id!==input.id||encoded.inputSha256!==sha256(JSON.stringify(input))||!hex(encoded.tokenIdsSha256)||!Number.isSafeInteger(encoded.tokenCount)||encoded.tokenCount<1||encoded.tokenCount>config.maxTokens||!Array.isArray(encoded.vector)||encoded.vector.length!==config.dimensions||Array.from(encoded.vector).some(n=>typeof n!=='number'||!Number.isFinite(n)||Math.abs(n)>1e10)||!encoded.vector.some(n=>n!==0))fail('KNOWLEDGE_QUERY_RECEIPT');
}
function readFact(db,runId,callId){
 const s=scope(db,runId);if(!s)return null;
 if(!hasKnowledgeQueryTables(db))fail('KNOWLEDGE_QUERY_RECORD_CHANGED');
 const item=db.prepare('SELECT fact,tool_ordinal FROM knowledge_query_effects WHERE run_id=? AND call_id=?').get(runId,callId);if(!item)return null;
 let f;try{f=JSON.parse(item.fact);}catch{fail('KNOWLEDGE_QUERY_RECORD_CHANGED');}
 if(!exact(f,['schemaVersion','runId','call','fence','toolOrdinal','profileSha256','requestSha256','status','dispatchedPhysicalOperations','encoded','encodedSha256'])||f.schemaVersion!=='knowledge-query-effect@1'||f.runId!==runId||f.call?.id!==callId||f.call?.name!=='knowledge_query'||!Number.isSafeInteger(f.fence)||f.fence<1||!Number.isSafeInteger(f.toolOrdinal)||f.toolOrdinal<1||f.toolOrdinal!==item.tool_ordinal||f.toolOrdinal>db.prepare('SELECT tool_used FROM roots WHERE root_id=?').get(runId).tool_used||f.profileSha256!==hash(s.config)||f.requestSha256!==hash({runId,call:f.call,profileSha256:f.profileSha256})||!['reserved','completed'].includes(f.status)||!Number.isSafeInteger(f.dispatchedPhysicalOperations)||f.dispatchedPhysicalOperations<0||f.dispatchedPhysicalOperations>2||(f.status==='completed'?(f.dispatchedPhysicalOperations!==2||!f.encoded):(f.encoded!==null||f.encodedSha256!==null)))fail('KNOWLEDGE_QUERY_RECORD_CHANGED');
 const snapshot=JSON.parse(s.row.snapshot),calls=[...(snapshot.messages??[]).flatMap(m=>m.calls??[]),...(snapshot.proposal?.calls??[])];
 if(!calls.some(c=>canonical(c)===canonical(f.call)))fail('KNOWLEDGE_QUERY_RECORD_CHANGED');
 if(f.status==='completed'&&f.encodedSha256!==hash(f.encoded))fail('KNOWLEDGE_QUERY_RECORD_CHANGED');
 if(f.status==='completed')validateEncoded(f.encoded,f.call,s.config);return structuredClone(f);
}
export function validateKnowledgeQueryDatabase(db){
 const present=hasKnowledgeQueryTables(db),version=db.prepare('PRAGMA user_version').get().user_version;if(present&&version!==7)fail('KNOWLEDGE_QUERY_RECORD_CHANGED');
 for(const row of db.prepare('SELECT run_id,definition FROM runs').iterate()){
  const s=scope(db,row.run_id);if(!s){if(version===7)fail('KNOWLEDGE_QUERY_SCOPE');continue;}if(!present)fail('KNOWLEDGE_QUERY_RECORD_CHANGED');
  const usage=db.prepare('SELECT reserved FROM knowledge_query_usage WHERE run_id=?').get(row.run_id),effects=db.prepare('SELECT call_id FROM knowledge_query_effects WHERE run_id=?').all(row.run_id);
  if(!usage||usage.reserved!==effects.length||usage.reserved>s.config.maxQueries)fail('KNOWLEDGE_QUERY_RECORD_CHANGED');
  for(const e of effects)readFact(db,row.run_id,e.call_id);
 }
 if(present)for(const row of db.prepare('SELECT run_id FROM knowledge_query_usage UNION SELECT run_id FROM knowledge_query_effects').iterate())if(!scope(db,row.run_id))fail('KNOWLEDGE_QUERY_RECORD_CHANGED');
}
export function createSessionKnowledgeQueries({db,transaction,writer}){
 const update=f=>db.prepare('UPDATE knowledge_query_effects SET fact=? WHERE run_id=? AND call_id=?').run(canonical(f),f.runId,f.call.id);
 const active=(token,callId)=>{const row=writer(token.runId,token.owner,token.fence),s=scope(db,token.runId),call=currentCall(row),snapshot=JSON.parse(row.snapshot),toolOrdinal=db.prepare('SELECT tool_used FROM roots WHERE root_id=?').get(row.root_id).tool_used;if(!s||call?.id!==callId||call.name!=='knowledge_query'||canonical(snapshot.inFlight?.effective)!==canonical(call)||toolOrdinal<1)fail('KNOWLEDGE_QUERY_DISPATCH_REQUIRED');return {...s,call,toolOrdinal};};
 return {
  initialize(runId){const s=scope(db,runId);if(!s)return;if(!hasKnowledgeQueryTables(db))for(const sql of knowledgeQuerySchemas)db.exec(sql);db.prepare('INSERT INTO knowledge_query_usage VALUES(?,0)').run(runId);},
  read:readFact.bind(null,db),
  budget(runId){const s=scope(db,runId);if(!s)return null;validateKnowledgeQueryDatabase(db);const usage=db.prepare('SELECT reserved FROM knowledge_query_usage WHERE run_id=?').get(runId),effects=db.prepare('SELECT call_id FROM knowledge_query_effects WHERE run_id=?').all(runId);const facts=effects.map(e=>readFact(db,runId,e.call_id)),completed=facts.filter(f=>f.status==='completed').length;return {maxQueries:s.config.maxQueries,reservedQueries:usage.reserved,reservedPhysicalOperations:2*usage.reserved,dispatchedPhysicalOperations:facts.reduce((n,f)=>n+f.dispatchedPhysicalOperations,0),completedQueries:completed,unsettledQueries:usage.reserved-completed};},
  reserve(token,call){
   const s=active(token,call?.id);if(canonical(call)!==canonical(s.call))fail('KNOWLEDGE_QUERY_SCOPE');validateKnowledgeQueryDatabase(db);
   if(readFact(db,token.runId,call.id))fail('KNOWLEDGE_QUERY_ALREADY_CLAIMED');
   const usage=db.prepare('SELECT reserved FROM knowledge_query_usage WHERE run_id=?').get(token.runId);if(usage.reserved>=s.config.maxQueries)fail('KNOWLEDGE_QUERY_BUDGET_EXHAUSTED');
   if(db.prepare('SELECT 1 FROM knowledge_query_effects WHERE run_id=? AND tool_ordinal=?').get(token.runId,s.toolOrdinal))fail('KNOWLEDGE_QUERY_DISPATCH_REQUIRED');
   const profileSha256=hash(s.config),f={schemaVersion:'knowledge-query-effect@1',runId:token.runId,call:structuredClone(call),fence:token.fence,toolOrdinal:s.toolOrdinal,profileSha256,requestSha256:hash({runId:token.runId,call,profileSha256}),status:'reserved',dispatchedPhysicalOperations:0,encoded:null,encodedSha256:null};
   db.prepare('UPDATE knowledge_query_usage SET reserved=reserved+1 WHERE run_id=?').run(token.runId);db.prepare('INSERT INTO knowledge_query_effects VALUES(?,?,?,?)').run(token.runId,call.id,s.toolOrdinal,canonical(f));return f;
  },
  dispatch(token,callId,stage){return transaction(()=>{active(token,callId);const f=readFact(db,token.runId,callId),expected=stage==='tokenize'?0:stage==='encode'?1:-1;if(f&&f.fence!==token.fence)fail('KNOWLEDGE_QUERY_OUTCOME_UNKNOWN');if(!f||f.status!=='reserved'||f.dispatchedPhysicalOperations!==expected)fail('KNOWLEDGE_QUERY_STAGE');f.dispatchedPhysicalOperations++;update(f);return f;});},
  complete(token,callId,encoded){return transaction(()=>{const s=active(token,callId),f=readFact(db,token.runId,callId);if(f&&f.fence!==token.fence)fail('KNOWLEDGE_QUERY_OUTCOME_UNKNOWN');if(!f||f.status!=='reserved'||f.dispatchedPhysicalOperations!==2)fail('KNOWLEDGE_QUERY_STAGE');validateEncoded(encoded,f.call,s.config);f.status='completed';f.encoded=structuredClone(encoded);f.encodedSha256=hash(encoded);update(f);return f;});}
 };
}
