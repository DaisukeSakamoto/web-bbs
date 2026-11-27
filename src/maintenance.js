import {snapshot,restoreDatabase,diskStatus,log} from './ops.js';
import {dirname} from 'node:path';
const db=process.env.DB_PATH||'data/bbs.sqlite',folder=process.env.BACKUP_DIR||'backups';
const interval=Number(process.env.BACKUP_INTERVAL_SECONDS||86400),retain=Number(process.env.BACKUP_RETAIN||7),minFree=Number(process.env.MIN_FREE_BYTES||268435456);
if(!Number.isSafeInteger(interval)||interval<60||!Number.isSafeInteger(retain)||retain<1||retain>365||!Number.isSafeInteger(minFree)||minFree<0)throw Error('Invalid maintenance configuration');
async function run(){if(!diskStatus(dirname(db),minFree).ok)throw Error('Database disk low');const dest=await snapshot(db,folder,{retain});log('backup_complete',{file:dest});}
const cmd=process.argv[2];
if(cmd==='backup')await run();
else if(cmd==='restore'){if(!process.argv[3])throw Error('Usage: restore BACKUP --offline');await restoreDatabase(process.argv[3],db,{offline:process.argv.includes('--offline')});log('restore_complete');}
else if(cmd==='schedule'){let stopping=false,timer;for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{stopping=true;clearTimeout(timer);});async function tick(){try{await run();}catch(e){log('backup_failed',{message:e.message});}if(!stopping)timer=setTimeout(tick,interval*1000);}await tick();}
else throw Error('Use backup, restore or schedule');
