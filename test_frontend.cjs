const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');

const nodes = new Map();
const node = selector => {
 if (!nodes.has(selector)) nodes.set(selector, { innerHTML: '', textContent: '', hidden: false, style: {}, classList: { add() {}, remove() {}, toggle() {} }, focus() {}, querySelectorAll() { return []; } });
 return nodes.get(selector);
};
const context = vm.createContext({
 console, Intl, URL, Blob, TextEncoder, setTimeout, clearTimeout,
 document: { querySelector: node, querySelectorAll: () => [], addEventListener() {}, body: { style: {} } },
 localStorage: { getItem: () => null, setItem() {} },
 location: { hash: '#dashboard' }, window: { addEventListener() {}, scrollTo() {} },
});
const source = fs.readFileSync('app.js', 'utf8').replace(/load\(\);\s*$/, '');
vm.runInContext(fs.readFileSync('forecast-reports.js','utf8'),context);
vm.runInContext(source, context);
const run = code => vm.runInContext(code, context);
const fixture = JSON.parse(execFileSync('python3', ['-c', 'import json; from planning import demo_data; print(json.dumps(demo_data()))'], { encoding: 'utf8' }));
fixture.runs = [];
fixture.scenarios = [];
run(`data = ${JSON.stringify(fixture)}; selectedMonth = '1405-07';`);
for (const [name, renderer] of [['dashboard', 'dashboard'], ['forecast', 'scenarioPage'], ['scenario', 'scenarioPage'], ['cohort', 'cohortPage'], ['voucher', 'voucherPage'], ['deviation', 'deviationPage'], ['import', 'importPage'], ['reports', 'reportsPage']]) {
 const html = run(`page = '${name}'; ${renderer}()`);
 assert(html.includes('حالت نمایشی فعال است.'), `${name} must disclose demo mode`);
 assert(!html.includes('NaN') && !html.includes('undefined'), `${name} renders invalid values`);
 assert(html.length > 200);
}
const importHTML = run('importPage()');
assert.equal((importHTML.match(/data-bundle-kind=/g)||[]).length,4);
assert(importHTML.includes('ثبت فایل‌ها و شروع پلنینگ'));
assert.equal(run("monthName('2026-11')"),'نوامبر ۲۰۲۶');
assert.equal(run("shortMonth('2026-10')"),'اکتبر');
const dashboardHTML = run('dashboard()');
assert(dashboardHTML.includes('class="page-heading dashboard-hero"'));
assert.equal((dashboardHTML.match(/class="planning-step"/g) || []).length, 3);
assert(dashboardHTML.includes('۱۲۰ ردیف نمایشی'));
for (const target of ['import', 'forecast', 'scenario']) {
 assert(dashboardHTML.includes(`href="#${target}"`));
}
assert.equal(run("shift('1405-12', 1)"), '1406-01');
assert.equal(run("shift('1405-01', -1)"), '1404-12');
assert.equal(run("esc('<script>')"), '&lt;script&gt;');
assert.equal(run("money(null)"), '—');
assert.equal(run("num(null)"), '—');
assert.equal(run("parseCSV('a,b\\n\"hello,world\",2')[0].a"), 'hello,world');
assert.equal(run("parseCSV('a,b\\n\"hello\"\"world\",2')[0].a"), 'hello"world');
assert.equal(run("parseCSV('a,b\\n\"hello\\nworld\",2')[0].a"), 'hello\nworld');
assert.throws(() => run("parseCSV('a,a\\n1,2')"));
assert.throws(() => run("parseCSV('a,b\\n1')"));
assert.throws(() => run("parseCSV('a,b\\n\"unclosed,2')"));
assert(run("csv([{name:'=HYPERLINK(\"test\")'}])").includes("'=HYPERLINK"));
assert(run("csv([{name:'@SUM(A1)'}])").includes("'@SUM"));
run("lastForecast = {target:'2026-11',rows:[{vertical:'FASHION',orders:31,gross_gmv_toman:3100.01}],warnings:[]}; reportTab='monthly';");
const monthlyHTML=run('forecastReportHTML()');
assert(monthlyHTML.includes('data-report-tab="monthly" aria-selected="true"'));
assert(monthlyHTML.includes('اکسل کامل دوشیتی'));
assert(monthlyHTML.includes('NMV (Prediction)'));
assert(monthlyHTML.includes('GMV (Prediction, Toman)'));
assert(!monthlyHTML.includes('NaN')&&!monthlyHTML.includes('undefined'));
run("reportTab='daily';");
const dailyHTML=run('forecastReportHTML()');
assert(dailyHTML.includes('data-report-tab="daily" aria-selected="true"'));
assert(dailyHTML.includes('2026-11-30'));
assert(dailyHTML.includes('توزیع یکنواخت'));
run("lastForecast=null;");
run("data.performance = []; data.cohort = []; data.voucher = []; data.organic = []; demo = false; selectedMonth = ''; ");
for (const renderer of ['dashboard', 'scenarioPage', 'cohortPage', 'voucherPage', 'deviationPage', 'importPage', 'reportsPage']) {
 const html = run(`${renderer}()`);
 assert(!html.includes('NaN') && !html.includes('undefined'), `empty ${renderer} renders invalid values`);
}
(async () => {
 const response = (text, type='application/json', ok=true) => ({ok,headers:{get:()=>type},text:async()=>text});
 for (const [text,type] of [['',''],['<html>Not an API</html>','text/html']]) {
  context.fetch=async()=>response(text,type);
  await assert.rejects(run("api('/api/state?demo=1')"),/docs/);
 }
 context.fetch=async()=>response('{');
 await assert.rejects(run("api('/api/state')"),/ناقص/);
 context.fetch=async()=>response('null');
 await assert.rejects(run("api('/api/state')"),/ساختار/);
 context.fetch=async()=>response('{"error":"backend unavailable"}','application/json',false);
 await assert.rejects(run("api('/api/state')"),/backend unavailable/);
 context.fetch=async()=>response('{"performance":[]}');
 assert.equal((await run("api('/api/state')")).performance.length,0);
 context.planningLocalAPI=async()=>({local:true});
 context.fetch=()=>{throw Error('Static deployment must not request a Python API');};
 assert.equal((await run("api('/api/state')")).local,true);
 let aggregateRendered=false;
 context.AggregatePlanning={render:()=>{aggregateRendered=true;}};
 await run('load()');
 assert(aggregateRendered,'new aggregate workflow must start without contacting the legacy backend');
 assert(nodes.get('#navigation').innerHTML.includes('پلنینگ میلادی'));
 console.log('API response checks passed: empty, HTML, truncated JSON, invalid structure, backend errors and static local routing.');
})().catch(error=>{console.error(error);process.exitCode=1;});
console.log('Frontend checks passed: all 8 pages, empty states, Persian periods, CSV parsing, HTML escaping and safe exports.');
