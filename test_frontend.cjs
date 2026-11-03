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
 console, Intl, URL, Blob, setTimeout, clearTimeout,
 document: { querySelector: node, querySelectorAll: () => [], addEventListener() {}, body: { style: {} } },
 localStorage: { getItem: () => null, setItem() {} },
 location: { hash: '#dashboard' }, window: { addEventListener() {}, scrollTo() {} },
});
const source = fs.readFileSync('app.js', 'utf8').replace(/load\(\);\s*$/, '');
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
run("data.performance = []; data.cohort = []; data.voucher = []; data.organic = []; demo = false; selectedMonth = ''; ");
for (const renderer of ['dashboard', 'scenarioPage', 'cohortPage', 'voucherPage', 'deviationPage', 'importPage', 'reportsPage']) {
 const html = run(`${renderer}()`);
 assert(!html.includes('NaN') && !html.includes('undefined'), `empty ${renderer} renders invalid values`);
}
console.log('Frontend checks passed: all 8 pages, empty states, Persian periods, CSV parsing, HTML escaping and safe exports.');
