/** 스티커 담벼락 로컬 AI 도우미 — 실행: node ai-helper.js */
const http = require('node:http');

const HOST = '127.0.0.1';
const PORT = 8787;
const ALLOWED_ORIGIN = 'https://joon0noh.github.io';
let config = { apiKey: '', model: 'solar-pro3' };

const setupPage = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>스티커 담벼락 AI 도우미</title><style>body{margin:0;background:#f2f5ff;color:#24213d;font:16px system-ui,sans-serif}.wrap{max-width:640px;margin:7vh auto;padding:28px}.card{background:#fffdf9;border-radius:24px;padding:28px;box-shadow:0 12px 36px #24213d18}h1{margin-top:0}label{display:grid;gap:8px;margin:18px 0;font-weight:700}input{padding:13px;border:1px solid #cbc5e9;border-radius:12px;font:inherit}button{border:0;border-radius:12px;padding:12px 16px;background:#5946d8;color:white;font:inherit;font-weight:800;cursor:pointer}.muted{color:#66627b;line-height:1.6}.ok{color:#18794e}.error{color:#b42318}</style><main class="wrap"><section class="card"><h1>스티커 담벼락 AI 도우미</h1><p class="muted">이 창은 교사 컴퓨터에서만 열립니다. API 키는 실행 중인 메모리에만 보관되며 GitHub·Firebase·파일에는 저장되지 않습니다.</p><form id="form"><label>Upstage API 키<input id="key" type="password" autocomplete="off" placeholder="API 키를 입력하세요" required></label><label>모델 이름<input id="model" value="solar-pro3" autocomplete="off" required></label><button>연결 테스트 및 사용 시작</button></form><p id="result" class="muted">아직 연결하지 않았습니다.</p><hr><p class="muted">수업이 끝나면 이 창을 닫거나 터미널에서 Ctrl+C를 누르면 키가 메모리에서 사라집니다.</p></section></main><script>const f=document.querySelector('#form'),r=document.querySelector('#result');f.onsubmit=async e=>{e.preventDefault();r.className='muted';r.textContent='연결을 확인하고 있어요…';try{const x=await fetch('/configure',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({apiKey:key.value,model:model.value})}),d=await x.json();if(!x.ok)throw Error(d.error);key.value='';r.className='ok';r.textContent='연결되었습니다. 이제 담벼락 교사 화면에서 AI 기능을 사용할 수 있어요.'}catch(e){r.className='error';r.textContent='연결하지 못했습니다: '+e.message}};</script></html>`;

function send(res,status,data,origin){
  const headers={'content-type':'application/json; charset=utf-8'};
  if(origin===ALLOWED_ORIGIN){
    headers['access-control-allow-origin']=ALLOWED_ORIGIN;
    headers['access-control-allow-private-network']='true';
    headers['access-control-allow-methods']='GET, POST, OPTIONS';
    headers['access-control-allow-headers']='content-type';
  }
  res.writeHead(status,headers);
  res.end(status===204?'':JSON.stringify(data));
}
function allowed(origin){return !origin||origin===`http://${HOST}:${PORT}`||origin===ALLOWED_ORIGIN;}
function readJson(req){return new Promise((resolve,reject)=>{let body='';req.on('data',chunk=>{body+=chunk;if(body.length>250000)req.destroy();});req.on('end',()=>{try{resolve(JSON.parse(body||'{}'));}catch{reject(new Error('JSON 형식이 아닙니다.'));}});req.on('error',reject);});}
async function callLlm(instructions,input){
  if(!config.apiKey||!config.model)throw new Error('먼저 로컬 AI 도우미 설정 화면에서 API 키와 모델을 연결하세요.');
  const response=await fetch('https://api.upstage.ai/v1/chat/completions',{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${config.apiKey}`},body:JSON.stringify({model:config.model,messages:[{role:'system',content:instructions},{role:'user',content:JSON.stringify(input)}],max_tokens:700,stream:false})});
  const data=await response.json();
  if(!response.ok)throw new Error(data?.error?.message||'Upstage API 요청에 실패했습니다.');
  return data.choices?.[0]?.message?.content||'요약 결과를 읽지 못했습니다.';
}

const server=http.createServer(async(req,res)=>{
  const origin=req.headers.origin;
  if(req.method==='OPTIONS')return send(res,204,{},origin);
  if(!allowed(origin))return send(res,403,{error:'허용되지 않은 웹사이트 요청입니다.'},origin);
  if(req.method==='GET'&&req.url==='/'){res.writeHead(200,{'content-type':'text/html; charset=utf-8'});return res.end(setupPage);}
  if(req.method==='GET'&&req.url==='/status')return send(res,200,{running:true,configured:Boolean(config.apiKey),model:config.apiKey?config.model:null},origin);
  try{
    const body=await readJson(req);
    if(req.method==='POST'&&req.url==='/configure'){
      if(origin&&origin!==`http://${HOST}:${PORT}`)return send(res,403,{error:'설정은 로컬 도우미 화면에서만 할 수 있습니다.'},origin);
      config={apiKey:String(body.apiKey||'').trim(),model:String(body.model||'solar-pro3').trim()};
      if(!config.apiKey)throw new Error('API 키를 입력해 주세요.');
      await callLlm('연결 테스트입니다. 한국어로 "연결 확인"이라고만 답하세요.',{});
      return send(res,200,{ok:true},origin);
    }
    if(req.method==='POST'&&req.url==='/summary'){
      if(origin!==ALLOWED_ORIGIN)return send(res,403,{error:'담벼락 교사 화면에서만 사용할 수 있습니다.'},origin);
      const result=await callLlm('당신은 초등 교사의 수업 보조자입니다. 제공된 익명 담벼락만 읽고, 학생을 평가·서열화하지 마세요. 출석번호·이름·닉네임을 추정하거나 만들지 마세요. 교사가 수업 중 바로 읽을 수 있게 3문장 이내로 현재 주제와 질문 참여 양상을 따뜻하게 요약하고, 다음 진행 제안 1가지를 덧붙이세요.',body);
      return send(res,200,{result},origin);
    }
    return send(res,404,{error:'없는 요청입니다.'},origin);
  }catch(error){return send(res,400,{error:error.message||'요청을 처리하지 못했습니다.'},origin);}
});
server.listen(PORT,HOST,()=>console.log(`스티커 담벼락 AI 도우미: http://${HOST}:${PORT}`));
