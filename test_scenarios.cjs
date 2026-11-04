const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {randomUUID}=require('node:crypto'),{fixture}=require('./test_v2.cjs');
const stored=new Map();let failStorage=false;
const ctx=vm.createContext({Intl,Date,console,crypto:{randomUUID},localStorage:{getItem:k=>stored.get(k)||null,setItem:(k,v)=>{if(failStorage)throw Error('quota');stored.set(k,v);}}});
for(const file of ['input-contract.js','scenarios.js','planning-v2.js'])vm.runInContext(fs.readFileSync(file,'utf8'),ctx);
const P=ctx.AggregatePlanning,S=ctx.PlanningScenarios,I=ctx.PlanningInputContract,clone=x=>JSON.parse(JSON.stringify(x));
const raw=fixture(),meta={cutoff:'2026-11-01',confirmed:true};
const strings=clone(raw);
for(const rows of Object.values(strings))for(const row of rows)for(const k of Object.keys(row))if(typeof row[k]==='number')row[k]=String(row[k]);
const ds=P.validate(strings,meta),scope={sectors:['Commercial','InStore','Social'],verticals:['FASHION','H&B'],payments:['Installment','Finance'],months:['2026-11','2027-01'],budget:null};
assert.equal(typeof ds.sizes[0].cohort_size,'number');
const original=JSON.stringify(ds),settings=S.presets(),all=S.runAll(ds,scope,settings);
assert.equal(JSON.stringify(ds),original);
assert.equal(Object.keys(all).length,3);
for(let i=0;i<2;i++){
 assert(all.optimistic.results[i].orders>all.realistic.results[i].orders);
 assert(all.realistic.results[i].orders>all.pessimistic.results[i].orders);
 for(const rep of Object.values(all))for(const r of rep.results){assert(Math.abs(r.rows.reduce((s,c)=>s+c.orders,0)-r.orders)<1e-6);assert(Math.abs(r.rows.reduce((s,c)=>s+c.orders*c.aov_toman,0)-r.gross_gmv_toman)<1e-4);assert(r.users.every(u=>u.active_users<=u.cohort_size));}
}
const reference=P.forecast(ds,scope);assert.equal(reference.results[0].orders,all.realistic.results[0].orders);
assert.equal(S.billion('1.25'),1250000000);assert.equal(S.billion('1e-9'),1);assert.equal(S.billion('0'),0);assert.equal(S.billion(''),null);
for(const x of ['-1','1x','Infinity','NaN'])assert.throws(()=>S.billion(x));
const custom=S.presets().realistic;custom.name='Custom test';custom.budgets={Commercial:1000,InStore:0,Social:2000};
const constrained=P.forecast(ds,{...scope,scenario:custom});
for(const sector of scope.sectors){
 const budgets=constrained.results.flatMap(r=>r.sector_budgets.filter(b=>b.sector===sector));
 assert.equal(budgets.reduce((s,b)=>s+b.month_allocated_budget_toman,0),custom.budgets[sector]);
 assert(budgets.reduce((s,b)=>s+b.forecast_spend_toman,0)<=custom.budgets[sector]+1e-6);
}
assert(constrained.results.every(r=>r.rows.filter(c=>c.sector==='InStore').every(c=>c.order_voucher_status!=='Voucher'||c.orders===0)));
assert(Math.abs(constrained.results[0].orders-reference.results[0].orders)<1e-8,'budget cap reallocates mix, not causal demand');
assert(Math.abs(constrained.results[0].gross_gmv_toman-reference.results[0].gross_gmv_toman)<1e-6);
const zeroScenario={...S.presets().realistic,new_users_growth_pct:-100,retention_growth_pct:-100};const zeros=P.forecast(ds,{...scope,scenario:zeroScenario});assert(zeros.results.every(r=>r.orders===0&&r.gross_gmv_toman===0&&r.aov_toman===null));
const narrower=P.forecast(ds,{...scope,verticals:['H&B'],payments:['Finance'],scenario:custom});
assert.equal(narrower.results[0].sector_budgets[0].forecast_spend_toman,constrained.results[0].sector_budgets[0].forecast_spend_toman,'sector budgets are not duplicated or changed by cell filters');
for(const r of constrained.results){const keys=r.rows.map(c=>[c.sector,c.cohort_month,c.user_type,c.vertical,c.payment_method,c.order_voucher_status].join('|'));assert.equal(new Set(keys).size,keys.length);}
const saved=S.saveVersion('Frozen version',constrained,ds);custom.aov_growth_pct=50;assert.equal(constrained.selection.scenario.aov_growth_pct,0,'calculated assumptions must not change when the editor changes');constrained.results[0].orders=1;
assert.notEqual(S.versions()[0].report.results[0].orders,1);
const again=S.saveVersion('Another version',all.optimistic,ds);assert.notEqual(saved.id,again.id);assert.equal(S.versions().length,2);
const firstCopy=S.versions()[1];firstCopy.report.results=[];assert(S.versions()[1].report.results.length>0);
failStorage=true;assert.throws(()=>S.saveVersion('No space',all.optimistic,ds));failStorage=false;assert.equal(S.versions().length,2);
assert.throws(()=>S.validate({...S.presets().realistic,new_users_growth_pct:NaN}));
assert.throws(()=>S.validate({...S.presets().realistic,budgets:{Commercial:-1}}));
const shuffled=Object.fromEntries(Object.entries(raw).map(([key,rows])=>[key,rows.map(r=>Object.fromEntries(Object.entries(r).reverse()))]));
assert.equal(P.validate(shuffled,meta).mix.length,ds.mix.length);
assert.equal(I.normalize('sizes',[{sector:'Commercial',cohort_month:'PRE_HISTORY',cohort_month_index:'\\N',user_type:'Organic',cohort_size:'12',first_commercial_voucher_users:'1'}])[0].cohort_month_index,null);
assert.throws(()=>I.normalize('sizes',[{cohort_size:true}]));assert.throws(()=>I.normalize('sizes',[{cohort_size:'0x10'}]));assert.throws(()=>I.normalize('sizes',[{cohort_size:'1.1'}]));
assert.throws(()=>I.normalize('sizes',[{cohort_month:'2026-10',cohort_month_index:'99'}]));
const noVoucher=clone(raw);for(const c of noVoucher.mix){c.order_voucher_status='NoVoucher';c.voucher_spend_toman=0;}
for(const r of noVoucher.activity)r.voucher_spend_toman=0;
for(const r of noVoucher.control){r.voucher_spend_toman=0;r.non_voucher_orders=r.orders;r.voucher_orders=0;}
noVoucher.voucher=[];assert.equal(P.validate(noVoucher,meta).voucher.length,0);
assert.throws(()=>I.normalize('voucher',P.parse('wrong_header\n')));
assert.equal(I.normalize('voucher',P.parse(I.schema.voucher.split(' ').join(',')+'\n')).length,0);
if(fs.existsSync('outputs/query-output-examples-data.json')){
 const exported=JSON.parse(fs.readFileSync('outputs/query-output-examples-data.json','utf8')),fromCSV={};
 for(const [kind,rows] of Object.entries(exported)){
  const headers=I.schema[kind].split(' ').reverse(),cell=v=>'"'+String(v===null?'\\N':v).replaceAll('"','""')+'"';
  const text='\uFEFF'+[headers,...rows.map(r=>headers.map(h=>r[h]))].map(r=>r.map(cell).join(',')).join('\r\n');
  fromCSV[kind]=P.parse(text);
 }
 const exact=P.validate(fromCSV,meta);assert.equal(exact.sizes.length,exported.sizes.length);assert.equal(exact.mix.length,exported.mix.length);
 assert.deepEqual(Object.keys(exact.sizes[0]).slice(0,6),Array.from(I.schema.sizes.split(' ')));
 console.log('Full query output example imported successfully through BOM/CRLF/reordered CSV with ClickHouse NULL markers.');
}
const nodes=new Map(),root={innerHTML:'',querySelectorAll:()=>[],querySelector:s=>{if(!nodes.has(s))nodes.set(s,{});return nodes.get(s);}};
P.render(root);assert(root.innerHTML.includes('خوش‌بینانه'));assert(root.innerHTML.includes('میلیارد تومان'));assert(root.innerHTML.includes('نسخهٔ مستقل'));
stored.set('planning-aggregate-gregorian-v2',JSON.stringify(ds));vm.runInContext(fs.readFileSync('planning-v2.js','utf8'),ctx);ctx.AggregatePlanning.render(root);
const targetInput={dataset:{select:'months'},value:'2026-11',checked:true};
const assumptionInputs=Object.keys(S.fields).map(key=>({dataset:{assumption:key},value:0}));
const budgetInputs=['Commercial','InStore','Social'].map(sector=>({dataset:{sectorBudget:sector},value:sector==='Commercial'?'0.000001':''}));
root.querySelectorAll=selector=>selector==='[data-select]'?[targetInput]:selector==='[data-select="months"]:checked'?[targetInput]:selector==='[data-assumption]'?assumptionInputs:selector==='[data-sector-budget]'?budgetInputs:[];
ctx.AggregatePlanning.render(root);root.querySelector('#scenario-reason').value='UI assumptions';targetInput.onchange();nodes.get('#v2-run').onclick();
assert(root.innerHTML.includes('مقایسهٔ سه سناریو'));assert(root.innerHTML.includes('بودجه و مصرف هر سکتور'));
root.querySelector('#scenario-version-name').value='UI snapshot';nodes.get('#scenario-save-version').onclick();
assert.equal(S.versions()[0].assumptions.budgets.Commercial,1000,'run must capture edited billion-toman input without a separate apply click');
assert.equal(S.versions()[0].name,'UI snapshot');
console.log('Scenario tests passed: CSV/JSON numeric normalization, column reorder, NULLs, three recursive scenarios, per-sector whole-horizon budgets, zero budgets, mix reconciliation and immutable custom versions.');
