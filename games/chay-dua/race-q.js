/* race-q.js – bộ hiển thị câu hỏi (lấy từ game Đổi Vàng, hỗ trợ đủ các dạng câu hỏi của thư viện chung) */
let busy=false,DRG=-1,SK=0,CQ=null,CB=null,RCB=null,IU=null,DQ=null,H=[],ST={ok:0,bad:0},T=[{name:''}],cur=0;const IM={},HW={on:false};
function shuffle(a){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]]}return a}
function modal(h){const m=$('#modal'),b=$('#mbox'),was=m.style.display=='flex';b.innerHTML=h;m.style.display='flex';b.classList.remove('in');void b.offsetWidth;b.classList.add('in');b.scrollTop=0}
function close_(){$('#modal').style.display='none'}
function toQ(r){r=r.map(x=>x==null?'':String(x).trim());const o=r.slice(1,5).filter(Boolean);const a=r[5];let i=-1;
 if(/^[A-Da-d]$/.test(a))i=a.toUpperCase().charCodeAt(0)-65;else if(/^[1-4]$/.test(a))i=+a-1;else i=o.findIndex(x=>x==a);
 return(!r[0]||o.length<2||i<0||i>=o.length)?null:{q:r[0],o,a:i,img:r[6]||''}}
function shO(o,oi,a){const p=shuffle(o.keys()),inv=[];p.forEach((k,n)=>inv[k]=n);let ni=oi;if(oi){ni=Array.isArray(oi)?p.map(k=>oi[k]):Object.fromEntries(p.map((k,n)=>[n,oi[k]]).filter(e=>e[1]))}return{o:p.map(k=>o[k]),oi:ni,a:a.map(v=>inv[v])}}
function norm(x,rt){rt=rt===true;const im=[x.image,x.preImage].find(s=>s)||'',b={q:x.question,img:im,ex:x.explain||'',hint:x.hint||'',imgPos:x.imagePosition,oi:x.optionImages},t=x.type,A=[].concat(x.answer);
 if(t=='single'&&x.options){const r=shO(x.options,b.oi,A);return{...b,oi:r.oi,ty:'single',o:r.o,a:r.a[0]}}
 if(t=='multiple'){const r=shO(x.options,b.oi,A);return{...b,oi:r.oi,ty:'multi',o:r.o,a:r.a}}
 if(t=='list')return{...b,ty:'rows',rows:shuffle(x.items.map(i=>({l:i.label,o:i.options,a:i.answer})))};
 if(t=='matching')return{...b,ty:'rows',rows:shuffle(x.left.map((l,i)=>({l,o:x.right,a:x.correctMap[i]})))};
 if(t=='classify2')return{...b,ty:'slot',items:x.items,zones:x.zones,a:x.answer};
 if(t=='classify')return{...b,ty:'cls',items:x.items,zones:x.zones,a:x.answer};
 if(t=='ordering')return{...b,ty:'ord',items:x.items,a:x.answerOrder||x.items.map((_,i)=>i)};
 if(t=='position')return{...b,ty:'pos',tb:x.toolbar,a:x.answer};
 if(t=='imagepoint'&&x.points)return{...b,ty:'pt',pts:x.points,a:A};
 if(t=='dragfill')return{...b,ty:'fill',tpl:x.template||'',o:x.options,a:x.answer,email:x.layout=='email',ef:x.emailFields,es:x.emailSubject,eg:x.emailGreeting,ec:x.emailContentBlank,esg:x.emailSign};
 if(t=='selectfill'){const r=rt&&Array.isArray(x.options)?shO(x.options,null,[].concat(x.answer)):null;return{...b,ty:'sel',tpl:x.template||'',o:r?r.o:x.options,a:r?r.a:x.answer}}
 SK++;return null}


