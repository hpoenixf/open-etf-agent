// Synthetic process kill point: durable registration before any paired checkpoint.
import {openSession} from '../src/session.mjs';import {DOCUMENT_REVOCATION_PROFILE as profile,readFixturePage} from '../src/source.mjs';import {openArtifactStore} from '../src/artifacts.mjs';import {createResultStore} from '../src/results.mjs';import {saveReport} from '../src/report.mjs';
const [directory,runId]=process.argv.slice(2),store=await openSession({directory,profile,clock:()=>100}),claim=store.claim(runId,'registered-child'),state=claim.read(),a=store.documentAuthority();
const source=await readFixturePage({documentId:'atlas-a',page:1}),results=await createResultStore({directory}),ref=await results.resolve(source.sourceId),dependency=claim.bindProtectedSource(source,ref.resultRef),protection={profile,authorityId:a.authorityId,libraryId:a.libraryId,rootId:state.rootId,runId};
const artifacts=await openArtifactStore({directory,protection}),call=state.snapshot.proposal.calls[state.snapshot.cursor];
const receipt=await saveReport({directory,store:artifacts,text:call.arguments.text,selected:[source],resultRefs:[ref],calculations:[],methods:[],callId:call.id,protectedOutput:{dependencies:[dependency],register:proof=>claim.registerProtectedOutput(proof)}});
process.send({phase:'registered-before-paired',receipt});setInterval(()=>{},1000);
