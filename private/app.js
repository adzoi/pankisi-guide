const COLORS={stay:'#2f6f9f',eat:'#c0392b',sight:'#8e5aa8',nature:'#3f8f4f',service:'#d08a1e'};
const ICONS={stay:'🛏',eat:'🍽',sight:'🕌',nature:'🌲',service:'🧭'};
const TILE_IMG={stay:'duisi',eat:'khachapuri',sight:'oldmosque',nature:'waterfall',service:'tbatana1'};
const CW_EN={jokolo:'village of Jokolo',duisi:'village of Duisi',valley:'the Pankisi valley',range:'the Pankisi range',folk:'Kist folk ensemble in Pankisi',bread:'shoti bread',trail:'a trail on the Tbatana plateau',alazani:'the Alazani river'};
const EN={all:'All',stay:'Stay',eat:'Eat & drink',sight:'Sights',nature:'Nature & trails',service:'Services'};
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

let places=[],favs=[],filter='all',selected=null,markers={},foodData=[],meData=null;
const I18N={};let lang='en';
try{lang=localStorage.getItem('lang')||'en'}catch{}
const T=()=>(I18N[lang]&&I18N[lang].ui)||{};
const tr=(k,fb)=>T()[k]||fb;
const labels=()=>({all:tr('c_all',EN.all),stay:tr('c_stay',EN.stay),eat:tr('c_eat',EN.eat),sight:tr('c_sight',EN.sight),nature:tr('c_nature',EN.nature),service:tr('c_service',EN.service)});
function pl(p){const o=I18N[lang]&&I18N[lang].places&&I18N[lang].places[p.id];
  return o?{...p,name:o.n,village:o.v,text:o.t,tags:o.g,do:o.d||p.do,how:o.h||p.how}:p}
const caption=p=>p.capk?`${tr('cap_ill','Illustrative photo')}: ${tr('cw_'+p.capk,CW_EN[p.capk])}`:'';

const map=L.map('map',{scrollWheelZoom:false}).setView([42.175,45.30],12);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'© OpenStreetMap contributors'}).addTo(map);
map.on('click',()=>map.scrollWheelZoom.enable());

function thumb(p){return p.img?`<img class="th" loading="lazy" src="/img/${p.img}.jpg" alt="">`:`<span class="th ph" style="background:${COLORS[p.cat]}">${ICONS[p.cat]}</span>`}

function popup(p){
  const img=p.img?`<img src="/img/${p.img}.jpg" alt="${esc(p.name)}">`:'';
  return `<div class="popup">${img}<h3>${esc(p.name)}</h3><div style="font-size:.8rem;color:#777">${esc(p.village)} · ${labels()[p.cat]}</div>
  <p>${esc(p.text.length>130?p.text.slice(0,127)+'…':p.text)}</p>
  <button class="favbtn" data-detail="${p.id}">${esc(tr('whatdo','What to do'))} →</button></div>`;
}
const pinIcon=(p,sel)=>L.divIcon({className:'',html:`<div class="pin ${sel?'sel':''}" style="background:${COLORS[p.cat]}"></div>`,iconSize:[26,26],iconAnchor:[13,26],popupAnchor:[0,-26]});

function render(){
  const vis=places.map(pl).filter(p=>filter==='all'||p.cat===filter||(filter==='saved'&&favs.includes(p.id)));
  Object.values(markers).forEach(m=>map.removeLayer(m));markers={};
  vis.forEach(p=>{
    const m=L.marker([p.lat,p.lon],{icon:pinIcon(p,p.id===selected),title:p.name}).addTo(map).bindPopup(popup(p));
    m.on('click',()=>{selected=p.id;highlight()});
    markers[p.id]=m;
  });
  $('#chips').innerHTML=[...Object.keys(labels()),'saved'].map(k=>`<button class="chip" aria-pressed="${filter===k}" data-f="${k}">${k==='saved'?'★ '+esc(tr('c_saved','Saved'))+' ('+favs.length+')':esc(labels()[k])}</button>`).join('');
  if(selected&&detailOpen)return showDetail(selected,true);
  $('#list').innerHTML=vis.length?vis.map(p=>`<div class="item ${p.id===selected?'on':''}" data-id="${p.id}" tabindex="0">
    ${thumb(p)}<div class="meta"><div class="n">${esc(p.name)}</div><div class="v">${esc(p.village)} · ${labels()[p.cat]}</div></div>
    ${favs.includes(p.id)?'<span class="star">★</span>':''}</div>`).join(''):`<p style="padding:16px;color:var(--muted)">${esc(tr('nosaved','Nothing here yet. Save places with the ☆ button on the map.'))}</p>`;
}
function highlight(){
  document.querySelectorAll('.item').forEach(e=>e.classList.toggle('on',e.dataset.id===selected));
  places.forEach(p=>markers[p.id]&&markers[p.id].setIcon(pinIcon(pl(p),p.id===selected)));
}

