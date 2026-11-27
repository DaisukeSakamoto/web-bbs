import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
const digest=v=>createHash('sha256').update(v).digest();
export function installAdmin(app,db,{adminPassword='',origin}){
 const enabled=typeof adminPassword==='string'&&adminPassword.length>=20&&adminPassword.length<=256;
 const secure=origin.startsWith('https://'), sessions=new Map(), attempts=new Map();
 const cookie='bbs_admin', ttl=3600000;
 const token=req=>{const values=(req.headers.cookie||'').split(';').map(s=>s.trim()).filter(s=>s.startsWith(cookie+'='));return values.length===1?values[0].slice(cookie.length+1):'';};
 const key=t=>digest(t).toString('hex');
 const opts={httpOnly:true,secure,sameSite:'strict',path:'/api/admin'};
 function prune(now){for(const [k,v] of sessions)if(v<=now)sessions.delete(k);for(const [k,v] of attempts)if(v.until<=now)attempts.delete(k);}
 function auth(req,res,next){if(!enabled)return res.status(503).json({error:'管理者機能は未設定です'});const t=token(req);if(!/^[a-f0-9]{64}$/.test(t)||!(sessions.get(key(t))>Date.now()))return res.status(401).json({error:'ログインしてください'});next();}
 app.post('/api/admin/login',(req,res)=>{if(!enabled)return res.status(503).json({error:'管理者機能は未設定です'});const now=Date.now();prune(now);let a=attempts.get(req.ip);if(!a){if(attempts.size>=10000)return res.sendStatus(429);a={count:0,until:now+900000};attempts.set(req.ip,a);}if(++a.count>5)return res.status(429).json({error:'ログイン試行回数超過'});const p=req.body?.password;if(typeof p!=='string'||p.length>256||!timingSafeEqual(digest(p),digest(adminPassword)))return res.status(401).json({error:'認証失敗'});if(sessions.size>=1000)return res.sendStatus(503);const old=token(req);if(old)sessions.delete(key(old));const t=randomBytes(32).toString('hex');sessions.set(key(t),now+ttl);res.cookie(cookie,t,{...opts,maxAge:ttl});res.json({ok:true});});
 app.use('/api/admin',auth);
 app.post('/api/admin/logout',(req,res)=>{sessions.delete(key(token(req)));res.clearCookie(cookie,opts);res.sendStatus(204);});
 app.get('/api/admin/dashboard',(req,res)=>res.json(db.dashboard()));
 app.delete('/api/admin/attachments/:id',(req,res)=>{if(!db.adminRemoveAttachment(Number(req.params.id)))return res.sendStatus(404);res.sendStatus(204);});
 app.delete('/api/admin/posts/:id',(req,res)=>{if(!db.adminRemove(Number(req.params.id)))return res.sendStatus(404);res.sendStatus(204);});
 app.post('/api/admin/reports/:id/resolve',(req,res)=>{if(!db.resolveReport(Number(req.params.id)))return res.sendStatus(404);res.sendStatus(204);});
 app.put('/api/admin/settings',(req,res)=>{db.setPaused(req.body?.paused);res.json({paused:db.paused()});});
}
