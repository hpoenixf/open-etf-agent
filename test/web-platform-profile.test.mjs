import test from 'node:test';
import assert from 'node:assert/strict';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import {Duplex,PassThrough} from 'node:stream';
import {EventEmitter} from 'node:events';
import {platformProxyConfig,prepareWebNetworkProfile,readPreparedWebNetworkProfile,platformPinnedTransport,validateDnsAnswer,createPlatformResolver} from '../src/web-platform-profile.mjs';
import {acquireWebPage} from '../src/web-transport.mjs';
import {mockWebNetwork} from './fixtures/web-network.mjs';
const host='example.org',address={address:'93.184.216.34',family:4};
const answer=(type,records)=>Buffer.from(JSON.stringify({Status:0,TC:false,Question:[{name:host+'.',type:type==='A'?1:28}],Answer:records.map(data=>({name:host+'.',type:type==='A'?1:28,data}))}));
const config={proxy:'http://proxy.example:8080/',noProxy:''};
test('platform profile requires explicit valid proxy configuration',()=>{
 assert.throws(()=>platformProxyConfig({}),/WEB_PLATFORM_PROXY_REQUIRED/);
 assert.throws(()=>platformProxyConfig({HTTPS_PROXY:'not-url'}),/WEB_PLATFORM_PROXY_INVALID/);
 assert.throws(()=>platformProxyConfig({HTTPS_PROXY:config.proxy,NODE_USE_ENV_PROXY:'0'}),/WEB_PLATFORM_PROXY_REQUIRED/);
 assert.equal(platformProxyConfig({HTTPS_PROXY:config.proxy}).proxy,config.proxy);
});
test('platform does not silently honor NO_PROXY by routing direct',()=>{
 for(const noProxy of ['*','example.org','.example.org','*.org','93.184.216.34'])assert.throws(()=>platformPinnedTransport(new URL('https://example.org/a'),address,new AbortController().signal,{...config,noProxy}),/WEB_PLATFORM_NO_PROXY_CONFLICT/);
});
test('platform rejects wrong DNS question, truncated/error and CNAME/unknown answers',()=>{
 const original=JSON.parse(answer('A',[address.address]));
 for(const delta of [{Status:2},{TC:true},{Question:[{name:'other.org.',type:1}]},{Answer:[{name:host+'.',type:5,data:'alias.example'}]},{Additional:[{type:1,data:'127.0.0.1'}]}])assert.throws(()=>validateDnsAnswer(Buffer.from(JSON.stringify({...original,...delta})),host,'A'),/WEB_PLATFORM_DNS_INVALID/);
 assert.throws(()=>validateDnsAnswer(answer('A',['127.0.0.1']),host,'A'),/WEB_ADDRESS_NOT_PUBLIC/);
});
test('platform resolves both families, validates all records and caches only this owner',async()=>{
 const calls=[],observations=[];const resolve=createPlatformResolver(async u=>{calls.push(u.href);return {status:200,contentType:'application/dns-json',body:answer(u.searchParams.get('type'),u.searchParams.get('type')==='A'?[address.address]:[])};},observations);
 assert.deepEqual(await resolve(host),address);await resolve(host);assert.equal(calls.length,2);assert.equal(observations[0].families.length,2);
});
test('platform rejects private AAAA even after public A and rejects both NODATA',async()=>{
 for(const privateV6 of [true,false]){const resolve=createPlatformResolver(async u=>({status:200,contentType:'application/dns-json',body:answer(u.searchParams.get('type'),privateV6?(u.searchParams.get('type')==='A'?[address.address]:['::1']):[])}),[]);await assert.rejects(resolve(host),privateV6?/WEB_ADDRESS_NOT_PUBLIC/:/WEB_PLATFORM_DNS_EMPTY/);}
});
test('platform owns pending returned socket and late callback socket after disposal',t=>{
 let callback,returned;class Socket extends EventEmitter{destroy(){this.destroyed=true;this.emit('close');}}
 returned=new Socket();
 t.mock.method(https.Agent.prototype,'createConnection',(_opts,cb)=>{callback=cb;return returned;});const c=new AbortController(),transport=platformPinnedTransport(new URL('https://example.org/a'),address,c.signal,config);
 let result;transport.options.agent.createConnection({},e=>{result=e;});c.abort();assert.equal(returned.destroyed,true);const late=new Socket();callback(null,late);assert.equal(late.destroyed,true);assert.equal(result.code,'WEB_CANCELLED');
});
test('platform owns undefined-return late socket and preserves pinned URL/Host/SNI',t=>{
 let callback;
 t.mock.method(https.Agent.prototype,'createConnection',(_opts,cb)=>{callback=cb;});const transport=platformPinnedTransport(new URL('https://example.org/a'),address,new AbortController().signal,config);
 assert.equal(transport.url.hostname,address.address);assert.equal(transport.options.servername,host);assert.equal(transport.options.headers.Host,host);assert.equal(transport.options.rejectUnauthorized,true);
 transport.options.agent.createConnection({},()=>{});transport.dispose();const late=new EventEmitter();late.destroy=()=>{late.destroyed=true;};callback(null,late);assert.equal(late.destroyed,true);
});
test('platform acquisition budgets DNS and pages together without OS resolver',async t=>{
 const saved={};for(const k of ['HTTPS_PROXY','https_proxy','NO_PROXY','no_proxy','NODE_USE_ENV_PROXY']){saved[k]=process.env[k];delete process.env[k];}process.env.HTTPS_PROXY=config.proxy;
 t.after(()=>{for(const [k,v]of Object.entries(saved)){if(v===undefined)delete process.env[k];else process.env[k]=v;}});
 const routes={};for(const type of ['A','AAAA'])routes[`https://1.1.1.1/dns-query?name=example.org&type=${type}`]={headers:{'content-type':'application/dns-json'},body:answer(type,type==='A'?[address.address]:[])};
 routes['https://93.184.216.34/robots.txt']={status:404};routes['https://93.184.216.34/a']={body:'Public text'};
 const m=mockWebNetwork(t,{routes});const r=await acquireWebPage({url:'https://example.org/a',allowedUrls:['https://example.org/a'],networkProfile:'platform-doh-pinned@1'});
 assert.equal(r.requestCount,4);assert.equal(m.lookups.length,0);assert.equal(r.dnsObservations.length,1);assert.equal(r.networkProfile,'platform-doh-pinned@1');assert.ok(r.receivedBytes>11);assert.equal(r.text,'Public text');
 await assert.rejects(acquireWebPage({url:'https://example.org/a',allowedUrls:['https://example.org/a'],networkProfile:'platform-doh-pinned@1',limits:{requests:1}}),/WEB_REQUEST_LIMIT/);
});

