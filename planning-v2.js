(() => {
 'use strict';
 const FILES={sizes:['اندازهٔ ثابت کوهورت','01_cohort_sizes.csv',['sector','cohort_month','user_type','cohort_size']],activity:['فعالیت کوهورت','02_cohort_activity.csv',['sector','activity_month','cohort_month','cohort_age','user_type','active_users','orders','gross_gmv_toman','voucher_spend_toman']],mix:['ترکیب سفارش','03_cohort_mix.csv',['sector','activity_month','cohort_month','cohort_age','user_type','vertical','payment_method','order_voucher_status','orders','gross_gmv_toman','voucher_spend_toman']],control:['کنترل کل ماهانه','04_monthly_control.csv',['sector','activity_month','active_users','new_commercial_users','existing_cohort_active_users','orders','gross_gmv_toman','voucher_spend_toman','voucher_orders','non_voucher_orders','unknown_voucher_orders']],voucher:['ووچر ماهانه','05_voucher_monthly.csv',['sector','activity_month','vertical','voucher_orders','voucher_spend_toman','voucher_orders_gmv_toman']],calendar:['تقویم کسب‌وکار','06_business_calendar.csv',['month','month_start','month_end_exclusive','calendar_days','is_complete_at_cutoff']],coverage:['دسترس‌پذیری پرداخت','07_payment_coverage.csv',['sector','payment_method','available_in_forecast_month']],quality:['کنترل کیفیت','08_data_quality.csv',['scope','metric','value']]};
 const SECTORS={Commercial:'کامرشال (آنلاین)',InStore:'این استور (آفلاین)',Social:'سوشال'};
 const KEY='planning-aggregate-gregorian-v2';
 const num=new Intl.NumberFormat('fa-IR',{maximumFractionDigits:2});
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const sum=(rs,k)=>rs.reduce((s,r)=>s+(r[k]??0),0),mean=xs=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;
 const id=r=>[r.sector,r.cohort_month,r.user_type].join('|');
 const month=s=>{s=String(s);if(!/^(19|20|21)\d{2}-(0[1-9]|1[0-2])(?:-01)?$/.test(s))throw Error('ماه باید میلادی با قالب YYYY-MM یا YYYY-MM-01 باشد؛ ماه شمسی پذیرفته نمی‌شود.');return s.slice(0,7);};
 const shift=(m,n)=>{const [y,mo]=month(m).split('-').map(Number),v=y*12+mo-1+n;return `${Math.floor(v/12)}-${String(v%12+1).padStart(2,'0')}`;};
 const age=(c,m)=>c==='PRE_HISTORY'?null:(+m.slice(0,4)-+c.slice(0,4))*12+(+m.slice(5)-+c.slice(5));
 const payment=s=>({'POST PAID':'PostPaid',POSTPAID:'PostPaid',FINANCIAL:'Finance',FINANCING:'Finance',FINANCE:'Finance',INSTALLMENT:'Installment',PAYNOW:'PayNow',PAY_NOW:'PayNow'}[String(s).toUpperCase()]||String(s).trim());
 const vertical=s=>String(s).trim().toUpperCase();
 function parse(text){
  text=text.replace(/^\uFEFF/,'');let rows=[],r=[],v='',q=false;
  for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(q&&text[i+1]==='"'){v+='"';i++;}else if(q||!v)q=!q;else throw Error('نقل‌قول CSV نامعتبر است.');}else if(c===','&&!q){r.push(v.trim());v='';}else if(/[\r\n]/.test(c)&&!q){if(c==='\r'&&text[i+1]==='\n')i++;r.push(v.trim());if(r.some(Boolean))rows.push(r);r=[];v='';}else v+=c;}
  if(q)throw Error('نقل‌قول CSV بسته نشده است.');r.push(v.trim());if(r.some(Boolean))rows.push(r);const headers=rows.shift();if(!headers||new Set(headers).size!==headers.length||headers.some(x=>!x))throw Error('سرستون CSV نامعتبر است.');
  return rows.map((row,i)=>{if(row.length!==headers.length)throw Error(`تعداد ستون ردیف ${i+2} معتبر نیست.`);return Object.fromEntries(headers.map((h,j)=>[h,row[j]]));});
 }
 function validate(inputs,meta){
  if(!/^\d{4}-\d{2}-01$/.test(meta.cutoff))throw Error('نقطهٔ برش باید روز اول ماه میلادی و انحصاری باشد.');const cutoff=month(meta.cutoff);
  if(!meta.confirmed)throw Error('تعریف‌ها، واحد تومان، کامل‌بودن تاریخچه و تأیید خروج داده باید تأیید شوند.');
  const data={},forbidden=/^(id|wallet_id|user_id|order_id|merchant_id|venture_id|phone|email|national_id|registered_at|registered_date|order_number|hashed_.*|anonymous_.*)$/i;
  for(const [kind,[label,,required]] of Object.entries(FILES)){
   const rows=inputs[kind];if(!Array.isArray(rows)||!rows.length||rows.length>100000)throw Error(`${label}: فایل خالی یا تعداد ردیف نامعتبر است.`);
   data[kind]=rows.map((raw,i)=>{
    if(Object.keys(raw).some(k=>forbidden.test(k)))throw Error(`${label}: دادهٔ فردی یا شناسه پذیرفته نمی‌شود.`);
    if(required.some(k=>!Object.hasOwn(raw,k)))throw Error(`${label}: ستون‌های الزامی کامل نیستند: ${required.join(', ')}`);
    const r={...raw};if(['suppressed','is_suppressed','redacted'].some(k=>r[k]===true||r[k]===1||r[k]==='1'||r[k]==='true'))throw Error(`${label}: سلول سرکوب‌شده نیازمند قرارداد تجمیع مجاز است و بازسازی نمی‌شود.`);for(const k of Object.keys(r)){
     if(['activity_month','month','first_observed_month','last_observed_month','confirmed_launch_month','confirmed_stop_month'].includes(k)&&r[k]&&r[k]!=='PRE_HISTORY')r[k]=month(r[k]);
     if(k==='cohort_month'&&r[k]!=='PRE_HISTORY')r[k]=month(r[k]);
     if(/(_users|_orders|_toman|cohort_size|active_users|^orders$|^value$|calendar_days|cohort_age|is_complete_at_cutoff|available_in_forecast_month|active_days|campaign_days|plan_known_at_cutoff)$/.test(k)){
      if(r[k]===''||r[k]===null){r[k]=null;continue;}const n=Number(r[k]);if(!Number.isFinite(n)||n<0)throw Error(`${label} ردیف ${i+2}: ${k} عدد معتبر نیست.`);if(!k.endsWith('_toman')&&!Number.isInteger(n))throw Error(`${label}: شمارش باید صحیح باشد.`);r[k]=n;
     }
    }
    if(required.some(k=>(r[k]===null||r[k]==='')&&!(k==='cohort_age'&&r.cohort_month==='PRE_HISTORY')&&!(kind==='coverage'&&k==='available_in_forecast_month')))throw Error(`${label}: مقدار الزامی خالی است؛ مقدار سرکوب‌شده صفرسازی نمی‌شود.`);
    if(r.sector&&!Object.hasOwn(SECTORS,r.sector))throw Error(`${label}: سکتور باید Commercial، InStore یا Social باشد.`);
    if(r.payment_method)r.payment_method=payment(r.payment_method);if(r.vertical)r.vertical=vertical(r.vertical);
    if(r.user_type&&!['Organic','NonOrganic','Unknown'].includes(r.user_type))throw Error(`${label}: نوع ثابت کاربر نامعتبر است.`);
    if(r.order_voucher_status&&!['Voucher','NoVoucher','Unknown'].includes(r.order_voucher_status))throw Error(`${label}: وضعیت ووچر نامعتبر است.`);
    if(r.activity_month&&r.activity_month>=cutoff)throw Error(`${label}: دادهٔ ماه ناقص یا پس از نقطهٔ برش مجاز نیست.`);
    if(r.cohort_month&&r.cohort_month!=='PRE_HISTORY'&&r.cohort_month>=cutoff)throw Error(`${label}: کوهورت آینده یا ناقص در آموزش مجاز نیست.`);
    return r;
   });
  }
  const keys={sizes:r=>id(r),activity:r=>id(r)+'|'+r.activity_month,mix:r=>[id(r),r.activity_month,r.vertical,r.payment_method,r.order_voucher_status].join('|'),control:r=>r.sector+'|'+r.activity_month,voucher:r=>[r.sector,r.activity_month,r.vertical].join('|'),calendar:r=>r.month,coverage:r=>[r.sector,r.payment_method,r.forecast_month||''].join('|'),quality:r=>r.scope+'|'+r.metric};
  for(const k of Object.keys(data)){const seen=new Set();for(const r of data[k]){const key=keys[k](r);if(seen.has(key))throw Error(`${FILES[k][0]}: کلید تکراری.`);seen.add(key);}}
  const requiredChecks=['duplicate_order_id_excess_rows','null_wallet_rows','null_order_time_rows','conflicting_venture_mappings','rows_without_unique_mapping','null_or_nonpositive_amount_rows','voucher_above_amount_rows','negative_cohort_age_rows','null_order_id_rows'];
  if(requiredChecks.some(k=>!data.quality.some(r=>r.metric===k)))throw Error('فایل کیفیت باید تمام کنترل‌های اجباری کوئری هشتم را داشته باشد.');
  for(const r of data.quality)if(r.value>0&&!/outside_|unknown_origin|unknown_voucher/.test(r.metric))throw Error(`کنترل کیفیت عبور نکرد: ${r.scope} / ${r.metric} = ${r.value}`);
  for(const s of data.sizes)if(s.cohort_size<=0||(s.first_commercial_voucher_users??0)>s.cohort_size)throw Error('اندازهٔ ثابت کوهورت یا اولین کاربران ووچردار معتبر نیست.');
  for(const p of data.coverage)if(p.available_in_forecast_month!==null&&![0,1].includes(p.available_in_forecast_month))throw Error('دسترس‌پذیری پرداخت فقط صفر، یک یا نامعلوم است.');
  const calendar=new Map(data.calendar.map(r=>[r.month,r]));for(const r of data.calendar){const start=r.month+'-01',end=shift(r.month,1)+'-01',days=(Date.parse(end)-Date.parse(start))/86400000;if(r.month_start!==start||r.month_end_exclusive!==end||r.calendar_days!==days||![0,1].includes(r.is_complete_at_cutoff))throw Error('مرز یا تعداد روز تقویم میلادی معتبر نیست.');if(r.is_complete_at_cutoff&&r.month>=cutoff)throw Error('تقویم ماه آینده را کامل اعلام کرده است.');}
  const sizes=new Map(data.sizes.map(r=>[id(r),r]));const mix=new Map();for(const r of data.mix){const key=id(r)+'|'+r.activity_month;if(!mix.has(key))mix.set(key,[]);mix.get(key).push(r);}
  const near=(a,b)=>Math.abs(a-b)<=Math.max(.02,Math.abs(b)*1e-9);const monthly=new Map();
  for(const r of data.activity){
   const size=sizes.get(id(r));if(!size||r.active_users>size.cohort_size||r.orders<r.active_users||(r.orders>0&&r.active_users===0)||(r.orders===0&&(r.gross_gmv_toman>0||r.voucher_spend_toman>0)))throw Error('فعالیت با اندازهٔ ثابت کوهورت یا سفارش سازگار نیست.');
   const expected=age(r.cohort_month,r.activity_month);if(expected!==null&&(expected<0||r.cohort_age!==expected||expected===0&&r.active_users!==size.cohort_size))throw Error('سن یا اندازهٔ کوهورت در ماه ورود نامعتبر است.');
   if(!calendar.get(r.activity_month)?.is_complete_at_cutoff)throw Error('ماه فعالیت در تقویم بسته و کامل نیست.');
   const cells=mix.get(id(r)+'|'+r.activity_month)||[];for(const k of ['orders','gross_gmv_toman','voucher_spend_toman'])if(!near(sum(cells,k),r[k]))throw Error(`جمع فایل ترکیب با فعالیت برابر نیست: ${k} / ${r.activity_month}`);
   const key=r.sector+'|'+r.activity_month;if(!monthly.has(key))monthly.set(key,[]);monthly.get(key).push(r);
  }
  for(const r of data.mix)if(r.cohort_month!=='PRE_HISTORY'&&r.cohort_age!==age(r.cohort_month,r.activity_month))throw Error('سن کوهورت در فایل ترکیب با ماه‌های میلادی سازگار نیست.');
  const activityKeys=new Set(data.activity.map(keys.activity));if(data.mix.some(r=>!activityKeys.has(id(r)+'|'+r.activity_month)))throw Error('ترکیب سفارش بدون فعالیت متناظر وجود دارد.');
  for(const c of data.control){const rows=monthly.get(c.sector+'|'+c.activity_month);if(!rows)throw Error('کنترل ماهانه بدون فعالیت متناظر وجود دارد.');for(const k of ['orders','gross_gmv_toman','voucher_spend_toman','active_users'])if(!near(sum(rows,k),c[k]))throw Error(`کنترل کل ماهانه تطابق ندارد: ${k}`);if(c.new_commercial_users+c.existing_cohort_active_users!==c.active_users||c.voucher_orders+c.non_voucher_orders+c.unknown_voucher_orders!==c.orders)throw Error('اجزای کاربران یا سفارش کنترل برابر کل نیست.');const cells=data.mix.filter(r=>r.sector===c.sector&&r.activity_month===c.activity_month);for(const [status,field] of [['Voucher','voucher_orders'],['NoVoucher','non_voucher_orders'],['Unknown','unknown_voucher_orders']])if(sum(cells.filter(r=>r.order_voucher_status===status),'orders')!==c[field])throw Error('سهم ووچر فایل کنترل و ترکیب تطابق ندارد.');if(sum(rows.filter(r=>r.cohort_age===0),'active_users')!==c.new_commercial_users)throw Error('ورودی جدید کنترل با سن صفر برابر نیست.');}
  if(data.control.length!==monthly.size)throw Error('پوشش فایل کنترل و فعالیت برابر نیست.');
  const voucher=new Map(data.mix.filter(r=>r.order_voucher_status==='Voucher').map(r=>[[r.sector,r.activity_month,r.vertical].join('|'),[]]));for(const r of data.mix.filter(r=>r.order_voucher_status==='Voucher'))voucher.get([r.sector,r.activity_month,r.vertical].join('|')).push(r);
  for(const r of data.voucher){const rs=voucher.get([r.sector,r.activity_month,r.vertical].join('|'))||[];if(sum(rs,'orders')!==r.voucher_orders||!near(sum(rs,'voucher_spend_toman'),r.voucher_spend_toman)||!near(sum(rs,'gross_gmv_toman'),r.voucher_orders_gmv_toman))throw Error('کنترل ووچر با ترکیب سفارش تطابق ندارد.');voucher.delete([r.sector,r.activity_month,r.vertical].join('|'));}if(voucher.size)throw Error('فایل ووچر پوشش کامل ندارد.');
  for(const sector of new Set(data.sizes.map(r=>r.sector)))if(!data.control.some(r=>r.sector===sector&&r.activity_month===shift(cutoff,-1)))throw Error(`آخرین ماه بستهٔ ${sector} با نقطهٔ برش تطابق ندارد.`);
  return {...data,meta:{...meta,cutoff:meta.cutoff,version:2,calendar:'gregorian',loaded_at:new Date().toISOString()}};
 }
 function rate(ds,cohort,user,sector,target,method){
  const rows=ds.activity.filter(r=>r.sector===sector&&r.user_type===user&&r.activity_month<target);
  const sizes=new Map(ds.sizes.map(r=>[id(r),r.cohort_size]));const a=age(cohort,target);
  let chosen=method==='age'&&a!==null?rows.filter(r=>r.cohort_age===a&&r.cohort_month!=='PRE_HISTORY'):[];
  if(!chosen.length)chosen=rows.filter(r=>r.cohort_month===cohort).sort((a,b)=>a.activity_month.localeCompare(b.activity_month)).slice(-3);
  if(!chosen.length)chosen=rows.filter(r=>a===0?r.cohort_age===0:r.cohort_month==='PRE_HISTORY'?cohort==='PRE_HISTORY':r.cohort_age>0).sort((a,b)=>a.activity_month.localeCompare(b.activity_month)).slice(-12);
  const denom=chosen.reduce((s,r)=>s+(sizes.get(id(r))||0),0);return {p:a===0?1:denom?sum(chosen,'active_users')/denom:0,f:sum(chosen,'active_users')?Math.max(1,sum(chosen,'orders')/sum(chosen,'active_users')):1,r:denom?sum(chosen,'orders')/denom:0,observations:chosen.length};
 }
 function project(ds,target,selection,method='recent'){
  const rows=[],users=[],warnings=[];
  for(const size of ds.sizes.filter(r=>selection.sectors.includes(r.sector))){
   const rr=rate(ds,size.cohort_month,size.user_type,size.sector,target,method),a=age(size.cohort_month,target);
   const active=size.cohort_size*Math.min(1,rr.p),orders=Math.max(active,size.cohort_size*(method==='direct'&&a!==0?rr.r:rr.p*rr.f));
   let cells=ds.mix.filter(r=>r.sector===size.sector&&r.user_type===size.user_type&&r.activity_month<target&&r.cohort_month===size.cohort_month);
   if(!cells.length)cells=ds.mix.filter(r=>r.sector===size.sector&&r.user_type===size.user_type&&r.activity_month<target&&(a===0?r.cohort_age===0:true));
   const availableMonths=[...new Set(cells.map(r=>r.activity_month))].sort().slice(-3);cells=cells.filter(r=>availableMonths.includes(r.activity_month));
   cells=cells.filter(r=>!ds.coverage.some(p=>p.sector===r.sector&&p.payment_method===r.payment_method&&p.available_in_forecast_month===0&&(!p.forecast_month||month(p.forecast_month)===target)));
   const denominator=sum(cells,'orders');if(rr.observations&&orders===0){users.push({sector:size.sector,cohort_month:size.cohort_month,user_type:size.user_type,cohort_size:size.cohort_size,active_users:0,orders:0,activity_rate:rr.p,frequency:rr.f});continue;}if(!rr.observations||!denominator){if(size.cohort_size)warnings.push(`دادهٔ کافی برای ${size.sector}/${size.cohort_month}/${size.user_type} موجود نیست؛ پیش‌بینی این کوهورت متوقف شد.`);continue;}
   users.push({sector:size.sector,cohort_month:size.cohort_month,user_type:size.user_type,cohort_size:size.cohort_size,active_users:active,orders,activity_rate:rr.p,frequency:rr.f});
   const groups=new Map();for(const c of cells){const k=[c.vertical,c.payment_method,c.order_voucher_status].join('|');if(!groups.has(k))groups.set(k,[]);groups.get(k).push(c);}
   for(const cs of groups.values()){const c=cs[0],o=sum(cs,'orders');if(!o)continue;const predicted=orders*o/denominator,aov=sum(cs,'gross_gmv_toman')/o;
    rows.push({sector:size.sector,cohort_month:size.cohort_month,user_type:size.user_type,vertical:c.vertical,payment_method:c.payment_method,order_voucher_status:c.order_voucher_status,orders:predicted,aov_toman:aov,gross_gmv_toman:predicted*aov,voucher_spend_toman:predicted*sum(cs,'voucher_spend_toman')/o});
   }
  }
  return {rows,users,warnings};
 }
 function train(ds,selection){
  const months=[...new Set(ds.activity.map(r=>r.activity_month))].sort(),scores=[];
  for(const method of ['recent','age','direct']){
   let error=0,gmvError=0,actual=0,gmv=0,bias=0,folds=0;
   for(const t of months.slice(3).slice(-6)){
    const earlier={...ds,coverage:[],activity:ds.activity.filter(r=>r.activity_month<t),mix:ds.mix.filter(r=>r.activity_month<t),sizes:ds.sizes.filter(r=>r.cohort_month==='PRE_HISTORY'||r.cohort_month<t)};
    const p=project(earlier,t,selection,method);const truth=ds.activity.filter(r=>r.activity_month===t&&selection.sectors.includes(r.sector)&&earlier.sizes.some(s=>id(s)===id(r)));
    if(!truth.length||!p.users.length||p.warnings.length)continue;
    const a=sum(truth,'orders'),v=sum(truth,'gross_gmv_toman'),pred=sum(p.rows,'orders');error+=Math.abs(pred-a);gmvError+=Math.abs(sum(p.rows,'gross_gmv_toman')-v);actual+=a;gmv+=v;bias+=pred-a;folds++;
   }
   scores.push({method,folds,wape:actual?error/actual:null,gmv_wape:gmv?gmvError/gmv:null,bias:actual?bias/actual:null});
  }
  const valid=scores.filter(s=>s.folds>=3&&s.wape!==null).sort((a,b)=>a.wape-b.wape);return {method:valid[0]?.method||'recent',scores,validated:!!valid.length};
 }
 function forecast(ds,selection){
  if(!selection.sectors.length||!selection.verticals.length||!selection.payments.length||!selection.months.length)throw Error('از هر بخش حداقل یک گزینه انتخاب کنید.');
  if(selection.budget!==undefined&&selection.budget!==null&&(!Number.isFinite(selection.budget)||selection.budget<0))throw Error('بودجه باید عدد غیرمنفی تومان یا نامعلوم باشد.');
  const latest=shift(month(ds.meta.cutoff),-1),targets=[...new Set(selection.months.map(month))].sort();
  if(targets.some(m=>m<=latest||m>'2027-12'))throw Error('ماه‌های هدف باید پس از آخرین ماه کامل و حداکثر دسامبر ۲۰۲۷ باشند.');
  const present=new Set(ds.sizes.map(r=>r.sector));if(selection.sectors.some(s=>!present.has(s)))throw Error('برای بعضی سکتورهای انتخاب‌شده داده وارد نشده است.');
  const fitted=train(ds,selection),work=JSON.parse(JSON.stringify(ds)),results=[];
  for(let target=shift(latest,1);target<=targets.at(-1);target=shift(target,1)){
   if(!work.calendar.some(r=>r.month===target))throw Error(`تقویم ماه هدف یا میانی ${target} در فایل تقویم موجود نیست.`);
   for(const sector of selection.sectors)for(const user of ['Organic','NonOrganic','Unknown']){
    const recent=[...new Set(work.sizes.filter(s=>s.sector===sector&&s.cohort_month!=='PRE_HISTORY'&&s.cohort_month<target).map(s=>s.cohort_month))].sort().slice(-3);
    const values=recent.map(m=>sum(work.sizes.filter(s=>s.sector===sector&&s.user_type===user&&s.cohort_month===m),'cohort_size'));
    const n=mean(values);if(n>0)work.sizes.push({sector,cohort_month:target,user_type:user,cohort_size:n,predicted:true});
   }
   const p=project(work,target,selection,fitted.method);if(p.warnings.length)throw Error(p.warnings.slice(0,4).join('\n'));
   if(!p.rows.length)throw Error('ترکیب انتخاب‌شده مبنای کافی ندارد.');
   for(const u of p.users)work.activity.push({...u,activity_month:target,cohort_age:age(u.cohort_month,target),gross_gmv_toman:sum(p.rows.filter(r=>id(r)===id(u)),'gross_gmv_toman'),voucher_spend_toman:sum(p.rows.filter(r=>id(r)===id(u)),'voucher_spend_toman')});
   for(const r of p.rows)work.mix.push({...r,activity_month:target,cohort_age:age(r.cohort_month,target)});
   if(targets.includes(target)){
    const cells=p.rows.filter(r=>selection.verticals.includes(r.vertical)&&selection.payments.includes(r.payment_method));
    if(!cells.length)throw Error(`${target}: برای فیلتر انتخابی سفارشی وجود ندارد؛ این وضعیت با پیش‌بینی صفر یکسان نیست.`);
    const totalOrders=sum(cells,'orders'),gmv=sum(cells,'gross_gmv_toman');
    results.push({target,budget_toman:selection.budget??null,budget_status:selection.budget==null?'Unknown':sum(cells,'voucher_spend_toman')>selection.budget?'Exceeds budget: revise policy':'Within budget',excluded_orders:sum(p.rows,'orders')-totalOrders,rows:cells,users:p.users,orders:totalOrders,gross_gmv_toman:gmv,aov_toman:totalOrders?gmv/totalOrders:null,unique_users_scope:'شمارش جداگانهٔ هر سکتور؛ بین سکتورها و فیلتر ورتیکال/پرداخت یکتا نیست',sector_user_counts_nonadditive:sum(p.users,'active_users'),voucher_spend_toman:sum(cells,'voucher_spend_toman')});
   }
  }
  return {results,fitted,selection,cutoff:ds.meta.cutoff,notes:['مدل تجمیعی بدون اطلاعات فردی؛ اندازهٔ کوهورت ثابت × نرخ فعالیت × دفعات × سهم مشترک ترکیب × AOV وزن‌دار.','رقیب‌ها: نرخ اخیر، منحنی سن مشاهده‌شده، سفارش مستقیم به عضو؛ انتخاب با آزمون غلتان یک‌گام برای کوهورت‌های موجود. این خطا، دقت ورودی جدید یا افق چندماهه نیست.','ورودی جدید: میانگین سه کوهورت اخیر؛ ماه‌های میانی بازگشتی ساخته می‌شوند. ماه مفقود صفرسازی نمی‌شود.','اثر کمپین، فصل‌مندی، بازهٔ اطمینان و اثر علّی ووچر بدون ارزیابی کافی ادعا نمی‌شود؛ AOV مرجع وزن‌دار سه ماه اخیر است.','کاربران یکتا فقط از فعالیت بدون هم‌پوشانی می‌آیند و برای زیرمجموعهٔ ورتیکال/پرداخت قابل تعهد نیستند.','سناریوی حاضر ادامهٔ سیاست هزینهٔ مرجع است؛ بودجهٔ مصوب از هزینهٔ مصرف‌شده استنتاج نمی‌شود. بودجهٔ اختیاری فقط سقف را کنترل می‌کند؛ تغییر آن رشد علّی سفارش ایجاد نمی‌کند.','مدل در کل سکتور برازش و سهم مشترک توزیع می‌شود؛ فیلتر ورتیکال/پرداخت پس از محاسبه اعمال می‌شود و تقاضای حذف‌شده دوباره بین گزینه‌های انتخابی پخش نمی‌شود.','دسترس‌پذیری نامعلوم، غیرفعال فرض نمی‌شود؛ فقط صفر تأییدشده ماسک می‌شود.']};
 }
 function history(ds,s){const end=shift(month(ds.meta.cutoff),-1);return Array.from({length:6},(_,i)=>{const m=shift(end,i-5),cells=ds.mix.filter(r=>r.activity_month===m&&s.sectors.includes(r.sector)&&s.verticals.includes(r.vertical)&&s.payments.includes(r.payment_method));const users=ds.control.filter(r=>r.activity_month===m&&s.sectors.includes(r.sector));return {month:m,observed:cells.length>0,orders:cells.length?sum(cells,'orders'):null,gross_gmv_toman:cells.length?sum(cells,'gross_gmv_toman'):null,aov_toman:sum(cells,'orders')?sum(cells,'gross_gmv_toman')/sum(cells,'orders'):null,voucher_spend_toman:cells.length?sum(cells,'voucher_spend_toman'):null,sector_user_counts_nonadditive:users.length?sum(users,'active_users'):null};});}
 let state=null,files={},report=null,error='',busy=false;
 try{const saved=localStorage.getItem(KEY);if(saved)state=JSON.parse(saved);}catch{error='دادهٔ مرورگر قابل خواندن نیست؛ فایل‌ها را دوباره انتخاب کنید.';}
 let selection={sectors:['Commercial'],verticals:['FMCG','FASHION','H&B','GOLD','HOME','DIGITAL','SERVICES'],payments:['Installment','PostPaid','Finance','PayNow'],months:[],budget:null};
 const csv=rows=>{if(!rows.length)return '';const headers=Object.keys(rows[0]);const c=v=>{const s=String(v??'');return '"'+(/^[=+@\-\t\r]/.test(s)?"'"+s:s).replaceAll('"','""')+'"';};return '\uFEFF'+[headers,...rows.map(r=>headers.map(h=>typeof r[h]==='object'?JSON.stringify(r[h]):r[h]))].map(r=>r.map(c).join(',')).join('\r\n');};
 function save(name,text,type='text/csv;charset=utf-8'){const u=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
 const checks=(key,options)=>`<fieldset><legend>${{sectors:'سکتور',verticals:'ورتیکال',payments:'روش پرداخت',months:'ماه‌های هدف میلادی'}[key]}</legend><div class="v2-checks">${options.map(([v,label])=>`<label><input type="checkbox" data-select="${key}" value="${esc(v)}" ${selection[key].includes(v)?'checked':''}>${esc(label)}</label>`).join('')}</div></fieldset>`;
 const table=rows=>{if(!rows.length)return '<p class="notice">داده‌ای وجود ندارد.</p>';const keys=Object.keys(rows[0]);return `<div class="table-scroll"><table dir="ltr"><thead><tr>${keys.map(k=>`<th>${esc(k)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${keys.map(k=>`<td>${r[k]===null?'—':typeof r[k]==='number'?num.format(r[k]):esc(r[k])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;};
 let tab='monthly',resultMonth='';
 function render(root){
  const cutoff=state?month(state.meta.cutoff):new Date().toISOString().slice(0,7),targets=[];for(let m=cutoff;m<='2027-12';m=shift(m,1))targets.push([m,m]);
  const verts=[...new Set(['FMCG','FASHION','H&B','GOLD','HOME','DIGITAL','SERVICES',...(state?.mix.map(r=>r.vertical)||[])])],payments=[...new Set(['Installment','PostPaid','Finance','PayNow',...(state?.mix.map(r=>r.payment_method)||[])])];
  root.innerHTML=`<section class="page-heading"><div><div class="eyebrow">AGGREGATE COHORT PLANNING · GREGORIAN</div><h1>پلنینگ کوهورت، از داده تا برنامه</h1><p>انتخاب چند سکتور، ورتیکال، روش پرداخت و ماه هدف تا دسامبر ۲۰۲۷</p></div></section><div class="banner"><span>همهٔ تاریخ‌ها میلادی و مبالغ تومان‌اند. داده فقط در همین مرورگر ذخیره می‌شود؛ فایل‌های تجمیعی و خروجی‌ها را نگهداری کنید. دادهٔ فردی پذیرفته نمی‌شود.</span></div>${error?`<div class="warning" role="alert">${esc(error)}</div>`:''}<section class="panel v2-upload"><div class="panel-head"><h2>۱. ورودی‌های مدل جدید — هشت فایل تجمیعی</h2><button class="btn btn-light" id="v2-queries">دانلود قرارداد و کوئری استخراج</button></div><p class="notice">چهار فایل نسخهٔ قدیمی اندازهٔ ثابت کوهورت و ترکیب مشترک را ندارند و برای این روش کافی نیستند؛ خروجی هشت کوئری را با ماه‌های میلادی تحویل دهید. کوهورت به تفکیک سکتور و نوع ثابت کاربر است؛ PRE_HISTORY پیش از شروع تاریخچهٔ آموزش.</p><div class="bundle-grid">${Object.entries(FILES).map(([k,[label,name]])=>`<label class="bundle-slot ${files[k]?'has-file':''}"><strong>${label}</strong><span class="bundle-slot-hint">${name}</span><input type="file" data-file="${k}" accept=".csv,.json" ${busy?'disabled':''}><span class="bundle-file-meta">${files[k]?num.format(files[k].length)+' ردیف':'انتخاب CSV یا JSON'}</span></label>`).join('')}</div><div class="form-grid"><div class="field"><label>نقطهٔ برش انحصاری؛ روز اول ماه پس از آخرین ماه کامل</label><input id="v2-cutoff" type="date" value="${state?.meta.cutoff||cutoff+'-01'}"></div><label class="field-check"><input id="v2-confirm" type="checkbox">تاریخچهٔ کامل، هویت ثابت کیف پول/کاربر، ماه‌های بسته، واحد تومان، نگاشت یکتا و اجازهٔ خروج داده‌های تجمیعی را تأیید می‌کنم.</label></div><div class="form-actions"><button class="btn btn-primary" id="v2-import" ${Object.keys(files).length!==8||busy?'disabled':''}>کنترل و ثبت یکپارچه</button><span>${state?'مجموعهٔ معتبر ثبت‌شده؛ برش '+state.meta.cutoff:'تا دریافت و کنترل فایل‌ها، مدل اجرا نمی‌شود.'}</span></div></section><section class="panel v2-scope"><div class="panel-head"><h2>۲. دامنهٔ پیش‌بینی و تحلیل شش‌ماهه</h2></div>${checks('sectors',Object.entries(SECTORS))}${checks('verticals',verts.map(v=>[v,v]))}${checks('payments',payments.map(v=>[v,v]))}${checks('months',targets)}<div class="form-grid"><div class="field"><label>سقف ووچر برای هر ماه انتخاب‌شده، در دامنهٔ فیلتر (تومان؛ اختیاری)</label><input id="v2-budget" type="number" min="0" step="any" value="${selection.budget??''}" placeholder="نامعلوم؛ خالی بگذارید"><small>این سقف برای هر ماه جدا کنترل می‌شود، نه مجموع افق. عبور از سقف هشدار است؛ اثر علّی بودجه بر سفارش ادعا نمی‌شود.</small></div></div><div class="form-actions"><button class="btn btn-primary" id="v2-run" ${!state||busy?'disabled':''}>ساخت برنامهٔ ماه‌های انتخاب‌شده</button><button class="btn btn-light" id="v2-history" ${!state?'disabled':''}>نمایش شش ماه اخیر با همین فیلتر</button></div></section><section class="panel mt20"><div class="panel-head"><h2>۳. وضعیت شش ماه کامل اخیر</h2></div><div id="v2-history-result">${state?table(history(state,selection)):'<p class="notice">منتظر دادهٔ معتبر</p>'}</div><p class="table-note">کاربران فقط در هر سکتور یکتا هستند؛ جمع بین سکتورها، ورتیکال‌ها یا روش‌های پرداخت کاربران یکتای کل نیست. ماه غایب با — نشان داده می‌شود، نه صفر.</p></section><div id="v2-result">${report?resultHTML():''}</div>`;
  root.querySelectorAll('[data-select]').forEach(input=>input.onchange=()=>{const key=input.dataset.select;selection[key]=[...root.querySelectorAll(`[data-select="${key}"]:checked`)].map(n=>n.value);report=null;root.querySelector('#v2-result').innerHTML='';if(state)root.querySelector('#v2-history-result').innerHTML=table(history(state,selection));});
  root.querySelectorAll('[data-file]').forEach(input=>input.onchange=async()=>{try{const f=input.files[0];if(!f)return;if(f.size>12000000)throw Error('هر فایل حداکثر ۱۲ مگابایت است.');const text=await f.text();files[input.dataset.file]=f.name.toLowerCase().endsWith('.json')?JSON.parse(text):parse(text);error='';render(root);}catch(e){delete files[input.dataset.file];error=e.message;render(root);}});
  root.querySelector('#v2-import').onclick=()=>{try{const meta={cutoff:root.querySelector('#v2-cutoff').value,confirmed:root.querySelector('#v2-confirm').checked};const ds=validate(files,meta);localStorage.setItem(KEY,JSON.stringify(ds));state=ds;files={};report=null;selection.months=[month(ds.meta.cutoff)];error='';render(root);}catch(e){error=e.message;render(root);}};
  root.querySelector('#v2-budget').oninput=e=>{selection.budget=e.target.value===''?null:Number(e.target.value);report=null;root.querySelector('#v2-result').innerHTML='';};
  root.querySelector('#v2-run').onclick=()=>{try{error='';report=forecast(state,selection);resultMonth=report.results[0].target;render(root);}catch(e){error=e.message;render(root);}};
  root.querySelector('#v2-history').onclick=()=>{root.querySelector('#v2-history-result').innerHTML=table(history(state,selection));};
  root.querySelector('#v2-queries').onclick=async()=>{try{const response=await fetch('./extraction-contract.json');if(!response.ok)throw Error('قرارداد استخراج دریافت نشد.');const q=await response.json();save('planning-gregorian-extraction.json',JSON.stringify(q,null,2),'application/json');}catch(e){error=e.message;render(root);}};
  bindResults(root);
 }
 function legacyResult(r){const groups=new Map();for(const c of r.rows){const key=[c.sector,c.vertical,c.payment_method].join('|');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(c);}return {target:r.target,warnings:report.notes,rows:[...groups.values()].map(rs=>{const orders=sum(rs,'orders');return {vertical:rs[0].sector+' / '+rs[0].vertical,payment_method:rs[0].payment_method,orders:Math.round(orders),gross_gmv_toman:sum(rs,'gross_gmv_toman')};})};}
 function resultHTML(){const r=report.results.find(r=>r.target===resultMonth)||report.results[0];let rows;
  if(tab==='monthly')rows=report.results.map(r=>({month:r.target,orders:r.orders,aov_toman:r.aov_toman,gross_gmv_toman:r.gross_gmv_toman,budget_toman:r.budget_toman,budget_status:r.budget_status,excluded_orders:r.excluded_orders,voucher_spend_toman:r.voucher_spend_toman,sector_user_counts_nonadditive:r.sector_user_counts_nonadditive}));
  else if(tab==='daily')rows=PlanningReports.build(legacyResult(r)).daily;
  else if(tab==='cohort')rows=r.users;
  else rows=r.rows;
  return `<section class="panel mt20"><div class="panel-head"><h2>۴. خروجی برنامه — ${report.fitted.method}</h2><button class="btn btn-light" id="v2-export-all">پشتیبان کامل برنامه JSON</button></div><p class="notice">${report.notes.map(esc).join('<br>')}</p><div class="forecast-report-controls"><label>ماه خروجی<select id="v2-result-month">${report.results.map(r=>`<option ${r.target===resultMonth?'selected':''}>${r.target}</option>`).join('')}</select></label><button class="btn btn-primary" id="v2-excel">اکسل ماهانه/روزانه این ماه</button><button class="btn btn-light" id="v2-csv">CSV تب فعلی</button></div><div class="tabs-line">${[['monthly','ماهانه'],['daily','روزانه (توزیع یکنواخت)'],['cohort','کاربران کوهورت و کل سکتور'],['cells','ترکیب سفارش']].map(([v,t])=>`<button data-tab="${v}" class="${v===tab?'active':''}">${t}</button>`).join('')}</div>${table(rows)}<div class="panel-head"><h2>ارزیابی غلتان کوهورت‌های موجود — نه تضمین دقت چندگام</h2></div>${table(report.fitted.scores)}<p class="table-note">${report.fitted.validated?'انتخاب رقیب با حداقل سه برش تاریخی.':'تاریخچه برای انتخاب آماری کافی نیست؛ مدل مرجع با برچسب کم‌اتکا استفاده شد.'} بازهٔ اطمینان کالیبره‌شده هنوز گزارش نمی‌شود. اعداد سفارش مدل کسری‌اند؛ فقط در فایل روزانه و اکسل نمایش سازگار صحیح می‌شوند.</p></section>`;
 }
 function bindResults(root){if(!report)return;const r=()=>report.results.find(r=>r.target===resultMonth)||report.results[0];root.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;render(root);});root.querySelector('#v2-result-month').onchange=e=>{resultMonth=e.target.value;render(root);};root.querySelector('#v2-export-all').onclick=()=>save('planning-aggregate-results.json',JSON.stringify(report,null,2),'application/json');root.querySelector('#v2-excel').onclick=()=>{try{save('planning-'+r().target+'.xlsx',PlanningReports.workbook(PlanningReports.build(legacyResult(r()))),'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');}catch(e){error=e.message;render(root);}};root.querySelector('#v2-csv').onclick=()=>{const rows=tab==='monthly'?report.results.map(r=>({month:r.target,orders:r.orders,aov_toman:r.aov_toman,gross_gmv_toman:r.gross_gmv_toman})):tab==='daily'?PlanningReports.build(legacyResult(r())).daily:tab==='cohort'?r().users:r().rows;save('planning-'+r().target+'-'+tab+'.csv',csv(rows));};}
 globalThis.AggregatePlanning={render,validate,forecast,history,parse,FILES,shift,month,train};
})();
