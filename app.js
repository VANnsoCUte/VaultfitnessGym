(function(){
var PLANS={daily:{label:"Daily pass",days:0},half:{label:"Half month",days:15},monthly:{label:"Monthly",months:1},quarterly:{label:"Quarterly",months:3},yearly:{label:"Yearly",months:12}};
var KEY="gym-system-v1";
var state={clients:[],visits:[]};
var ui={filter:"all",view:"members",q:"",armed:null,renewId:null,photoId:null,newPhoto:""};

function load(){try{var raw=localStorage.getItem(KEY);if(raw){var d=JSON.parse(raw);if(d&&d.clients&&d.visits)state=d;}}catch(e){}}
function save(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch(e){}if(window.gymApp&&window.gymApp.onSave)window.gymApp.onSave(state);}
function pad(n){return n<10?"0"+n:""+n}
function fmt(d){return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())}
function parse(s){var p=s.split("-").map(Number);return new Date(p[0],p[1]-1,p[2])}
function today(){return fmt(new Date())}
function addPlan(startStr,plan){var d=parse(startStr),p=PLANS[plan];if(p.days!==undefined)d.setDate(d.getDate()+p.days);else d.setMonth(d.getMonth()+p.months);return fmt(d)}
function daysLeft(exp){return Math.round((parse(exp)-parse(today()))/864e5)}
function fDate(s){return parse(s).toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"})}
function fTime(ts){return new Date(ts).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})}
function fDay(ts){return new Date(ts).toLocaleDateString(undefined,{month:"short",day:"numeric"})}
function dur(ms){var m=Math.max(0,Math.round(ms/60000)),h=Math.floor(m/60);return h?h+" h "+(m%60)+" min":m+" min"}
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,6)}
function status(c){var d=daysLeft(c.expiry);return d<0?"expired":(d<=3&&c.plan!=="daily")?"expiring":"active"}
function openVisit(cid){for(var i=state.visits.length-1;i>=0;i--){var v=state.visits[i];if(v.cid===cid&&!v.out)return v}return null}
function $(id){return document.getElementById(id)}

var toastT;
function toast(m){var t=$("toast");t.textContent=m;t.classList.add("show");clearTimeout(toastT);toastT=setTimeout(function(){t.classList.remove("show")},2600)}

function badgeFor(c){
  var d=daysLeft(c.expiry),s=status(c);
  if(c.plan==="daily"&&d===0)return '<span class="badge b-ok">Daily pass, valid today</span>';
  if(s==="expired")return '<span class="badge b-bad">Expired '+(d===-1?"yesterday":(-d)+" days ago")+'</span>';
  if(s==="expiring")return '<span class="badge b-warn">'+(d===0?"Expires today":d===1?"Expires tomorrow":"Expires in "+d+" days")+'</span>';
  return '<span class="badge b-ok">Active, '+d+' days left</span>';
}

function renderStats(){
  var a=0,e=0,x=0,i=0;
  state.clients.forEach(function(c){var s=status(c);if(s==="expired"){if(c.plan!=="daily")x++}else{if(c.plan!=="daily")a++;if(s==="expiring")e++}if(openVisit(c.id))i++});
  $("sActive").textContent=a;$("sExpiring").textContent=e;$("sExpired").textContent=x;$("sInside").textContent=i;
}

function renderTabs(){
  var n={all:state.clients.length,active:0,expiring:0,expired:0,inside:0,walkin:0};
  state.clients.forEach(function(c){var s=status(c);if(c.plan==="daily")n.walkin++;if(s==="expired"){if(c.plan!=="daily")n.expired++}else{if(c.plan!=="daily")n.active++;if(s==="expiring")n.expiring++}if(openVisit(c.id))n.inside++});
  var defs=[["all","All"],["active","Active"],["expiring","Expiring"],["expired","Expired"],["inside","Inside now"],["walkin","Walk-ins"]];
  $("tabs").innerHTML=defs.map(function(d){return '<button class="tab" data-tab="'+d[0]+'" aria-pressed="'+(ui.filter===d[0])+'">'+d[1]+" ("+n[d[0]]+")</button>"}).join("");
  $("tabs").style.display=ui.view==="members"?"flex":"none";
}

