import { DatabaseSync } from 'node:sqlite';
import { randomBytes, createHash } from 'node:crypto';
const hash = s => createHash('sha256').update(s).digest('hex');
export function openDb(path=':memory:') {
 const db=new DatabaseSync(path); db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
 CREATE TABLE IF NOT EXISTS posts(id INTEGER PRIMARY KEY AUTOINCREMENT, parent INTEGER REFERENCES posts(id) ON DELETE CASCADE, title TEXT NOT NULL, body TEXT NOT NULL, owner_hash TEXT NOT NULL, created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);`);
 const clean = (v,max) => { if(typeof v!=='string'||!v.trim()||v.trim().length>max) throw Object.assign(new Error('入力内容を確認してください'),{status:400}); return v.trim(); };
 const idCheck = id => {if(!Number.isSafeInteger(id)||id<1) throw Object.assign(new Error('不正なID'),{status:400});};
 const get = id => {idCheck(id); return db.prepare('SELECT id,parent,title,body,created FROM posts WHERE id=?').get(id);};
 return {close:()=>db.close(), get,
 list(q=''){return db.prepare(`SELECT p.id,p.title,p.body,p.created,(SELECT count(*) FROM posts r WHERE r.parent=p.id) AS replies FROM posts p WHERE p.parent IS NULL AND (instr(p.title,?)>0 OR instr(p.body,?)>0) ORDER BY p.id DESC LIMIT 100`).all(q,q);},
 replies(id){idCheck(id);return db.prepare('SELECT id,parent,title,body,created FROM posts WHERE parent=? ORDER BY id LIMIT 500').all(id);},
 create({title,body,parent=null}){body=clean(body,4000); if(parent!==null){const p=get(parent);if(!p||p.parent!==null)throw Object.assign(new Error('スレッドがありません'),{status:404}); title='';}else title=clean(title,120); const token=randomBytes(32).toString('hex');const result=db.prepare('INSERT INTO posts(parent,title,body,owner_hash) VALUES(?,?,?,?)').run(parent,title,body,hash(token));return {id:Number(result.lastInsertRowid),deleteToken:token};},
 remove(id,token){idCheck(id);if(typeof token!=='string'||! /^[a-f0-9]{64}$/.test(token))return false;return db.prepare('DELETE FROM posts WHERE id=? AND owner_hash=?').run(id,hash(token)).changes===1;}};
}
