(() => {
 'use strict';
 const fields={new_users_growth_pct:'رشد ورودی جدید در هر گام (%)',retention_growth_pct:'تغییر نرخ فعالیت کوهورت قدیمی (%)',frequency_growth_pct:'تغییر سفارش به کاربر فعال (%)',aov_growth_pct:'رشد AOV مرجع در هر گام (%)',voucher_cost_growth_pct:'تغییر هزینهٔ هر سفارش ووچردار (%)'};
 const names={optimistic:'خوش‌بینانه',realistic:'واقع‌بینانه',pessimistic:'بدبینانه'};
 function presets(){return Object.fromEntries(Object.entries(names).map(([id,name])=>{const d=id==='optimistic'?1:id==='pessimistic'?-1:0;return [id,{id,name,new_users_growth_pct:10*d,retention_growth_pct:5*d,frequency_growth_pct:5*d,aov_growth_pct:5*d,voucher_cost_growth_pct:0,budgets:{Commercial:null,InStore:null,Social:null},notes:'فرض مدیریتی نمونه؛ نه بازهٔ اطمینان آماری. مبنای واقعی از دادهٔ قبل از برش محاسبه می‌شود.'}];}));}
 function validate(raw){
  const a=JSON.parse(JSON.stringify(raw));a.name=String(a.name||'سناریوی سفارشی').trim().slice(0,120);if(!a.name)throw Error('نام سناریو الزامی است.');
  for(const field of Object.keys(fields)){const n=a[field];if(typeof n!=='number'||!Number.isFinite(n)||n< -100||n>200)throw Error(`${fields[field]} باید بین منفی ۱۰۰ و مثبت ۲۰۰ باشد.`);}
  a.budgets=a.budgets||{};for(const s of ['Commercial','InStore','Social']){const v=a.budgets[s]??null;if(v!==null&&(typeof v!=='number'||!Number.isFinite(v)||v<0||v>1e18))throw Error('بودجهٔ سکتور باید تومان غیرمنفی یا نامعلوم باشد.');a.budgets[s]=v;}
  a.notes=String(a.notes||'').slice(0,3000);return a;
 }
 function billion(value){if(value==='')return null;if(!/^\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(String(value)))throw Error('بودجهٔ میلیارد تومان باید عدد غیرمنفی باشد.');const v=Number(value)*1e9;if(!Number.isFinite(v)||v>1e18)throw Error('بودجه خارج از دامنه است.');return v;}
 function allocate(projected,assumptions,target,selection){
  const sectors=[];
  for(const sector of selection.sectors){
   const indices=projected.rows.map((r,i)=>r.sector===sector?i:-1).filter(i=>i>=0),spend=indices.reduce((s,i)=>s+projected.rows[i].voucher_spend_toman,0);
   const total=assumptions.budgets[sector],budget=selection.months.includes(target)&&total!==null?total/new Set(selection.months).size:null;
   const factor=budget===0?0:budget!==null&&spend>budget?budget/spend:1,extra=[];
   for(const i of indices){const row=projected.rows[i];if(factor<1&&row.order_voucher_status==='Voucher'){
    const removed={...row,orders:row.orders*(1-factor),gross_gmv_toman:row.gross_gmv_toman*(1-factor),voucher_spend_toman:0,order_voucher_status:'NoVoucher'};
    projected.rows[i]={...row,orders:row.orders*factor,gross_gmv_toman:row.gross_gmv_toman*factor,voucher_spend_toman:row.voucher_spend_toman*factor};extra.push(removed);
   }}
   projected.rows.push(...extra);
   const actualSpend=projected.rows.filter(r=>r.sector===sector).reduce((s,r)=>s+r.voucher_spend_toman,0);
   sectors.push({sector,total_selected_months_budget_toman:total,month_allocated_budget_toman:budget,reference_spend_toman:spend,forecast_spend_toman:actualSpend,remaining_toman:budget===null?null:Math.max(0,budget-actualSpend),policy:factor<1?'سقف اعمال شد؛ سهم مازاد به بدون ووچر منتقل شد':'سیاست مرجع یا بودجهٔ کافی'});
  }
  const combined=new Map();for(const r of projected.rows){const k=[r.sector,r.cohort_month,r.user_type,r.vertical,r.payment_method,r.order_voucher_status].join('|');if(!combined.has(k))combined.set(k,{...r});else{const c=combined.get(k);c.orders+=r.orders;c.gross_gmv_toman+=r.gross_gmv_toman;c.voucher_spend_toman+=r.voucher_spend_toman;c.aov_toman=c.orders?c.gross_gmv_toman/c.orders:null;}}
  projected.rows=[...combined.values()];return sectors;
 }
 function runAll(ds,selection,assumptions){return Object.fromEntries(Object.entries(assumptions).map(([key,a])=>[key,AggregatePlanning.forecast(ds,{...selection,scenario:validate(a)})]));}
 const storageKey='planning-scenario-versions-v1';
 function versions(){try{return JSON.parse(localStorage.getItem(storageKey)||'[]');}catch{throw Error('خواندن نسخه‌های سناریو ممکن نیست.');}}
 function saveVersion(name,report,ds){if(!name.trim())throw Error('نام نسخه را وارد کنید.');const version={id:crypto.randomUUID(),name:name.trim().slice(0,120),created_at:new Date().toISOString(),data_cutoff:report.cutoff,source_loaded_at:report.source_loaded_at??ds.meta.loaded_at,assumptions:JSON.parse(JSON.stringify(report.selection.scenario)),selection:JSON.parse(JSON.stringify(report.selection)),report:JSON.parse(JSON.stringify(report))};const all=versions();all.unshift(version);try{localStorage.setItem(storageKey,JSON.stringify(all));}catch{throw Error('فضای مرورگر برای ذخیره نسخه کافی نیست؛ خروجی JSON بگیرید.');}return version;}
 globalThis.PlanningScenarios={fields,names,presets,validate,billion,allocate,runAll,versions,saveVersion};
})();
