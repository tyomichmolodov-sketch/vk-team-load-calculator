const webApp = window.Telegram && window.Telegram.WebApp;
if (webApp) {
  webApp.ready();
  webApp.expand();
}
const leadEndpoint = './api/lead.php';
const VIEW_TO_LEAD_CONV = 0.145;
const targets={1:24,2:44,3:67,4:83};

function readEntryParams(){
  // Presentation only; the server trusts signed initData.start_param, never this field.
  const params = new URLSearchParams(window.location.search);
  const key = String(webApp?.initDataUnsafe?.start_param || params.get('tgWebAppStartParam') || '');
  const labels = {yt:'YouTube',ig:'Instagram',tg:'Telegram'};
  return {
    source: labels[key] || 'Telegram',
    campaign: key || 'tg',
    ad: ''
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

const phoneInput = document.getElementById('phone');
phoneInput.addEventListener('input', () => {
  let digits = phoneInput.value.replace(/\D/g, '');
  if(digits.startsWith('8')) digits = '7' + digits.slice(1);
  if(!digits.startsWith('7')) digits = '7' + digits;
  digits = digits.slice(0, 11);

  const p1 = digits.slice(1, 4);
  const p2 = digits.slice(4, 7);
  const p3 = digits.slice(7, 9);
  const p4 = digits.slice(9, 11);

  let formatted = '+7';
  if(p1) formatted += ' (' + p1;
  if(p1.length === 3) formatted += ')';
  if(p2) formatted += ' ' + p2;
  if(p3) formatted += '-' + p3;
  if(p4) formatted += '-' + p4;
  phoneInput.value = formatted;
});

const timeInput = document.getElementById('time');
const openDatePicker = document.getElementById('openDatePicker');
const closeDatePicker = document.getElementById('closeDatePicker');
const dateModal = document.getElementById('dateModal');
const calendarGrid = document.getElementById('calendarGrid');
const monthLabel = document.getElementById('monthLabel');
const prevMonth = document.getElementById('prevMonth');
const nextMonth = document.getElementById('nextMonth');
const callTimePicker = document.getElementById('callTimePicker');
const callTimeDisplay = document.getElementById('callTimeDisplay');
const confirmDateTime = document.getElementById('confirmDateTime');

const todayStart = new Date();
todayStart.setHours(0,0,0,0);
let calendarCursor = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
let selectedDate = null;

function sameDay(a,b){
  return a && b && a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
}
function renderCalendar(){
  const y=calendarCursor.getFullYear();
  const m=calendarCursor.getMonth();
  monthLabel.textContent = calendarCursor.toLocaleDateString('ru-RU',{month:'long',year:'numeric'});
  calendarGrid.innerHTML='';
  const firstDay=(new Date(y,m,1).getDay()+6)%7;
  const daysInMonth=new Date(y,m+1,0).getDate();
  for(let i=0;i<firstDay;i++){
    calendarGrid.appendChild(document.createElement('div'));
  }
  for(let d=1;d<=daysInMonth;d++){
    const date=new Date(y,m,d);
    const btn=document.createElement('button');
    btn.type='button';
    btn.className='dayBtn';
    btn.textContent=d;
    if(sameDay(date,todayStart)) btn.classList.add('today');
    if(sameDay(date,selectedDate)) btn.classList.add('selected');
    if(date<todayStart) btn.disabled=true;
    btn.onclick=()=>{
      selectedDate=date;
      renderCalendar();
    };
    calendarGrid.appendChild(btn);
  }
  const currentMonthStart=new Date(todayStart.getFullYear(),todayStart.getMonth(),1);
  prevMonth.disabled = calendarCursor <= currentMonthStart;
}

function openCalendar(){
  if(!selectedDate) selectedDate=new Date(todayStart);
  calendarCursor=new Date(selectedDate.getFullYear(),selectedDate.getMonth(),1);
  if(!callTimePicker.value){
    const now=new Date();
    now.setMinutes(Math.ceil(now.getMinutes()/15)*15,0,0);
    callTimePicker.value=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
  }
  renderCalendar();
  dateModal.classList.add('active');
  dateModal.setAttribute('aria-hidden','false');
}
function closeCalendar(){
  dateModal.classList.remove('active');
  dateModal.setAttribute('aria-hidden','true');
}
openDatePicker.onclick=openCalendar;
closeDatePicker.onclick=closeCalendar;
dateModal.addEventListener('click',(e)=>{ if(e.target===dateModal) closeCalendar(); });
prevMonth.onclick=()=>{ calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()-1,1); renderCalendar(); };
nextMonth.onclick=()=>{ calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()+1,1); renderCalendar(); };

