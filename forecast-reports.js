(() => {
 'use strict';
 const monthlyHeaders = ['Month','Level','Vertical','Category','Order (Prediction)','AoV','NMV (Prediction)','Order (Target)','AoV','NMV (Target)','GMV (Prediction, Toman)','GMV (Target, Toman)'];
 const dailyHeaders = ['date','level','vertical','Order %','AOV','Monthly Order','Daily Order','NMV','GMV (Toman)','Basis'];
 const money = value => Math.round((value + Number.EPSILON) * 100) / 100;
 const persian = new Intl.DateTimeFormat('en-US-u-ca-persian', { year:'numeric',month:'numeric',day:'numeric',timeZone:'UTC' });
 function dates(target) {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(target);
  if (!match) throw Error('ماه خروجی معتبر نیست.');
  const year=+match[1],month=+match[2];
  if (year>=1900 && year<=2200) {
   const count=new Date(Date.UTC(year,month,0)).getUTCDate();
   return Array.from({length:count},(_,i)=>`${target}-${String(i+1).padStart(2,'0')}`);
  }
  if(year<1300||year>1600) throw Error('سال خروجی معتبر نیست.');
  const result=[];
  for(let t=Date.UTC(year+621,0,1),end=Date.UTC(year+622,3,1);t<end;t+=86400000) {
   const parts=Object.fromEntries(persian.formatToParts(new Date(t)).map(p=>[p.type,p.value]));
   if(+parts.year===year && +parts.month===month) result.push(`${target}-${String(parts.day).padStart(2,'0')}`);
  }
  if(result.length<29||result.length>31) throw Error('تعداد روزهای ماه شمسی قابل محاسبه نیست.');
  return result;
 }
 function aggregate(rows) {
  const groups=new Map();
  for(const row of rows) {
   if(typeof row.vertical!=='string'||!Number.isSafeInteger(row.orders)||row.orders<0||!Number.isFinite(row.gross_gmv_toman)||row.gross_gmv_toman<0||(!row.orders&&row.gross_gmv_toman)) throw Error('اعداد پیش‌بینی برای ساخت خروجی معتبر نیستند.');
   const group=groups.get(row.vertical)||{orders:0,gmv:0};
   group.orders+=row.orders;group.gmv+=row.gross_gmv_toman;groups.set(row.vertical,group);
  }
  for(const group of groups.values()) {
   group.gmv=money(group.gmv);
   if(!Number.isSafeInteger(group.orders)||!Number.isSafeInteger(Math.round(group.gmv*100))) throw Error('مقادیر خروجی فراتر از دقت امن محاسبات مالی مرورگر هستند.');
   group.aov=group.orders?group.gmv/group.orders:null;
  }
  return groups;
 }
 function build(forecast, targetPlan=null, basis='prediction') {
  if(!forecast||!Array.isArray(forecast.rows)||!forecast.rows.length) throw Error('ابتدا پیش‌بینی را محاسبه یا یک نسخهٔ ذخیره‌شده را انتخاب کنید.');
  if(targetPlan && targetPlan.target!==forecast.target) throw Error('هدف و پیش‌بینی باید متعلق به یک ماه باشند.');
  if(!['prediction','target'].includes(basis)||(basis==='target'&&!targetPlan)) throw Error('برای خروجی روزانهٔ هدف، ابتدا نسخهٔ هدف را انتخاب کنید.');
  const days=dates(forecast.target), predictions=aggregate(forecast.rows), targets=aggregate(targetPlan?.rows||[]);
  const monthly=[],daily=[];
  for(const vertical of [...predictions.keys()].sort()) {
   const p=predictions.get(vertical),t=targets.get(vertical);
   monthly.push({month:forecast.target,level:'Vertical',vertical,category:'Total',prediction_orders:p.orders,prediction_aov:p.aov,prediction_nmv:null,target_orders:t?.orders??null,target_aov:t?.aov??null,target_nmv:null,prediction_gmv:p.gmv,target_gmv:t?.gmv??null});
   const source=basis==='target'?t:p;
   let cumulativeOrders=0,previousCents=0;
   for(let i=0;i<days.length;i++) {
    const count=source?Math.floor(source.orders/days.length)+(i<source.orders%days.length?1:0):null;
    cumulativeOrders+=count||0;
    const cumulativeCents=source?.orders?Math.round(Math.round(source.gmv*100)*cumulativeOrders/source.orders):0;
    const gmv=source?(cumulativeCents-previousCents)/100:null;
    previousCents=cumulativeCents;
    daily.push({date:days[i],level:'vertical',vertical,order_share:source?(source.orders?count/source.orders:1/days.length):null,aov:source?.aov??null,monthly_orders:source?.orders??null,daily_orders:count,nmv:null,gmv,basis});
   }
  }
  const notes=[
   `Forecast month: ${forecast.target}; calendar: ${+forecast.target.slice(0,4)>=1900?'Gregorian':'Persian'}. Currency: Toman.`,
   'Daily values are an even allocation of the monthly forecast, not an independently trained daily forecast. Integer orders and monetary totals reconcile to Monthly.',
   `Daily basis: ${basis==='target'?'explicitly selected target plan':'prediction'}. Target columns are blank unless a target version is explicitly selected.`,
   'Input files have no category dimension: only Vertical / Total rows are available. Payment methods are aggregated; AOV is weighted by orders.',
   'NMV is not available in source data and stays blank. Gross GMV is reported separately; it is not relabeled as net merchandise value.',
   'This is an analytical projection, not a guaranteed result or financial approval.',
   ...(forecast.warnings||[]),
  ];
  return {target:forecast.target,calendar:+forecast.target.slice(0,4)>=1900?'gregorian':'persian',basis,monthly,daily,days:days.length,notes};
 }
 function matrices(report) {
  return {
   Monthly:[monthlyHeaders,...report.monthly.map(r=>[r.month,r.level,r.vertical,r.category,r.prediction_orders,r.prediction_aov,r.prediction_nmv,r.target_orders,r.target_aov,r.target_nmv,r.prediction_gmv,r.target_gmv])],
   Daily:[dailyHeaders,...report.daily.map(r=>[r.date,r.level,r.vertical,r.order_share,r.aov,r.monthly_orders,r.daily_orders,r.nmv,r.gmv,r.basis])],
  };
 }
 const xml=value=>String(value).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
 const col=index=>{let s='';for(let n=index+1;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
 function cell(value,address,style=0,formula=null) {
  if(formula) return `<c r="${address}" s="${style}">${value===null?'<f>'+xml(formula)+'</f>':'<f>'+xml(formula)+'</f><v>'+value+'</v>'}</c>`;
  if(value===null||value===undefined) return `<c r="${address}" s="${style}"/>`;
  if(typeof value==='number') { if(!Number.isFinite(value))throw Error('خروجی اکسل شامل عدد نامعتبر است.');return `<c r="${address}" s="${style}"><v>${value}</v></c>`; }
  return `<c r="${address}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
 }
 function sheet(report,name,values) {
  const body=values.map((row,i)=>`<row r="${i+1}">${row.map((v,j)=>{
   const address=`${col(j)}${i+1}`;
   if(i===0)return cell(v,address,1);
   const n=i+1;
   if(name==='Monthly') {
    if(j===5)return cell(v,address,2,`IF(E${n}=0,"",K${n}/E${n})`);
    if(j===8&&report.monthly[i-1].target_orders!==null)return cell(v,address,2,`IF(H${n}=0,"",L${n}/H${n})`);
    return cell(v,address,[4,7].includes(j)?5:j>=5?2:0);
   }
   const dayIndex=(i-1)%report.days,monthlyRow=Math.floor((i-1)/report.days)+2,start=n-dayIndex;
   const ordersCol=report.basis==='target'?'H':'E',aovCol=report.basis==='target'?'I':'F',gmvCol=report.basis==='target'?'L':'K';
   const hasSource=report.daily[i-1].monthly_orders!==null;
   if(j===0&&report.calendar==='gregorian')return cell(Date.parse(v+'T00:00:00Z')/86400000+25569,address,4);
   if(hasSource) {
    if(j===3)return cell(v,address,3,`IF(F${n}=0,1/${report.days},G${n}/F${n})`);
    if(j===4)return cell(v,address,2,`IF(F${n}=0,"",'Monthly'!${aovCol}${monthlyRow})`);
    if(j===5)return cell(v,address,5,`'Monthly'!${ordersCol}${monthlyRow}`);
    if(j===6)return cell(v,address,5,`QUOTIENT(F${n},${report.days})+IF(${dayIndex}<MOD(F${n},${report.days}),1,0)`);
    if(j===8)return cell(v,address,2,`IF(F${n}=0,0,ROUND('Monthly'!${gmvCol}${monthlyRow}*SUM(G$${start}:G${n})/F${n},2)-ROUND('Monthly'!${gmvCol}${monthlyRow}*(SUM(G$${start}:G${n})-G${n})/F${n},2))`);
   }
   return cell(v,address,j===3?3:[5,6].includes(j)?5:[4,7,8].includes(j)?2:0);
  }).join('')}</row>`).join('');
  const notes=report.notes.map((note,i)=>`<row r="${values.length+3+i}">${cell(i===0?'Notes':'',`A${values.length+3+i}`)}${cell(note,`B${values.length+3+i}`)}</row>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="4" width="20" customWidth="1"/><col min="5" max="12" width="25" customWidth="1"/></cols><sheetData>${body}${notes}</sheetData><autoFilter ref="A1:${col(values[0].length-1)}${values.length}"/></worksheet>`;
 }
 const crcTable=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=(n&1)?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
 const crc32=data=>{let c=0xffffffff;for(const b of data)c=crcTable[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0;};
 const concat=arrays=>{const result=new Uint8Array(arrays.reduce((n,a)=>n+a.length,0));let offset=0;for(const a of arrays){result.set(a,offset);offset+=a.length;}return result;};
 function zip(files) {
  const encoder=new TextEncoder(),locals=[],central=[];let offset=0;
  for(const [name,text] of Object.entries(files)) {
   const filename=encoder.encode(name),data=encoder.encode(text),crc=crc32(data);
   const local=new Uint8Array(30),l=new DataView(local.buffer);l.setUint32(0,0x04034b50,true);l.setUint16(4,20,true);l.setUint16(6,0x800,true);l.setUint16(12,33,true);l.setUint32(14,crc,true);l.setUint32(18,data.length,true);l.setUint32(22,data.length,true);l.setUint16(26,filename.length,true);
   locals.push(local,filename,data);
   const record=new Uint8Array(46),c=new DataView(record.buffer);c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x800,true);c.setUint16(14,33,true);c.setUint32(16,crc,true);c.setUint32(20,data.length,true);c.setUint32(24,data.length,true);c.setUint16(28,filename.length,true);c.setUint32(42,offset,true);
   central.push(record,filename);offset+=local.length+filename.length+data.length;
  }
  const directory=concat(central),end=new Uint8Array(22),e=new DataView(end.buffer);e.setUint32(0,0x06054b50,true);e.setUint16(8,Object.keys(files).length,true);e.setUint16(10,Object.keys(files).length,true);e.setUint32(12,directory.length,true);e.setUint32(16,offset,true);
  return concat([...locals,directory,end]);
 }
 function workbook(report) {
  const data=matrices(report),ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  return zip({
   '[Content_Types].xml':'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
   '_rels/.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
   'xl/workbook.xml':`<workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Monthly" sheetId="1" r:id="rId1"/><sheet name="Daily" sheetId="2" r:id="rId2"/></sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`,
   'xl/_rels/workbook.xml.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
   'xl/styles.xml':`<styleSheet xmlns="${ns}"><numFmts count="4"><numFmt numFmtId="164" formatCode="#,##0.00;(#,##0.00);&quot;-&quot;"/><numFmt numFmtId="165" formatCode="0.0%;(0.0%);&quot;-&quot;"/><numFmt numFmtId="166" formatCode="yyyy-mm-dd"/><numFmt numFmtId="167" formatCode="#,##0;(#,##0);&quot;-&quot;"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF174F42"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="6"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="center"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="167" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
   'xl/worksheets/sheet1.xml':sheet(report,'Monthly',data.Monthly),
   'xl/worksheets/sheet2.xml':sheet(report,'Daily',data.Daily),
  });
 }
 globalThis.PlanningReports={build,matrices,workbook,dates};
})();
