const WEBHOOK='https://script.google.com/macros/s/AKfycbzJ0Jl_7sx_Dtp6Aana2vHrhoC0VTj5Jtod4o3Mz-nkHW7DYguFScr27H4OenUdJ5mtNA/exec';
const VIEW_TO_LEAD_CONV = 0.145;
const targets={1:24,2:44,3:67,4:83};

function readEntryParams(){
  const merged = new URLSearchParams(window.location.search);
  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
  const hashParams = new URLSearchParams(hash);
  hashParams.forEach((v,k)=>{ if(!merged.has(k)) merged.set(k,v); });
  const obj={};
  merged.forEach((v,k)=>obj[k]=v);
  return {
    campaign: merged.get('campaign') || merged.get('utm_campaign') || '',
    ad: merged.get('ad') || merged.get('utm_content') || '',
    source: merged.get('src') || merged.get('utm_source') || 'VK Mini App / Ветка A',
    params: JSON.stringify(obj),
    entryUrl: window.location.href
  };
}

const tracking=readEntryParams();
const state={teams:null,current:0,city:''};
const names=['step1','step2','step3','loading','result','result5'];
const panels=Object.fromEntries(names.map(x=>[x,document.getElementById(x)]));

function show(name){
  const y = window.scrollY;
  Object.values(panels).forEach(p=>p.classList.remove('active'));
  panels[name].classList.add('active');
  requestAnimationFrame(()=>window.scrollTo(0,y));
}

function prog(n){
  [1,2,3].forEach(i=>document.getElementById('p'+i).classList.toggle('done',i<=n));
}

function pluralTeams(n){
  if(n===1) return '1 бригады';
  return n + ' бригад';
}

const cityInput = document.getElementById('city');
cityInput.addEventListener('input', () => {
  cityInput.value = cityInput.value.replace(/[0-9]/g, '');
});

document.querySelectorAll('[data-teams]').forEach(btn => {
  btn.onclick = () => {
    state.teams = +btn.dataset.teams;
    document.querySelectorAll('[data-teams]').forEach(x=>x.classList.remove('selected'));
    btn.classList.add('selected');
    prog(2);
    setTimeout(()=>show('step2'),120);
  };
});

document.getElementById('next2').onclick = () => {
  const v = +document.getElementById('current').value;
  if(!Number.isFinite(v) || v < 0){
    alert('Укажи примерное количество объектов в месяц');
    return;
  }
  state.current = v;
  prog(3);
  show('step3');
};

document.getElementById('back1').onclick = ()=>{ prog(1); show('step1'); };
document.getElementById('back2').onclick = ()=>{ prog(2); show('step2'); };

document.getElementById('calc').onclick = () => {
  const c = cityInput.value.trim();
  if(!c){
    alert('Укажи город');
    return;
  }
  if(/[0-9]/.test(c)){
    alert('В названии города не должно быть цифр');
    return;
  }
  state.city = c;
  show('loading');

  setTimeout(() => {
    if(state.teams >= 5){
      document.getElementById('cityPill5').textContent = 'Город: ' + c + ' • 5+ бригад';
      show('result5');
      return;
    }

    const targetOrders = targets[state.teams];
    const orderGap = Math.max(0, targetOrders - state.current);
    const requiredMeasures = Math.ceil(targetOrders / 0.70);
    const requiredLeads = Math.ceil(requiredMeasures / 0.33);
    const requiredViews = Math.ceil(requiredLeads / VIEW_TO_LEAD_CONV);
    const avgTicket = 25000;
    const lostRevenue = orderGap * avgTicket;
    const currentRevenue = state.current * avgTicket;

    document.getElementById('cityPill').textContent = 'Город: ' + c;
    document.getElementById('orders').textContent = targetOrders;
    document.getElementById('measures').textContent = requiredMeasures;
    document.getElementById('leads').textContent = requiredLeads;
    document.getElementById('views').textContent = requiredViews;
    document.getElementById('currentShow').textContent = state.current;
    document.getElementById('gap').textContent = orderGap;
    const lostRevenueEl = document.getElementById('lostRevenue');
    lostRevenueEl.dataset.target = String(lostRevenue);
    lostRevenueEl.textContent = '••• ••• ₽';
    document.getElementById('currentRevenue').textContent = currentRevenue.toLocaleString('ru-RU') + ' ₽';
    document.getElementById('teamsLabel').textContent = pluralTeams(state.teams);
    document.getElementById('teamsGapLabel').textContent = pluralTeams(state.teams);
    document.getElementById('revenueReveal').classList.remove('revealed');

    const resultText = document.getElementById('resultText');
    if(orderGap > 0){
      resultText.innerHTML = 'Сейчас тебе не хватает примерно <b>' + orderGap + ' объектов в месяц</b> до стабильной загрузки. Чтобы выйти на нужный результат, нужен поток около <b>' + requiredLeads + ' обращений</b>, которые конвертируются примерно в <b>' + requiredMeasures + ' замера</b> и дают около <b>' + targetOrders + ' объектов</b>.';
    } else {
      resultText.innerHTML = 'По базовой модели ты уже находишься примерно на уровне стабильной загрузки. Следующий вопрос — насколько этот объём устойчив и не проседает ли загрузка по неделям.';
    }

    show('result');
  }, 5000);
};

