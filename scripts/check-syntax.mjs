import {execFileSync} from 'node:child_process';
import {readdirSync, statSync} from 'node:fs';
import {join} from 'node:path';

const root=process.cwd(), ignored=new Set(['node_modules','.git','rendered_guide','rendered_guide_v2']);
const files=[];
function walk(dir){
  for(const name of readdirSync(dir)){
    if(ignored.has(name)) continue;
    const path=join(dir,name), stat=statSync(path);
    if(stat.isDirectory()) walk(path);
    else if(name.endsWith('.js')||name.endsWith('.mjs')) files.push(path);
  }
}
walk(root);
for(const file of files) execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
console.log(`Syntax validation passed for ${files.length} JavaScript files.`);