confirmDateTime.onclick=()=>{
  if(!selectedDate){
    alert('Выбери дату');
    return;
  }
  if(!callTimePicker.value){
    alert('Выбери время');
    return;
  }
  const [hh,mm]=callTimePicker.value.split(':').map(Number);
  const chosen=new Date(selectedDate.getFullYear(),selectedDate.getMonth(),selectedDate.getDate(),hh,mm,0,0);
  if(chosen.getTime()<Date.now()){
    alert('Выбери время позже текущего');
    return;
  }
  const yyyy=chosen.getFullYear();
  const mo=String(chosen.getMonth()+1).padStart(2,'0');
  const dd=String(chosen.getDate()).padStart(2,'0');
  const h=String(chosen.getHours()).padStart(2,'0');
  const min=String(chosen.getMinutes()).padStart(2,'0');
  timeInput.value=yyyy+'-'+mo+'-'+dd+'T'+h+':'+min;
  callTimeDisplay.textContent=chosen.toLocaleDateString('ru-RU',{day:'numeric',month:'long'})+', '+h+':'+min;
  openDatePicker.classList.add('hasValue');
  closeCalendar();
};

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
  const raw = document.getElementById('current').value.trim();
  if(raw === ''){
    alert('Укажи примерное количество объектов в месяц');
    return;
  }
  const v = Number(raw);
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
  const consent = document.getElementById('privacyConsent').checked;
  if(!n || !p || !t){
    alert('Заполни имя, телефон и выбери дату и время');
    return;
  }
  const phoneDigits = p.replace(/\D/g, '');
  if(phoneDigits.length !== 11){
    alert('Укажи номер телефона полностью');
    return;
  }
  const selectedCallTime = new Date(t);
  if(Number.isNaN(selectedCallTime.getTime()) || selectedCallTime.getTime() < Date.now()){
    alert('Выбери будущую дату и время для звонка');
    return;
  }
  if(!consent){
    alert('Подтверди согласие на обработку персональных данных');
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

  if (!webApp || !webApp.initData) {
    err.textContent='Открой калькулятор через Telegram-бота @Aspeckor_bot.';
    err.style.display='block';
    btn.disabled=false;
    btn.textContent='Отправить заявку';
    return;
  }

  const payload = {
    initData: webApp.initData,
    name:n,
    phone:p,
    city:state.city,
    teams:state.teams,
    currentOrders:state.current,
    callTime:t,
    timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Moscow',
    consent:true
  };

  try {
    const response = await fetch(leadEndpoint,{
      method:'POST',
      headers:{'Content-Type':'application/json','Accept':'application/json'},
      cache:'no-store',
      body:JSON.stringify(payload)
    });
    const answer=await response.json().catch(()=>null);
    if(!response.ok || !answer || answer.ok!==true) {
      throw new Error('DELIVERY_NOT_CONFIRMED');
    }
    ok.style.display='none';
    btn.textContent='Заявка отправлена';
    document.getElementById('leadBox').classList.remove('active');
    const thankScreen=document.getElementById('thankScreen');
    thankScreen.classList.add('active');
    setTimeout(()=>thankScreen.scrollIntoView({behavior:'smooth',block:'center'}),80);
  } catch(e) {
    err.textContent='Не удалось подтвердить доставку заявки. Попробуй ещё раз.';
    err.style.display='block';
    btn.disabled=false;
    btn.textContent='Отправить заявку';
  }
};
