import {createAnalyzer} from './ai.js';
import {randomUUID} from 'node:crypto';
import {installAdmin} from './admin.js';
import express from 'express';
import {fileURLToPath} from 'node:url';
export function createApp(db,{origin='http://localhost:8000',adminPassword='',trustProxy=false,health=()=>true,logger=null,analyze=createAnalyzer(),externalAI=false}={}){
 const app=express();app.disable('x-powered-by');if(trustProxy)app.set('trust proxy',1);
 app.use((req,res,next)=>{const id=randomUUID(),start=Date.now();res.set('X-Request-ID',id);if(logger)res.once('finish',()=>logger('request',{id,method:req.method,status:res.statusCode,durationMs:Date.now()-start}));next();});
 app.get('/healthz',(req,res)=>{res.set('Cache-Control','no-store');try{const ok=db.health()&&health();res.status(ok?200:503).json({status:ok?'ok':'unavailable'});}catch{res.status(503).json({status:'unavailable'});}});
 app.use((req,res,next)=>{res.set({'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});next();});
 // Trust exactly one hop only when isolated behind the configured Nginx proxy.
 const buckets=new Map();app.use('/api',(req,res,next)=>{res.set('Cache-Control','no-store');if(!['GET','HEAD','OPTIONS'].includes(req.method)){if(req.get('origin')!==origin)return res.status(403).json({error:'Origin not allowed'});if(!req.is('application/json'))return res.status(415).json({error:'JSON required'});const now=Date.now();for(const [k,v] of buckets)if(v.until<=now)buckets.delete(k);const k=req.ip;let v=buckets.get(k);if(!v){if(buckets.size>=10000)return res.status(429).json({error:'Try later'});v={until:now+60000,count:0};buckets.set(k,v);}if(++v.count>20)return res.status(429).json({error:'Too many requests'});}next();});
 const smallJson=express.json({limit:'32kb',inflate:false}),uploadJson=express.json({limit:'7mb',inflate:false});
 app.use((req,res,next)=>{const upload=req.method==='POST'&&(/^\/api\/threads\/?$/i.test(req.path)||/^\/api\/threads\/[0-9]+\/comments\/?$/i.test(req.path));return (upload?uploadJson:smallJson)(req,res,next);});
 const withAttachment=p=>({...p,attachment:db.attachmentMeta(p.id),analysis:db.analysis(p.id)});
 app.get('/api/attachments/:id/:variant',(req,res)=>{const a=db.attachment(Number(req.params.id));if(!a)return res.sendStatus(404);if(req.params.variant==='thumbnail'&&a.thumbnail){res.set('Content-Type','image/png');return res.send(Buffer.from(a.thumbnail));}if(req.params.variant!=='download')return res.sendStatus(404);res.attachment(a.name);res.set('Content-Type','application/octet-stream');res.send(Buffer.from(a.data));});
 app.get('/api/threads',(req,res)=>res.json(db.list(typeof req.query.q==='string'?req.query.q.slice(0,120):'').map(withAttachment)));
 app.get('/api/thread-pages',(req,res)=>{const p=db.page(typeof req.query.q==='string'?req.query.q.slice(0,120):'',typeof req.query.category==='string'?req.query.category:'',req.query.page===undefined?1:Number(req.query.page));res.json({...p,items:p.items.map(withAttachment)});});
 app.get('/api/threads/:id',(req,res)=>{const p=db.get(Number(req.params.id));if(!p||p.parent!==null)return res.status(404).json({error:'Not found'});res.json({...withAttachment(p),replies:db.replies(p.id).map(withAttachment)});});
 app.get('/api/info',(req,res)=>res.json({version:'0.6.0',externalAI}));
 app.post('/api/threads',async(req,res)=>{const {title,body,category,attachment,aiConsent}=req.body||{};if(db.paused())return res.status(503).json({error:'投稿は一時停止中です'});if(typeof title!=='string'||!title.trim()||title.trim().length>120||typeof body!=='string'||!body.trim()||body.trim().length>4000)return res.status(400).json({error:'入力内容を確認してください'});if(category!==undefined&&!['auto','general','technology','ai','iot'].includes(category))return res.status(400).json({error:'不正なカテゴリ'});const analysis=await analyze(title.trim(),body.trim(),{external:externalAI&&aiConsent===true});res.status(201).json(db.create({title,body,category:category==='auto'?analysis.category:category,attachment,analysis}));});
 app.post('/api/threads/:id/comments',(req,res)=>res.status(201).json(db.create({body:req.body?.body,parent:Number(req.params.id),attachment:req.body?.attachment})));
 app.delete('/api/posts/:id',(req,res)=>{if(!db.remove(Number(req.params.id),req.body?.deleteToken))return res.status(403).json({error:'削除キーが無効です'});res.sendStatus(204);});
 app.post('/api/posts/:id/report',(req,res)=>res.status(201).json(db.report(Number(req.params.id),req.body?.reason)));
 installAdmin(app,db,{origin,adminPassword});
 app.use('/api',(req,res)=>res.status(404).json({error:'Not found'}));
 app.use(express.static(fileURLToPath(new URL('../public',import.meta.url))));
 app.use((err,req,res,next)=>{const status=Number.isInteger(err.status)&&err.status>=400&&(err.status<500||err.status===503||err.status===507)?err.status:500;if(status===500&&logger)logger('server_error',{requestId:res.get('X-Request-ID')});res.status(status).json({error:status===500?'Server error':err.message});});return app;
}
