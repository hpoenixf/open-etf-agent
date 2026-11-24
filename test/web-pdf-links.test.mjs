import test from 'node:test';
import assert from 'node:assert/strict';
import {extractWebPdfLinks,extractWebText,verifyWebPdfLink} from '../src/web-extraction.mjs';

const finalUrl='https://issuer.example/reports/overview';
const html='text/html; charset=utf-8';
const body=text=>Buffer.from(text);
const create=(text,type=html)=>extractWebPdfLinks(body(text),type,{finalUrl});

test('actual bounded HTML links only, resolves against verified final URL, unchanged text extraction',()=>{
 const bytes=body(`
  <base href="https://not-the-authority.example/"><p>Annual report</p>
  <a href="../real.PDF#page=8">Read the report</a><a href="/real.PDF">duplicate</a>
  <a href="document" type="application/pdf">Unusual path</a>
  <p>https://fake.example/fake.pdf</p><script>fake="/also-fake.pdf"</script>
  <img src="/fake.pdf"><div hidden><a href="/hidden.pdf">Hidden</a></div>
  <div style="color: red; visibility: hidden !important"><a href="/invisible.pdf">Hidden</a></div>
  <form><a href="/form.pdf">Hidden by policy</a></form>
  <a href="http://insecure.example/no.pdf">cleartext</a>
  <a href="https://127.0.0.1/no.pdf">local literal</a>
  <a href="https://nas.local/no.pdf">local name</a>
  <a href="https://login:token@issuer.example/no.pdf">user info</a>
  <a href="signed.pdf?access_token=private">signed</a>
  <a href="#same.pdf" type="application/pdf">Only a fragment</a>
 `);
 const old=extractWebText(bytes,html);
 const values=extractWebPdfLinks(bytes,html,{finalUrl});
 assert.deepEqual(values.links.map(x=>x.url),['https://issuer.example/real.PDF','https://issuer.example/reports/document']);
 assert.equal(values.complete,true);
 assert.deepEqual(extractWebText(bytes,html),old);
 assert.equal(Object.hasOwn(old,'links'),false);
 assert.deepEqual(create('<a href="report.pdf">text only</a>','text/plain').links,[]);
});

test('proof requires exact retained bytes, accepted URL scope and existing link id',()=>{
 const bytes=body('<p>From authentic chapter</p><a href="/holdings.pdf">Portfolio</a>');
 const inventory=extractWebPdfLinks(bytes,html,{finalUrl});
 const [link]=inventory.links;
 const binding={finalUrl,originalSha256:inventory.originalSha256,linkId:link.id};
 assert.deepEqual(verifyWebPdfLink(bytes,html,binding),link);
 assert.equal(verifyWebPdfLink(Buffer.concat([bytes,Buffer.from('!')]),html,binding),null);
 assert.equal(verifyWebPdfLink(bytes,html,{...binding,finalUrl:'https://issuer.example/other'}),null);
 assert.equal(verifyWebPdfLink(bytes,html,{...binding,linkId:'web-pdf-link:sha256:'+'0'.repeat(64)}),null);
 assert.equal(verifyWebPdfLink(bytes,'text/plain',binding),null);
 assert.throws(()=>extractWebPdfLinks(bytes,html,{finalUrl:'file:///not-a-web-page.pdf'}),{code:'WEB_URL_INVALID'});
});

test('inventory cap is explicit and legacy bounds fail closed before projecting links',()=>{
 const many=Array.from({length:70},(_,i)=>`<a href="data-${i}.pdf">Data</a>`).join('');
 const bounded=create(many);
 assert.equal(bounded.complete,false);
 assert.equal(bounded.links.length,64);
 assert.equal(new Set(bounded.links.map(x=>x.id)).size,64);
 assert.throws(()=>extractWebPdfLinks(body(many),html,{finalUrl,limits:{bodyBytes:100}}),{code:'WEB_BODY_LIMIT'});
});