test('platform prepared token freezes configuration and rejects fabricated tokens',t=>{
 const keys=['HTTPS_PROXY','https_proxy','NO_PROXY','no_proxy','NODE_USE_ENV_PROXY'],saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));for(const k of keys)delete process.env[k];process.env.HTTPS_PROXY=config.proxy;
 t.after(()=>{for(const [k,v] of Object.entries(saved)){if(v===undefined)delete process.env[k];else process.env[k]=v;}});
 const token=prepareWebNetworkProfile('platform-doh-pinned@1');process.env.HTTPS_PROXY='http://changed.example:8080';
 assert.equal(readPreparedWebNetworkProfile(token,token.networkProfile).proxy,config.proxy);assert.equal(Object.isFrozen(token),true);
 assert.throws(()=>readPreparedWebNetworkProfile({...token},token.networkProfile),/WEB_NETWORK_PROFILE_INVALID/);
});
for(const protocol of ['http:','https:'])test('platform actual Node Agent pending CONNECT socket is abort-owned '+protocol,t=>{
 let pending;const module=protocol==='http:'?net:tls;
 t.mock.method(module,'connect',()=>{pending=new PassThrough();pending.setTimeout=()=>pending;return pending;});
 const c=new AbortController(),transport=platformPinnedTransport(new URL('https://example.org/a'),address,c.signal,{...config,proxy:protocol+'//proxy.example:8080/'});
 const returned=transport.options.agent.createConnection({host:address.address,port:443,servername:host,rejectUnauthorized:true},()=>{});
 assert.equal(returned,pending);assert.equal(pending.destroyed,false);c.abort();assert.equal(pending.destroyed,true);transport.dispose();
});
test('platform asynchronous callback after finalize destroys unregistered socket',async t=>{
 let callback;
 t.mock.method(https.Agent.prototype,'createConnection',(_opts,cb)=>{callback=cb;});const transport=platformPinnedTransport(new URL('https://example.org/a'),address,new AbortController().signal,config);let calls=0;
 transport.options.agent.createConnection({},()=>calls++);transport.dispose();const late=new PassThrough();await new Promise(resolve=>setImmediate(()=>{callback(null,late);resolve();}));assert.equal(late.destroyed,true);assert.equal(calls,1);
});

