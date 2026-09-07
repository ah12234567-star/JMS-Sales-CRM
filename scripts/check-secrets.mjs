import {readFileSync,readdirSync,statSync} from 'node:fs';
import {join,relative} from 'node:path';

const root=process.cwd(), ignored=new Set(['node_modules','vendor','.git','upload','rendered_guide','rendered_guide_v2']);
const extensions=new Set(['.js','.mjs','.html','.md','.sql','.json','.txt']);
const patterns=[
  ['demo password',/\b123456\b/],
  ['Meta test template',/hello_world/],
  ['hardcoded Supabase URL',/https:\/\/[a-z0-9]+\.supabase\.co/],
  ['hardcoded Supabase publishable key',/sb_publishable_[A-Za-z0-9_-]+/],
  ['hardcoded WhatsApp phone number id',/1252021734662917/]
];
const failures=[];
function walk(dir){
  for(const name of readdirSync(dir)){
    if(ignored.has(name)) continue;
    const path=join(dir,name),stat=statSync(path);
    if(stat.isDirectory()) walk(path);
    else if([...extensions].some(ext=>name.endsWith(ext))){
      if(['scripts/check-secrets.mjs','tests/security-hardening.test.js'].includes(relative(root,path))) continue;
      const content=readFileSync(path,'utf8');
      for(const [label,pattern] of patterns) if(pattern.test(content)) failures.push(`${relative(root,path)}: ${label}`);
    }
  }
}
walk(root);
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log('Tracked-source secret scan passed.');
