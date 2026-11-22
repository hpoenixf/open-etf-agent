const find=id=>document.getElementById(id);
const form=find('login'), scope=find('session'), status=find('status'), password=find('password');
async function refresh(){
  const response=await fetch('/api/account/status');
  if(!response.ok)throw Error('无法确认会话状态。');
  const value=await response.json();form.hidden=value.authenticated;scope.hidden=!value.authenticated;
}
async function submit(path,body){
  const response=await fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  if(!response.ok)throw Error(response.status===429?'请求过于频繁，请稍后再试。':'操作未完成，请重试。');
}
form.addEventListener('submit',async e=>{
  e.preventDefault();const button=form.querySelector('button');button.disabled=true;status.textContent='';
  try{await submit('/api/auth/sign-in/email',{email:find('email').value,password:password.value});await refresh();}
  catch(e){status.textContent=e.message;}
  finally{password.value='';button.disabled=false;}
});
find('logout').addEventListener('click',async e=>{
  const button=e.currentTarget;button.disabled=true;status.textContent='';
  try{await submit('/api/auth/sign-out',{});await refresh();}
  catch(e){status.textContent=e.message;}
  finally{button.disabled=false;}
});
refresh().catch(e=>{status.textContent=e.message;});
