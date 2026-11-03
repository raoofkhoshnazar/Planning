const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const demo = JSON.parse(fs.readFileSync('docs/demo-data.json', 'utf8'));
const storage = new Map();
let quota = false;
const context = vm.createContext({
 URL, console, crypto: { randomUUID },
 localStorage: { getItem: k => storage.get(k) || null, setItem: (k,v) => { if (quota) throw Error('quota'); storage.set(k,v); } },
 fetch: async path => { assert.equal(path,'./demo-data.json'); return {ok:true,json:async()=>demo}; },
});
vm.runInContext(fs.readFileSync('local-engine.js','utf8'), context);
const api = context.planningLocalAPI;
function close(actual, expected, path='root') {
 if (typeof expected === 'number') assert(Math.abs(actual-expected) <= Math.max(1e-6,Math.abs(expected)*1e-12), `${path}: ${actual} vs ${expected}`);
 else if (expected && typeof expected === 'object') { assert.deepEqual(Object.keys(actual).sort(),Object.keys(expected).sort(),path); for (const k of Object.keys(expected)) close(actual[k],expected[k],`${path}.${k}`); }
 else assert.equal(actual,expected,path);
}
(async () => {
 const reference = JSON.parse(execFileSync('python3',['-c',`import json
from planning import demo_data, forecast
d = demo_data()
print(json.dumps([forecast(d['performance'],d['cohort'],'1405-08',a) for a in [{}, {'baseline':'average','new_growth':12,'aov_growth':8,'budget':1e12}, {'auto_trend':False,'retention':70,'voucher_share':15,'frequency':2.1,'voucher_cost':60000}]]))`],{encoding:'utf8'}));
 const assumptions = [{},{baseline:'average',new_growth:12,aov_growth:8,budget:1e12},{auto_trend:false,retention:70,voucher_share:15,frequency:2.1,voucher_cost:60000}];
 for (let i=0;i<assumptions.length;i++) close(await api('/api/forecast',{demo:true,target:'1405-08',assumptions:assumptions[i]}), reference[i]);
 let state = await api('/api/state?demo=0'); assert.equal(state.performance.length,0);
 assert.equal((await api('/api/state?demo=1')).performance.length,120);
 const row = demo.performance.at(-1);
 const payload = {kind:'performance',rows:[row],source:'monthly.csv'};
 assert.equal((await api('/api/import/validate',payload)).count,1);
 assert.equal((await api('/api/state?demo=0')).performance.length,0);
 const imported = await api('/api/import',payload);
 assert(imported.run_id);
 await assert.rejects(api('/api/import',payload),/تکراری/);
 await assert.rejects(api('/api/import',{...payload,rows:[{...row,vertical:'GOOD'},{...row,orders:-1}]}));
 assert.equal((await api('/api/state?demo=0')).performance.length,1);
 const forecast = await api('/api/forecast',{target:'1405-08',assumptions:{budget:1e12}});
 assert.equal(forecast.rows.length,1);
 const saved = await api('/api/scenarios',{demo:true,target:'1405-08',name:'Pages test',assumptions:{budget:1e12}});
 assert.equal((await api('/api/state?demo=0')).scenarios.length,0);
 await api('/api/scenarios/approve',{id:saved.id});
 state = await api('/api/state?demo=1'); assert.equal(state.scenarios[0].status,'approved');
 close(state.scenarios[0].result,saved.result);
 await assert.rejects(api('/api/scenarios/approve',{id:saved.id}));
 const over = await api('/api/scenarios',{demo:true,target:'1405-08',name:'Over',assumptions:{budget:0}});
 await assert.rejects(api('/api/scenarios/approve',{id:over.id}),/بودجه/);
 state.performance[0].orders = 99;
 assert.notEqual((await api('/api/state?demo=1')).performance[0].orders,99);
 const unknown = {...row,vertical:'NEW',payment_method:'Unknown'};
 await assert.rejects(api('/api/import',{...payload,rows:[unknown]}),/هشدار/);
 quota = true;
 await assert.rejects(api('/api/import',{...payload,rows:[{...row,vertical:'QUOTA'}]}),/ذخیره/);
 quota = false;
 assert.equal((await api('/api/state?demo=0')).performance.length,1);
 const html = fs.readFileSync('docs/index.html','utf8');
 assert(html.includes('src="./local-engine.js"'));
 assert(!/(?:src|href)="\/(?:app.js|styles.css)/.test(html));
 for (const file of ['app.js','styles.css','local-engine.js']) assert.equal(fs.readFileSync('docs/'+file,'utf8'),fs.readFileSync(file,'utf8'));
 console.log('Pages tests passed: Python/JavaScript parity, persistence, imports, locked snapshots, quota failures, mode isolation and subpath assets.');
})().catch(e => { console.error(e); process.exitCode=1; });