const IMG_BASE='https://cdn.jsdelivr.net/gh/tinhoc247/ic3-images@main/';
function repoUrl(s){s=String(s||'').trim().replace(/\\/g,'/').replace(/^\.?\//,'');if(!/^image\//i.test(s))s='image/'+s.split('/').pop();return IMG_BASE+encodeURI(s)}
function nm(s){let f=String(s).split(/[\\/]/).pop();try{f=decodeURIComponent(f)}catch(e){}return f.toLowerCase()}
function rs(s){if(!s||/^(data:|https?:|blob:)/.test(s))return s;if(/^lib:/.test(s))return IM['~'+s]||'data:image/gif;base64,R0lGODlhAQABAAAAACw=';const f=nm(s);return IM[f]||IM['~'+f.replace(/\.[^.]+$/,'')]||(HW.base?HW.base.replace(/\/?$/,'/')+s:repoUrl(s))}
function imgH(s,c){return s?`<img class="${c||'qimg'}" src="${esc(rs(s))}" data-s="${esc(s)}" alt="" onerror="imgErr(this)" onclick="this.classList.toggle('zoom')">`:''}
async function preImgs(s){const r=[...new Set(String(s||'').match(/lib:[A-Za-z0-9]+:i\d+/g)||[])].filter(k=>!IM['~'+k]);
 for(let i=0;i<r.length;i+=6)await Promise.all(r.slice(i,i+6).map(async k=>{const[,id,key]=k.split(':');try{const v=await fb(('libimg/'+id+'/'+key));if(typeof v=='string'&&v)IM['~'+k]=v}catch(e){}}))}
async function qLoad(c){const r=(await fb(G('quiz/'+c)))||'[]';await preImgs(r);return JSON.parse(r).map(x=>norm(x)).filter(Boolean)}
function imgErr(e){const x=document.createElement('span');x.className='imgerr';x.textContent='🖼️ Không tải được hình: '+(e.dataset.s||'');e.replaceWith(x)}
function ob(q,i,p){const o=q.oi&&q.oi[i],m=o&&o.src?imgH(o.src,'oimg'):'',t=(p||'')+esc(q.o[i]);return o&&o.position=='after'?t+m:m+t}

function showQ(q,cb,pre,use,dn){DQ=dn?{q,cb,pre,dn}:null;RCB=cb;IU=null;CB=o=>{ST[o?'ok':'bad']++;H.push({q,o,w:T[cur].name});window.SYNC&&SYNC(q,o);cb(o)};const ty=q.ty||'single';CQ=q;q.sel=-1;q.locked=false;q.pp=null;
 const ps=q.imgPos,im=q.img&&ty!='pt'?imgH(q.img):'',qt=`<h3>${esc(q.q||'')}</h3>`;
 let h=`${pre||''}${dn?useBar(use||[],dn):''}`+(ps=='left'||ps=='right'?`<div style="display:flex;gap:10px;align-items:center;flex-direction:${ps=='left'?'row':'row-reverse'}"><div style="flex:0 0 42%">${im}</div><div style="flex:1">${qt}</div></div>`:qt+im);
 if(ty=='pt')h+=q.img?ptHtml(q)+'<div id="fb"></div><button id="chk" onclick="chkPt()" style="margin-top:6px">✔ Kiểm tra đáp án</button>':ptBtns(q);
 else if(ty=='single')h+=q.o.map((o,i)=>`<button class="opt" onclick="pick(${i},${q.a},this)">${ob(q,i)}</button>`).join('');
 else if(ty=='pos')h+=`<div class="tbar">${q.tb.map((b,i)=>`<button class="tb" onclick="pickPos(${i},this)"><span>${esc(b.icon||'')}</span><small>${esc(b.label||'')}</small></button>`).join('')}</div>`;
 else if(ty=='ord'){q.ord=shuffle([...q.items.keys()]);if(q.ord.every((v,p)=>v==q.a[p]))q.ord.reverse();h+=`<div id="ol"></div><div id="fb"></div><button id="chk" onclick="chkOrd()" style="margin-top:6px">✔ Kiểm tra đáp án</button>`}
 else if(ty=='fill'||ty=='slot'||ty=='cls'){fillInit(q);h+=`<div id="fa"></div><div id="fb"></div><button id="chk" onclick="chkFill()" style="margin-top:6px">✔ Kiểm tra đáp án</button>`}
 else if(ty=='sel')h+=`<div class="area" style="text-align:left;line-height:2.3;white-space:pre-line">${esc(q.tpl).replace(/\{(\d+)\}/g,(m,k)=>`<select id="sf${k}"><option value="">- Chọn -</option>${q.o.map((o,j)=>`<option value="${j}">${esc(o)}</option>`).join('')}</select><b id="sm${k}"></b>`)}</div><div id="fb"></div><button id="chk" onclick="chkSel()" style="margin-top:6px">✔ Kiểm tra đáp án</button>`;
 else{if(ty=='rows')h+=q.rows.map((r,i)=>`<div class="rw qr" id="rw${i}"><span>${esc(r.l)}</span><select id="sel${i}"><option value="">- Select -</option>${r.o.map((o,j)=>`<option value="${j}">${esc(o)}</option>`).join('')}</select><b id="mk${i}" class="mk"></b></div>`).join('');
  else h+=q.o.map((o,i)=>`<button class="opt tg" data-i="${i}" onclick="this.classList.toggle('sel')">${ob(q,i)}</button>`).join('');
  h+=`<div id="fb"></div><button id="chk" onclick="check()" style="margin-top:6px">✔ Kiểm tra đáp án</button>`}
 modal(h);if(ty=='ord')ordDraw();if(ty=='fill'||ty=='slot'||ty=='cls')fillDraw()}
function exH(s){return esc(s||'').replace(/&lt;(\/?)(b|i|u)&gt;|&lt;br\s*\/?&gt;/gi,(m,a,t)=>t?'<'+a+t+'>':'<br>')}
function ansBox(l){return l.length?`<div class="ans"><b>✅ Đáp án đúng:</b>${l.map(x=>`<div>${x}</div>`).join('')}</div>`:''}
function fillAns(q){const c=b=>`<b style="color:var(--okc)">${esc(q.ch[q.a[b]])}</b>`;
 if(q.ty=='cls')return q.items.map((t,i)=>q.fl[i]==q.a[i]?'':`${esc(t)} → <b style="color:var(--okc)">${esc(q.zones[q.a[i]].label)}</b>`).filter(Boolean);
 if(q.ty=='slot')return q.items.map((t,i)=>q.ch[q.fl[i]]==q.ch[q.a[i]]?'':`${esc(t)} → ${c(i)}`).filter(Boolean);
 if(q.email)return[...(q.ef||[]).map(f=>`${esc(f.label)}: ${c(f.blank)}`),`Nội dung: ${c(q.ec)}`];
 return[`<span style="white-space:pre-line">${esc(q.tpl).replace(/\{(\d+)\}/g,(m,k)=>c(+k))}</span>`]}
function resHtml(ok,ans){return `<p style="font-size:22px;margin:8px 0"><b>${ok?'🎉 Chính xác!':'😢 Chưa đúng'}</b></p>${ok?'':ans||''}${CQ.ex?`<div class="ex"><b>💡 Giải thích</b><br>${exH(CQ.ex)}</div>`:''}`}
function done(ok,ans){$('#fb').innerHTML=resHtml(ok,ans);$('#chk').outerHTML=`<button onclick="CB(${ok})">Tiếp tục</button>`}
function warn(m){$('#fb').innerHTML=`<p style="color:var(--badc);font-size:18px;font-weight:700">${m}</p>`}
function pickPos(i,el){if(busy)return;busy=true;const A=[].concat(CQ.a),ok=A.includes(i),bs=document.querySelectorAll('.tb');el.classList.add(ok?'ok':'bad');if(!ok)A.forEach(a=>bs[a]&&bs[a].classList.add('ok'));setTimeout(()=>{busy=false;CB(ok)},1100)}
function ordDraw(){const q=CQ;$('#ol').innerHTML=q.ord.map((ix,p)=>`<div class="oi${q.locked?(q.items[ix]==q.items[q.a[p]]?' ok':' bad'):''}" draggable="true" ondragstart="DRG=${p}" ondragover="event.preventDefault()" ondrop="ordMv(DRG,${p}-DRG)"><b>${p+1}</b><span>${esc(q.items[ix])}</span>${q.locked?'':`<button class="mini" onclick="ordMv(${p},-1)">▲</button><button class="mini" onclick="ordMv(${p},1)">▼</button>`}</div>`).join('')}
function ordMv(p,d){const q=CQ,t=p+d;if(q.locked||p<0||t<0||t>=q.ord.length)return;const[x]=q.ord.splice(p,1);q.ord.splice(t,0,x);ordDraw()}
function chkOrd(){const q=CQ,ok=q.ord.every((ix,p)=>q.items[ix]==q.items[q.a[p]]);q.locked=true;ordDraw();done(ok,ansBox(q.a.map((i,p)=>(p+1)+'. '+esc(q.items[i]))))}
function fillInit(q){if(q.ty=='fill'){q.n=q.a.length;q.ch=q.o;q.re=false}else if(q.ty=='slot'){q.n=q.items.length;q.ch=q.zones.map(z=>z.label);q.re=true}else{q.n=q.items.length;q.ch=q.items;q.re=false}
 q.fl=Array(q.n).fill(-1);q.cord=shuffle([...q.ch.keys()])}
function fillDraw(){const q=CQ,L=q.locked,used=new Set(q.ty=='cls'?q.fl.map((z,i)=>z>=0?i:-1):q.re?[]:q.fl);
 const chip=c=>`<span class="chip${q.sel==c?' on':''}" draggable="true" ondragstart="DRG=${c}" onclick="chipClick(${c})"${q.ty=='slot'?` style="background:${q.zones[c].color}"`:''}>${esc(q.ch[c])}</span>`;
 const bl=b=>{const v=q.fl[b],ok=L&&q.ch[v]==q.ch[q.a[b]];return `<span class="bl${L?(ok?' ok':' bad'):''}" onclick="blClick(${b})" ondragover="event.preventDefault()" ondrop="blDrop(${b})">${v>=0?esc(q.ch[v]):'&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'}</span>`};
 let h='';
 if(q.ty=='fill')h=q.email?`<div class="mail">${(q.ef||[]).map(f=>`<div><b>${esc(f.label)}:</b> ${bl(f.blank)}</div>`).join('')}<div><b>Chủ đề:</b> ${esc(q.es||'')}</div><hr><div>${esc(q.eg||'')}</div><div style="margin:6px 0">${bl(q.ec)}</div><div>${esc(q.esg||'')}</div></div>`:`<div class="area" style="text-align:left;line-height:2.4;white-space:pre-line">${esc(q.tpl).replace(/\{(\d+)\}/g,(m,k)=>bl(+k))}</div>`;
 else if(q.ty=='slot')h=q.items.map((t,i)=>`<div class="rw" style="justify-content:flex-start;gap:10px">${bl(i)}<span>${esc(t)}</span></div>`).join('');
 else h=q.zones.map((z,k)=>`<div class="zone" style="border-color:${z.color}" onclick="zoneDrop(${k},CQ.sel)" ondragover="event.preventDefault()" ondrop="zoneDrop(${k})"><b style="color:${z.color}">${esc(z.label)}</b><div>${q.fl.map((v,i)=>v==k?`<span class="chip${L?(q.a[i]==k?' ok':' bad'):''}" onclick="event.stopPropagation();unpl(${i})">${esc(q.items[i])}</span>`:'').join('')}</div></div>`).join('');
 $('#fa').innerHTML=`<div class="tray">${q.cord.filter(c=>!used.has(c)).map(chip).join('')||''}</div>`+h}
function chipClick(c){const q=CQ;if(q.locked)return;q.sel=q.sel==c?-1:c;fillDraw()}
function put(b,c){const q=CQ;if(q.locked||c<0)return;if(!q.re)q.fl=q.fl.map(v=>v==c?-1:v);q.fl[b]=c;q.sel=-1;fillDraw()}
function blClick(b){const q=CQ;if(q.locked)return;if(q.sel>=0)put(b,q.sel);else{q.fl[b]=-1;fillDraw()}}
function blDrop(b){put(b,DRG)}
function zoneDrop(k,c){const q=CQ;if(c===undefined)c=DRG;if(q.locked||c<0)return;q.fl[c]=k;q.sel=-1;fillDraw()}
function unpl(i){if(!CQ.locked){CQ.fl[i]=-1;fillDraw()}}
function chkFill(){const q=CQ;if(q.fl.includes(-1))return warn('Hãy điền/xếp đủ tất cả các ô.');q.locked=true;fillDraw();const ok=q.ty=='cls'?q.fl.every((v,i)=>v==q.a[i]):q.fl.every((v,b)=>q.ch[v]==q.ch[q.a[b]]);done(ok,ansBox(ok?[]:fillAns(q)))}
function chkSel(){const q=CQ,v=q.a.map((_,k)=>$('#sf'+k)?$('#sf'+k).value:'x');if(v.includes(''))return warn('Hãy chọn đủ tất cả các chỗ trống.');let ok=true;q.a.forEach((a,k)=>{const g=q.o[+v[k]]==q.o[a];ok=ok&&g;$('#sm'+k).textContent=g?' ✅':' ❌';$('#sf'+k).disabled=true});done(ok,ansBox([`<span style="white-space:pre-line">${esc(q.tpl).replace(/\{(\d+)\}/g,(m,k)=>`<b style="color:var(--okc)">${esc(q.o[q.a[k]])}</b>`)}</span>`]))}
function ptHtml(q){return `<div id="ipb" style="position:relative;display:inline-block;max-width:100%"><img src="${esc(rs(q.img))}" alt="" style="max-width:100%;max-height:48vh;display:block;border-radius:8px;cursor:default" onclick="ptClick(event)" onerror="ptFail()"></div>`}
const PX=p=>p.x!=null?p.x:100-(p.right||0)-(p.width||0);
function ptClick(ev){const q=CQ;if(q.locked)return;const r=ev.currentTarget.getBoundingClientRect(),x=(ev.clientX-r.left)/r.width*100,y=(ev.clientY-r.top)/r.height*100,b=$('#ipb');q.pp={x,y};
 b.querySelectorAll('.pm').forEach(e=>e.remove());
 b.insertAdjacentHTML('beforeend',`<div class="pm" style="position:absolute;left:${x}%;top:${y}%;width:18px;height:18px;margin:-9px;border-radius:50%;border:3px solid #f97316;background:#fff8;pointer-events:none"></div>`);$('#fb').innerHTML=''}
function chkPt(){const q=CQ;if(!q.pp)return warn('Hãy nhấp vào một vị trí trên hình (có thể nhấp lại để chọn lại).');q.locked=true;const{x,y}=q.pp,b=$('#ipb'),
 hit=q.pts.findIndex(p=>p.width==null?Math.hypot(x-PX(p),y-p.y)<5:(x>=PX(p)&&x<=PX(p)+p.width&&y>=p.y&&y<=p.y+p.height)),ok=hit>=0&&q.a.includes(hit);
 b.querySelector('.pm').style.borderColor=ok?'#22c55e':'#ef4444';
 if(!ok)q.a.forEach(i=>{const p=q.pts[i],c=p.width==null;b.insertAdjacentHTML('beforeend',`<div style="position:absolute;left:${PX(p)-(c?5:0)}%;top:${p.y-(c?5:0)}%;width:${p.width??10}%;height:${p.height??10}%;border:3px dashed #22c55e;background:#22c55e33;border-radius:4px;pointer-events:none"></div>`)});
 done(ok,ansBox(q.a.map(i=>esc(q.pts[i].label||'Vùng khoanh xanh trên hình'))))}
function ptBtns(q,m){return (m?`<div class="imgerr" style="font-size:16px;margin:6px 0">${m}</div>`:'')+q.pts.map((p,i)=>`<button class="opt" onclick="pick(${i},${q.a.includes(i)?i:q.a[0]},this)">${esc(p.label||i+1)}</button>`).join('')}
function ptFail(){const q=CQ;const cb_=$('#chk');if(cb_)cb_.remove();$('#ipb').outerHTML=ptBtns(q,`Không tải được hình (${esc(q.img)}). Hãy chọn đáp án:`)}
function pick(i,a,el){if(busy)return;const bs=document.querySelectorAll('.opt'),ok=i==a;bs[a].classList.add('ok');if(!ok)el.classList.add('bad');
 if(CQ&&CQ.ex){bs.forEach(b=>b.disabled=true);let f=$('#fb');if(!f){f=document.createElement('div');f.id='fb';$('#mbox').appendChild(f)}
  f.innerHTML=resHtml(ok)+`<button onclick="CB(${ok})">Tiếp tục</button>`;return}
 busy=true;setTimeout(()=>{busy=false;CB(ok)},ok?900:1500)}
function check(){const q=CQ;let ok=true,m='';
 if(q.ty=='rows'){const v=q.rows.map((r,i)=>$('#sel'+i).value);if(v.includes(''))m='Hãy chọn đủ đáp án cho tất cả các dòng.';else q.rows.forEach((r,i)=>{const g=[].concat(r.a).includes(+v[i]);ok=ok&&g;$('#mk'+i).innerHTML=g?'<span style="color:var(--okc)">✅ Chính xác</span>':'<span style="color:var(--badc)">❌ Chưa đúng.</span> Đáp án đúng: <b style="color:var(--okc)">'+esc(r.o[[].concat(r.a)[0]])+'</b>';$('#rw'+i).classList.add(g?'ok':'bad');$('#sel'+i).disabled=true})}
 else{const s=[...document.querySelectorAll('.tg')],v=s.filter(b=>b.classList.contains('sel')).map(b=>+b.dataset.i);if(!v.length)m='Hãy chọn ít nhất 1 đáp án.';else{ok=v.length==q.a.length&&v.every(i=>q.a.includes(i));s.forEach((b,i)=>{b.disabled=true;if(q.a.includes(i))b.classList.add('ok');else if(v.includes(i))b.classList.add('bad')})}}
 if(m){$('#fb').innerHTML=`<p style="color:var(--badc);font-size:18px;font-weight:700">${m}</p>`;return}
 done(ok,q.ty=='rows'?'':ansBox(q.a.map(i=>esc(q.o[i]))))}