test('platform DNS comparison allows ASCII case and one optional trailing dot only',()=>{
 const original=JSON.parse(answer('A',[address.address]));for(const name of ['example.org','EXAMPLE.org.']){const value={...original,Question:[{name,type:1}],Answer:[{name,type:1,data:address.address}]};assert.equal(validateDnsAnswer(Buffer.from(JSON.stringify(value)),host,'A').records.length,1);}
 for(const name of ['example.org..','other.example.org','example.org.evil',' example.org','example%2eorg'])assert.throws(()=>validateDnsAnswer(Buffer.from(JSON.stringify({...original,Question:[{name,type:1}]})),host,'A'),/WEB_PLATFORM_DNS_INVALID/);
});
test('platform resolver access/rate refusal stops before second family',async()=>{
 for(const status of [403,429]){let calls=0;const resolve=createPlatformResolver(async()=>{calls++;return {status};},[]);await assert.rejects(resolve(host),e=>e.code===(status===403?'WEB_ACCESS_DENIED':'WEB_RATE_LIMITED'));assert.equal(calls,1);}
});
test('platform rejects oversized DNS body and wrong address family',()=>{
 assert.throws(()=>validateDnsAnswer(Buffer.alloc(8193),host,'A'),/WEB_PLATFORM_DNS_INVALID/);
 assert.throws(()=>validateDnsAnswer(answer('AAAA',[address.address]),host,'AAAA'),/WEB_PLATFORM_DNS_INVALID/);
});
test('platform IPv6 CONNECT destination keeps hostname certificate identity',()=>{
 const t=platformPinnedTransport(new URL('https://example.org/a'),{address:'2606:4700:4700::1111',family:6},new AbortController().signal,config);
 assert.equal(t.url.host,'[2606:4700:4700::1111]');assert.equal(t.options.servername,host);assert.equal(t.options.headers.Host,host);t.dispose();
});

for(const abortDuringTls of [false,true])test('platform native CONNECT 200 preserves pin and TLS identity '+(abortDuringTls?'until abort':'through handshake'),async t=>{
 let proxyOptions,onProxyConnection,targetOptions,onHandshake,payload='';
 const proxySocket=new Duplex({read(){},write(chunk,_encoding,done){payload+=chunk.toString();done();}});proxySocket.setTimeout=()=>proxySocket;
 const targetSocket=new PassThrough();
 t.mock.method(net,'connect',(options,callback)=>{proxyOptions=options;onProxyConnection=callback;return proxySocket;});
 t.mock.method(tls,'connect',(options,callback)=>{targetOptions=options;onHandshake=callback;return targetSocket;});
 const c=new AbortController(),transport=platformPinnedTransport(new URL('https://example.org/a'),address,c.signal,config);t.after(()=>{transport.dispose();targetSocket.destroy();});
 let result;const lookup=()=>assert.fail('No target DNS lookup is permitted');
 const returned=transport.options.agent.createConnection({...transport.options,host:address.address,port:443,lookup},(error,socket)=>{result={error,socket};});
 assert.equal(returned,proxySocket);assert.equal(proxyOptions.host,'proxy.example');assert.equal(Number(proxyOptions.port),8080);assert.equal(proxyOptions.lookup,undefined);
 onProxyConnection();assert.match(payload,/^CONNECT 93\.184\.216\.34:443 HTTP\/1\.1\r\n/);assert.match(payload,/\r\nHost: 93\.184\.216\.34:443\r\n/i);
 proxySocket.push(Buffer.from('HTTP/1.1 200 Connection Established\r\n\r\n'));await new Promise(resolve=>setImmediate(resolve));
 assert.equal(targetOptions.socket,proxySocket);assert.equal(targetOptions.host,address.address);assert.equal(targetOptions.servername,host);assert.equal(targetOptions.headers.Host,host);assert.equal(targetOptions.rejectUnauthorized,true);assert.equal(result,undefined);
 if(abortDuringTls){c.abort();assert.equal(proxySocket.destroyed,true);onHandshake();assert.equal(targetSocket.destroyed,true);assert.equal(result.error.code,'WEB_CANCELLED');}
 else{onHandshake();assert.equal(result.error,null);assert.equal(result.socket,targetSocket);transport.dispose();assert.equal(proxySocket.destroyed,true);assert.equal(targetSocket.destroyed,true);}
 assert.equal(transport.connectionAttempts,1);
});
