import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {openDb} from './db.js';
import {createApp} from './app.js';
const port=Number(process.env.PORT||8000), path=process.env.DB_PATH||'data/bbs.sqlite';
mkdirSync(dirname(path),{recursive:true});const db=openDb(path);const server=createApp(db,{adminPassword:process.env.ADMIN_PASSWORD||'',origin:process.env.PUBLIC_ORIGIN||`http://localhost:${port}`}).listen(port,'0.0.0.0',()=>console.log(`Listening on ${port}`));
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>server.close(()=>{db.close();process.exit(0);}));