function renderMembers(){
  var q=ui.q.trim().toLowerCase();
  var rows=state.clients.filter(function(c){
    if(q&&c.name.toLowerCase().indexOf(q)<0&&(c.phone||"").toLowerCase().indexOf(q)<0)return false;
    var s=status(c),f=ui.filter;
    if(f==="walkin")return c.plan==="daily";
    if(f==="active")return s!=="expired"&&c.plan!=="daily";
    if(f==="expiring")return s==="expiring";
    if(f==="expired")return s==="expired"&&c.plan!=="daily";
    if(f==="inside")return !!openVisit(c.id);
    return true;
  }).sort(function(a,b){return a.name.localeCompare(b.name)});
  if(!state.clients.length){
    $("list").innerHTML='<div class="empty">No clients yet. Add the first one using the form, or load a few examples to try the system.<br><button data-act="sample">Load sample clients</button></div>';return;
  }
  if(!rows.length){$("list").innerHTML='<div class="empty">No clients match this filter.</div>';return}
  $("list").innerHTML=rows.map(function(c){
    var s=status(c),v=openVisit(c.id),exp=s==="expired";
    var inb=v?'<span class="badge b-in">Inside since '+fTime(v.in)+'</span>':"";
    var act=v?'<button class="out" data-act="out" data-id="'+c.id+'">Time out</button>':'<button class="in" data-act="in" data-id="'+c.id+'"'+(exp?' title="Subscription expired"':"")+'>Time in</button>';
    var del=ui.armed===c.id?'<button class="armed" data-act="del" data-id="'+c.id+'">Tap again to delete</button>':'<button class="danger" data-act="del" data-id="'+c.id+'">Delete</button>';
    return '<article class="row"><div class="who">'+avatar(c)+'<div><strong>'+esc(c.name)+'</strong><span class="sub">'+(esc(c.phone)||"No phone")+'</span></div></div>'+
      '<div><div>'+PLANS[c.plan].label+'</div><span class="sub">'+fDate(c.start)+' to '+fDate(c.expiry)+'</span></div>'+
      '<div class="badges">'+badgeFor(c)+inb+'</div>'+
      '<div class="acts">'+act+'<button data-act="qr" data-id="'+c.id+'">QR code</button><button data-act="renew" data-id="'+c.id+'">'+(exp?"Renew now":"Renew")+'</button>'+del+'</div></article>';
  }).join("");
}

function renderLog(){
  var names={};state.clients.forEach(function(c){names[c.id]=c.name});
  var vs=state.visits.slice().sort(function(a,b){return b.in-a.in}).slice(0,200);
  if(!vs.length){$("list").innerHTML='<div class="empty">No time in or time out records yet.</div>';return}
  $("list").innerHTML='<div class="wrapx"><table class="log"><thead><tr><th>Client</th><th>Date</th><th>Time in</th><th>Time out</th><th>Duration</th></tr></thead><tbody>'+
  vs.map(function(v){return "<tr><td>"+esc(names[v.cid]||"Deleted client")+"</td><td>"+fDay(v.in)+"</td><td>"+fTime(v.in)+"</td><td>"+(v.out?fTime(v.out):'<span class="badge b-in">Inside</span>')+"</td><td>"+(v.out?dur(v.out-v.in):dur(Date.now()-v.in))+"</td></tr>"}).join("")+"</tbody></table></div>";
}

function render(){
  renderStats();renderTabs();
  $("vMembers").setAttribute("aria-pressed",ui.view==="members");
  $("vLog").setAttribute("aria-pressed",ui.view==="log");
  $("vWalk").setAttribute("aria-pressed",ui.view==="walk");
  if(ui.view==="members")renderMembers();else if(ui.view==="walk")renderWalk();else renderLog();
}

function clock(){
  var n=new Date();
  $("clockTime").textContent=n.toLocaleTimeString([],{hour:"numeric",minute:"2-digit"});
  $("clockDate").textContent=n.toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric",year:"numeric"});
}

