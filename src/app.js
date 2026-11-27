import {installAdmin} from './admin.js';
import express from 'express';
import {fileURLToPath} from 'node:url';
export function createApp(db,{origin='http://localhost:8000',adminPassword=''}={}){
 const app=express();app.disable('x-powered-by');
 app.use((req,res,next)=>{res.set({'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});next();});
 // No proxy trust by default. Behind a reverse proxy, rate limits apply to the proxy as a whole.
 const buckets=new Map();app.use('/api',(req,res,next)=>{res.set('Cache-Control','no-store');if(!['GET','HEAD','OPTIONS'].includes(req.method)){if(req.get('origin')!==origin)return res.status(403).json({error:'Origin not allowed'});if(!req.is('application/json'))return res.status(415).json({error:'JSON required'});const now=Date.now();for(const [k,v] of buckets)if(v.until<=now)buckets.delete(k);const k=req.ip;let v=buckets.get(k);if(!v){if(buckets.size>=10000)return res.status(429).json({error:'Try later'});v={until:now+60000,count:0};buckets.set(k,v);}if(++v.count>20)return res.status(429).json({error:'Too many requests'});}next();});
 const smallJson=express.json({limit:'32kb',inflate:false}),uploadJson=express.json({limit:'7mb',inflate:false});
 app.use((req,res,next)=>{const upload=req.method==='POST'&&(/^\/api\/threads\/?$/i.test(req.path)||/^\/api\/threads\/[0-9]+\/comments\/?$/i.test(req.path));return (upload?uploadJson:smallJson)(req,res,next);});
 const withAttachment=p=>({...p,attachment:db.attachmentMeta(p.id)});
 app.get('/api/attachments/:id/:variant',(req,res)=>{const a=db.attachment(Number(req.params.id));if(!a)return res.sendStatus(404);if(req.params.variant==='thumbnail'&&a.thumbnail){res.set('Content-Type','image/png');return res.send(Buffer.from(a.thumbnail));}if(req.params.variant!=='download')return res.sendStatus(404);res.attachment(a.name);res.set('Content-Type','application/octet-stream');res.send(Buffer.from(a.data));});
 app.get('/api/threads',(req,res)=>res.json(db.list(typeof req.query.q==='string'?req.query.q.slice(0,120):'').map(withAttachment)));
 app.get('/api/thread-pages',(req,res)=>{const p=db.page(typeof req.query.q==='string'?req.query.q.slice(0,120):'',typeof req.query.category==='string'?req.query.category:'',req.query.page===undefined?1:Number(req.query.page));res.json({...p,items:p.items.map(withAttachment)});});
 app.get('/api/threads/:id',(req,res)=>{const p=db.get(Number(req.params.id));if(!p||p.parent!==null)return res.status(404).json({error:'Not found'});res.json({...withAttachment(p),replies:db.replies(p.id).map(withAttachment)});});
 app.post('/api/threads',(req,res)=>res.status(201).json(db.create({title:req.body?.title,body:req.body?.body,category:req.body?.category,attachment:req.body?.attachment})));
 app.post('/api/threads/:id/comments',(req,res)=>res.status(201).json(db.create({body:req.body?.body,parent:Number(req.params.id),attachment:req.body?.attachment})));
 app.delete('/api/posts/:id',(req,res)=>{if(!db.remove(Number(req.params.id),req.body?.deleteToken))return res.status(403).json({error:'削除キーが無効です'});res.sendStatus(204);});
 app.post('/api/posts/:id/report',(req,res)=>res.status(201).json(db.report(Number(req.params.id),req.body?.reason)));
 installAdmin(app,db,{origin,adminPassword});
 app.use('/api',(req,res)=>res.status(404).json({error:'Not found'}));
 app.use(express.static(fileURLToPath(new URL('../public',import.meta.url))));
 app.use((err,req,res,next)=>{const status=Number.isInteger(err.status)&&err.status>=400&&(err.status<500||err.status===503||err.status===507)?err.status:500;res.status(status).json({error:status===500?'Server error':err.message});});return app;
}
