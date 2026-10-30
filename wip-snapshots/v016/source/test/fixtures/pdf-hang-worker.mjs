// Lifecycle fixture only; not a substitute for real PDF extraction.
process.on('message',()=>{process.send({kind:'ready'});setInterval(()=>{},1000);});
