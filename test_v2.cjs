const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const storage=new Map();
const context=vm.createContext({Intl,Date,console,localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)}});
vm.runInContext(fs.readFileSync('planning-v2.js','utf8'),context);
const P=context.AggregatePlanning;
const clone=x=>JSON.parse(JSON.stringify(x));
function fixture(){
 const files={sizes:[],activity:[],mix:[],control:[],voucher:[],calendar:[],coverage:[],quality:['duplicate_order_id_excess_rows','null_wallet_rows','null_order_time_rows','conflicting_venture_mappings','rows_without_unique_mapping','null_or_nonpositive_amount_rows','voucher_above_amount_rows','negative_cohort_age_rows','null_order_id_rows'].map(metric=>({scope:'all',metric,value:0}))};
 for(let m='2025-11';m<='2027-12';m=P.shift(m,1))files.calendar.push({month:m,month_start:m+'-01',month_end_exclusive:P.shift(m,1)+'-01',calendar_days:(Date.parse(P.shift(m,1)+'-01')-Date.parse(m+'-01'))/86400000,is_complete_at_cutoff:m<'2026-11'?1:0});
 for(const sector of ['Commercial','InStore','Social']){
  for(const method of ['Installment','Finance'])files.coverage.push({sector,payment_method:method,available_in_forecast_month:''});
  for(let c='2025-11';c<='2026-10';c=P.shift(c,1))for(const [user_type,cohort_size] of [['Organic',90],['NonOrganic',10]])files.sizes.push({sector,cohort_month:c,user_type,cohort_size});
  for(let m='2025-11';m<='2026-10';m=P.shift(m,1)){
   const start=files.activity.length,mixStart=files.mix.length;
   for(const s of files.sizes.filter(s=>s.sector===sector&&s.cohort_month<=m)){
    const a=(+m.slice(0,4)-+s.cohort_month.slice(0,4))*12+(+m.slice(5)-+s.cohort_month.slice(5));
    const active=s.cohort_size*(a===0?1:.5),orders=active*2;
    files.activity.push({...s,activity_month:m,cohort_age:a,active_users:active,orders,gross_gmv_toman:orders*1400,voucher_spend_toman:orders*.4*100});
    for(const [vertical,payment_method,order_voucher_status,share,aov] of [['FASHION','Installment','NoVoucher',.6,1000],['H&B','Finance','Voucher',.4,2000]])files.mix.push({...s,activity_month:m,cohort_age:a,vertical,payment_method,order_voucher_status,orders:orders*share,gross_gmv_toman:orders*share*aov,voucher_spend_toman:order_voucher_status==='Voucher'?orders*share*100:0});
   }
   const rows=files.activity.slice(start),cells=files.mix.slice(mixStart),sum=(rs,k)=>rs.reduce((s,r)=>s+r[k],0),vo=cells.filter(r=>r.order_voucher_status==='Voucher');
   files.control.push({sector,activity_month:m,active_users:sum(rows,'active_users'),new_commercial_users:100,existing_cohort_active_users:sum(rows,'active_users')-100,orders:sum(rows,'orders'),gross_gmv_toman:sum(rows,'gross_gmv_toman'),voucher_spend_toman:sum(rows,'voucher_spend_toman'),voucher_orders:sum(vo,'orders'),non_voucher_orders:sum(cells.filter(r=>r.order_voucher_status==='NoVoucher'),'orders'),unknown_voucher_orders:0});
   files.voucher.push({sector,activity_month:m,vertical:'H&B',voucher_orders:sum(vo,'orders'),gross_gmv_toman:sum(vo,'gross_gmv_toman'),voucher_orders_gmv_toman:sum(vo,'gross_gmv_toman'),voucher_spend_toman:sum(vo,'voucher_spend_toman')});
  }
 }
 return files;
}
const raw=fixture(),meta={cutoff:'2026-11-01',confirmed:true},ds=P.validate(raw,meta);
assert.equal(ds.meta.calendar,'gregorian');assert.equal(ds.sizes.length,72);
assert.throws(()=>P.month('1405-08'));
assert.equal(P.shift('2026-12',1),'2027-01');
const scope={sectors:['Commercial'],verticals:['FASHION','H&B'],payments:['Installment','Finance'],months:['2026-11','2027-02']};
const before=JSON.stringify(ds),pred=P.forecast(ds,scope);
assert.equal(JSON.stringify(ds),before,'forecast must not mutate actuals');
assert.equal(pred.results.length,2);assert.equal(pred.results[1].target,'2027-02');
assert(pred.results[1].users.some(r=>r.cohort_month==='2026-12'),'intermediate cohort is not dropped');
assert(pred.results[1].users.some(r=>r.cohort_month==='2027-01'));
for(const r of pred.results){assert(Math.abs(r.rows.reduce((s,c)=>s+c.orders,0)-r.orders)<1e-8);assert(Math.abs(r.rows.reduce((s,c)=>s+c.orders*c.aov_toman,0)-r.gross_gmv_toman)<1e-6);assert(Math.abs(r.aov_toman-r.gross_gmv_toman/r.orders)<1e-9);assert(r.users.every(u=>u.active_users<=u.cohort_size));}
assert(pred.fitted.validated);assert(pred.fitted.scores.every(s=>s.folds>=3));
const filtered=P.forecast(ds,{...scope,verticals:['H&B'],payments:['Finance']});
assert(filtered.results.every(r=>r.rows.every(c=>c.vertical==='H&B'&&c.payment_method==='Finance')));
assert(filtered.results[0].orders<pred.results[0].orders,'filter must not redistribute excluded demand');
assert.equal(filtered.results[0].sector_user_counts_nonadditive,pred.results[0].sector_user_counts_nonadditive);
const budgeted=P.forecast(ds,{...scope,budget:0});assert.equal(budgeted.results[0].orders,pred.results[0].orders);assert(budgeted.results.every(r=>r.budget_status.startsWith('Exceeds')));
assert.throws(()=>P.forecast(ds,{...scope,budget:-1}));
const all=P.forecast(ds,{...scope,sectors:['Commercial','InStore','Social']});
assert(Math.abs(all.results[0].orders-3*pred.results[0].orders)<1e-7);
const hist=P.history(ds,scope);assert.equal(hist.length,6);assert.equal(hist[0].month,'2026-05');assert.equal(hist[5].month,'2026-10');
assert(P.history(ds,{...scope,verticals:['MISSING']}).every(r=>r.orders===null));
for(const mutate of [
 f=>{f.sizes[0].wallet_id='secret';},
 f=>{f.sizes.push(clone(f.sizes[0]));},
 f=>{f.activity[0].active_users=100000;},
 f=>{f.mix[0].orders++;},
 f=>{f.control[0].active_users++;},
 f=>{f.control[0].voucher_orders++;f.control[0].non_voucher_orders--;},
 f=>{f.voucher[0].voucher_spend_toman++;},
 f=>{f.activity[0].activity_month='2026-11';},
 f=>{f.quality[0].value=1;},
 f=>{f.calendar[0].calendar_days=99;},
 f=>{f.coverage[0].available_in_forecast_month=2;},
 f=>{f.mix[0].orders='';},
]){const broken=clone(raw);mutate(broken);assert.throws(()=>P.validate(broken,meta));}
assert.throws(()=>P.validate(raw,{...meta,confirmed:false}));
assert.throws(()=>P.forecast(ds,{...scope,months:['2028-01']}));
assert.throws(()=>P.forecast(ds,{...scope,months:['2026-10']}));
assert.throws(()=>P.forecast(ds,{...scope,payments:[]}));
const masked=clone(ds);masked.coverage.forEach(p=>{if(p.payment_method==='Finance')p.available_in_forecast_month=0;});
const maskedResult=P.forecast(masked,scope);assert(maskedResult.results.every(r=>r.rows.every(c=>c.payment_method!=='Finance')));
assert.equal(JSON.stringify(P.train(masked,scope)),JSON.stringify(P.train(ds,scope)),'future payment flags must not leak into backtests');
const pre=clone(raw);
for(const k of ['sizes','activity','mix'])for(const r of pre[k])if(r.cohort_month==='2025-11'){r.cohort_month='PRE_HISTORY';if(Object.hasOwn(r,'cohort_age'))r.cohort_age=null;}
for(const r of pre.control)if(r.activity_month==='2025-11'){r.new_commercial_users=0;r.existing_cohort_active_users=r.active_users;}
const preData=P.validate(pre,meta);assert(P.forecast(preData,scope).results[0].users.some(r=>r.cohort_month==='PRE_HISTORY'));
const items=new Map(),root={innerHTML:'',querySelectorAll:()=>[],querySelector:s=>{if(!items.has(s))items.set(s,{});return items.get(s);}};
P.render(root);assert.equal((root.innerHTML.match(/data-file=/g)||[]).length,8);assert(root.innerHTML.includes('2027-12'));assert(root.innerHTML.includes('InStore'));assert(root.innerHTML.includes('PostPaid'));assert(!root.innerHTML.includes('۱۴۰۵'));
const contract=JSON.parse(fs.readFileSync('extraction-contract.json','utf8'));
assert.equal(Object.keys(contract.queries).length,8);
for(const query of Object.values(contract.queries)){assert(!query.includes('year_anchors'));assert(!query.includes('PRE_1401'));assert(query.includes('PRE_HISTORY'));}
assert(contract.queries['01_cohort_sizes.csv'].includes('GROUP BY sector, cohort_month'));
assert(contract.queries['03_cohort_mix.csv'].includes('A.sector, A.activity_month'));
assert.equal(P.parse('a,b\n"x,y",2')[0].a,'x,y');
console.log('Aggregate planning v2 passed: eight-file validation, privacy, Gregorian-only input, checkbox UI, three sectors, backtests, recursive horizons, filtered six-month history and extraction SQL contracts.');
