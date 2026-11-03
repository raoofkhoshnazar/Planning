(() => {
 'use strict';
 const tables = {
  performance: ['active_users','new_users','returning_users','orders','gross_gmv_toman','aov_toman','voucher_orders','non_voucher_orders','total_voucher_toman'],
  cohort: ['cohort_age','active_users','orders','gross_gmv_toman','aov_toman','organic_users','non_organic_users'],
  organic: ['organic_orders','non_organic_orders','organic_users','non_organic_users','organic_gmv_toman','non_organic_gmv_toman','organic_aov_toman','non_organic_aov_toman'],
  voucher: ['voucher_orders','new_voucher_users','previous_voucher_users','total_voucher_toman','voucher_orders_gmv_toman','voucher_orders_aov_toman'],
 };
 const key = 'plannama-pages-state-v1';
 const clone = value => JSON.parse(JSON.stringify(value));
 const empty = () => ({ performance: [], cohort: [], organic: [], voucher: [], runs: [], scenarios: [] });
 const digits = value => String(value).replace(/[۰-۹]/g, c => '۰۱۲۳۴۵۶۷۸۹'.indexOf(c)).replace(/[٠-٩]/g, c => '٠١٢٣٤٥٦٧٨٩'.indexOf(c));
 function period(value) {
  const match = /^(1[3-5]\d{2}|1600|19\d{2}|20\d{2}|21\d{2}|2200)-(\d{1,2})$/.exec(digits(value).trim().replace('/', '-'));
  if (!match || +match[2] < 1 || +match[2] > 12) throw Error('ماه شمسی باید به شکل 1405-07 باشد.');
  return `${match[1]}-${match[2].padStart(2, '0')}`;
 }
 const shift = (month, delta) => { const [y,m] = period(month).split('-').map(Number); const n = y * 12 + m - 1 + delta; return `${Math.floor(n / 12)}-${String(n % 12 + 1).padStart(2, '0')}`; };
 const distance = (a,b) => { const [ay,am] = a.split('-').map(Number), [by,bm] = b.split('-').map(Number); return (by-ay)*12+bm-am; };
 const total = (rows, field) => rows.reduce((s,r) => s+r[field], 0);
 const mean = values => values.length ? values.reduce((s,n) => s+n,0)/values.length : 0;
 const round = n => { const floor = Math.floor(n); return n-floor === .5 ? floor + floor % 2 : Math.round(n); };
 function read() {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : empty(); }
  catch { throw Error('دسترسی به داده‌های ذخیره‌شدهٔ مرورگر ممکن نیست؛ تنظیمات ذخیره‌سازی مرورگر را بررسی کنید.'); }
 }
 function write(state) {
  try { localStorage.setItem(key, JSON.stringify(state)); }
  catch { throw Error('فضای ذخیره‌سازی مرورگر کافی نیست یا مسدود است؛ داده‌ای ثبت نشد. از اطلاعات قبلی خروجی بگیرید.'); }
 }
 function validate(kind, rows, selectedPeriod, stored, softReconcile = false) {
  if (!Object.hasOwn(tables, kind) || !Array.isArray(rows) || !rows.length || rows.length > 30000) throw Error('نوع خروجی یا تعداد ردیف‌ها معتبر نیست (۱ تا ۳۰٬۰۰۰ ردیف).');
  const sourceMonths = new Set(rows.map(r => r?.month ?? r?.month_key ?? r?.activity_month ?? ''));
  const warnings = [], keys = new Set(stored[kind].map(r => r._key));
  const normalized = rows.map((original, i) => {
   if (!original || typeof original !== 'object' || Array.isArray(original)) throw Error(`ردیف ${i+1}: ساختار معتبر نیست.`);
   const r = { ...original };
   const sourceMonth = r['M.month'] ?? r.month ?? r.month_key ?? r.activity_month;
   const fromDate = value => { if (!/^\d{4}-\d{2}-01$/.test(String(value))) throw Error(`ردیف ${i+1}: تاریخ ماه باید روز اول و با قالب YYYY-MM-01 باشد.`); return period(value.slice(0,7)); };
   if (!r.persian_year_month && sourceMonth) r.persian_year_month = fromDate(sourceMonth);
   if (kind === 'cohort' && !r.cohort_persian_month && r.cohort_month) r.cohort_persian_month = fromDate(r.cohort_month);
   if (!r.persian_year_month && (!selectedPeriod || sourceMonths.size > 1)) throw Error('برای فایل چندماهه ستون ماه الزامی است.');
   r.persian_year_month = period(r.persian_year_month || selectedPeriod);
   r.calendar_basis = +r.persian_year_month.slice(0,4) >= 1900 ? 'gregorian' : 'persian';
   const savedBasis = stored.performance[0]?.calendar_basis || (stored.performance[0] ? (+stored.performance[0].persian_year_month.slice(0,4)>=1900 ? 'gregorian':'persian') : null);
   if (savedBasis && savedBasis !== r.calendar_basis) throw Error('داده‌های میلادی و شمسی را نمی‌توان در یک مجموعه ترکیب کرد.');
   for (const field of ['vertical', ...(kind === 'voucher' ? [] : ['payment_method'])]) {
    if (typeof r[field] !== 'string' || !r[field].trim() || r[field].length > 100) throw Error(`ردیف ${i+1}: ستون ${field} الزامی است.`);
    r[field] = r[field].trim();
   }
   for (const field of tables[kind]) {
    const raw = r[field];
    const denominator = field === 'organic_aov_toman' ? r.organic_orders : field === 'non_organic_aov_toman' ? r.non_organic_orders : null;
    if (field.endsWith('aov_toman') && (raw === null || raw === '') && denominator === 0) { r[field] = null; continue; }
    const n = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() ? Number(digits(raw).replace(/[,٬]/g,'')) : NaN;
    if (!Number.isFinite(n) || n < 0 || n > 1e18 || (!field.endsWith('_toman') && !Number.isInteger(n))) throw Error(`ردیف ${i+1}: مقدار ستون ${field} معتبر نیست.`);
    r[field] = n;
   }
   const parts = [r.persian_year_month, r.vertical];
   if (kind !== 'voucher') parts.push(r.payment_method);
   if (kind === 'cohort') {
    r.cohort_persian_month = period(r.cohort_persian_month);
    if (distance(r.cohort_persian_month,r.persian_year_month) !== r.cohort_age) throw Error(`ردیف ${i+1}: سن کوهورت با ماه فعالیت سازگار نیست.`);
    if (r.organic_users+r.non_organic_users !== r.active_users) throw Error(`ردیف ${i+1}: جمع کاربران کوهورت معتبر نیست.`);
    parts.push(r.cohort_persian_month);
   }
   r._key = JSON.stringify(parts);
   if (keys.has(r._key)) throw Error(`ردیف ${i+1}: کلید تکراری است؛ دادهٔ واقعی بازنویسی نمی‌شود.`);
   keys.add(r._key);
   if (kind === 'performance') {
    if (r.voucher_orders+r.non_voucher_orders !== r.orders) throw Error(`ردیف ${i+1}: جمع اجزای سفارش با کل برابر نیست.`);
    if (r.new_users>r.active_users || r.returning_users>r.active_users || r.active_users>r.orders) throw Error(`ردیف ${i+1}: تعداد کاربران با سفارش سازگار نیست.`);
    const expected = r.orders ? r.gross_gmv_toman/r.orders : 0;
    if ((!r.orders && r.gross_gmv_toman) || Math.abs(expected-r.aov_toman)>Math.max(1,expected*.01)) throw Error(`ردیف ${i+1}: AOV و GMV با سفارش تطابق ندارند.`);
    const prev = stored.performance.find(p => p.vertical === r.vertical && p.payment_method === r.payment_method && p.persian_year_month === shift(r.persian_year_month,-1));
    if (prev?.orders && Math.abs(r.orders/prev.orders-1)>.5) warnings.push(`تغییر سفارش بیش از ۵۰٪: ${r.vertical} / ${r.payment_method}`);
   }
   if (kind === 'voucher' && r.total_voucher_toman>r.voucher_orders_gmv_toman) throw Error(`ردیف ${i+1}: هزینهٔ ووچر از GMV بیشتر است.`);
   if (r.payment_method === 'Unknown') warnings.push(`ردیف ${i+1}: روش پرداخت ناشناخته است.`);
   return r;
  });
  if (['performance','organic'].includes(kind)) {
   const performance = kind === 'performance' ? normalized : stored.performance;
   const organic = kind === 'organic' ? normalized : stored.organic;
   const index = new Map(performance.map(r => [JSON.stringify([r.persian_year_month,r.vertical,r.payment_method]),r]));
   for (const o of organic) {
    const p = index.get(JSON.stringify([o.persian_year_month,o.vertical,o.payment_method]));
    if (p && (o.organic_orders+o.non_organic_orders !== p.orders || Math.abs(o.organic_gmv_toman+o.non_organic_gmv_toman-p.gross_gmv_toman)>1)) {
     const message = `عدم تطابق ارگانیک با عملکرد: ${o.persian_year_month} / ${o.vertical} / ${o.payment_method}`;
     if (!softReconcile) throw Error(message);
     warnings.push(message);
    }
   }
  }
  if (new Set(normalized.map(r=>r.calendar_basis)).size !== 1) throw Error('تقویم ردیف‌های یک فایل باید یکسان باشد.');
  return { rows: normalized, warnings, count: normalized.length, periods: [...new Set(normalized.map(r => r.persian_year_month))].sort() };
 }
 function prepareBundle(payload, stored) {
  if (!payload.files || Object.keys(payload.files).sort().join(',') !== Object.keys(tables).sort().join(',')) throw Error('هر چهار فایل عملکرد، کوهورت، ارگانیک و ووچر را انتخاب کنید.');
  const candidate = clone(stored), files = [], warnings = [], rejected = [];
  for (const kind of Object.keys(tables)) {
   const file = payload.files[kind];
   if (!file || typeof file !== 'object' || !Array.isArray(file.rows)) throw Error(`فایل ${kind}: ساختار ردیف‌ها معتبر نیست.`);
   let rawRows = file.rows;
   if (kind === 'cohort' && Array.isArray(rawRows)) rawRows = rawRows.filter((row,i)=>{
    if (row && /^-\d+$/.test(String(row.cohort_age).trim()) && +row.cohort_age<0) {
     rejected.push({kind,source:file.source || kind,row_number:i+2,reason:'سن کوهورت منفی است؛ ماه فعالیت پیش از ماه ورود ثبت شده است.',data:clone(row)});
     return false;
    }
    return true;
   });
   const result = validate(kind, rawRows, null, candidate, true);
   candidate[kind].push(...result.rows);
   files.push({kind,source:String(file.source || kind).slice(0,200),...result});
   warnings.push(...result.warnings);
  }
  const latest = [...new Set(files[0].rows.map(r=>r.persian_year_month))].sort().at(-1);
  const target = payload.target ? period(payload.target) : shift(latest,1);
  const basis = files[0].rows[0].calendar_basis;
  if (target !== shift(latest,1)) throw Error('ماه هدف باید ماه بلافاصله پس از آخرین ماه عملکرد باشد.');
  for (const file of files) {
   if (file.rows.some(r=>r.persian_year_month >= target)) throw Error(`فایل ${file.kind} شامل دادهٔ ماه هدف یا آینده است؛ نشت داده مجاز نیست.`);
   if (file.rows.some(r=>r.calendar_basis!==basis)) throw Error('تقویم هر چهار فایل باید یکسان باشد.');
   const missing = files[0].periods.filter(m=>!file.periods.includes(m));
   if (missing.length) warnings.push(`فایل ${file.kind}: برای ${missing.length} ماه عملکرد داده وجود ندارد.`);
  }
  const perf = new Map(candidate.performance.map(r=>[JSON.stringify([r.persian_year_month,r.vertical]),[]]));
  for (const r of candidate.performance) perf.get(JSON.stringify([r.persian_year_month,r.vertical])).push(r);
  let voucherMismatches=0;
  for (const v of files.find(f=>f.kind==='voucher').rows) {
   const p=perf.get(JSON.stringify([v.persian_year_month,v.vertical]));
   if (!p || total(p,'voucher_orders')!==v.voucher_orders || Math.abs(total(p,'total_voucher_toman')-v.total_voucher_toman)>1) voucherMismatches++;
  }
  if (voucherMismatches) warnings.push(`${voucherMismatches} ردیف ووچر با جمع عملکرد تطابق ندارد؛ تحلیل ووچر مستقل است و پیش‌بینی بر مبنای عملکرد انجام می‌شود.`);
  if (rejected.length) warnings.push(`${rejected.length} ردیف کوهورت با سن منفی قرنطینه شد و در تحلیل و پیش‌بینی استفاده نمی‌شود؛ گزارش ردیف‌ها را دریافت و منبع را اصلاح کنید.`);
  const uniqueWarnings=[...new Set(warnings)];
  return {files,warnings:uniqueWarnings,target,calendar:basis,rejected};
 }
 function assumptions(input = {}) {
  const a = { baseline:'previous',new_growth:0,aov_growth:0,retention:90,frequency:0,voucher_share:-1,voucher_cost:0,budget:0,campaign:1,auto_trend:true,notes:'',...input };
  if (!['previous','average','year'].includes(a.baseline)) throw Error('مبنای پیش‌بینی معتبر نیست.');
  const limits = {new_growth:[-100,500],aov_growth:[-100,500],retention:[0,100],frequency:[0,100],voucher_share:[-1,100],voucher_cost:[0,1e15],budget:[0,1e18],campaign:[0,10]};
  for (const [name,[low,high]] of Object.entries(limits)) {
   if (a[name] === null || a[name] === '' || typeof a[name] === 'boolean') throw Error('فرض‌های سناریو باید عدد باشند.');
   a[name] = Number(a[name]);
   if (!Number.isFinite(a[name]) || a[name]<low || a[name]>high) throw Error(`مقدار ${name} خارج از دامنه است.`);
  }
  a.notes = String(a.notes).slice(0,3000); a.auto_trend = Boolean(a.auto_trend);
  if (a.campaign !== 1 && !a.notes.trim()) throw Error('برای ضریب کمپین، مستند یا دلیل فرض را وارد کنید.');
  return a;
 }
 function forecast(ds, target, raw) {
  target = period(target); const a = assumptions(raw);
  const history = ds.performance.filter(r => r.persian_year_month<target);
  if (!history.length) throw Error('پیش از ماه هدف، دادهٔ واقعی وجود ندارد.');
  let groups = [...new Set(history.map(r => JSON.stringify([r.vertical,r.payment_method])))].sort();
  let skipped = 0;
  if (ds.training_bundle) {
   const required = a.baseline==='previous' ? [shift(target,-1)] : a.baseline==='year' ? [shift(target,-12)] : [1,2,3].map(n=>shift(target,-n));
   const eligible = groups.filter(g=>{const [v,p]=JSON.parse(g);return required.every(m=>history.some(r=>r.vertical===v && r.payment_method===p && r.persian_year_month===m));});
   skipped=groups.length-eligible.length;
   if (!eligible.length) throw Error('هیچ سگمنتی دادهٔ کامل مبنای انتخاب‌شده را ندارد.');
   groups=eligible;
  }
  const rows = groups.map(group => {
   const [vertical,payment_method] = JSON.parse(group);
   const series = history.filter(r => r.vertical===vertical && r.payment_method===payment_method).sort((a,b) => a.persian_year_month.localeCompare(b.persian_year_month));
   const months = a.baseline==='previous' ? [shift(target,-1)] : a.baseline==='year' ? [shift(target,-12)] : [1,2,3].map(n => shift(target,-n));
   const base = series.filter(r => months.includes(r.persian_year_month));
   if (base.length !== months.length) throw Error(`دادهٔ مبنای ${vertical} / ${payment_method} برای ${months.join('، ')} کامل نیست. مبنای دیگری انتخاب کنید.`);
   const avg = field => total(base,field)/base.length;
   const baseOrders=avg('orders'), baseActive=avg('active_users'), baseAov=total(base,'orders') ? total(base,'gross_gmv_toman')/total(base,'orders') : 0;
   const changes=[]; const recent=series.slice(-4);
   if (a.auto_trend) for (let i=1;i<recent.length;i++) if (recent[i-1].new_users && distance(recent[i-1].persian_year_month,recent[i].persian_year_month)===1) changes.push(Math.min(.3,Math.max(-.3,recent[i].new_users/recent[i-1].new_users-1)));
   const growth=mean(changes), newUsers=round(avg('new_users')*(1+growth)*(1+a.new_growth/100)*a.campaign);
   const cohorts=ds.cohort.filter(c => c.vertical===vertical && c.payment_method===payment_method && c.persian_year_month<target);
   const seeds=new Map(cohorts.filter(c => c.cohort_age===0).map(c => [c.cohort_persian_month,c.active_users]));
   const rates=new Map();
   for (const c of cohorts) { const size=seeds.get(c.cohort_persian_month); if (size && c.cohort_age>0) { const v=rates.get(c.cohort_age)||[0,0]; rates.set(c.cohort_age,[v[0]+c.active_users,v[1]+size]); } }
   let old, method='aggregate', extended=false;
   if (seeds.size && rates.size) {
    method='cohort'; const ages=[...rates.keys()].sort((a,b)=>a-b); const curve=new Map([...rates].map(([age,[users,size]]) => [age,Math.min(1,users/size)]));
    const retentionAt = age => { if (curve.has(age)) return curve.get(age); extended=true; const lower=ages.filter(x=>x<age),upper=ages.filter(x=>x>age); if (lower.length && upper.length) { const lo=lower.at(-1),hi=upper[0]; return curve.get(lo)+(curve.get(hi)-curve.get(lo))*(age-lo)/(hi-lo); } return curve.get(lower.length ? lower.at(-1):upper[0]); };
    old=round([...seeds].reduce((s,[m,size])=>s+size*retentionAt(distance(m,target))*a.retention/100,0));
   } else old=round(Math.max(0,baseActive-avg('new_users'))*a.retention/100);
   const active=newUsers+old, frequency=a.frequency||(baseActive ? baseOrders/baseActive:0), orders=round(active*frequency), aov=baseAov*(1+a.aov_growth/100);
   const share=a.voucher_share>=0 ? a.voucher_share/100 : baseOrders ? avg('voucher_orders')/baseOrders:0;
   const vorders=round(orders*share), cost=a.voucher_cost||(avg('voucher_orders') ? avg('total_voucher_toman')/avg('voucher_orders'):0);
   return {persian_year_month:target,vertical,payment_method,new_users:newUsers,active_users:active,orders,aov_toman:aov,gross_gmv_toman:orders*aov,voucher_orders:vorders,non_voucher_orders:orders-vorders,total_voucher_toman:vorders*cost,method,retention_interpolated_or_extended:extended,baseline_months:months,source_run_ids:[...new Set(base.map(r=>r.source_run_id||'demo'))].sort(),trend_pct:growth*100};
  });
  const voucherCost=total(rows,'total_voucher_toman');
  const warnings=['کاربران تجمیعی جمع سگمنت‌ها هستند؛ تعداد کاربران یکتای کل نیستند.','پیش‌بینی تحلیلی است، نه تضمین عملکرد یا برنامهٔ مالی قطعی.'];
  if (rows.some(r=>r.method==='aggregate')) warnings.push('کوهورت کامل برای سن‌های هدف موجود نیست؛ در سگمنت‌های علامت‌دار از تقریب کاربران قدیمی استفاده شد.');
  if (rows.some(r=>r.retention_interpolated_or_extended)) warnings.push('برای سن‌های فاقد مشاهده، منحنی نگهداشت بین سن‌های موجود خطی و پس از آخرین سن، ثابت امتداد یافته است؛ کوهورت‌های بدون سن صفر در مدل وارد نمی‌شوند.');
  if (skipped) warnings.push(`${skipped} سگمنت فاقد مبنای کامل از پیش‌بینی کنار گذاشته شد؛ برای آن‌ها عدد ساختگی تولید نشده است.`);
  if (ds.training_bundle?.warnings?.length) warnings.push(`مجموعهٔ ورودی ${ds.training_bundle.warnings.length} هشدار کیفیت تأییدشده دارد؛ خروجی صرفاً تحلیلی است.`);
  return {target,rows,assumptions:a,voucher_cost:voucherCost,budget:a.budget,over_budget:voucherCost>a.budget,budget_remaining:a.budget-voucherCost,warnings};
 }
 let demoPromise;
 async function api(path, payload) {
  const demoMode=payload?.demo===true || new URL(path,'https://local.invalid').searchParams.get('demo')==='1';
  let samples;
  if (demoMode) {
   demoPromise ||= fetch('./demo-data.json').then(r=>{if(!r.ok) throw Error('دادهٔ نمایشی دریافت نشد.'); return r.json();}).catch(e=>{demoPromise=null;throw e;});
   samples=await demoPromise;
  }
  const stored=read();
  const ds=demoMode ? clone(samples):stored;
  const route=path.split('?')[0];
  if (route==='/api/state') return clone({...ds,runs:stored.runs,scenarios:stored.scenarios.filter(s=>s.mode===(demoMode?'demo':'live'))});
  if (route==='/api/import/bundle/validate' || route==='/api/import/bundle') {
   const result=prepareBundle(payload,stored);
   const summary={...result,files:result.files.map(({rows,...file})=>file)};
   if(route.endsWith('validate')) return clone(summary);
   if(result.warnings.length && payload.confirmed_warnings!==true) throw Error('هشدارهای کیفیت را پیش از شروع پلنینگ تأیید کنید.');
   const now=new Date().toISOString();
   for(const file of result.files) {
    const id=crypto.randomUUID().replaceAll('-','').slice(0,12);
    stored[file.kind].push(...file.rows.map(r=>({...r,source_run_id:id,loaded_at:now})));
    stored.runs.unshift({id,loaded_at:now,kind:file.kind,count:file.count,warnings:JSON.stringify(result.warnings),source:file.source});
   }
   stored.training_bundle={target:result.target,calendar:result.calendar,warnings:result.warnings,rejected:result.rejected,loaded_at:now};
   write(stored); return clone(summary);
  }
  if (route==='/api/import/validate' || route==='/api/import') {
   const result=validate(payload.kind,payload.rows,payload.period,stored);
   if (route.endsWith('validate')) return clone({count:result.count,warnings:result.warnings,periods:result.periods});
   if (result.warnings.length && payload.confirmed_warnings!==true) throw Error('هشدارهای کیفیت را پیش از انتشار تأیید کنید.');
   const id=crypto.randomUUID().replaceAll('-','').slice(0,12), now=new Date().toISOString();
   stored[payload.kind].push(...result.rows.map(r=>({...r,source_run_id:id,loaded_at:now})));
   stored.runs.unshift({id,loaded_at:now,kind:payload.kind,count:result.count,warnings:JSON.stringify(result.warnings),source:String(payload.source||'file').slice(0,200)});
   write(stored); return {run_id:id,count:result.count,warnings:result.warnings};
  }
  if (route==='/api/forecast' || route==='/api/scenarios') {
   const result=forecast(ds,payload.target,payload.assumptions);
   if (route==='/api/forecast') return clone(result);
   const name=String(payload.name||'').trim().slice(0,120); if(!name) throw Error('نام سناریو را وارد کنید.');
   const id=crypto.randomUUID().replaceAll('-','').slice(0,12);
   stored.scenarios.unshift({id,name,target:result.target,status:'draft',created_at:new Date().toISOString(),approved_at:null,payload:result.assumptions,result,mode:demoMode?'demo':'live'});
   write(stored); return clone({id,result});
  }
  if (route==='/api/scenarios/approve') {
   const row=stored.scenarios.find(s=>s.id===payload.id);
   if(!row || row.status!=='draft') throw Error('فقط نسخهٔ پیش‌نویس قابل قفل‌کردن است.');
   if(row.result.over_budget) throw Error('هزینهٔ ووچر از بودجه بیشتر است؛ ابتدا نسخهٔ جدید با فرض اصلاح‌شده بسازید.');
   row.status='approved'; row.approved_at=new Date().toISOString(); write(stored); return {status:'approved'};
  }
  throw Error('مسیر موجود نیست.');
 }
 globalThis.planningLocalAPI=api;
})();
