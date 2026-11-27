import {inflateSync,deflateSync} from 'node:zlib';
import {TextDecoder} from 'node:util';
export const MAX_FILE=5*1024*1024, MAX_STORAGE=100*1024*1024;
const signature=Buffer.from([137,80,78,71,13,10,26,10]);
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const crcTable=Array.from({length:256},(_,i)=>{for(let j=0;j<8;j++)i=i&1?0xedb88320^(i>>>1):i>>>1;return i>>>0;});
function crc(b){let c=0xffffffff;for(const x of b)c=crcTable[(c^x)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
function chunk(type,data){const b=Buffer.concat([Buffer.from(type),data]),n=Buffer.alloc(4),end=Buffer.alloc(4);n.writeUInt32BE(data.length);end.writeUInt32BE(crc(b));return Buffer.concat([n,b,end]);}
function encode(w,h,pixels){const head=Buffer.alloc(13);head.writeUInt32BE(w);head.writeUInt32BE(h,4);head[8]=8;head[9]=6;const raw=Buffer.alloc((w*4+1)*h);for(let y=0;y<h;y++)pixels.copy(raw,y*(w*4+1)+1,y*w*4,(y+1)*w*4);return Buffer.concat([signature,chunk('IHDR',head),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);}
function paeth(a,b,c){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;}
function png(data){
 if(!data.subarray(0,8).equals(signature))fail('PNG signature mismatch',415);
 let pos=8,w=0,h=0,bpp=0,ended=false,seenData=false,closedData=false;const parts=[];
 while(pos+12<=data.length){const len=data.readUInt32BE(pos);if(len>data.length-pos-12)fail('Invalid PNG');const type=data.toString('ascii',pos+4,pos+8),v=data.subarray(pos+8,pos+8+len);if(crc(data.subarray(pos+4,pos+8+len))!==data.readUInt32BE(pos+8+len))fail('Invalid PNG CRC');if(pos===8&&type!=='IHDR')fail('Invalid PNG header');pos+=12+len;
 if(type==='IHDR'){if(w||len!==13)fail('Invalid PNG header');w=v.readUInt32BE(0);h=v.readUInt32BE(4);if(!w||!h||w>4096||h>4096||w*h>4000000)fail('Image dimensions too large',413);if(v[8]!==8||![2,6].includes(v[9])||v[10]||v[11]||v[12])fail('Only non-interlaced RGB/RGBA 8-bit PNG supported',415);bpp=v[9]===2?3:4;}
 else if(type==='IDAT'){if(!w||closedData)fail('Invalid PNG data');seenData=true;parts.push(v);}
 else if(type==='IEND'){if(len||!seenData||pos!==data.length)fail('Invalid PNG end');ended=true;break;}
 else {if(seenData)closedData=true;if(type==='tRNS'||type==='acTL'||type==='fcTL'||type==='fdAT'||(type[0]===type[0].toUpperCase()&&type!=='PLTE'))fail('Unsupported PNG chunk',415);}
 }
 if(!ended)fail('Incomplete PNG');
 const stride=w*bpp,expected=(stride+1)*h;let raw;try{raw=inflateSync(Buffer.concat(parts),{maxOutputLength:expected});}catch{fail('Invalid compressed PNG');}if(raw.length!==expected)fail('Invalid PNG size');
 const decoded=Buffer.alloc(stride*h),rgba=Buffer.alloc(w*h*4);
 for(let y=0;y<h;y++){const filter=raw[y*(stride+1)];if(filter>4)fail('Invalid PNG filter');for(let x=0;x<stride;x++){const i=y*stride+x,a=x>=bpp?decoded[i-bpp]:0,b=y?decoded[i-stride]:0,c=y&&x>=bpp?decoded[i-stride-bpp]:0;decoded[i]=(raw[y*(stride+1)+1+x]+[0,a,b,Math.floor((a+b)/2),paeth(a,b,c)][filter])&255;}}
 for(let i=0,j=0;i<decoded.length;i+=bpp,j+=4){rgba[j]=decoded[i];rgba[j+1]=decoded[i+1];rgba[j+2]=decoded[i+2];rgba[j+3]=bpp===4?decoded[i+3]:255;}
 const scale=Math.min(1,320/Math.max(w,h)),tw=Math.max(1,Math.round(w*scale)),th=Math.max(1,Math.round(h*scale)),thumb=Buffer.alloc(tw*th*4);
 for(let y=0;y<th;y++)for(let x=0;x<tw;x++){const i=(Math.floor(y*h/th)*w+Math.floor(x*w/tw))*4;rgba.copy(thumb,(y*tw+x)*4,i,i+4);}
 return {data:encode(w,h,rgba),thumbnail:encode(tw,th,thumb)};
}
export function validateAttachment(file){
 if(file===undefined||file===null)return null;
 if(typeof file!=='object'||Array.isArray(file)||typeof file.name!=='string'||typeof file.mime!=='string'||typeof file.base64!=='string')fail('Invalid attachment');
 const name=file.name.normalize('NFC');if(!name||name.length>120||/[\\/\x00-\x1f\x7f]/u.test(name)||name==='.'||name==='..')fail('Invalid filename');
 const s=file.base64;if(s.length>Math.ceil(MAX_FILE/3)*4)fail('File exceeds 5 MiB',413);
 if(!s||s.length%4||!/^[A-Za-z0-9+/]*={0,2}$/.test(s))fail('Invalid base64');
 const bytes=Buffer.from(s,'base64');if(bytes.toString('base64')!==s)fail('Invalid base64');if(bytes.length>MAX_FILE)fail('File exceeds 5 MiB',413);
 let result;
 if(file.mime==='image/png'&&/\.png$/i.test(name))result=png(bytes);
 else if(file.mime==='text/plain'&&/\.txt$/i.test(name)){try{const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);if(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/u.test(text))fail('Invalid text');}catch{fail('Invalid UTF-8 text',415);}result={data:bytes,thumbnail:null};}
 else fail('Unsupported file type: PNG or UTF-8 TXT only',415);
 if(result.data.length>MAX_FILE)fail('Processed file exceeds 5 MiB',413);
 return {name,mime:file.mime,...result};
}