function formHint(){
  var s=$("fStart").value||today();
  $("fHint").innerHTML="Subscription ends on <b>"+fDate(addPlan(s,$("fPlan").value))+"</b>.";
}

function addClient(){
  var name=$("fName").value.trim();
  if(!name){toast("Enter the client’s name first.");$("fName").focus();return}
  var start=$("fStart").value||today(),plan=$("fPlan").value;
  var nid=uid();state.clients.push({id:nid,name:name,phone:$("fPhone").value.trim(),photo:ui.newPhoto,plan:plan,start:start,expiry:addPlan(start,plan)});
  ui.newPhoto="";fPrev();save();$("fName").value="";$("fPhone").value="";formHint();render();toast(name+" was added.");openQr(nid,true);
}

function timeIn(id){
  var c=state.clients.find(function(x){return x.id===id});if(!c)return;
  if(status(c)==="expired"){toast(c.name+"’s subscription expired on "+fDate(c.expiry)+". Renew to allow entry.");return}
  if(openVisit(id)){toast(c.name+" is already inside.");return}
  state.visits.push({id:uid(),cid:id,in:Date.now(),out:null,walk:c.plan==="daily"});save();render();toast(c.name+" timed in at "+fTime(Date.now())+".");
}
function timeOut(id){
  var v=openVisit(id);if(!v)return;v.out=Date.now();save();render();
  var c=state.clients.find(function(x){return x.id===id});toast((c?c.name:"Client")+" timed out. Visit lasted "+dur(v.out-v.in)+".");
}
function renewHint(){
  var c=state.clients.find(function(x){return x.id===ui.renewId});if(!c)return;
  var base=status(c)==="expired"?today():c.expiry;
  $("renewHint").innerHTML="Starts "+fDate(base)+" and ends on <b>"+fDate(addPlan(base,$("renewPlan").value))+"</b>.";
}
function openRenew(id){
  var c=state.clients.find(function(x){return x.id===id});if(!c)return;
  ui.renewId=id;$("renewTitle").textContent="Renew "+c.name;$("renewPlan").value=c.plan;renewHint();
  if($("renewDlg").showModal)$("renewDlg").showModal();else $("renewDlg").setAttribute("open","");
}
function doRenew(){
  var c=state.clients.find(function(x){return x.id===ui.renewId});if(!c)return;
  var plan=$("renewPlan").value,base=status(c)==="expired"?today():c.expiry;
  c.plan=plan;c.start=base;c.expiry=addPlan(base,plan);save();$("renewDlg").close();render();toast(c.name+" renewed until "+fDate(c.expiry)+".");
}
function initials(n){return n.trim().split(/\s+/).slice(0,2).map(function(w){return w[0].toUpperCase()}).join("")}
function avatar(c){return '<button class="avatar" data-act="photo" data-id="'+c.id+'" aria-label="View photo of '+esc(c.name)+'">'+(c.photo?'<img src="'+c.photo+'" alt="">':esc(initials(c.name)))+'</button>'}
function readPhoto(file,cb){
  if(!file)return;var r=new FileReader();
  r.onload=function(){var im=new Image();
    im.onload=function(){var s=240,w=im.width,h=im.height,m=Math.min(w,h),cv=document.createElement("canvas");cv.width=cv.height=s;cv.getContext("2d").drawImage(im,(w-m)/2,(h-m)/2,m,m,0,0,s,s);cb(cv.toDataURL("image/jpeg",0.78))};
    im.onerror=function(){toast("That file is not a readable image.")};im.src=r.result};
  r.readAsDataURL(file);
}
function fPrev(){$("fPrev").innerHTML=ui.newPhoto?'<img src="'+ui.newPhoto+'" alt="Selected photo">':"?"}
function openPhoto(id){
  var c=state.clients.find(function(x){return x.id===id});if(!c)return;ui.photoId=id;
  $("photoName").textContent=c.name;
  $("photoBody").innerHTML=c.photo?'<img class="pbig" src="'+c.photo+'" alt="Photo of '+esc(c.name)+'">':'<div class="pnone">'+esc(initials(c.name))+'</div>';
  $("photoRemove").style.display=c.photo?"":"none";
  $("photoChange").textContent=c.photo?"Change photo":"Add photo";
  if(!$("photoDlg").open){if($("photoDlg").showModal)$("photoDlg").showModal();else $("photoDlg").setAttribute("open","")}
}
var camStream=null,camTarget=null;
function stopCam(){if(camStream){camStream.getTracks().forEach(function(t){t.stop()});camStream=null}$("camVideo").srcObject=null}
function openCam(target){
  camTarget=target;
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){toast("Webcam is not available here. Upload a photo file instead.");return}
  navigator.mediaDevices.getUserMedia({video:{facingMode:"user",width:{ideal:640},height:{ideal:640}},audio:false}).then(function(s){
    camStream=s;var v=$("camVideo");v.srcObject=s;
    if($("photoDlg").open)$("photoDlg").close();
    if($("camDlg").showModal)$("camDlg").showModal();else $("camDlg").setAttribute("open","");
    if(v.play)v.play().catch(function(){});
  }).catch(function(err){
    toast(err&&err.name==="NotAllowedError"?"Camera access was blocked. Allow the camera for this page, or upload a photo file.":"No webcam found. Upload a photo file instead.");
  });
}
function snap(){
  var v=$("camVideo");if(!v.videoWidth){toast("The camera is still starting. Try again in a moment.");return}
  var s=240,w=v.videoWidth,h=v.videoHeight,m=Math.min(w,h),cv=document.createElement("canvas");cv.width=cv.height=s;
  cv.getContext("2d").drawImage(v,(w-m)/2,(h-m)/2,m,m,0,0,s,s);
  var d=cv.toDataURL("image/jpeg",0.78);
  stopCam();$("camDlg").close();
  if(camTarget==="form"){ui.newPhoto=d;fPrev();toast("Photo captured.")}
  else{var c=state.clients.find(function(x){return x.id===ui.photoId});if(c){c.photo=d;save();render();openPhoto(c.id);toast("Photo saved.")}}
}
function closeCam(){stopCam();if($("camDlg").open)$("camDlg").close();if(camTarget==="client"&&ui.photoId)openPhoto(ui.photoId)}
function findC(id){return state.clients.find(function(x){return x.id===id})}
function qrCard(c,code){
  var q=qrcode(0,"M");q.addData(code);q.make();
  var n=q.getModuleCount(),cell=8,quiet=4,qs=(n+quiet*2)*cell,W=Math.max(qs,340),H=qs+80;
  var cv=document.createElement("canvas");cv.width=W;cv.height=H;var x=cv.getContext("2d");
  x.fillStyle="#fff";x.fillRect(0,0,W,H);x.fillStyle="#000";
  var ox=Math.round((W-qs)/2)+quiet*cell;
  for(var r=0;r<n;r++)for(var k=0;k<n;k++)if(q.isDark(r,k))x.fillRect(ox+k*cell,quiet*cell+r*cell,cell,cell);
  x.textAlign="center";x.fillStyle="#14202B";x.font="700 26px Arial, sans-serif";x.fillText(c.name,W/2,qs+30,W-20);
  x.font="15px Arial, sans-serif";x.fillStyle="#5B6B7A";x.fillText("Gym membership QR. Show this at the front desk.",W/2,qs+58,W-20);
  return cv.toDataURL("image/png");
}
function openQr(id,isNew){
  var c=findC(id);if(!c)return;
  $("qrName").textContent=c.name;
  var code="GYM:"+c.id,img;
  try{img='<img src="'+qrCard(c,code)+'" alt="QR code for '+esc(c.name)+'" style="width:100%;max-width:300px;border-radius:8px;border:1px solid var(--line)">'}
  catch(e){img='<div class="empty">The QR code could not be created. Check your internet connection and reload.</div>'}
  $("qrBody").innerHTML=img+'<div style="margin:8px 0">'+badgeFor(c)+'</div><div class="sub">'+(isNew?"Client added. Save this QR card and give it to the client.<br>":"")+'Right-click or long-press the card to save it. Code: '+esc(code)+'</div>';
  if($("qrDlg").showModal)$("qrDlg").showModal();else $("qrDlg").setAttribute("open","");
}
var scanStream=null,scanTimer=0,scanCv=document.createElement("canvas"),lastScan={id:"",t:0};
function beep(ok){try{var a=new (window.AudioContext||window.webkitAudioContext)(),o=a.createOscillator(),g=a.createGain();o.frequency.value=ok?880:220;g.gain.value=.08;o.connect(g);g.connect(a.destination);o.start();o.stop(a.currentTime+.15)}catch(e){}}
function stopScan(){clearTimeout(scanTimer);if(scanStream){scanStream.getTracks().forEach(function(t){t.stop()});scanStream=null}$("scanVideo").srcObject=null}
function scanTick(){
  var v=$("scanVideo");
  if(scanStream&&v.videoWidth){
    var s=Math.min(1,480/v.videoWidth),w=Math.round(v.videoWidth*s),h=Math.round(v.videoHeight*s);
    scanCv.width=w;scanCv.height=h;var x=scanCv.getContext("2d");x.drawImage(v,0,0,w,h);
    var code=jsQR(x.getImageData(0,0,w,h).data,w,h);
    if(code&&code.data)handleScan(code.data);
  }
  if(scanStream)scanTimer=setTimeout(scanTick,150);
}
function needJsQR(cb){if(typeof jsQR!=="undefined"){cb(true);return}var s=document.createElement("script");s.src="https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js";s.onload=function(){cb(typeof jsQR!=="undefined")};s.onerror=function(){cb(false)};document.head.appendChild(s)}
function openScan(){
  $("scanResult").innerHTML="";
  if($("scanDlg").showModal)$("scanDlg").showModal();else $("scanDlg").setAttribute("open","");
  $("scanInput").focus();
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){$("scanMsg").textContent="This page is not allowed to use a camera here. Open the page link in its own browser tab, or use a handheld scanner or type the code.";return}
  if(typeof jsQR==="undefined"){$("scanMsg").textContent="Loading the QR reader…";needJsQR(function(ok){if(ok)startScanCam();else $("scanMsg").textContent="The QR reader could not load. Check your internet connection and reload the page."});return}
  startScanCam();
}
function startScanCam(){
  $("scanMsg").textContent="Starting camera…";
  navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}},audio:false}).then(function(s){
    if(!$("scanDlg").open){s.getTracks().forEach(function(t){t.stop()});return}
    scanStream=s;var v=$("scanVideo");v.srcObject=s;if(v.play)v.play().catch(function(){});
    $("scanMsg").textContent="Hold the client’s QR code in front of the camera.";scanTick();
  }).catch(function(err){var n=err&&err.name;$("scanMsg").textContent=n==="NotAllowedError"?"Camera permission is blocked for this page. Allow the camera in your browser’s site settings, or open the page link in its own tab.":n==="NotFoundError"?"No camera was found on this device.":n==="NotReadableError"?"The camera is in use by another app or tab. Close it and try again.":"The camera could not start ("+(n||"unknown error")+"). Use a handheld scanner or type the code."});
}
function avatarBig(c){return '<div class="avatar big">'+(c.photo?'<img src="'+c.photo+'" alt="">':esc(initials(c.name)))+'</div>'}
function showScan(c,act,extra){
  var el=$("scanResult");
  if(!c){el.innerHTML='<div class="res bad"><div><strong>Code not recognized</strong><br>'+esc(extra||"")+'</div></div>';return}
  var cls=act==="in"?"ok":act==="out"?"out":"bad";
  var head=act==="in"?"Timed in at "+fTime(Date.now()):act==="out"?"Timed out. Stayed "+extra:"Entry denied. Subscription expired.";
  el.innerHTML='<div class="res '+cls+'">'+avatarBig(c)+'<div><strong>'+esc(c.name)+'</strong><br>'+head+'</div></div>'+
    '<div style="margin-top:8px">'+badgeFor(c)+' <span class="sub">'+PLANS[c.plan].label+', ends '+fDate(c.expiry)+'</span></div>'+
    (act==="denied"?'<button data-act="renew" data-id="'+c.id+'" style="margin-top:8px">Renew now</button>':"");
}
function handleScan(text){
  var m=/^GYM:(.+)$/.exec(String(text).trim());
  if(!m){showScan(null,"","This is not a gym QR code.");beep(false);return}
  var c=findC(m[1]);
  if(!c){showScan(null,"","No client with this code was found on this device.");beep(false);return}
  var now=Date.now();
  if(lastScan.id===c.id&&now-lastScan.t<5000)return;
  lastScan={id:c.id,t:now};
  var v=openVisit(c.id),act,extra="";
  if(v){v.out=now;act="out";extra=dur(v.out-v.in)}
  else if(status(c)==="expired"){act="denied"}
  else{state.visits.push({id:uid(),cid:c.id,in:now,out:null,walk:c.plan==="daily"});act="in"}
  save();render();showScan(c,act,extra);beep(act!=="denied");
}
function walkIn(){
  var name=$("fName").value.trim();
  if(!name){toast("Enter the client’s name first.");$("fName").focus();return}
  var t=today(),nid=uid(),now=Date.now();
  state.clients.push({id:nid,name:name,phone:$("fPhone").value.trim(),photo:ui.newPhoto,plan:"daily",start:t,expiry:t});
  state.visits.push({id:uid(),cid:nid,in:now,out:null,walk:true});
  ui.newPhoto="";fPrev();$("fName").value="";$("fPhone").value="";save();formHint();render();
  toast(name+" timed in as a daily walk-in at "+fTime(now)+".");
}
function isWalk(v){var c=findC(v.cid);return !!(v.walk||(c&&c.plan==="daily"))}
function renderWalk(){
  var q=ui.q.trim().toLowerCase(),names={},cnt={},perDay={};
  state.clients.forEach(function(c){names[c.id]=c.name});
  var vs=state.visits.filter(isWalk);
  vs.forEach(function(v){cnt[v.cid]=(cnt[v.cid]||0)+1});
  var tk=fmt(new Date()),mk=tk.slice(0,7),td=0,mo=0,ins=0;
  vs.forEach(function(v){var d=fmt(new Date(v.in));if(d===tk)td++;if(d.slice(0,7)===mk)mo++;if(!v.out)ins++});
  var h='<div class="stats"><div class="stat ok"><b>'+td+'</b><span>Walk-ins today</span></div><div class="stat in"><b>'+ins+'</b><span>Walk-ins inside now</span></div><div class="stat warn"><b>'+mo+'</b><span>Walk-ins this month</span></div><div class="stat"><b>'+vs.length+'</b><span>All-time walk-in visits</span></div></div>';
  var fv=vs.filter(function(v){return !q||(names[v.cid]||"").toLowerCase().indexOf(q)>=0}).sort(function(a,b){return b.in-a.in});
  fv.forEach(function(v){var d=fmt(new Date(v.in));perDay[d]=(perDay[d]||0)+1});
  if(!fv.length){$("list").innerHTML=h+'<div class="empty">No walk-in visits found. Use “Daily walk-in: save and time in now” to add one.</div>';return}
  var last="",open=false;
  fv.forEach(function(v){
    var d=fmt(new Date(v.in));
    if(d!==last){
      if(open)h+='</tbody></table></div>';
      h+='<h3 style="font:700 18px/1.2 Barlow Condensed,Arial Narrow,sans-serif;margin:16px 0 6px">'+fDate(d)+' ('+perDay[d]+(perDay[d]===1?' walk-in':' walk-ins')+')</h3><div class="wrapx"><table class="log"><thead><tr><th>Client</th><th>Time in</th><th>Time out</th><th>Duration</th><th>Visits</th></tr></thead><tbody>';
      open=true;last=d;
    }
    h+='<tr><td>'+esc(names[v.cid]||"Deleted client")+'</td><td>'+fTime(v.in)+'</td><td>'+(v.out?fTime(v.out):'<span class="badge b-in">Inside</span>')+'</td><td>'+dur((v.out||Date.now())-v.in)+'</td><td>'+(cnt[v.cid]||1)+'</td></tr>';
  });
  if(open)h+='</tbody></table></div>';
  $("list").innerHTML=h;
}
function sample(){
  var t=new Date();function off(d){var x=new Date(t);x.setDate(x.getDate()+d);return fmt(x)}
  var defs=[["Maria Santos","0917 111 2233","monthly",-10],["Juan Dela Cruz","0918 222 3344","half",-13],["Ana Reyes","0920 333 4455","quarterly",-120],["Carlo Bautista","0927 444 5566","yearly",-200]];
  defs.forEach(function(d){var s=off(d[3]);state.clients.push({id:uid(),name:d[0],phone:d[1],plan:d[2],start:s,expiry:addPlan(s,d[2])})});
  save();render();toast("Sample clients loaded.");
}

