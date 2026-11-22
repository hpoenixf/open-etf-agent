import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {prepareScheduledSmtp} from '../src/scheduled-smtp.mjs';

const key='f'.repeat(64);
const worker=fileURLToPath(new URL('../src/scheduled-smtp-worker.py',import.meta.url));
const fixture={
 ETF_SCHEDULED_SMTP_ENABLED:'1',ETF_SCHEDULED_SMTP_PROFILE:'resend-smtp',
 ETF_SCHEDULED_SMTP_HOST:'smtp.resend.com',ETF_SCHEDULED_SMTP_TLS:'implicit',
 ETF_SCHEDULED_SMTP_USER:'resend',ETF_SCHEDULED_SMTP_PASSWORD:'synthetic-only',
 ETF_SCHEDULED_SMTP_FROM:'sender@example.invalid',ETF_SCHEDULED_SMTP_VERIFIED_TO:'owner@example.invalid',
 ETF_SCHEDULED_SMTP_VERIFIED_TO_VERSION:'fixture-verified',
};

test('explicit Resend profile is gated to official TLS route and emits header on first DATA only for that profile',()=>{
 assert.throws(()=>prepareScheduledSmtp({...fixture,ETF_SCHEDULED_SMTP_HOST:'localhost'}),{code:'SCHEDULED_SMTP_CONFIG_INVALID'});
 assert.throws(()=>prepareScheduledSmtp({...fixture,ETF_SCHEDULED_SMTP_PORT:'2525'}),{code:'SCHEDULED_SMTP_CONFIG_INVALID'});
 assert.ok(prepareScheduledSmtp(fixture));
 // Execute the real Python MIME worker with the SMTP socket boundary replaced
 // by a pure standard-library test double. No Resend DNS or socket is used.
 const code=`
import importlib.util, io, json, os, sys
spec = importlib.util.spec_from_file_location("worker", sys.argv[1])
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)
class Fixture:
    def __init__(self, *args, **kwargs): pass
    def ehlo(self): pass
    def login(self, *args): pass
    def mail(self, *args): return (250,b'fixture')
    def rcpt(self, *args): return (250,b'fixture')
    def data(self, body): self.__class__.message=body.decode("utf-8"); return (250,b'fixture')
    def close(self): pass
worker.smtplib.SMTP_SSL = Fixture
os.environ.update(SMTP_PROFILE=sys.argv[2],SMTP_HOST="smtp.resend.com",SMTP_PORT="465",SMTP_TLS="implicit",
    SMTP_USER="resend",SMTP_PASSWORD="synthetic-only",SMTP_FROM="sender@example.invalid")
sys.stdin = io.TextIOWrapper(io.BytesIO(json.dumps(dict(to="owner@example.invalid",subject="Fixture",text="Body",idempotencyKey=sys.argv[3])).encode()))
print(json.dumps(dict(status=worker.run(),message=Fixture.message)))
`;
 const result=profile=>JSON.parse(execFileSync('/usr/bin/python3',['-B','-I','-c',code,worker,profile,key],{env:{},encoding:'utf8'}));
 const resale=result('resend-smtp'), generic=result('generic-smtp');
 assert.equal(resale.status,'accepted');
 assert.ok(resale.message.includes('Resend-Idempotency-Key: '+key));
 assert.ok(generic.message.includes('Message-ID: <'+key+'@example.invalid>'));
 assert.doesNotMatch(generic.message,/Resend-Idempotency-Key/);
});
