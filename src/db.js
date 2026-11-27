import { DatabaseSync } from 'node:sqlite';
import { randomBytes, createHash } from 'node:crypto';
const hash = s => createHash('sha256').update(s).digest('hex');
export function openDb(path=':memory:') {
 const db=new DatabaseSync(path); db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
 CREATE TABLE IF NOT EXISTS posts(id INTEGER PRIMARY KEY AUTOINCREMENT, parent INTEGER REFERENCES posts(id) ON DELETE CASCADE, title TEXT NOT NULL, body TEXT NOT NULL, owner_hash TEXT NOT NULL, created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);`);
 if(!db.prepare('PRAGMA table_info(posts)').all().some(c=>c.name==='category')) db.exec("ALTER TABLE posts ADD COLUMN category TEXT NOT NULL DEFAULT 'general'");
 db.exec('CREATE INDEX IF NOT EXISTS posts_category ON posts(parent,category,id)');
 const categories=['general','technology','ai','iot'];
 const clean = (v,max) => { if(typeof v!=='string'||!v.trim()||v.trim().length>max) throw Object.assign(new Error('入力内容を確認してください'),{status:400}); return v.trim(); };
 const idCheck = id => {if(!Number.isSafeInteger(id)||id<1) throw Object.assign(new Error('不正なID'),{status:400});};
 const get = id => {idCheck(id); return db.prepare('SELECT id,parent,title,body,created,category FROM posts WHERE id=?').get(id);};
 const filter=(q,category)=>{if(category&&!categories.includes(category))throw Object.assign(new Error('不正なカテゴリ'),{status:400});return [q,q,category,category];};
 return {close:()=>db.close(), get,
 page(q='',category='',page=1){if(!Number.isSafeInteger(page)||page<1||page>1000000)throw Object.assign(new Error('不正なページ'),{status:400});const args=filter(q,category);const where="p.parent IS NULL AND (instr(p.title,?)>0 OR instr(p.body,?)>0) AND (?='' OR p.category=?)";const total=db.prepare('SELECT count(*) AS n FROM posts p WHERE '+where).get(...args).n;const items=db.prepare('SELECT p.id,p.title,p.body,p.created,p.category,(SELECT count(*) FROM posts r WHERE r.parent=p.id) AS replies FROM posts p WHERE '+where+' ORDER BY p.id DESC LIMIT 20 OFFSET ?').all(...args,(page-1)*20);return {items,total,page,pageSize:20};},
 list(q=''){return db.prepare(`SELECT p.id,p.title,p.body,p.created,(SELECT count(*) FROM posts r WHERE r.parent=p.id) AS replies FROM posts p WHERE p.parent IS NULL AND (instr(p.title,?)>0 OR instr(p.body,?)>0) ORDER BY p.id DESC LIMIT 100`).all(q,q);},
 replies(id){idCheck(id);return db.prepare('SELECT id,parent,title,body,created FROM posts WHERE parent=? ORDER BY id LIMIT 500').all(id);},
 create({title,body,parent=null,category='general'}){body=clean(body,4000); if(parent!==null){const p=get(parent);if(!p||p.parent!==null)throw Object.assign(new Error('スレッドがありません'),{status:404}); title='';category=p.category;}else title=clean(title,120);if(!categories.includes(category))throw Object.assign(new Error('不正なカテゴリ'),{status:400}); const token=randomBytes(32).toString('hex');const result=db.prepare('INSERT INTO posts(parent,title,body,owner_hash,category) VALUES(?,?,?,?,?)').run(parent,title,body,hash(token),category);return {id:Number(result.lastInsertRowid),deleteToken:token};},
 remove(id,token){idCheck(id);if(typeof token!=='string'||! /^[a-f0-9]{64}$/.test(token))return false;return db.prepare('DELETE FROM posts WHERE id=? AND owner_hash=?').run(id,hash(token)).changes===1;}};
}
