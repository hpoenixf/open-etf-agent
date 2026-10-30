// Independent read-only Session + loopback Reader; no model or writer capability.
import {openSession} from '../src/session.mjs';import {DOCUMENT_REVOCATION_PROFILE as profile} from '../src/source.mjs';import {startReader} from '../src/reader.mjs';
const [sessionDirectory,directory,runId]=process.argv.slice(2),store=await openSession({directory:sessionDirectory,profile,readOnly:true});const server=await startReader({directory,protectedContext:{store,runId}});let closing;
async function close(){if(!closing)closing=(async()=>{await server.close();store.close();if(process.connected)process.disconnect();})();return closing;}
process.on('message',message=>{if(message==='close')void close();});process.on('disconnect',()=>void close());process.send({origin:server.origin,readOnly:store.readOnly,hasClaim:typeof store.claim==='function',hasRegister:typeof store.registerProtectedOutput==='function'});
