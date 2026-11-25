import {constants} from 'node:fs';
import {open} from 'node:fs/promises';
import {parseArgs} from 'node:util';
import {preflightSkill} from './skill-preflight.mjs';

const usage='Usage: node src/skill-preflight-cli.mjs validate --root DIR\n'
  +'       node src/skill-preflight-cli.mjs preview --root DIR --skill ID\n'
  +'       node src/skill-preflight-cli.mjs test --root DIR --case FILE\n';
const rootDiagnostics=new Map([
  ['Unsupported Skill frontmatter metadata; only name and description are supported','Unsupported Skill frontmatter; use name and description in the documented order.'],
  ['Unknown Skill ID','Unknown Skill ID. Use the directory ID from validate output.'],
  ['Unsafe Skill directory symlink','Unsafe Skill directory symlink. Use an ordinary directory.'],
  ['Unsafe directory or symlink','Use an existing ordinary Skill catalog directory.'],
  ['Invalid Skill directory ID','Invalid Skill directory ID. Use lowercase letters, numbers and hyphens.'],
  ['Duplicate Skill name','Duplicate Skill name. Give each method a unique frontmatter name.'],
  ['Resource is not a file or exceeds size limit','The Skill file is missing, too large, or not an ordinary file.'],
  ['Unsafe resource path or symlink','Use an ordinary file inside the selected Skill directory.'],
  ['Skill metadata changed since catalog discovery','Skill metadata changed during preflight. Retry after saving the files.'],
]);

async function readCase(path){
  const cap=16384;
  const file=await open(path,constants.O_RDONLY|constants.O_NONBLOCK|constants.O_NOFOLLOW);
  try{
    const stat=await file.stat();
    if(!stat.isFile()||stat.size>cap)throw new Error('Invalid synthetic case file');
    const buffer=Buffer.alloc(cap+1);
    let offset=0;
    while(offset<buffer.length){
      const {bytesRead}=await file.read(buffer,offset,buffer.length-offset,offset);
      if(!bytesRead)break;
      offset+=bytesRead;
    }
    if(offset>cap)throw new Error('Invalid synthetic case file');
    return JSON.parse(new TextDecoder('utf8',{fatal:true}).decode(buffer.subarray(0,offset)));
  }finally{await file.close();}
}

const [action,...args]=process.argv.slice(2);
if(action==='--help'&&!args.length)process.stdout.write(usage);
else try{
  const flags=action==='validate'?['root']:action==='preview'?['root','skill']:action==='test'?['root','case']:[];
  if(!flags.length)throw new Error('Invalid command');
  const {values,tokens}=parseArgs({args,options:Object.fromEntries(flags.map(flag=>[flag,{type:'string'}])),tokens:true});
  if(tokens.length!==flags.length||!flags.every(flag=>values[flag]))throw new Error('Invalid options');
  const fixture=action==='test'?await readCase(values.case):undefined;
  process.stdout.write(JSON.stringify(await preflightSkill({root:values.root,skillId:values.skill,fixture}),null,2)+'\n');
}catch(error){
  const message=rootDiagnostics.get(error.message)??(
    error.code==='ENOENT'?'The selected catalog, SKILL.md, or case file is missing.':
    ['Invalid synthetic case shape','Invalid synthetic case file','Synthetic case suggested-tools assertion failed',
      'Synthetic case body assertion failed','Synthetic case resource unavailable'].includes(error.message)?error.message:
    'Skill preflight failed. Check the command and UTF-8 input files.'
  );
  process.stderr.write(message+'\n'+usage);
  process.exitCode=1;
}
