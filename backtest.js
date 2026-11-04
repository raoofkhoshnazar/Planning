(() => {
 'use strict';
 const sum=(rows,key)=>rows.reduce((n,r)=>n+(r[key]??0),0);
 const cohortKey=r=>[r.sector,r.cohort_month,r.user_type].join('|');
 const cellKey=r=>[cohortKey(r),r.vertical,r.payment_method,r.order_voucher_status].join('|');
 const selected=(r,s)=>s.sectors.includes(r.sector)&&s.verticals.includes(r.vertical)&&s.payments.includes(r.payment_method);
 function snapshot(ds,origin){
  const copy=JSON.parse(JSON.stringify(ds));
  copy.sizes=copy.sizes.filter(r=>r.cohort_month==='PRE_HISTORY'||r.cohort_month<origin);
  for(const key of ['activity','mix','control','voucher'])copy[key]=copy[key].filter(r=>r.activity_month<origin);
  copy.coverage=copy.coverage.filter(r=>r.known_at_cutoff && /^\d{4}-\d{2}-\d{2}$/.test(r.known_at_cutoff)&&r.known_at_cutoff<origin+'-01');
  copy.calendar=copy.calendar.map(r=>({...r,is_complete_at_cutoff:Number(r.month<origin),active_days:null,campaign_days:null,business_events:null,plan_known_at_cutoff:null,committed_voucher_budget_toman:null}));
  copy.meta={...copy.meta,cutoff:origin+'-01'};
  return copy;
 }
 function comparisons(level,keys,predicted,actual,metrics,extra={}){
  const p=new Map(predicted.map(r=>[keys(r),r])),a=new Map(actual.map(r=>[keys(r),r]));const rows=[];
  for(const key of new Set([...p.keys(),...a.keys()])){
   const pr=p.get(key),ar=a.get(key),sample=pr||ar;
   const dimensions=level==='monthly'?{}:Object.fromEntries(['sector','cohort_month','user_type',...(level==='cells'?['vertical','payment_method','order_voucher_status']:[])].map(k=>[k,sample[k]]));
   for(const metric of metrics){const predictedValue=pr?.[metric]??null,actualValue=ar?.[metric]??null,comparable=typeof predictedValue==='number'&&typeof actualValue==='number';rows.push({...extra,level,...dimensions,metric,evaluation_weight:metric==='aov_toman'?(ar?.orders??null):1,predicted:predictedValue,actual:actualValue,error:comparable?predictedValue-actualValue:null,absolute_error:comparable?Math.abs(predictedValue-actualValue):null,error_pct:comparable&&actualValue!==0?(predictedValue-actualValue)/actualValue*100:null,achievement_pct:comparable&&predictedValue!==0?actualValue/predictedValue*100:null,status:comparable?'comparable':!pr?'actual_only':!ar?'prediction_only':'undefined_ratio'});}
  }
  return rows;
 }
 function summarize(rows){
  return [...new Set(rows.map(r=>r.metric))].map(metric=>{const rs=rows.filter(r=>r.metric===metric&&r.status==='comparable'),weight=r=>metric==='aov_toman'?(r.evaluation_weight??0):1,totalWeight=rs.reduce((s,r)=>s+weight(r),0),denom=rs.reduce((s,r)=>s+r.actual*weight(r),0),absolute=rs.reduce((s,r)=>s+r.absolute_error*weight(r),0),signed=rs.reduce((s,r)=>s+r.error*weight(r),0);return {metric,weighting:metric==='aov_toman'?'actual orders':'one per month',observations:rs.length,unavailable:rows.filter(r=>r.metric===metric&&r.status!=='comparable').length,mae:totalWeight?absolute/totalWeight:null,wape_pct:denom?absolute/denom*100:null,bias_pct:denom?signed/denom*100:null};});
 }
 function run(ds,selection,months,horizon=1){
  const P=globalThis.AggregatePlanning;
  if(!Number.isInteger(horizon)||horizon<1||horizon>24)throw Error('افق بک تست باید بین ۱ تا ۲۴ ماه باشد.');
  if(['sectors','verticals','payments'].some(k=>!Array.isArray(selection[k])||!selection[k].length))throw Error('از هر فیلتر سکتور، ورتیکال و پرداخت حداقل یک گزینه انتخاب کنید.');
  if(!Array.isArray(months)||!months.length)throw Error('حداقل یک ماه تاریخی انتخاب کنید.');
  const targets=[...new Set(months.map(P.month))].sort(),monthly=[],cohorts=[],cells=[],folds=[],skipped=[];
  for(const target of targets){
   const origin=P.shift(target,1-horizon);
   try{
    if(target>=P.month(ds.meta.cutoff))throw Error('ماه هدف هنوز بسته نیست یا پس از نقطهٔ برش است.');
    if(selection.sectors.some(s=>!ds.control.some(r=>r.sector===s&&r.activity_month===target)))throw Error('اکچوال کامل تمام سکتورهای انتخاب‌شده در این ماه وجود ندارد.');
    const historical=snapshot(ds,origin);
    if(selection.sectors.some(s=>new Set(historical.control.filter(r=>r.sector===s).map(r=>r.activity_month)).size<3))throw Error('پیش از نقطهٔ برش حداقل سه ماه اکچوال در هر سکتور لازم است.');
    if(selection.sectors.some(s=>!historical.control.some(r=>r.sector===s&&r.activity_month===P.shift(origin,-1))))throw Error('اکچوال ماه بلافاصله قبل از برش کامل نیست.');
    const scope={...selection,months:[target],budget:null};
    const projected=P.forecast(historical,scope),pr=projected.results[0];
    const actualCells=ds.mix.filter(r=>r.activity_month===target&&selected(r,selection));
    if(!actualCells.length)throw Error('اکچوال ترکیب انتخابی موجود نیست؛ نبود ردیف، صفر فرض نمی‌شود.');
    const allActual=ds.mix.filter(r=>r.activity_month===target&&selection.sectors.includes(r.sector));
    const controls=ds.control.filter(r=>r.activity_month===target&&selection.sectors.includes(r.sector));
    const orders=sum(actualCells,'orders'),gmv=sum(actualCells,'gross_gmv_toman');
    const actual={orders,gross_gmv_toman:gmv,aov_toman:orders?gmv/orders:null,voucher_spend_toman:sum(actualCells,'voucher_spend_toman'),excluded_orders:sum(allActual,'orders')-orders,sector_user_counts_nonadditive:sum(controls,'active_users')};
    const extra={target,origin_exclusive:origin+'-01',horizon,method:projected.fitted.method};
    monthly.push(...comparisons('monthly',()=>target,[pr],[actual],Object.keys(actual),extra));
    const sizes=new Map(ds.sizes.map(r=>[cohortKey(r),r.cohort_size]));
    const actualUsers=ds.activity.filter(r=>r.activity_month===target&&selection.sectors.includes(r.sector)).map(r=>({...r,cohort_size:sizes.get(cohortKey(r))??null,activity_rate:sizes.get(cohortKey(r))?r.active_users/sizes.get(cohortKey(r)):null,frequency:r.active_users?r.orders/r.active_users:null}));
    cohorts.push(...comparisons('cohorts',cohortKey,pr.users,actualUsers,['cohort_size','active_users','orders','activity_rate','frequency'],extra));
    cells.push(...comparisons('cells',cellKey,pr.rows,actualCells.map(r=>({...r,aov_toman:r.orders?r.gross_gmv_toman/r.orders:null})),['orders','aov_toman','gross_gmv_toman','voucher_spend_toman'],extra));
    folds.push({...extra,status:'evaluated',training_last_month:P.shift(origin,-1),training_months:new Set(historical.activity.map(r=>r.activity_month)).size,nested_model_selection:projected.fitted.validated?'historical folds only':'insufficient history: recent baseline',prediction_rows:pr.rows.length,actual_rows:actualCells.length});
   }catch(e){skipped.push({target,origin_exclusive:origin+'-01',horizon,status:'not_evaluated',reason:e.message});}
  }
  return {selection:{sectors:[...selection.sectors],verticals:[...selection.verticals],payments:[...selection.payments]},horizon,requested_months:targets,folds,skipped,monthly,cohorts,cells,summary:summarize(monthly),notes:[
   'همان تابع پیش‌بینی عملیاتی برای هر برش تاریخی اجرا می‌شود؛ ورودی جدید و کوهورت‌های ماه‌های میانی نیز پیش‌بینی می‌شوند.',
   'برش تاریخی انحصاری است؛ فعالیت، ترکیب، کنترل، ووچر و کوهورت‌های آینده وارد آموزش یا انتخاب مدل نمی‌شوند.',
   'دسترس‌پذیری پرداخت فقط با known_at_cutoff میلادیِ قبل از برش تاریخی استفاده می‌شود؛ تأیید امروزی به گذشته نسبت داده نمی‌شود. تاریخ تقویم معلوم است، اطلاعات کسب‌وکار آینده پاک می‌شود.',
   'بودجهٔ امروزی، هزینهٔ واقعی هدف یا سیاست نامعلوم تاریخی ورودی مدل نیست؛ هزینهٔ ووچر مرجع پیش‌بینی و با مصرف اکچوال مقایسه می‌شود. بودجه و وضعیت سقف، اکچوال عملکرد نیستند و معیار خطا ندارند.',
   'کاربران فقط در هر سکتور یکتا هستند و برای زیرمجموعهٔ ورتیکال/پرداخت یا جمع بین سکتورها یکتای کل محسوب نمی‌شوند.',
   'نبود ردیف سلولی یا کوهورت صفر نمی‌شود؛ موارد actual_only و prediction_only گزارش می‌شوند و از معیارهای قابل‌مقایسه کنار می‌روند.',
   'وقتی اکچوال صفر باشد خطای درصدی تعریف ندارد؛ MAE قابل محاسبه می‌ماند. WAPE و Bias بر مجموع اکچوال ماه‌های قابل ارزیابی محاسبه می‌شوند.',
   'AOV از GMV تقسیم بر سفارش ساخته می‌شود؛ خطاهای خلاصهٔ AOV با سفارش اکچوال وزن‌گذاری می‌شوند، نه میانگین سادهٔ AOV ماه‌ها.',
   'ورودی روزانهٔ اکچوال نداریم؛ تطبیق روزانه ساخته نمی‌شود. روزانهٔ برنامه صرفاً توزیع ماهانه است.',
   'این آزمون با نسخهٔ فعلی تاریخچه بازسازی می‌شود؛ اصلاحات بعدی منبع، نگاشت و کوهورت یا تعریف هویت را بدون snapshot استخراج‌های تاریخی نمی‌توان به وضعیت واقعی آن زمان برگرداند.',
  ]};
 }
 globalThis.PlanningBacktest={run,snapshot,summarize};
})();