document.addEventListener("click",function(e){
  var t=e.target.closest("[data-act],[data-tab]");if(!t)return;
  if(t.dataset.tab){ui.filter=t.dataset.tab;render();return}
  var a=t.dataset.act,id=t.dataset.id;
  if(a==="in")timeIn(id);
  else if(a==="out")timeOut(id);
  else if(a==="renew")openRenew(id);
  else if(a==="photo")openPhoto(id);
  else if(a==="qr")openQr(id);
  else if(a==="sample")sample();
  else if(a==="del"){
    if(ui.armed===id){state.clients=state.clients.filter(function(c){return c.id!==id});state.visits=state.visits.filter(function(v){return v.cid!==id});ui.armed=null;save();render();toast("Client deleted.")}
    else{ui.armed=id;render();setTimeout(function(){if(ui.armed===id){ui.armed=null;render()}},3000)}
  }
});
$("addBtn").addEventListener("click",addClient);
$("walkBtn").addEventListener("click",walkIn);
$("fName").addEventListener("keydown",function(e){if(e.key==="Enter")addClient()});
$("fPlan").addEventListener("change",formHint);
$("fStart").addEventListener("change",formHint);
$("search").addEventListener("input",function(){ui.q=this.value;render()});
$("vMembers").addEventListener("click",function(){ui.view="members";render()});
$("vLog").addEventListener("click",function(){ui.view="log";render()});
$("vWalk").addEventListener("click",function(){ui.view="walk";render()});
$("renewPlan").addEventListener("change",renewHint);
$("renewCancel").addEventListener("click",function(){$("renewDlg").close()});
$("renewOk").addEventListener("click",doRenew);
$("fPhotoBtn").addEventListener("click",function(){$("fPhotoFile").click()});
$("fPhotoFile").addEventListener("change",function(){var f=this.files[0];this.value="";readPhoto(f,function(d){ui.newPhoto=d;fPrev()})});
$("photoChange").addEventListener("click",function(){$("photoFile").click()});
$("photoFile").addEventListener("change",function(){var f=this.files[0];this.value="";readPhoto(f,function(d){var c=state.clients.find(function(x){return x.id===ui.photoId});if(!c)return;c.photo=d;save();render();openPhoto(c.id);toast("Photo saved.")})});
$("photoRemove").addEventListener("click",function(){var c=state.clients.find(function(x){return x.id===ui.photoId});if(!c)return;c.photo="";save();render();openPhoto(c.id);toast("Photo removed.")});
$("photoClose").addEventListener("click",function(){$("photoDlg").close()});
$("fCamBtn").addEventListener("click",function(){openCam("form")});
$("photoCam").addEventListener("click",function(){openCam("client")});
$("camShot").addEventListener("click",snap);
$("camCancel").addEventListener("click",closeCam);
$("camDlg").addEventListener("close",stopCam);
$("scanBtn").addEventListener("click",openScan);
$("scanClose").addEventListener("click",function(){$("scanDlg").close()});
$("scanDlg").addEventListener("close",stopScan);
$("scanInput").addEventListener("keydown",function(e){if(e.key==="Enter"){handleScan(this.value);this.value=""}});
$("qrClose").addEventListener("click",function(){$("qrDlg").close()});

load();$("fStart").value=today();formHint();clock();render();
window.gymApp={onSave:null,get:function(){return state},apply:function(kind,list){state[kind]=list;try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){}render()}};
setInterval(function(){clock();render()},30000);
})();
