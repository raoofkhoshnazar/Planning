const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const context=vm.createContext({Intl,TextEncoder,Uint8Array,DataView,Date});
vm.runInContext(fs.readFileSync('forecast-reports.js','utf8'),context);
const R=context.PlanningReports;
const base={target:'2026-11',warnings:[],rows:[
 {vertical:'DIGITAL',payment_method:'Installment',orders:31,gross_gmv_toman:3100.01},
 {vertical:'DIGITAL',payment_method:'PayNow',orders:16,gross_gmv_toman:3200.02},
 {vertical:'FASHION',orders:3,gross_gmv_toman:900.01},
 {vertical:'ZERO',orders:0,gross_gmv_toman:0},
]};
const report=R.build(base);
assert.equal(report.days,30);assert.equal(report.monthly.length,3);assert.equal(report.daily.length,90);
assert.equal(report.monthly[0].prediction_orders,47);
assert.equal(report.monthly[0].prediction_aov,6300.03/47);
assert(report.monthly.every(r=>r.target_orders===null&&r.prediction_nmv===null&&r.category==='Total'));
function reconciles(report,basis='prediction') {
 for(const m of report.monthly) {
  const rows=report.daily.filter(r=>r.vertical===m.vertical),expected=m[basis+'_orders'];
  if(expected===null){assert(rows.every(r=>r.daily_orders===null&&r.gmv===null));continue;}
  assert.equal(rows.reduce((s,r)=>s+r.daily_orders,0),expected);
  assert.equal(Math.round(rows.reduce((s,r)=>s+r.gmv,0)*100),Math.round(m[basis+'_gmv']*100));
  assert(Math.abs(rows.reduce((s,r)=>s+r.order_share,0)-1)<1e-12);
  assert(rows.every(r=>Number.isInteger(r.daily_orders)&&r.daily_orders>=0&&r.nmv===null));
 }
}
reconciles(report);
assert.equal(R.dates('2024-02').length,29);assert.equal(R.dates('2025-02').length,28);
assert.equal(R.dates('2026-12').length,31);
assert.equal(R.dates('1403-12').length,30);assert.equal(R.dates('1404-12').length,29);
assert.equal(R.dates('1405-01')[0],'1405-01-01');
assert.throws(()=>R.dates('2026-13'));
assert.throws(()=>R.build({...base,rows:[{vertical:'BAD',orders:0,gross_gmv_toman:10}]}));
assert.throws(()=>R.build(base,{...base,target:'2026-12'}));
assert.throws(()=>R.build(base,null,'target'));
const target={target:'2026-11',rows:[{vertical:'DIGITAL',orders:90,gross_gmv_toman:18000}]};
const targetReport=R.build(base,target,'target');reconciles(targetReport,'target');
assert.equal(targetReport.monthly[0].target_orders,90);
const bytes=R.workbook(report);
assert.equal(Buffer.from(bytes).subarray(0,2).toString(),'PK');
const inspected=JSON.parse(execFileSync('python3',['-c',`import io,sys,json,openpyxl,zipfile
raw=sys.stdin.buffer.read()
archive=zipfile.ZipFile(io.BytesIO(raw)); assert archive.testzip() is None
values=openpyxl.load_workbook(io.BytesIO(raw),data_only=True)
formulas=openpyxl.load_workbook(io.BytesIO(raw),data_only=False)
assert values.sheetnames==['Monthly','Daily']
assert values['Monthly']['E2'].value==47
assert abs(values['Monthly']['F2'].value-6300.03/47)<1e-10
assert values['Monthly']['G2'].value is None
assert values['Monthly']['H2'].value is None
assert formulas['Monthly']['F2'].data_type=='f'
assert formulas['Daily']['G2'].data_type=='f'
assert values['Daily']['A2'].value.year==2026
assert values['Daily']['A2'].value.month==11
for r in range(2,5):
 v=values['Monthly'].cell(r,3).value
 rows=[row for row in values['Daily'].iter_rows(min_row=2,max_row=91,values_only=True) if row[2]==v]
 assert sum(row[6] for row in rows)==values['Monthly'].cell(r,5).value
 assert round(sum(row[8] for row in rows),2)==values['Monthly'].cell(r,11).value
for sheet in values:
 assert sheet.freeze_panes=='A2'
 assert not any(cell.data_type=='e' for row in sheet for cell in row)
print(json.dumps({'sheets':values.sheetnames,'formulas':sum(c.data_type=='f' for s in formulas for row in s for c in row)}))`],{input:Buffer.from(bytes),encoding:'utf8'}));
assert(inspected.formulas>400);
const malicious=R.workbook(R.build({target:'2026-11',rows:[{vertical:'=HYPERLINK("https://example.invalid")<&',orders:1,gross_gmv_toman:1}]}));
execFileSync('python3',['-c',`import io,sys,openpyxl
w=openpyxl.load_workbook(io.BytesIO(sys.stdin.buffer.read()),data_only=False)
assert w['Monthly']['C2'].data_type=='s'
assert w['Monthly']['C2'].value.startswith('=HYPERLINK')`],{input:Buffer.from(malicious)});
if(process.env.TEST_UPLOADED_TRAINING==='1') {
 const actual=JSON.parse(execFileSync('python3',['-c',`import csv,glob,json
from planning import TABLES,forecast
from bundle_import import prepare_bundle
files={}
for path in glob.glob('uploads/*.csv'):
 rows=list(csv.DictReader(open(path,encoding='utf-8-sig'))); h=rows[0]
 kind='performance' if 'M.month' in h else 'cohort' if 'cohort_month' in h else 'organic' if 'organic_orders' in h else 'voucher'
 files[kind]={'rows':rows,'source':path.split('/')[-1]}
r=prepare_bundle({'files':files},{k:[] for k in TABLES}); d={f['kind']:f['rows'] for f in r['files']}
print(json.dumps(forecast(d['performance'],d['cohort'],r['target'],{},r)))`],{encoding:'utf8'}));
 const actualReport=R.build(actual);reconciles(actualReport);
 actualReport.notes.unshift('Source: supplied four training CSV files. Baseline: previous month; default analytical assumptions, no target plan selected.');
 if(process.argv.includes('--sample')) {
  const path='outputs/Planning-2026-11.xlsx';fs.writeFileSync(path,R.workbook(actualReport));console.log('Created '+path);
 }
 console.log(`Actual forecast output verified: ${actualReport.monthly.length} verticals, ${actualReport.daily.length} daily rows, ${actualReport.target}.`);
}
console.log('Forecast reports passed: calendar lengths, weighted AOV, blank NMV/targets, target selection, daily reconciliation and valid two-sheet XLSX with cached formulas.');
