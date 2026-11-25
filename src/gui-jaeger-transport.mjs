import {request} from 'node:http';

export function jaegerTransport(value){
  if(typeof value!=='string'||!/^[1-9]\d{3,4}$/.test(value)||Number(value)<1024||Number(value)>65535)return null;
  const port=Number(value);
  // A local port is the only configurable destination component. Do not use
  // fetch, global proxy settings, custom headers, redirects, or DNS here.
  return (body,signal)=>new Promise((resolve,reject)=>{
    const req=request({host:'127.0.0.1',family:4,port,path:'/v1/traces',method:'POST',agent:false,signal,
      headers:{'content-type':'application/json','content-length':Buffer.byteLength(body)}},res=>{
      res.on('error',reject);
      if(res.statusCode<200||res.statusCode>=300){resolve({ok:false});res.destroy();return;}
      if(res.statusCode!==200||!/^application\/json(?:;|$)/i.test(res.headers['content-type']??'')){
        reject(new Error('invalid OTLP response'));res.destroy();return;
      }
      const parts=[];let bytes=0;
      res.on('data',part=>{
        bytes+=part.length;if(bytes>8192){reject(new Error('OTLP response too large'));res.destroy();}else parts.push(part);
      });
      res.on('end',()=>resolve({ok:true,body:new Blob(parts).stream()}));
    });
    req.on('error',reject);req.end(body);
  });
}