function openLeadBox(){
  const box = document.getElementById('leadBox');
  box.classList.add('active');
  setTimeout(()=>box.scrollIntoView({behavior:'smooth', block:'start'}), 80);
}

document.getElementById('openLead').onclick = openLeadBox;
document.getElementById('openLead5').onclick = openLeadBox;

const revealObserver = new IntersectionObserver((entries)=>{
  entries.forEach(entry=>{
    if(entry.isIntersecting){
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
},{threshold:.16,rootMargin:'0px 0px -7% 0px'});

document.querySelectorAll('.reveal').forEach(el=>revealObserver.observe(el));

const revenueReveal = document.getElementById('revenueReveal');
let revenueAnimating = false;

function animateRevenueNumber(){
  const el = document.getElementById('lostRevenue');
  const target = Number(el.dataset.target || 0);
  const duration = 1450;
  const start = performance.now();
  revenueAnimating = true;

  function frame(now){
    const p = Math.min(1, (now - start) / duration);
    const ease = 1 - Math.pow(1 - p, 4);
    const jitterStrength = Math.pow(1 - p, 2);
    const jitter = (Math.random() - .5) * Math.max(target * .22, 50000) * jitterStrength;
    const value = Math.max(0, Math.round((target * ease + jitter) / 1000) * 1000);
    el.textContent = value.toLocaleString('ru-RU') + ' ₽';
    if(p < 1){
      requestAnimationFrame(frame);
    } else {
      el.textContent = target.toLocaleString('ru-RU') + ' ₽';
      revenueAnimating = false;
    }
  }
  requestAnimationFrame(frame);
}

function revealRevenue(){
  if(revenueReveal.classList.contains('revealed') || revenueAnimating) return;
  revenueReveal.classList.add('revealed');
  revenueReveal.setAttribute('aria-label','Потерянная выручка показана');
  setTimeout(animateRevenueNumber, 170);
}
revenueReveal.addEventListener('click',revealRevenue);
revenueReveal.addEventListener('keydown',(e)=>{
  if(e.key==='Enter'||e.key===' '){e.preventDefault();revealRevenue();}
});

document.getElementById('submit').onclick = async () => {
  const n = document.getElementById('name').value.trim();
  const p = document.getElementById('phone').value.trim();
  const t = document.getElementById('time').value.trim();
  if(!n || !p || !t){
    alert('Заполни имя, телефон и удобное время');
    return;
  }

  const btn = document.getElementById('submit');
  const ok = document.getElementById('success');
  const err = document.getElementById('error');

  btn.disabled = true;
  btn.textContent = 'Отправляем...';
  ok.style.display = 'none';
  err.style.display = 'none';

  let targetOrders='',orderGap='',requiredMeasures='',requiredLeads='';
  if(state.teams < 5){
    targetOrders = targets[state.teams];
    orderGap = Math.max(0, targetOrders - state.current);
    requiredMeasures = Math.ceil(targetOrders / 0.70);
    requiredLeads = Math.ceil(requiredMeasures / 0.33);
  }

  const payload = {
    name:n,
    phone:p,
    city:state.city,
    teams:state.teams,
    currentOrders:state.current,
    targetOrders,
    orderGap,
    requiredMeasures,
    requiredLeads,
    callTime:t,
    source:tracking.source,
    campaign:tracking.campaign,
    ad:tracking.ad,
    entryParams:tracking.params,
    entryUrl:tracking.entryUrl
  };

  try {
    await fetch(WEBHOOK, {
      method:'POST',
      mode:'no-cors',
      headers:{'Content-Type':'text/plain;charset=utf-8'},
      body:JSON.stringify(payload)
    });
    ok.style.display='block';
    btn.textContent='Заявка отправлена';
  } catch(e){
    console.error(e);
    err.style.display='block';
    btn.disabled=false;
    btn.textContent='Отправить заявку';
  }
};
