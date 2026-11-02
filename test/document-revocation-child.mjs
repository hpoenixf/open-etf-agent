// Dedicated provider-free fresh-process Session revocation; not a model worker.
import {openSession} from '../src/session.mjs';import {DOCUMENT_REVOCATION_PROFILE} from '../src/source.mjs';
const [directory,documentId]=process.argv.slice(2);const store=await openSession({directory,profile:DOCUMENT_REVOCATION_PROFILE,clock:()=>100});
try{const a=store.documentAuthority();const result=store.revokeDocument({authorityId:a.authorityId,libraryId:a.libraryId,documentId,expectedRevision:1});process.stdout.write(JSON.stringify(result)+'\n');}finally{store.close();}
