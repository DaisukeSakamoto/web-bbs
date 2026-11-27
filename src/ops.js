import {DatabaseSync,backup} from 'node:sqlite';
import {mkdirSync,statfsSync,statSync,readdirSync,renameSync,unlinkSync,existsSync,chmodSync,realpathSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {randomBytes} from 'node:crypto';
export function diskStatus(path,minFree=256*1024*1024){const s=statfsSync(path);const free=s.bavail*s.bsize,total=s.blocks*s.bsize;return {free,total,ok:free>=minFree};}
export function verifyDatabase(path){const d=new DatabaseSync(path,{readOnly:true});try{const check=d.prepare('PRAGMA integrity_check').all();if(check.length!==1||Object.values(check[0])[0]!=='ok')throw Error('Database integrity check failed');if(d.prepare('PRAGMA foreign_key_check').all().length)throw Error('Foreign key check failed');const names=new Set(d.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r=>r.name));for(const name of ['posts','reports','moderation','audit','attachments'])if(!names.has(name))throw Error('Missing table: '+name);}finally{d.close();}}
const stamp=()=>new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomBytes(6).toString('hex');
const pattern=/^bbs-[0-9TZ-]+[a-f0-9]{12}\.sqlite$/;
export async function snapshot(dbPath,folder,{retain=7}={}){
 if(!Number.isSafeInteger(retain)||retain<1||retain>365)throw Error('Invalid retention');
 if(!existsSync(dbPath))throw Error('Source database not found');mkdirSync(folder,{recursive:true,mode:0o700});
 const name='bbs-'+stamp()+'.sqlite',dest=join(folder,name),temp=dest+'.partial';
 const db=new DatabaseSync(dbPath,{readOnly:true});try{await backup(db,temp);chmodSync(temp,0o600);verifyDatabase(temp);renameSync(temp,dest);}catch(e){if(existsSync(temp))unlinkSync(temp);throw e;}finally{db.close();}
 const files=readdirSync(folder).filter(n=>pattern.test(n)).sort().reverse();for(const old of files.slice(retain))unlinkSync(join(folder,old));return dest;
}
export async function restoreDatabase(source,dest,{offline=false}={}){
 if(!offline)throw Error('Stop all database users before restore; --offline required');
 if(!existsSync(source))throw Error('Backup not found');if(resolve(source)===resolve(dest)||(existsSync(dest)&&realpathSync(source)===realpathSync(dest)))throw Error('Source and destination must differ');
 verifyDatabase(source);mkdirSync(dirname(dest),{recursive:true});
 // Never discard a WAL or SHM file: an active/unclean database must be checkpointed first.
 for(const suffix of ['-wal','-shm','-journal'])if(existsSync(dest+suffix))throw Error('Database sidecar exists; stop/checkpoint database before restore');
 const temp=dest+'.restore-'+stamp();const db=new DatabaseSync(source,{readOnly:true});try{await backup(db,temp);chmodSync(temp,0o600);verifyDatabase(temp);if(existsSync(dest)){const old=dest+'.before-'+stamp();const previous=new DatabaseSync(dest,{readOnly:true});try{await backup(previous,old);chmodSync(old,0o600);}finally{previous.close();}}renameSync(temp,dest);}finally{db.close();if(existsSync(temp))unlinkSync(temp);}
}
export function log(event,fields={}){console.log(JSON.stringify({time:new Date().toISOString(),event,...fields}));}