let detailOpen=false;
function showDetail(id,keep){
  const raw=places.find(p=>p.id===id);if(!raw)return;const p=pl(raw);
  selected=id;detailOpen=true;
  const imgs=p.gallery||(p.img?[p.img]:[]);
  const cap=caption(p);
  const hero=imgs.length?`<div class="dhero"><img id="dimg" src="/img/${imgs[0]}.jpg" alt="${esc(p.name)}">${cap?`<span class="cap">${esc(cap)}</span>`:''}</div>`:`<div class="dhero ph" style="background:${COLORS[p.cat]}">${ICONS[p.cat]}</div>`;
  const thumbs=imgs.length>1?`<div class="gal">${imgs.map((g,i)=>`<img src="/img/${g}.jpg" data-g="${g}" class="${i?'':'on'}" alt="">`).join('')}</div>`:'';
  const doList=p.do&&p.do.length?`<h4>${esc(tr('whatdo','What to do'))}</h4><ul class="dl">${p.do.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'';
  const how=p.how?`<h4>${esc(tr('howto','How to arrange it'))}</h4><p>${esc(p.how)}</p>`:'';
  $('#list').innerHTML=`<div class="detail"><button class="back" data-back>${esc(tr('back','← Back to list'))}</button>${hero}${thumbs}
    <div class="dbody"><h3>${esc(p.name)}</h3><div class="v">${esc(p.village)} · ${labels()[p.cat]}</div>
    <p>${esc(p.text)}</p>${p.tags.map(t=>`<span class="tag">${esc(t)}</span>`).join('')}${doList}${how}
    <div class="acts"><button class="favbtn ${favs.includes(p.id)?'on':''}" data-fav="${p.id}">${favs.includes(p.id)?tr('savedbtn','★ Saved'):tr('save','☆ Save')}</button></div></div></div>`;
  $('#list').scrollTop=0;
  if(!keep)highlight();
}
function pick(id,detail){
  const m=markers[id];if(!m)return;selected=id;
  map.flyTo(m.getLatLng(),Math.max(map.getZoom(),13),{duration:.6});
  if(detail)showDetail(id);else{highlight();m.openPopup()}
}
function goMap(f){filter=f;detailOpen=false;selected=null;render();$('#map-sec').scrollIntoView({behavior:'smooth'})}

$('#chips').addEventListener('click',e=>{const b=e.target.closest('[data-f]');if(b){filter=b.dataset.f;detailOpen=false;selected=null;render()}});
$('#list').addEventListener('click',e=>{
  if(e.target.closest('[data-back]')){detailOpen=false;render();return}
  const g=e.target.closest('[data-g]');
  if(g){$('#dimg').src='/img/'+g.dataset.g+'.jpg';document.querySelectorAll('.gal img').forEach(i=>i.classList.toggle('on',i===g));return}
  const i=e.target.closest('.item');if(i)pick(i.dataset.id,true);
});
$('#list').addEventListener('keydown',e=>{if(e.key==='Enter'){const i=e.target.closest('.item');if(i)pick(i.dataset.id,true)}});
document.addEventListener('click',async e=>{
  const d=e.target.closest('[data-detail]');if(d){map.closePopup();showDetail(d.dataset.detail);return}
  const t=e.target.closest('[data-tile]');if(t){goMap(t.dataset.tile);return}
  const o=e.target.closest('[data-onmap]');if(o){filter='all';detailOpen=false;render();$('#map-sec').scrollIntoView({behavior:'smooth'});setTimeout(()=>pick(o.dataset.onmap,true),500);return}
  const b=e.target.closest('[data-fav]');if(!b)return;
  const r=await fetch('/api/favorites',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:b.dataset.fav})});
  if(r.ok){favs=(await r.json()).favorites;render();renderNature()}
});
$('#out').onclick=async()=>{await fetch('/api/logout',{method:'POST'});location.href='/login'};

function renderTiles(){
  $('#tiles').innerHTML=['stay','eat','sight','nature','service'].map(k=>`<button class="tile" data-tile="${k}" style="--c:${COLORS[k]}"><img loading="lazy" src="/img/${TILE_IMG[k]}.jpg" alt=""><span>${ICONS[k]} ${esc(labels()[k])}</span></button>`).join('');
}
function renderNature(){
  $('#naturecards').innerHTML=places.map(pl).filter(p=>p.cat==='nature').map((p,i)=>{
    const imgs=p.gallery||(p.img?[p.img]:[]);
    return `<article class="ncard ${i%2?'rev':''}"><div class="nimgs"><img class="main" loading="lazy" src="/img/${imgs[0]}.jpg" alt="${esc(p.name)}">
      ${imgs.length>1?`<div class="nthumbs">${imgs.slice(1,4).map(g=>`<img loading="lazy" src="/img/${g}.jpg" alt="">`).join('')}</div>`:''}</div>
      <div class="ntext"><span class="kicker">${esc(p.village)}</span><h3>${esc(p.name)}</h3><p>${esc(p.text)}</p>
      <ul class="dl">${(p.do||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul>
      <p class="how">${esc(p.how||'')}</p>
      <button class="btn" data-onmap="${p.id}">${esc(tr('onmap','Show on map'))}</button></div></article>`}).join('');
}
function renderFood(){
  $('#food').innerHTML=foodData.map((f,i)=>{const o=I18N[lang]&&I18N[lang].food&&I18N[lang].food[i];const name=o?o.n:f.name,text=o?o.t:f.text,note=o?o.i:f.imgNote;
    return `<article class="card">${f.img?`<img loading="lazy" src="/img/${f.img}.jpg" alt="${esc(name)}">`:'<div class="ph"></div>'}
    <div class="b"><h3>${esc(name)}${f.kist?`<span class="kist">${esc(tr('kistbadge','Kist'))}</span>`:''}</h3><p>${esc(text)}</p>${f.imgNote?`<p class="imgnote">${esc(note||f.imgNote)}</p>`:''}</div></article>`}).join('');
}
function applyLang(){
  document.documentElement.lang=lang;$('#lang').value=lang;
  document.querySelectorAll('[data-i18n]').forEach(el=>{
    if(el.dataset.en===undefined)el.dataset.en=el.textContent;
    el.textContent=lang==='en'?el.dataset.en:(T()[el.dataset.i18n]||el.dataset.en);
  });
  if(meData)$('#who').textContent=tr('hi','Hi, ')+meData.name;
  render();renderTiles();renderNature();renderFood();
}
$('#lang').addEventListener('change',e=>{lang=e.target.value;try{localStorage.setItem('lang',lang)}catch{}applyLang()});

async function j(u){const r=await fetch(u);if(r.status===401){location.href='/login';throw 0}return r.json()}
(async()=>{
  const [me,pls,food,cr,i18n]=await Promise.all([j('/api/me'),j('/api/places'),j('/api/cuisine'),j('/api/credits'),j('/api/i18n')]);
  meData=me;favs=me.favorites;places=pls;foodData=food;Object.assign(I18N,i18n);
  $('#credits').innerHTML=Object.values(cr).map(c=>`<a href="${esc(c.page)}" target="_blank" rel="noopener">${esc(c.title.replace(/\.\w+$/,''))}</a> — ${esc(c.author)}, ${esc(c.license)}`).join(' · ');
  applyLang();
})();
