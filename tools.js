/* IP Axix free-tools — shared engine. One backend, four views. */
(function(){
  var FN  = "https://ooanilhblskuaasxyimw.supabase.co/functions/v1/free-audit";
  var CAP = "https://ooanilhblskuaasxyimw.supabase.co/functions/v1/capture-lead";
  var EMAIL = "https://ooanilhblskuaasxyimw.supabase.co/functions/v1/email-deadlines";
  var KEY = "sb_publishable_dQBbAXx5l_buD3m-HQieTA_UBQA125h";
  // Point these where sign-up / booking should go:
  var SIGNUP_URL = "https://patent-platform.vercel.app";
  var DEMO_URL   = "mailto:hello@ipaxix.online?subject=IP%20Axix%20walkthrough";
  // USPTO maintenance-fee schedule (eff. 19 Jan 2025) — [large, small, micro].
  var FEE = { "3.5":{large:2150,small:860,micro:430}, "7.5":{large:4040,small:1616,micro:808}, "11.5":{large:8280,small:3312,micro:1656} };

  var $ = function(id){ return document.getElementById(id); };
  var CFG = {};

  function parseList(s){ return (s||"").split(/[\s,;\n]+/).map(function(x){return x.trim();}).filter(Boolean).slice(0,20); }
  function esc(s){ return String(s==null?"":s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c];}); }
  function fmtDate(d){ if(!d) return ""; var m=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]; var p=String(d).split("-"); if(p.length<3) return d; return p[2].replace(/^0/,"")+" "+m[(+p[1])-1]+" "+p[0]; }
  function money(n){ return "$"+Number(n).toLocaleString("en-US"); }
  function yearsLeft(iso){ if(!iso) return null; var ms=new Date(iso+"T00:00:00Z")-Date.now(); return ms<=0?0:Math.round(ms/(365.25*864e5)*10)/10; }
  var STATE_LABEL={overdue:"Overdue",soon:"Due soon",upcoming:"This year",future:"Scheduled"};
  function badge(label){ var cls="b-none"; if(/granted/i.test(label))cls="b-granted"; else if(/pending/i.test(label))cls="b-pending"; else if(/abandon|lapsed/i.test(label))cls="b-dead"; return '<span class="badge '+cls+'">'+esc(label)+'</span>'; }
  function nextMaint(p){ return (p.deadlines||[]).filter(function(d){return /Maintenance fee/i.test(d.type);})[0]||null; }

  /* ---------- render modes ---------- */
  function renderAudit(data){
    var score=Math.max(0,Math.min(100,data.score||0)), s=data.summary||{};
    var ring=$("ring"), C=2*Math.PI*44;
    ring.setAttribute("stroke-dasharray",C.toFixed(1));
    ring.setAttribute("stroke-dashoffset",(C*(1-score/100)).toFixed(1));
    var col=score>=80?"var(--green)":score>=60?"var(--amber)":"var(--red)";
    ring.setAttribute("stroke",col); $("scoreNum").textContent=score; $("scoreNum").style.color=col;
    var head,sub;
    if(s.overdue>0){head="Action needed";sub=s.overdue+" deadline"+(s.overdue>1?"s are":" is")+" already overdue — the kind of thing that quietly abandons a granted right.";}
    else if(s.dueWithin90Days>0){head="Watch the next 90 days";sub=s.dueWithin90Days+" deadline"+(s.dueWithin90Days>1?"s fall":" falls")+" within 90 days. Worth diarising now.";}
    else if((s.dueWithin12Months||0)>0){head="In good shape";sub="Nothing urgent — "+s.dueWithin12Months+" deadline"+(s.dueWithin12Months>1?"s":"")+" to plan for over the coming year.";}
    else {head="All clear for now";sub="No near-term deadlines surfaced for the numbers you entered.";}
    $("scoreHead").textContent=head; $("scoreSub").textContent=sub;
    var tiles=[["total","Patents checked",""],["granted","Granted","ok"],["pending","Pending",""],["overdue","Overdue","warn"],["dueWithin90Days","Due in 90 days","soon"],["dueWithin12Months","Due in 12 months",""]];
    $("tiles").innerHTML=tiles.map(function(t){ var v=s[t[0]]||0; if(t[0]==="total")v=(data.patents||[]).length; return '<div class="tile '+(t[2]&&v>0?t[2]:"")+'"><b>'+v+'</b><span>'+t[1]+'</span></div>'; }).join("");
    $("plist").innerHTML=(data.patents||[]).map(function(p){
      var head='<div class="top"><span class="pid">'+esc(p.display||p.id)+'</span><span class="pt">'+esc(p.title||"")+'</span>'+badge(p.statusLabel||"")+'</div>';
      var body;
      if(p.deadlines&&p.deadlines.length){
        body=p.deadlines.map(function(d){
          return '<div class="dl d-'+d.state+'"><span class="stripe s-'+d.state+'"></span><div class="dmain"><div class="dtype">'+esc(d.type)+(d.est?'<span class="est">est</span>':'')+'</div><div class="dnote">'+esc(d.note||"")+'</div></div><div class="ddate">'+fmtDate(d.due)+'<small>'+(STATE_LABEL[d.state]||"")+'</small></div></div>';
        }).join("");
      } else if(/granted|pending/i.test(p.statusLabel||"")){ body='<div class="clean">No deadlines in the near-term window. In the full tool this stays monitored so new ones surface automatically.</div>'; }
      else { body='<div class="clean" style="color:var(--mut)">'+esc(p.statusLabel||"Not audited")+'.</div>'; }
      return '<div class="pat">'+head+body+'</div>';
    }).join("");
  }

  function dlRow(d){ return '<div class="dl d-'+d.state+'"><span class="stripe s-'+d.state+'"></span><div class="dmain"><div class="dtype">'+esc(d.type)+(d.est?'<span class="est">est</span>':'')+'</div><div class="dnote">'+esc(d.note||"")+'</div></div><div class="ddate">'+fmtDate(d.due)+'<small>'+(STATE_LABEL[d.state]||"")+'</small></div></div>'; }
  function renderNextDeadline(data){
    $("plist").innerHTML=(data.patents||[]).map(function(p){
      var head='<div class="top"><span class="pid">'+esc(p.display||p.id)+'</span><span class="pt">'+esc(p.title||"")+'</span>'+badge(p.statusLabel||"")+'</div>';
      var dls=(p.deadlines||[]); var body;
      if(dls.length){
        var n=dls[0];
        var col=n.state==="overdue"?"var(--red)":n.state==="soon"?"var(--amber)":"var(--accent)";
        body='<div class="fact"><div class="fcol"><span class="flab">Next deadline</span><span class="fbig" style="color:'+col+'">'+fmtDate(n.due)+'</span></div>'+
             '<div class="fcol rt"><span class="fbig" style="font-size:16px">'+esc(n.type)+'</span><span class="flab">'+(STATE_LABEL[n.state]||"")+(p.expiryEst?" · est. expiry ~"+fmtDate(p.expiryEst):"")+'</span></div></div>';
        if(dls.length>1){ body+='<div>'+dls.slice(1).map(dlRow).join("")+'</div>'; }
      } else if(/granted/i.test(p.statusLabel||"")){
        body='<div class="fact"><div class="fcol"><span class="fbig" style="color:var(--green)">No deadline coming up</span><span class="flab">In force'+(p.expiryEst?" · est. expiry ~"+fmtDate(p.expiryEst):"")+' — nothing due in the near-term window</span></div></div>';
      } else if(/pending/i.test(p.statusLabel||"")){
        body='<div class="fact"><div class="fcol"><span class="fbig" style="color:var(--blue)">Pending</span><span class="flab">In examination — no docketed deadline in the near-term window</span></div></div>';
      } else { body='<div class="clean" style="color:var(--mut)">'+esc(p.statusLabel||"")+'.</div>'; }
      return '<div class="pat">'+head+body+'</div>';
    }).join("");
  }

  function renderExpiry(data){
    $("plist").innerHTML=(data.patents||[]).map(function(p){
      var head='<div class="top"><span class="pid">'+esc(p.display||p.id)+'</span><span class="pt">'+esc(p.title||"")+'</span>'+badge(p.statusLabel||"")+'</div>';
      var body;
      if(p.expiryEst){
        var yl=yearsLeft(p.expiryEst);
        body='<div class="fact"><div class="fcol"><span class="fbig">~'+fmtDate(p.expiryEst)+'</span><span class="flab">Estimated expiry <span class="est">est</span></span></div>'+
             '<div class="fcol rt"><span class="fbig" style="color:var(--accent)">'+(yl!=null?yl+" yrs":"—")+'</span><span class="flab">Remaining term</span></div></div>'+
             '<div class="fact"><div class="fcol"><span class="flab">Filed</span><span style="font-size:13px">'+fmtDate(p.filingDate)+'</span></div><div class="fcol rt"><span class="flab">Granted</span><span style="font-size:13px">'+(fmtDate(p.grantDate)||"—")+'</span></div></div>';
      } else if(/pending/i.test(p.statusLabel||"")){ body='<div class="fact"><span class="flab">Pending — term isn\'t set until the patent grants.</span></div>'; }
      else { body='<div class="clean" style="color:var(--mut)">'+esc(p.statusLabel||"")+'.</div>'; }
      return '<div class="pat">'+head+body+'</div>';
    }).join("");
  }

  function renderAnnuity(data){
    $("plist").innerHTML=(data.patents||[]).map(function(p){
      var head='<div class="top"><span class="pid">'+esc(p.display||p.id)+'</span><span class="pt">'+esc(p.title||"")+'</span>'+badge(p.statusLabel||"")+'</div>';
      if(!/granted/i.test(p.statusLabel||"") || !p.grantDate){
        return '<div class="pat">'+head+'<div class="fact"><span class="flab">'+(/pending/i.test(p.statusLabel||"")?"Pending — maintenance fees begin only after grant.":"No maintenance-fee schedule (not a live granted patent).")+'</span></div></div>';
      }
      var nm=nextMaint(p), nextDue=nm?nm.due:null, today=new Date().toISOString().slice(0,10);
      var stages=[["3.5","3.5-year (1st)"],["7.5","7.5-year (2nd)"],["11.5","11.5-year (3rd)"]];
      var rows=stages.map(function(st){
        var due=addYears(p.grantDate, parseFloat(st[0])), f=FEE[st[0]];
        var isNext = nextDue && due===nextDue;
        var when = due<today ? "Paid / elapsed" : (isNext?"Next due":"Scheduled");
        return '<tr'+(isNext?' class="next"':'')+'><td>'+(isNext?'<b>'+st[1]+'</b>':st[1])+'<br><span style="font-size:11px;color:var(--mut)">'+fmtDate(due)+' · '+when+'</span></td><td>'+money(f.large)+'</td><td>'+money(f.small)+'</td><td>'+money(f.micro)+'</td></tr>';
      }).join("");
      return '<div class="pat">'+head+'<div class="feewrap"><table class="fee"><thead><tr><th>Stage</th><th>Large</th><th>Small</th><th>Micro</th></tr></thead><tbody>'+rows+'</tbody></table></div></div>';
    }).join("");
  }
  function addYears(iso,y){ var d=new Date(iso+"T00:00:00Z"); if(isNaN(d.getTime()))return ""; d.setUTCMonth(d.getUTCMonth()+Math.round(y*12)); return d.toISOString().slice(0,10); }

  var RENDER={audit:renderAudit,nextdeadline:renderNextDeadline,inforce:renderNextDeadline,expiry:renderExpiry,annuity:renderAnnuity};

  function setStatus(html){ var el=$("status"); if(!html){el.hidden=true;el.innerHTML="";}else{el.hidden=false;el.innerHTML=html;} }

  function showCapture(list,score){
    var c=$("capture"); if(!c) return;
    c.innerHTML='<h2>Email me my deadlines — free</h2>'+
      '<p>We’ll email you this deadline list plus a calendar file you can add to Google, Outlook or Apple Calendar in one tap — and keep watching so you’re reminded before each date.</p>'+
      '<div class="crow"><input type="email" id="capEmail" placeholder="you@company.com" autocomplete="email"><button class="go" id="capBtn">Email me my deadlines</button></div>'+
      '<div class="mini" id="capMsg">We store your email only to send these deadline reminders — never sold or shared, and you can unsubscribe in one click from any email. By continuing you agree to this.</div>';
    c.hidden=false;
    $("capBtn").addEventListener("click",function(){
      var em=($("capEmail").value||"").trim();
      if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)){ $("capMsg").textContent="Please enter a valid email address."; return; }
      $("capBtn").disabled=true; $("capMsg").textContent="Sending your deadlines…";
      fetch(EMAIL,{method:"POST",headers:{"Content-Type":"application/json","apikey":KEY},body:JSON.stringify({email:em,patents:list,tool:CFG.tool||CFG.mode})})
        .then(function(r){return r.json();}).then(function(j){
          if(j&&j.ok){ $("capMsg").parentNode.innerHTML='<div class="done">✓ Sent — check your inbox for your deadlines and calendar file (peek in spam if it’s not there in a minute). We’ll remind you before each date.</div>'; }
          else { $("capBtn").disabled=false; $("capMsg").textContent=(j&&j.error)||"Could not send — please try again."; }
        }).catch(function(){ $("capBtn").disabled=false; $("capMsg").textContent="Could not send — please try again."; });
    });
  }

  function run(){
    var list=parseList($("pn").value);
    if(!list.length){ setStatus("Enter at least one patent number above."); return; }
    $("run").disabled=true; setStatus('<span class="spin"></span>Pulling the live USPTO record — this can take up to a minute…');
    $("results").hidden=true;
    fetch(FN,{method:"POST",headers:{"Content-Type":"application/json","apikey":KEY},body:JSON.stringify({patents:list})})
      .then(function(r){return r.json().then(function(j){return {ok:r.ok,status:r.status,j:j};});})
      .then(function(res){
        var data=res.j;
        if(!data||!data.ok){ setStatus("Sorry — "+((data&&data.error)||("something went wrong (HTTP "+res.status+")."))); $("run").disabled=false; return; }
        setStatus("");
        (RENDER[CFG.mode]||renderAudit)(data);
        showCapture(list, data.score);
        $("results").hidden=false;
        try{ location.replace("#p="+encodeURIComponent(list.join(","))); }catch(_e){}
        if($("share")) $("share").hidden=false;
        $("results").scrollIntoView({behavior:"smooth",block:"start"});
      })
      .catch(function(){ setStatus("Sorry — the service could not be reached. Please try again in a moment."); })
      .then(function(){ $("run").disabled=false; });
  }

  window.IPAX={
    signup:SIGNUP_URL, demo:DEMO_URL,
    init:function(cfg){
      CFG=cfg||{};
      var ctaS=$("ctaStart"), ctaD=$("ctaDemo"); if(ctaS)ctaS.href=SIGNUP_URL; if(ctaD)ctaD.href=DEMO_URL;
      $("run").addEventListener("click",run);
      $("pn").addEventListener("keydown",function(e){ if((e.metaKey||e.ctrlKey)&&e.key==="Enter") run(); });
      var sh=$("share");
      if(sh) sh.addEventListener("click",function(){
        var url=location.href.split("#")[0]+"#p="+encodeURIComponent(parseList($("pn").value).join(","));
        var done=function(){ sh.textContent="Link copied ✓"; setTimeout(function(){ sh.textContent="Copy shareable link"; },1800); };
        if(navigator.clipboard){ navigator.clipboard.writeText(url).then(done,done); } else { done(); }
      });
      var m=(location.hash||"").match(/p=([^&]+)/);
      if(m){ try{ $("pn").value=decodeURIComponent(m[1]).split(",").join("\n"); }catch(_e){} run(); }
      else if(cfg.examples){ $("pn").value=cfg.examples; run(); }
    }
  };
})();
