// Development utility: merge reviewed tab-separated Arabic/English pairs into catalogs.
import fs from 'node:fs';import crypto from 'node:crypto';
const ar=JSON.parse(fs.readFileSync('locales/ar.json')),en=JSON.parse(fs.readFileSync('locales/en.json'));
for(const file of process.argv.slice(2))for(const line of fs.readFileSync(file,'utf8').split('\n')){
 if(!line.trim())continue;const split=line.indexOf('\t');if(split<0)throw new Error('Expected Arabic TAB English');
 const a=line.slice(0,split),e=line.slice(split+1);if(!e)throw new Error('Empty translation');
 const key='ui_'+crypto.createHash('sha256').update(a).digest('hex').slice(0,12);ar[key]=a;en[key]=e;
}
for(const [lang,data] of [['ar',ar],['en',en]])fs.writeFileSync('locales/'+lang+'.json',JSON.stringify(data,null,2)+'\n');
console.log(Object.keys(ar).length+' reviewed entries');
