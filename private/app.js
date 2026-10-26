const COLORS={stay:'#2f6f9f',eat:'#c0392b',sight:'#8e5aa8',nature:'#3f8f4f',service:'#d08a1e'};
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let places=[],favs=[],filter='all',selected=null,markers={},foodData=[],creditsData={},meData=null;
const I18N={};let lang='en';
try{lang=localStorage.getItem('lang')||'en'}catch{}
const T=()=>(I18N[lang]&&I18N[lang].ui)||{};
const tr=(k,fb)=>T()[k]||fb;
function labels(){return {all:tr('c_all','All'),stay:tr('c_stay','Stay'),eat:tr('c_eat','Eat & drink'),sight:tr('c_sight','Sights'),nature:tr('c_nature','Nature & trails'),service:tr('c_service','Services')}}
function pl(p){const o=I18N[lang]&&I18N[lang].places&&I18N[lang].places[p.id];return o?{...p,name:o.n,village:o.v,text:o.t,tags:o.g}:p}

const map=L.map('map',{scrollWheelZoom:false}).setView([42.175,45.30],12);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'© OpenStreetMap contributors'}).addTo(map);
map.on('click',()=>map.scrollWheelZoom.enable());

function popup(p){
  const img=p.img?`<img src="/img/${p.img}.jpg" alt="${esc(p.imgAlt||p.name)}">`:'';
  return `<div class="popup">${img}<h3>${esc(p.name)}</h3><div style="font-size:.8rem;color:#777">${esc(p.village)} · ${labels()[p.cat]}</div>
  <p>${esc(p.text)}</p>${p.tags.map(t=>`<span class="tag">${esc(t)}</span>`).join('')}
  <div><button class="favbtn ${favs.includes(p.id)?'on':''}" data-fav="${p.id}">${favs.includes(p.id)?tr('savedbtn','★ Saved'):tr('save','☆ Save')}</button></div></div>`;
}
function pinIcon(p,sel){return L.divIcon({className:'',html:`<div class="pin ${sel?'sel':''}" style="background:${COLORS[p.cat]}"></div>`,iconSize:[26,26],iconAnchor:[13,26],popupAnchor:[0,-26]})}

function render(){
  const vis=places.map(pl).filter(p=>filter==='all'||p.cat===filter||(filter==='saved'&&favs.includes(p.id)));
  Object.values(markers).forEach(m=>map.removeLayer(m));markers={};
  vis.forEach(p=>{
    const m=L.marker([p.lat,p.lon],{icon:pinIcon(p,p.id===selected),title:p.name}).addTo(map).bindPopup(popup(p));
    m.on('click',()=>{selected=p.id;highlight()});
    markers[p.id]=m;
  });
  $('#list').innerHTML=vis.length?vis.map(p=>`<div class="item ${p.id===selected?'on':''}" data-id="${p.id}" tabindex="0">
    <span class="dot" style="background:${COLORS[p.cat]}"></span><div><div class="n">${esc(p.name)}</div><div class="v">${esc(p.village)} · ${labels()[p.cat]}</div></div>
    ${favs.includes(p.id)?'<span class="star">★</span>':''}</div>`).join(''):`<p style="padding:16px;color:var(--muted)">${tr('nosaved','Nothing here yet. Save places with the ☆ button on the map.')}</p>`;
  $('#chips').innerHTML=[...Object.keys(labels()),'saved'].map(k=>`<button class="chip" aria-pressed="${filter===k}" data-f="${k}">${k==='saved'?'★ '+tr('c_saved','Saved')+' ('+favs.length+')':labels()[k]}</button>`).join('');
}
function highlight(){
  document.querySelectorAll('.item').forEach(e=>e.classList.toggle('on',e.dataset.id===selected));
  places.forEach(p=>markers[p.id]&&markers[p.id].setIcon(pinIcon(p,p.id===selected)));
}
function pick(id){
  const m=markers[id];if(!m)return;selected=id;highlight();
  map.flyTo(m.getLatLng(),Math.max(map.getZoom(),13),{duration:.6});m.openPopup();
}
$('#chips').addEventListener('click',e=>{const b=e.target.closest('[data-f]');if(b){filter=b.dataset.f;render()}});
$('#list').addEventListener('click',e=>{const i=e.target.closest('.item');if(i){pick(i.dataset.id);$('#map').scrollIntoView({block:'nearest'})}});
$('#list').addEventListener('keydown',e=>{if(e.key==='Enter'){const i=e.target.closest('.item');if(i)pick(i.dataset.id)}});
document.addEventListener('click',async e=>{
  const b=e.target.closest('[data-fav]');if(!b)return;
  const r=await fetch('/api/favorites',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:b.dataset.fav})});
  if(r.ok){favs=(await r.json()).favorites;const id=b.dataset.fav;render();if(markers[id])markers[id].openPopup()}
});
$('#out').onclick=async()=>{await fetch('/api/logout',{method:'POST'});location.href='/login'};

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
  render();renderFood();
}
$('#lang').addEventListener('change',e=>{lang=e.target.value;try{localStorage.setItem('lang',lang)}catch{}applyLang()});

async function j(u){const r=await fetch(u);if(r.status===401){location.href='/login';throw 0}return r.json()}
(async()=>{
  const [me,pls,food,cr,i18n]=await Promise.all([j('/api/me'),j('/api/places'),j('/api/cuisine'),j('/api/credits'),j('/api/i18n')]);
  meData=me;favs=me.favorites;places=pls;foodData=food;Object.assign(I18N,i18n);
  $('#credits').innerHTML=Object.values(cr).map(c=>`<a href="${esc(c.page)}" target="_blank" rel="noopener">${esc(c.title.replace(/\.\w+$/,''))}</a> — ${esc(c.author)}, ${esc(c.license)}`).join(' · ');
  applyLang();
})();
