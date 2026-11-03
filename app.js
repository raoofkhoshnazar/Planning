const $ = (s, p = document) => p.querySelector(s);
const $$ = (s, p = document) => [...p.querySelectorAll(s)];
const fa = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 });
const num = n => n == null || !Number.isFinite(Number(n)) ? '—' : fa.format(n);
const money = n => n == null ? '—' : Math.abs(n) >= 1e9 ? `${num(n / 1e9)} میلیارد` : Math.abs(n) >= 1e6 ? `${num(n / 1e6)} میلیون` : num(n);
const pct = n => n == null ? '—' : `${num(n)}٪`;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const sum = (rows, key) => rows.reduce((a, r) => a + (+r[key] || 0), 0);
const div = (a, b) => b ? a / b : null;
const monthsFa = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
const monthName = m => m ? `${monthsFa[+m.split('-')[1] - 1]} ${num(+m.split('-')[0])}` : 'بدون داده';
const shortMonth = m => monthsFa[+m.split('-')[1] - 1];
const shift = (m, delta) => { const [y, mo] = m.split('-').map(Number); const t = y * 12 + mo - 1 + delta; return `${Math.floor(t / 12)}-${String(t % 12 + 1).padStart(2, '0')}`; };
const verticalNames = { FASHION: 'مد و پوشاک', DIGITAL: 'کالای دیجیتال', BEAUTY: 'زیبایی و سلامت', HOME: 'خانه و زندگی', SPORT: 'ورزش و سفر', FMCG: 'کالاهای مصرفی', FOOD: 'غذا و رستوران' };
const vname = v => verticalNames[v] || v;
const paths = {
 dashboard: '<rect x="3" y="3" width="7" height="7" rx="1.6"/><rect x="14" y="3" width="7" height="7" rx="1.6"/><rect x="3" y="14" width="7" height="7" rx="1.6"/><rect x="14" y="14" width="7" height="7" rx="1.6"/>',
 trend: '<path d="M3 17l6-6 4 4 8-11M15 4h6v6"/>',
 scenario: '<path d="M5 3v18M5 7h8a4 4 0 014 4v9M5 16h5M14 17l3 3 3-3"/><circle cx="5" cy="7" r="2"/><circle cx="5" cy="16" r="2"/>',
 cohort: '<path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M22 21v-2a4 4 0 00-3-3.87"/><circle cx="9" cy="7" r="4"/><path d="M16 3.13a4 4 0 010 7.75"/>',
 voucher: '<path d="M3 7a2 2 0 012-2h14a2 2 0 012 2v3a2 2 0 000 4v3a2 2 0 01-2 2H5a2 2 0 01-2-2v-3a2 2 0 000-4V7zM14 5v2m0 3v2m0 3v2"/>',
 deviation: '<path d="M4 20V10m5 10V4m6 16v-7m5 7V7M2 20h20"/>',
 import: '<path d="M12 16V3m-4 4l4-4 4 4M4 14v5a2 2 0 002 2h12a2 2 0 002-2v-5"/>',
 download: '<path d="M12 3v12m-4-4l4 4 4-4M4 16v3a2 2 0 002 2h12a2 2 0 002-2v-3"/>',
 report: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M8 13h8M8 17h5"/>',
 calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18M8 15h2M14 15h2"/>',
 arrow: '<path d="M19 12H5m6 6l-6-6 6-6"/>',
 plus: '<path d="M12 5v14M5 12h14"/>',
 spark: '<path d="M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3zM20 2v4m-2-2h4"/>',
 orders: '<path d="M3 3h2l2 12h11l3-9H6M9 21h.01M18 21h.01"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/>',
 wallet: '<path d="M20 7H5a2 2 0 010-4h13v4M3 5v14a2 2 0 002 2h15V7M20 11h-5v5h5M16 13.5h1"/>',
 bag: '<path d="M5 7h14l2 14H3L5 7zM8 7V5a4 4 0 018 0v2"/>',
 check: '<path d="M20 6L9 17l-5-5"/>',
 info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
 lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 018 0v3M12 14v3"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.bag}</svg>`;
const pages = [['dashboard', 'نمای کلی', 'dashboard'], ['forecast', 'پیش‌بینی ماه آینده', 'trend'], ['scenario', 'سناریوها و برنامه‌ها', 'scenario'], ['cohort', 'تحلیل کوهورت', 'cohort'], ['voucher', 'مدیریت ووچر', 'voucher'], ['deviation', 'تحلیل انحراف', 'deviation'], ['import', 'ورود و مدیریت داده', 'import'], ['reports', 'گزارش‌ها', 'report']];
let demo = localStorage.getItem('planning-mode') !== 'live';
let data = null, page = 'dashboard', selectedMonth = '', vertical = '', payment = '', planId = '', metric = 'gross_gmv_toman';
let preview = null, lastForecast = null, importFile = null, importValidation = null;
let forecastRequest = 0;
const defaultAssumptions = { baseline: 'previous', new_growth: 0, aov_growth: 0, retention: 90, frequency: 0, voucher_share: -1, voucher_cost: 0, budget: 4e9, campaign: 1, auto_trend: true, notes: '' };
let currentAssumptions = { ...defaultAssumptions }, scenarioTarget = '';

async function api(path, payload) {
 const response = await fetch(path, payload ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) } : {});
 const result = await response.json();
 if (!response.ok) throw new Error(result.error || 'دریافت اطلاعات ممکن نشد.');
 return result;
}
let toastTimer;
function toast(message) { $('#toast').textContent = message; $('#toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').hidden = true, 5500); }
function openModal(html) { $('#modal-content').innerHTML = html; $('#modal').hidden = false; document.body.style.overflow = 'hidden'; $('#modal-close').focus(); }
function closeModal() { $('#modal').hidden = true; document.body.style.overflow = ''; }
$('#modal-close').onclick = closeModal;
$('#modal').onclick = e => { if (e.target.id === 'modal') closeModal(); };
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeModal(); $('#sidebar').classList.remove('open'); } if (e.key === 'Tab' && !$('#modal').hidden) { const nodes = $$('button,a,input,select,textarea', $('#modal')).filter(n => !n.disabled); const first = nodes[0], last = nodes.at(-1); if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } } });
$('#menu-toggle').onclick = () => $('#sidebar').classList.toggle('open');
function guide() {
 openModal(`<h2>به پلن‌نما خوش آمدید</h2><p>فضای یکپارچهٔ ورود اطلاعات ماهانه، برنامه‌ریزی و مقایسهٔ عملکرد کامرشیال.</p><h3>۱. هر ماه داده‌ها را اضافه کنید</h3><p>خروجی چهار کوئری نوت‌بوک را به صورت CSV یا JSON وارد کنید. داده‌های ماهانهٔ عملکرد برای شروع کافی است؛ کوهورت، ارگانیک و ووچر تحلیل را کامل‌تر می‌کنند. اطلاعات واقعی پس از انتشار قابل ویرایش نیست.</p><h3>۲. ماه بعد را پیش‌بینی کنید</h3><p>مبنای ماه قبل، میانگین سه‌ماهه یا ماه مشابه سال قبل را انتخاب کنید. موتور، روند کاربران جدید را از حداکثر سه تغییر ماهانهٔ گذشته برآورد می‌کند و اثر فرض‌های نگهداشت، دفعات سفارش و AOV را جداگانه نشان می‌دهد.</p><h3>۳. سناریو را ذخیره و قفل کنید</h3><p>هر ذخیره، نسخهٔ مستقل با خروجی ثابت می‌سازد. قفل‌کردن، نسخه را غیرقابل‌ویرایش می‌کند؛ این قفل، جای تأیید مالی با احراز هویت را نمی‌گیرد.</p><h3>نکات مهم پیش از بهره‌برداری سازمانی</h3><p>این نسخه تک‌فضای‌کاری و تحلیلی است؛ احراز هویت و نقش‌های سازمانی هنوز پیاده‌سازی نشده‌اند و نباید بدون کنترل دسترسی روی اینترنت عمومی قرار بگیرد. تأیید سیاست تاریخ سفارش، حذف‌شده‌ها و کمپین‌ها نیز لازم است.</p><p>کوئری‌های فعلی ماه <b>میلادی</b> تولید می‌کنند؛ تغییر نام آن به شمسی، مرز ماه را اصلاح نمی‌کند. برای گزارش شمسی واقعی، کوئری باید بر اساس شروع و پایان ماه شمسی استخراج شود. ماه شمسی واردشده در فرم، تأیید شما دربارهٔ بازهٔ خروجی است. مقادیر <code>_toman</code> از قبل تومان‌اند و مجدداً تقسیم بر ۱۰ نمی‌شوند.</p>`);
}
$('#guide-button').onclick = guide; $('#help-button').onclick = guide; $('#profile-button').onclick = guide;
function download(name, content, type = 'text/csv;charset=utf-8') { const url = URL.createObjectURL(new Blob([content], { type })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function csv(rows) { if (!rows.length) return ''; const keys = Object.keys(rows[0]); const cell = v => { const s = String(v ?? ''); const safe = /^[=+@\-\t\r]/.test(s) ? `'${s}` : s; return `"${safe.replaceAll('"', '""')}"`; }; return '\uFEFF' + [keys.map(cell).join(','), ...rows.map(r => keys.map(k => cell(typeof r[k] === 'object' ? JSON.stringify(r[k]) : r[k])).join(','))].join('\r\n'); }
function exportRows(rows, label) { if (!rows?.length) return toast('داده‌ای برای خروجی وجود ندارد.'); download(`plannama-${demo ? 'demo-' : ''}${label}.csv`, csv(rows)); toast('فایل خروجی آماده شد.'); }
const allMonths = () => [...new Set(data.performance.map(r => r.persian_year_month))].sort();
const filtered = rows => rows.filter(r => (!vertical || r.vertical === vertical) && (!payment || r.payment_method === payment));
const actualRows = (month = selectedMonth) => filtered(data.performance.filter(r => r.persian_year_month === month));
function aggregate(rows) { const out = {}; for (const k of ['gross_gmv_toman', 'orders', 'active_users', 'new_users', 'voucher_orders', 'total_voucher_toman']) out[k] = sum(rows, k); out.aov_toman = div(out.gross_gmv_toman, out.orders); return out; }
function chosenPlan() { return data.scenarios.find(s => s.id === planId) || null; }
function planRows() { const p = chosenPlan(); return p && p.target === selectedMonth ? filtered(p.result.rows) : []; }
function banner() { return demo ? `<div class="banner">${icon('info')}<span><span class="label">حالت نمایشی فعال است.</span> تمام اعداد این فضا نمونه‌اند؛ دادهٔ واقعی شما هنوز بارگذاری نشده است.</span><button data-action="go-live">ورود داده‌های واقعی ←</button></div>` : `<div class="banner">${icon('lock')}<span><span class="label">فضای دادهٔ واقعی</span> اطلاعات واقعی پس از ثبت قفل می‌شوند. پیش‌بینی‌ها صرفاً تحلیلی هستند.</span><button data-action="go-demo">مشاهدهٔ نسخهٔ نمایشی ←</button></div>`; }
function heading(title, subtitle, english, actions = '') { return `<section class="page-heading"><div><div class="eyebrow">${english}</div><h1>${title}</h1><p>${subtitle}</p></div><div class="heading-buttons">${actions}</div></section>`; }
const exportButton = () => `<button class="btn btn-light" data-action="export">${icon('download')} دریافت گزارش</button>`;
function filters(showPlans = false) {
 return `<section class="filters" aria-label="فیلتر گزارش"><label>${icon('calendar').replace('<svg ', '<svg style="width:15px;height:15px" ')}<select id="month-filter" aria-label="ماه شمسی">${allMonths().reverse().map(m => `<option value="${m}" ${m === selectedMonth ? 'selected' : ''}>${monthName(m)}</option>`).join('')}</select></label><label>ورتیکال<select id="vertical-filter" aria-label="ورتیکال"><option value="">همه ورتیکال‌ها</option>${[...new Set(data.performance.map(r => r.vertical))].map(v => `<option value="${esc(v)}" ${vertical === v ? 'selected' : ''}>${esc(vname(v))}</option>`).join('')}</select></label><label>پرداخت<select id="payment-filter" aria-label="روش پرداخت"><option value="">همه روش‌ها</option>${[...new Set(data.performance.map(r => r.payment_method))].map(p => `<option value="${esc(p)}" ${payment === p ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select></label>${showPlans ? `<label>نسخه<select id="plan-filter" aria-label="نسخه برنامه"><option value="">بدون برنامه</option>${data.scenarios.filter(s => s.target === selectedMonth).map(s => `<option value="${s.id}" ${s.id === planId ? 'selected' : ''}>${esc(s.name)} ${s.status === 'approved' ? '· قفل‌شده' : '· پیش‌نویس'}</option>`).join('')}</select></label>` : ''}<span class="filter-spacer"></span><span class="filter-status"><i></i>${demo ? 'داده‌های نمونهٔ ۱۲ ماهه' : `${num(data.performance.length)} ردیف واقعی`}</span></section>`;
}
function empty(title = 'اولین قدم، ورود داده‌های شماست', text = 'خروجی عملکرد ماهانه را بارگذاری کنید تا داشبورد و پیش‌بینی ماه بعد آماده شود.') { return `<div class="panel empty">${icon('import')}<h2>${title}</h2><p>${text}</p><button class="btn btn-primary" data-action="navigate" data-page="import">${icon('plus')} ورود اطلاعات ماهانه</button></div>`; }
function kpi(title, key, symbol, unit = '') {
 const now = aggregate(actualRows()), prev = aggregate(actualRows(shift(selectedMonth, -1))), plan = aggregate(planRows());
 const hasPrevious = actualRows(shift(selectedMonth, -1)).length > 0;
 const change = hasPrevious && prev[key] ? (now[key] / prev[key] - 1) * 100 : null;
 const financial = ['gross_gmv_toman', 'aov_toman'].includes(key);
 const values = allMonths().slice(-8).map(m => aggregate(actualRows(m))[key] || 0);
 const max = Math.max(...values, 1), min = Math.min(...values);
 const points = values.map((v, i) => `${i * 100 / Math.max(values.length - 1, 1)},${23 - (v - min) / Math.max(max - min, 1) * 20}`);
 const achievement = div(now[key], plan[key]);
 return `<article class="kpi"><div class="kpi-top"><span>${title}</span><span class="kpi-icon">${icon(symbol)}</span></div><div class="kpi-number">${financial ? money(now[key]) : num(now[key])}<small>${unit}</small></div><svg class="spark" viewBox="0 0 100 27" preserveAspectRatio="none" aria-hidden="true"><path d="M${points.join(' L')}"/></svg><div class="kpi-bottom"><span class="change ${change < 0 ? 'negative' : ''}">${change == null ? 'بدون مبنای مقایسه' : `${change >= 0 ? '↗' : '↘'} ${pct(Math.abs(change))}`}</span><span>${achievement == null ? 'نسبت به ماه قبل' : `${pct(achievement * 100)} تحقق برنامه`}</span></div></article>`;
}
function trendChart() {
 const months = allMonths().filter(m => m <= selectedMonth).slice(-8);
 const actual = months.map(m => aggregate(actualRows(m))[metric] || 0);
 const plan = months.map(m => { const p = data.scenarios.find(s => s.target === m && s.id === planId); return p ? aggregate(filtered(p.result.rows))[metric] : null; });
 const max = Math.max(...actual, ...plan.filter(n => n != null), 1) * 1.22;
 const W = 650, H = 225, left = 52, right = 18, top = 15, bottom = 39;
 const x = i => left + i * (W - left - right) / Math.max(months.length - 1, 1);
 const y = v => top + (1 - v / max) * (H - top - bottom);
 const dots = actual.map((v, i) => [x(i), y(v)]);
 const d = dots.length ? 'M' + dots.map(p => p.join(',')).join(' L') : '';
 const area = `${d} L${x(months.length - 1)},${H - bottom} L${left},${H - bottom} Z`;
 const label = n => metric === 'gross_gmv_toman' ? `${num(n / 1e9)}` : n >= 1000 ? `${num(n / 1000)}k` : num(n);
 return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="روند ماهانه ${metric === 'orders' ? 'سفارش' : 'GMV'}"><defs><linearGradient id="area-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#6b9a73" stop-opacity=".16"/><stop offset="100%" stop-color="#6b9a73" stop-opacity=".01"/></linearGradient></defs>${[0, 1, 2, 3, 4].map(i => { const v = max * i / 4; return `<line x1="${left}" x2="${W - right}" y1="${y(v)}" y2="${y(v)}" stroke="#edf2ed" stroke-dasharray="3 5"/><text x="${left - 9}" y="${y(v) + 4}" text-anchor="end">${label(v)}</text>`; }).join('')}<path d="${area}" fill="url(#area-fill)"/><path d="${d}" fill="none" stroke="#689574" stroke-width="2.4" stroke-linejoin="round"/>${dots.map(([px, py], i) => `<circle cx="${px}" cy="${py}" r="3.7" fill="white" stroke="#689574" stroke-width="2"><title>${monthName(months[i])}: ${num(actual[i])}</title></circle>`).join('')}${plan.map((v, i) => v == null ? '' : `<circle cx="${x(i)}" cy="${y(v)}" r="5" fill="#c5cdae"><title>برنامه: ${num(v)}</title></circle>`).join('')}${months.map((m, i) => `<text x="${x(i)}" y="${H - 12}" text-anchor="middle">${shortMonth(m)}</text>`).join('')}</svg>`;
}
function predictionPanel() {
 return `<aside class="panel prediction-panel"><div class="panel-head"><h2>نگاهی به ماه آینده</h2><span class="forecast-label">${icon('spark')} پیش‌بینی تحلیلی</span></div><div class="prediction-content" id="dashboard-prediction"><p class="next-month">در حال محاسبه از داده‌های تاریخی…</p></div></aside>`;
}
async function updateDashboardPrediction() {
 const request = ++forecastRequest;
 try {
 const target = shift(selectedMonth, 1);
 const result = await api('/api/forecast', { demo, target, assumptions: defaultAssumptions });
 if (request !== forecastRequest || page !== 'dashboard' || !$('#dashboard-prediction')) return;
 preview = result;
 const rows = filtered(result.rows), total = aggregate(rows), now = aggregate(actualRows());
 const growth = div(total.gross_gmv_toman - now.gross_gmv_toman, now.gross_gmv_toman);
 $('#dashboard-prediction').innerHTML = `<span class="next-month">GMV پیش‌بینی‌شدهٔ ${monthName(target)}</span><div class="forecast-number">${money(total.gross_gmv_toman)} <small>تومان</small></div><div class="prediction-growth"><b>${growth == null ? '—' : `${growth >= 0 ? '↗' : '↘'} ${pct(Math.abs(growth * 100))}`}</b> نسبت به ${shortMonth(selectedMonth)} · مبنای ماه قبل</div><div class="forecast-divider"></div><div class="forecast-detail"><span>سفارش پیش‌بینی‌شده</span><strong>${num(total.orders)} <small>سفارش</small></strong></div><div class="forecast-detail"><span>کاربر فعال سگمنت‌ها</span><strong>${num(total.active_users)} <small>کاربر</small></strong></div><div class="forecast-bar"><span style="width:${Math.min(100, total.orders / Math.max(now.orders, 1) * 65)}%"></span></div><div class="forecast-detail"><span>روش مدل</span><span class="method-tag">${rows.some(r => r.method === 'aggregate') ? 'تقریب تجمیعی + روند' : 'مدل کوهورت + روند'}</span></div><button class="forecast-cta" data-action="navigate" data-page="forecast">مشاهده و تنظیم پیش‌بینی ${icon('arrow')}</button>`;
 } catch (e) { if ($('#dashboard-prediction')) $('#dashboard-prediction').innerHTML = `<p class="notice">${esc(e.message)}</p>`; }
}
function performanceTable() {
 const verts = [...new Set(actualRows().map(r => r.vertical))];
 return `<section class="panel"><div class="panel-head"><div><h2>عملکرد ورتیکال‌ها</h2><p class="panel-subtitle">از تصویر کلی تا جزئیات هر کسب‌وکار</p></div><button class="panel-link" data-action="navigate" data-page="reports">همه گزارش‌ها ${icon('arrow')}</button></div><div class="table-scroll performance-table"><table><thead><tr><th>ورتیکال</th><th>GMV <span class="text-muted">(تومان)</span></th><th>سفارش</th><th>رشد ماهانه</th><th>وضعیت روند</th></tr></thead><tbody>${verts.map(v => { const now = aggregate(actualRows().filter(r => r.vertical === v)); const prev = aggregate(actualRows(shift(selectedMonth, -1)).filter(r => r.vertical === v)); const growth = div(now.gross_gmv_toman - prev.gross_gmv_toman, prev.gross_gmv_toman); return `<tr><td><div class="vertical-cell"><span class="vertical-icon">${icon(v === 'DIGITAL' ? 'wallet' : 'bag')}</span><div><strong>${esc(vname(v))}</strong><small>${esc(v)}</small></div></div></td><td>${money(now.gross_gmv_toman)}</td><td>${num(now.orders)}</td><td><span class="change ${growth < 0 ? 'negative' : ''}">${growth == null ? '—' : `${growth >= 0 ? '+' : '−'}${pct(Math.abs(growth * 100))}`}</span></td><td><span class="status-pill ${growth < 0 ? 'warn' : ''}">${growth == null ? 'بدون مبنا' : growth >= 0 ? 'رو به رشد' : 'نیازمند بررسی'}</span></td></tr>`; }).join('') || '<tr><td colspan="5">داده‌ای با فیلتر انتخاب‌شده وجود ندارد.</td></tr>'}</tbody></table></div></section>`;
}
function organicPanel() {
 const now = aggregate(actualRows()); const share = div(now.orders - now.voucher_orders, now.orders); const percentage = share == null ? 0 : share * 100;
 return `<section class="panel"><div class="panel-head"><div><h2>ترکیب سفارش‌ها</h2><p class="panel-subtitle">سهم رشد ارگانیک و وابستگی به ووچر</p></div><span class="panel-link">⋯</span></div><div class="organic-body"><div class="donut"><svg viewBox="0 0 160 160" role="img" aria-label="سهم سفارش بدون ووچر ${pct(percentage)}"><circle cx="80" cy="80" r="63" fill="none" stroke="#e4ebd7" stroke-width="15"/><circle cx="80" cy="80" r="63" fill="none" stroke="#7d9d70" stroke-width="15" stroke-dasharray="${percentage * 3.9584} 395.84" stroke-linecap="round"/></svg><div class="donut-center"><strong>${share == null ? '—' : pct(percentage)}</strong><small>سهم ارگانیک</small></div></div><div class="donut-labels"><div class="donut-label"><span><i class="legend-dot" style="background:#7d9d70"></i>بدون ووچر</span><b>${num(now.orders - now.voucher_orders)}</b></div><div class="donut-label"><span><i class="legend-dot" style="background:#d8e0c5"></i>ووچردار</span><b>${num(now.voucher_orders)}</b></div></div></div><div class="organic-note">تفکیک سفارش بر اساس ووچر است؛ طبقه‌بندی کاربران بر مبنای اولین سفارش، مستقل محاسبه می‌شود.</div></section>`;
}
function dashboard() {
 const header = heading('هر تصمیم خوب، از یک دید روشن شروع می‌شود.', 'نمایی یکپارچه از عملکرد امروز و مسیر رشد ماه آیندهٔ کسب‌وکار شما', 'YOUR BUSINESS, AT A GLANCE', `${exportButton()}<button class="btn btn-primary" data-action="navigate" data-page="import">${icon('plus')} ورود داده ماهانه</button>`);
 if (!data.performance.length) return header + banner() + empty();
 return header + banner() + filters(true) + `<section class="kpi-grid">${kpi('GMV ناخالص', 'gross_gmv_toman', 'wallet', 'تومان')}${kpi('تعداد سفارش', 'orders', 'orders', 'سفارش')}${kpi('کاربران فعال سگمنت‌ها', 'active_users', 'cohort', 'کاربر')}${kpi('میانگین ارزش سفارش', 'aov_toman', 'deviation', 'تومان')}</section><section class="chart-row"><div class="panel"><div class="panel-head"><div><h2>مسیر رشد کسب‌وکار</h2><p class="panel-subtitle">روند عملکرد ماهانه، به تفکیک شاخص‌های کلیدی</p></div><div class="segmented"><button data-metric="gross_gmv_toman" class="${metric === 'gross_gmv_toman' ? 'active' : ''}">GMV</button><button data-metric="orders" class="${metric === 'orders' ? 'active' : ''}">سفارش</button></div></div><div class="chart-legend"><span class="legend-item"><i class="legend-dot" style="background:#689574"></i>عملکرد واقعی</span><span class="legend-item"><i class="legend-dot" style="background:#c5cdae"></i>برنامهٔ انتخاب‌شده</span></div><div class="trend-chart" id="trend-chart">${trendChart()}</div><div class="chart-footer"><span>${metric === 'gross_gmv_toman' ? 'واحد محور: میلیارد تومان' : 'واحد محور: تعداد سفارش'}</span><strong>${monthName(selectedMonth)} · ${demo ? 'دادهٔ نمایشی' : 'دادهٔ ثبت‌شده'}</strong></div></div>${predictionPanel()}</section><section class="bottom-row">${performanceTable()}${organicPanel()}</section><section class="insights-strip"><span class="insight-icon">${icon('spark')}</span><span><strong>اعداد، شروع یک گفت‌وگوی بهترند.</strong> فرض‌های رشد و بودجه را تغییر دهید و اثر آن‌ها را پیش از تصمیم‌گیری ببینید.</span><button data-action="navigate" data-page="scenario">ساخت سناریوی جدید ←</button></section>`;
}
function field(label, name, value, help = '', min = '0', max = '', step = 'any') { return `<div class="field"><label for="ass-${name}">${label}</label><input id="ass-${name}" name="${name}" type="number" value="${value}" min="${min}" ${max ? `max="${max}"` : ''} step="${step}" required dir="ltr"><small>${help}</small></div>`; }
function scenarioPage() {
 const isForecast = page === 'forecast';
 const title = isForecast ? 'ماه آینده را آگاهانه پیش‌بینی کنید.' : 'یک آینده، چند مسیر متفاوت.';
 const header = heading(title, 'فرض‌های شفاف، محاسبهٔ قابل‌ردیابی و نسخه‌هایی که هیچ‌وقت بازنویسی نمی‌شوند.', isForecast ? 'LOOK ONE MONTH AHEAD' : 'EXPLORE YOUR POSSIBILITIES', exportButton());
 if (!data.performance.length) return header + banner() + empty();
 scenarioTarget ||= shift(allMonths().at(-1), 1);
 const a = currentAssumptions;
 return header + banner() + `<div class="scenario-layout"><section class="panel"><div class="panel-head"><div><h2>فرض‌های پیش‌بینی</h2><p class="panel-subtitle">فرض‌ها برای هر سگمنت به‌صورت مستقل روی مبنای همان سگمنت اعمال می‌شوند.</p></div><span class="tag">نسخهٔ جدید</span></div><form id="scenario-form"><div class="form-grid"><div class="field"><label for="scenario-name">نام سناریو</label><input id="scenario-name" name="name" value="${isForecast ? 'پیش‌بینی ماه آینده' : 'سناریوی پایه'}" maxlength="120" required><small>هر ذخیره، یک نسخهٔ مستقل ایجاد می‌کند.</small></div><div class="field"><label for="target-month">ماه هدف شمسی</label><input id="target-month" name="target" value="${esc(scenarioTarget)}" pattern="1[3-6][0-9]{2}-(0[1-9]|1[0-2])" required dir="ltr"><small>قالب 1405-08؛ دادهٔ ماه هدف وارد مدل نمی‌شود.</small></div><div class="field"><label for="baseline">مبنای محاسبه</label><select name="baseline" id="baseline">${[['previous', 'ماه قبل'], ['average', 'میانگین سه‌ماهه'], ['year', 'ماه مشابه سال قبل']].map(([v, label]) => `<option value="${v}" ${a.baseline === v ? 'selected' : ''}>${label}</option>`).join('')}</select><small>مبنای ناقص باعث توقف محاسبه می‌شود.</small></div>${field('رشد کاربران جدید (%)', 'new_growth', a.new_growth, 'تغییر کسب‌وکاری افزون بر روند تاریخی', '-100', '500')}${field('ضریب نگهداشت (%)', 'retention', a.retention, 'در نبود کوهورت کامل، روی کاربران قدیمی مبنا اعمال می‌شود.', '0', '100')}${field('رشد AOV (%)', 'aov_growth', a.aov_growth, 'نسبت به میانگین ارزش سفارش مبنا', '-100', '500')}${field('سفارش به ازای کاربر فعال', 'frequency', a.frequency, 'صفر = دفعات سفارش واقعی مبنا', '0', '100')}${field('سهم سفارش ووچردار (%)', 'voucher_share', a.voucher_share, 'منفی یک = سهم واقعی مبنا', '-1', '100')}${field('هزینهٔ هر سفارش ووچردار (تومان)', 'voucher_cost', a.voucher_cost, 'صفر = هزینهٔ واقعی مبنا')}${field('بودجهٔ کل ووچر (تومان)', 'budget', a.budget, 'سقف کل سناریو، نه سقف هر سگمنت')}${field('ضریب کمپین', 'campaign', a.campaign, 'پیش‌فرض ۱؛ تغییر آن به یادداشت نیاز دارد.', '0', '10')}<div class="field"><label class="field-check" style="margin-top:30px"><input name="auto_trend" type="checkbox" ${a.auto_trend ? 'checked' : ''} style="width:auto"> استفاده از روند تاریخی</label><small>میانگین حداکثر ۳ تغییر متوالی کاربران جدید؛ هر تغییر محدود به ±۳۰٪.</small></div><div class="field wide"><label for="scenario-notes">یادداشت و منبع فرض‌ها</label><textarea id="scenario-notes" name="notes" placeholder="دلیل تغییر فرض، برنامهٔ کمپین یا منبع تصمیم…">${esc(a.notes)}</textarea></div></div><div class="form-actions"><button type="submit" class="btn btn-primary">${icon('spark')} محاسبهٔ پیش‌بینی</button><button type="button" class="btn btn-light" id="save-scenario">${icon('plus')} ذخیره نسخهٔ جدید</button><span>واقعیت تغییر نمی‌کند؛ فقط آینده بازبرآورد می‌شود.</span></div></form></section><aside class="panel scenario-result" id="scenario-output"><h3>اثر تصمیم شما، در یک نگاه</h3><div class="empty" style="padding:40px 0">${icon('trend')}<p>فرض‌ها را تنظیم کنید و<br>«محاسبهٔ پیش‌بینی» را بزنید.</p></div><div class="notice">این پیش‌بینی یک مدل تحلیلی مبتنی بر فرض است، نه مدل آموزش‌دیدهٔ یادگیری ماشین. نتیجه تضمین‌شده نیست.</div></aside></div><section class="panel saved-scenarios"><div class="panel-head"><div><h2>نسخه‌های ذخیره‌شده</h2><p class="panel-subtitle">نسخهٔ قفل‌شده همیشه با اعداد زمان ذخیره باقی می‌ماند.</p></div><span class="tag">${num(data.scenarios.length)} نسخه</span></div><div class="table-scroll performance-table"><table><thead><tr><th>سناریو / شناسه نسخه</th><th>ماه هدف</th><th>GMV برنامه</th><th>وضعیت</th><th>عملیات</th></tr></thead><tbody>${data.scenarios.map(s => `<tr><td><strong>${esc(s.name)}</strong><br><small class="mono text-muted">${s.id}</small></td><td>${monthName(s.target)}</td><td>${money(sum(s.result.rows, 'gross_gmv_toman'))}</td><td><span class="status-pill">${s.status === 'approved' ? 'قفل‌شده' : 'پیش‌نویس'}</span></td><td><div class="row-actions"><button data-view="${s.id}">مشاهده</button><button data-copy="${s.id}">کپی فرض‌ها</button>${s.status !== 'approved' ? `<button data-approve="${s.id}">قفل نسخه</button>` : ''}</div></td></tr>`).join('') || '<tr><td colspan="5">هنوز سناریویی ذخیره نشده است.</td></tr>'}</tbody></table></div></section>`;
}
function readScenario() { const f = new FormData($('#scenario-form')); const a = {}; for (const key of Object.keys(defaultAssumptions)) a[key] = key === 'auto_trend' ? f.has(key) : key === 'notes' || key === 'baseline' ? f.get(key) : Number(f.get(key)); currentAssumptions = a; scenarioTarget = f.get('target'); return { demo, target: scenarioTarget, name: f.get('name'), assumptions: a }; }
function resultHTML(result) {
 const total = aggregate(result.rows);
 return `<h3>پیش‌بینی ${monthName(result.target)}</h3><div class="forecast-label">${icon('spark')} ${demo ? 'بر پایهٔ دادهٔ نمایشی' : 'بر پایهٔ دادهٔ واقعی'}</div>${[['GMV ناخالص', `${money(total.gross_gmv_toman)} تومان`], ['سفارش', num(total.orders)], ['کاربران جدید سگمنت‌ها', num(total.new_users)], ['کاربران فعال سگمنت‌ها', num(total.active_users)], ['میانگین ارزش سفارش', `${money(total.aov_toman)} تومان`], ['هزینهٔ ووچر', `${money(result.voucher_cost)} تومان`], ['بودجهٔ ووچر', `${money(result.budget)} تومان`]].map(([k, v]) => `<div class="result-line"><span>${k}</span><b>${v}</b></div>`).join('')}<div class="${result.over_budget ? 'warning' : 'notice'} mt20">${result.over_budget ? `هزینهٔ ووچر ${money(-result.budget_remaining)} تومان بالاتر از بودجه است. سهم ووچر، هزینهٔ هر سفارش یا بودجه را بازنگری کنید.` : `هزینهٔ ووچر در محدودهٔ بودجه است. مانده: ${money(result.budget_remaining)} تومان.`}</div><div class="notice mt20">${result.warnings.map(esc).join('<br>')}</div><button class="btn btn-light mt20" data-action="forecast-details">${icon('report')} جزئیات محاسبه و ردیابی</button>`;
}
function cohortPage() {
 const rows = filtered(data.cohort).filter(r => r.persian_year_month <= selectedMonth);
 const cohMonths = [...new Set(rows.map(r => r.cohort_persian_month))].sort().slice(-12);
 const ages = [...new Set(rows.map(r => r.cohort_age))].sort((a, b) => a - b);
 return heading('رشد پایدار، از ماندن کاربران آغاز می‌شود.', 'رفتار کوهورت‌ها را از ماه ورود تا ماه‌های بعد دنبال کنید.', 'UNDERSTAND WHO STAYS', exportButton()) + banner() + (data.performance.length ? filters() : '') + (rows.length ? `<section class="panel"><div class="panel-head"><div><h2>ماتریس نگهداشت کاربران</h2><p class="panel-subtitle">نسبت کاربران فعال هر سن به کاربران سن صفر در سگمنت انتخاب‌شده</p></div><span class="tag">درصد نگهداشت</span></div><div class="table-scroll performance-table"><table class="cohort-table"><thead><tr><th>ماه ورود</th><th>اندازهٔ کوهورت</th>${ages.map(a => `<th>ماه ${num(a)}</th>`).join('')}</tr></thead><tbody>${cohMonths.map(m => { const cells = rows.filter(r => r.cohort_persian_month === m); const seed = sum(cells.filter(r => r.cohort_age === 0), 'active_users'); return `<tr><td><strong>${monthName(m)}</strong></td><td>${seed ? num(seed) : 'ناموجود'}</td>${ages.map(age => { const bucket = cells.filter(r => r.cohort_age === age); const count = sum(bucket, 'active_users'); const retention = seed && bucket.length ? count / seed : null; return `<td>${retention == null ? '<span class="text-muted">—</span>' : `<span class="heat-cell" style="background:rgba(95,151,107,${Math.min(1, retention) * .73 + .04});color:${retention > .65 ? '#fff' : '#4e7754'}">${pct(retention * 100)}<small>${num(count)} کاربر</small></span>`}</td>`; }).join('')}</tr>`; }).join('')}</tbody></table></div><div class="table-note">جمع کاربران بین ورتیکال‌ها و روش‌های پرداخت لزوماً یکتا نیست. نرخ‌های بیش از ۱۰۰٪ ممکن است ناشی از جابه‌جایی سگمنت باشند و نباید نگهداشت یکتای کل تلقی شوند.</div></section>` : empty('دادهٔ کوهورت هنوز وارد نشده است', 'خروجی دوم نوت‌بوک را به همراه ماه شمسی کوهورت و ماه شمسی فعالیت بارگذاری کنید.'));
}
function voucherPage() {
 const rows = data.voucher.filter(r => r.persian_year_month === selectedMonth && (!vertical || r.vertical === vertical));
 const plan = aggregate(planRows()), cost = sum(rows, 'total_voucher_toman');
 const p = chosenPlan(); const budget = p?.target === selectedMonth ? p.result.budget : null;
 return heading('بودجه‌ای که هدفمند خرج می‌شود.', 'هزینه، سفارش و ارزش ایجادشده از ووچر را کنار هم ببینید.', 'MAKE EVERY VOUCHER COUNT', exportButton()) + banner() + (data.performance.length ? filters(true) : '') + (rows.length ? `<div class="report-summary"><article class="panel report-card"><p>هزینهٔ واقعی ووچر</p><strong>${money(cost)}</strong><small>تومان · ${monthName(selectedMonth)}</small></article><article class="panel report-card"><p>بودجهٔ کل نسخهٔ انتخاب‌شده</p><strong>${budget == null ? '—' : money(budget)}</strong><small>بودجه کل سناریو است و با فیلتر ورتیکال تقسیم نمی‌شود.</small></article><article class="panel report-card"><p>هزینه به ازای سفارش ووچردار</p><strong>${money(div(cost, sum(rows, 'voucher_orders')))}</strong><small>تومان / سفارش</small></article></div><section class="panel"><div class="panel-head"><h2>جزئیات مصرف ووچر</h2><span class="tag">خروجی چهارم</span></div><div class="table-scroll performance-table"><table><thead><tr><th>ورتیکال</th><th>سفارش ووچردار</th><th>کاربر جدید ووچردار</th><th>هزینه واقعی</th><th>GMV ووچردار</th><th>ووچر / GMV</th><th>هزینه / کاربر جدید</th></tr></thead><tbody>${rows.map(r => `<tr><td><strong>${esc(vname(r.vertical))}</strong></td><td>${num(r.voucher_orders)}</td><td>${num(r.new_voucher_users)}</td><td>${money(r.total_voucher_toman)}</td><td>${money(r.voucher_orders_gmv_toman)}</td><td>${pct(div(r.total_voucher_toman * 100, r.voucher_orders_gmv_toman))}</td><td>${money(div(r.total_voucher_toman, r.new_voucher_users))}</td></tr>`).join('')}</tbody></table></div><div class="table-note">کاربر جدید ووچردار به معنای کاربر با سفارش ووچردار در ماه ورود است، نه لزوماً کاربر جذب‌شده با اولین سفارش ووچردار. اثر افزایشی ووچر بدون آزمایش قابل ادعای قطعی نیست.</div></section>` : empty('دادهٔ تحلیل ووچر موجود نیست', 'خروجی چهارم نوت‌بوک را برای ماه انتخاب‌شده بارگذاری کنید.'));
}
function deviationPage() {
 const actual = aggregate(actualRows()), plan = aggregate(planRows());
 const comparable = planRows().length > 0;
 const orderEffect = comparable ? (actual.orders - plan.orders) * plan.aov_toman : null;
 const aovEffect = comparable ? actual.orders * (actual.aov_toman - plan.aov_toman) : null;
 return heading('فاصلهٔ برنامه و واقعیت، از کجا می‌آید؟', 'تحقق هدف‌ها و سهم هر عامل از انحراف را بررسی کنید.', 'FROM VARIANCE TO ACTION', exportButton()) + banner() + (data.performance.length ? filters(true) : '') + (!comparable ? `<div class="panel empty">${icon('deviation')}<h2>یک نسخهٔ برنامه برای این ماه انتخاب کنید</h2><p>برای مقایسه، باید هم دادهٔ واقعی و هم نسخهٔ برنامهٔ همان ماه موجود باشد.<br>برنامه‌های ذخیره‌شده پس از ورود عملکرد ماه هدف، قابل مقایسه خواهند بود.</p><button class="btn btn-primary" data-action="navigate" data-page="scenario">رفتن به سناریوها</button></div>` : `<div class="report-summary"><article class="panel report-card"><p>انحراف کل GMV</p><strong>${money(actual.gross_gmv_toman - plan.gross_gmv_toman)}</strong><small>تومان · واقعی منهای برنامه</small></article><article class="panel report-card"><p>اثر تعداد سفارش</p><strong>${money(orderEffect)}</strong><small>(سفارش واقعی − برنامه) × AOV برنامه</small></article><article class="panel report-card"><p>اثر ارزش سفارش</p><strong>${money(aovEffect)}</strong><small>سفارش واقعی × (AOV واقعی − برنامه)</small></article></div><section class="panel"><div class="panel-head"><h2>کارنامهٔ تحقق برنامه</h2><span class="tag">${esc(chosenPlan().name)}</span></div><div class="table-scroll performance-table"><table><thead><tr><th>شاخص</th><th>واقعی</th><th>برنامه</th><th>نرخ تحقق</th><th>انحراف</th><th>انحراف درصدی</th></tr></thead><tbody>${[['gross_gmv_toman', 'GMV ناخالص', true], ['orders', 'سفارش'], ['active_users', 'کاربران فعال سگمنت‌ها'], ['new_users', 'کاربران جدید سگمنت‌ها'], ['aov_toman', 'میانگین ارزش سفارش', true], ['total_voucher_toman', 'هزینه ووچر', true]].map(([k, title, financial]) => `<tr><td><strong>${title}</strong></td><td>${financial ? money(actual[k]) : num(actual[k])}</td><td>${financial ? money(plan[k]) : num(plan[k])}</td><td>${pct(div(actual[k] * 100, plan[k]))}</td><td>${financial ? money(actual[k] - plan[k]) : num(actual[k] - plan[k])}</td><td>${pct(div((actual[k] - plan[k]) * 100, plan[k]))}</td></tr>`).join('')}</tbody></table></div></section>`);
}
const importNames = { performance: 'عملکرد ماهانه', cohort: 'کوهورت کاربران', organic: 'ارگانیک و غیرارگانیک', voucher: 'تحلیل ووچر' };
const templates = {
 performance: { persian_year_month: '1405-07', vertical: 'FASHION', payment_method: 'Installment', active_users: 100, new_users: 20, returning_users: 10, orders: 150, gross_gmv_toman: 150000000, aov_toman: 1000000, voucher_orders: 30, non_voucher_orders: 120, total_voucher_toman: 1500000 },
 cohort: { persian_year_month: '1405-07', cohort_persian_month: '1405-06', cohort_age: 1, vertical: 'FASHION', payment_method: 'Installment', active_users: 50, orders: 75, gross_gmv_toman: 75000000, aov_toman: 1000000, organic_users: 35, non_organic_users: 15 },
 organic: { persian_year_month: '1405-07', vertical: 'FASHION', payment_method: 'Installment', organic_orders: 120, non_organic_orders: 30, organic_users: 70, non_organic_users: 30, organic_gmv_toman: 120000000, non_organic_gmv_toman: 30000000, organic_aov_toman: 1000000, non_organic_aov_toman: 1000000 },
 voucher: { persian_year_month: '1405-07', vertical: 'FASHION', voucher_orders: 30, new_voucher_users: 8, previous_voucher_users: 12, total_voucher_toman: 1500000, voucher_orders_gmv_toman: 30000000, voucher_orders_aov_toman: 1000000 },
};
function importPage() {
 return heading('دادهٔ این ماه، نقطهٔ شروع ماه بعد.', 'خروجی کوئری‌های خود را وارد کنید؛ کیفیت را بررسی و سپس منتشر کنید.', 'BUILD ON RELIABLE DATA', `<button class="btn btn-light" data-action="template">${icon('download')} دریافت قالب نمونه</button>`) + banner() + `<section class="import-info-grid">${Object.entries(importNames).map(([k, name]) => `<div class="import-info">${name}<b>${demo ? '—' : num(data[k].length)} <small style="font-size:9px;font-weight:400">ردیف واقعی</small></b></div>`).join('')}</section><section class="panel"><div class="panel-head"><div><h2>بارگذاری خروجی ماهانه</h2><p class="panel-subtitle">فایل‌های CSV با UTF-8 و JSON، تا ۱۲ مگابایت</p></div><span class="tag">بدون تغییر اطلاعات قبلی</span></div><div class="upload-options"><div class="field"><label for="import-kind">نوع خروجی کوئری</label><select id="import-kind">${Object.entries(importNames).map(([k, name]) => `<option value="${k}">${name}</option>`).join('')}</select></div><div class="field"><label for="import-month">ماه شمسی خروجی تک‌ماهه</label><input id="import-month" dir="ltr" placeholder="1405-07" value="1405-07"><small>برای فایل چندماهه، ستون persian_year_month الزامی است.</small></div></div><label class="upload-zone" id="upload-zone" for="upload-file">${icon('import')}<h3 id="upload-title">فایل خود را اینجا رها کنید یا برای انتخاب کلیک کنید</h3><p>CSV یا JSON · خروجی کوئری، نه خود فایل نوت‌بوک</p><input id="upload-file" type="file" accept=".csv,.json"></label><div class="upload-help"><b>توجه به مرز ماه:</b> نوت‌بوک پیوست ماه‌های میلادی می‌سازد. خروجی را با مرز واقعی ماه شمسی استخراج کنید؛ تغییر برچسب تاریخ، تبدیل تقویم نیست.<br>مبالغ ستون‌های <code>_toman</code> از قبل تومان هستند. کوهورت علاوه بر ماه فعالیت، ستون <code>cohort_persian_month</code> نیاز دارد.<br>اطلاعات تکراری رد می‌شوند؛ دادهٔ واقعی ثبت‌شده در این نسخه بازنویسی نمی‌شود.</div><div class="quality-result" id="quality-result"></div><div class="form-actions"><button class="btn btn-primary" id="validate-import">${icon('check')} بررسی کیفیت داده</button><button class="btn btn-light" id="publish-import" disabled>${icon('lock')} تأیید و ثبت قطعی</button><span>ابتدا بررسی، سپس انتشار؛ همهٔ ردیف‌ها یکجا ثبت می‌شوند.</span></div></section><section class="panel mt20"><div class="panel-head"><div><h2>تاریخچهٔ بارگذاری</h2><p class="panel-subtitle">شناسهٔ اجرا، منبع و زمان انتشار هر خروجی</p></div></div><div class="table-scroll performance-table"><table><thead><tr><th>شناسه اجرا</th><th>نوع خروجی</th><th>نام فایل</th><th>تعداد ردیف</th><th>زمان ثبت</th><th>هشدار کیفیت</th></tr></thead><tbody>${data.runs.map(r => `<tr><td class="mono">${r.id}</td><td>${importNames[r.kind]}</td><td>${esc(r.source)}</td><td>${num(r.count)}</td><td>${new Intl.DateTimeFormat('fa-IR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(r.loaded_at))}</td><td>${num(JSON.parse(r.warnings).length)}</td></tr>`).join('') || '<tr><td colspan="6">هنوز دادهٔ واقعی ثبت نشده است.</td></tr>'}</tbody></table></div></section>`;
}
function reportsPage() {
 const rows = actualRows(); const org = filtered(data.organic.filter(r => r.persian_year_month === selectedMonth));
 return heading('یک تصویر روشن، آمادهٔ گفت‌وگو.', 'گزارش ماهانهٔ عملکرد و خروجی قابل‌استفاده در Excel', 'TURN DATA INTO CONVERSATION', exportButton()) + banner() + (data.performance.length ? filters(true) : '') + (!rows.length ? empty() : `<section class="panel"><div class="panel-head"><div><h2>گزارش ماهانه · ${monthName(selectedMonth)}</h2><p class="panel-subtitle">واقعی، برنامه و منبع هر ردیف، مستقل و قابل ردیابی</p></div><button class="btn btn-light" data-action="raw-export">${icon('download')} خروجی جزئیات واقعی</button></div><div class="table-scroll performance-table"><table><thead><tr><th>ورتیکال</th><th>پرداخت</th><th>کاربر فعال</th><th>کاربر جدید</th><th>سفارش</th><th>GMV (تومان)</th><th>AOV (تومان)</th><th>شناسه اجرا</th></tr></thead><tbody>${rows.map(r => `<tr><td>${esc(vname(r.vertical))}</td><td>${esc(r.payment_method)}</td><td>${num(r.active_users)}</td><td>${num(r.new_users)}</td><td>${num(r.orders)}</td><td>${money(r.gross_gmv_toman)}</td><td>${money(r.aov_toman)}</td><td class="mono">${esc(r.source_run_id)}</td></tr>`).join('')}</tbody></table></div><div class="table-note">دادهٔ واقعی از سناریو مستقل است. برای نرخ تحقق، نسخهٔ برنامهٔ همین ماه را انتخاب کنید. خروجی CSV دارای BOM و مناسب بازشدن در Excel است.</div></section><section class="panel mt20"><div class="panel-head"><div><h2>کاربران ارگانیک و غیرارگانیک</h2><p class="panel-subtitle">طبقه‌بندی ثابت بر اساس وجود ووچر در نخستین سفارش موفق Commercial</p></div></div>${org.length ? `<div class="table-scroll performance-table"><table><thead><tr><th>ورتیکال</th><th>پرداخت</th><th>کاربر ارگانیک</th><th>کاربر غیرارگانیک</th><th>GMV ارگانیک</th><th>GMV غیرارگانیک</th></tr></thead><tbody>${org.map(r => `<tr><td>${esc(vname(r.vertical))}</td><td>${esc(r.payment_method)}</td><td>${num(r.organic_users)}</td><td>${num(r.non_organic_users)}</td><td>${money(r.organic_gmv_toman)}</td><td>${money(r.non_organic_gmv_toman)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="notice" style="margin:20px">خروجی سوم نوت‌بوک برای این ماه بارگذاری نشده است.</p>'}</section>`);
}
function navigate(target) { location.hash = target; if (page === target) render(); }
function render() {
 if (!data) return;
 page = location.hash.slice(1) || 'dashboard';
 if (!pages.some(p => p[0] === page)) page = 'dashboard';
 $('#breadcrumb-title').textContent = pages.find(p => p[0] === page)[1];
 $('#navigation').innerHTML = pages.map(([id, label, symbol], i) => `${i === 6 ? '<div class="nav-divider"></div>' : ''}<a href="#${id}" class="nav-item ${id === page ? 'active' : ''}" ${id === page ? 'aria-current="page"' : ''}>${icon(symbol)}<span>${label}</span>${id === 'forecast' ? '<span class="badge">ماه بعد</span>' : ''}</a>`).join('');
 const renderer = { dashboard, forecast: scenarioPage, scenario: scenarioPage, cohort: cohortPage, voucher: voucherPage, deviation: deviationPage, import: importPage, reports: reportsPage };
 $('#main').innerHTML = renderer[page]();
 $('#sidebar').classList.remove('open');
 bind();
 if (page === 'dashboard' && data.performance.length) updateDashboardPrediction();
}
async function load() {
 try {
  data = await api(`/api/state?demo=${demo ? 1 : 0}`);
  if (!allMonths().includes(selectedMonth)) selectedMonth = allMonths().at(-1) || '';
  if (!data.scenarios.some(s => s.id === planId)) planId = '';
  render();
 } catch (e) { $('#main').innerHTML = `<div class="error-box">ارتباط با سرویس داده برقرار نشد. ${esc(e.message)}<br><button class="btn btn-light" id="retry-load">تلاش دوباره</button></div>`; $('#retry-load').onclick = load; }
}
function bind() {
 for (const [selector, setter] of [['#month-filter', v => selectedMonth = v], ['#vertical-filter', v => vertical = v], ['#payment-filter', v => payment = v], ['#plan-filter', v => planId = v]]) { if ($(selector)) $(selector).onchange = e => { setter(e.target.value); render(); }; }
 $$('[data-metric]').forEach(b => b.onclick = () => { metric = b.dataset.metric; render(); });
 if ($('#scenario-form')) {
 $('#scenario-form').onsubmit = async e => { e.preventDefault(); await computeScenario(false); };
 $('#save-scenario').onclick = async () => { if ($('#scenario-form').reportValidity()) await computeScenario(true); };
 }
 $$('[data-view]').forEach(b => b.onclick = () => { const s = data.scenarios.find(s => s.id === b.dataset.view); lastForecast = s.result; $('#scenario-output').innerHTML = resultHTML(s.result); $('#scenario-output').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
 $$('[data-copy]').forEach(b => b.onclick = () => { const s = data.scenarios.find(s => s.id === b.dataset.copy); currentAssumptions = { ...s.payload }; scenarioTarget = s.target; render(); $('#scenario-name').value = `${s.name} · بازنگری`; toast('فرض‌ها کپی شد؛ ذخیره، نسخهٔ جدید می‌سازد.'); });
 $$('[data-approve]').forEach(b => b.onclick = () => { const s = data.scenarios.find(s => s.id === b.dataset.approve); openModal(`<h2>قفل نسخهٔ برنامه</h2><p>نسخهٔ <b>${esc(s.name)}</b> برای ${monthName(s.target)} قفل می‌شود و پس از آن قابل تغییر نیست. برای اصلاح، باید نسخهٔ جدید بسازید.</p><p>این عملیات قفل فنی نسخه است و جایگزین تأیید مالی و گردش تأیید مبتنی بر نقش نیست.</p><button class="btn btn-primary" id="confirm-lock">${icon('lock')} تأیید و قفل نسخه</button>`); $('#confirm-lock').onclick = async () => { try { await api('/api/scenarios/approve', { id: s.id }); closeModal(); await load(); toast('نسخهٔ برنامه قفل شد.'); } catch (e) { toast(e.message); } }; });
 if (page === 'import') bindImport();
}
async function computeScenario(save) {
 const buttons = $$('#scenario-form button'); buttons.forEach(b => b.disabled = true);
 try { const payload = readScenario(); const response = await api(save ? '/api/scenarios' : '/api/forecast', payload); lastForecast = save ? response.result : response; if (save) { await load(); toast('نسخهٔ مستقل سناریو ذخیره شد.'); } if ($('#scenario-output')) $('#scenario-output').innerHTML = resultHTML(lastForecast); }
 catch (e) { if ($('#scenario-output')) $('#scenario-output').innerHTML = `<h3>محاسبه نیازمند بررسی است</h3><p class="warning">${esc(e.message)}</p>`; toast(e.message); }
 finally { $$('#scenario-form button').forEach(b => b.disabled = false); }
}
function parseCSV(text) {
 text = text.replace(/^\uFEFF/, '');
 const lines = []; let row = [], value = '', quoted = false;
 for (let i = 0; i < text.length; i++) { const c = text[i]; if (c === '"') { if (quoted && text[i + 1] === '"') { value += '"'; i++; } else if (quoted || !value) quoted = !quoted; else throw new Error('ساختار نقل‌قول CSV معتبر نیست.'); } else if (c === ',' && !quoted) { row.push(value.trim()); value = ''; } else if ((c === '\n' || c === '\r') && !quoted) { if (c === '\r' && text[i + 1] === '\n') i++; row.push(value.trim()); if (row.some(v => v !== '')) lines.push(row); row = []; value = ''; } else value += c; }
 if (quoted) throw new Error('نقل‌قول CSV بسته نشده است.');
 row.push(value.trim()); if (row.some(v => v !== '')) lines.push(row);
 if (lines.length < 2) throw new Error('فایل باید سرستون و حداقل یک ردیف داده داشته باشد.');
 const headers = lines.shift();
 if (headers.some(h => !h) || new Set(headers).size !== headers.length) throw new Error('سرستون خالی یا تکراری است.');
 return lines.map((r, i) => { if (r.length !== headers.length) throw new Error(`تعداد ستون‌های ردیف ${num(i + 2)} معتبر نیست.`); return Object.fromEntries(headers.map((h, j) => [h, r[j]])); });
}
async function pickFile(file) {
 importValidation = null; importFile = null; $('#publish-import').disabled = true; $('#quality-result').innerHTML = '';
 if (!file) return;
 try { if (file.size > 12e6) throw new Error('حجم فایل باید کمتر از ۱۲ مگابایت باشد.'); const text = await file.text(); const rows = file.name.toLowerCase().endsWith('.json') ? JSON.parse(text) : parseCSV(text); if (!Array.isArray(rows) || !rows.length) throw new Error('فایل باید آرایه‌ای از ردیف‌ها داشته باشد.'); importFile = { source: file.name, rows }; $('#upload-title').textContent = `${file.name} · ${num(rows.length)} ردیف`; }
 catch (e) { $('#quality-result').innerHTML = `<div class="warning">${esc(e.message)}</div>`; }
}
function bindImport() {
 importFile = null; importValidation = null;
 $('#upload-file').onchange = e => pickFile(e.target.files[0]);
 const zone = $('#upload-zone');
 zone.ondragover = e => { e.preventDefault(); zone.classList.add('dragover'); };
 zone.ondragleave = () => zone.classList.remove('dragover');
 zone.ondrop = e => { e.preventDefault(); zone.classList.remove('dragover'); pickFile(e.dataTransfer.files[0]); };
 for (const sel of ['#import-kind', '#import-month']) $(sel).oninput = () => { importValidation = null; $('#publish-import').disabled = true; $('#quality-result').innerHTML = ''; };
 $('#validate-import').onclick = async () => {
  if (!importFile) return toast('ابتدا فایل خروجی را انتخاب کنید.');
  const button = $('#validate-import'); button.disabled = true;
  try {
   const payload = { ...importFile, kind: $('#import-kind').value, period: $('#import-month').value };
   const result = await api('/api/import/validate', payload); importValidation = payload;
   $('#quality-result').innerHTML = `<div class="notice">${icon('check').replace('<svg ', '<svg style="width:15px;height:15px;vertical-align:middle" ')} ${num(result.count)} ردیف معتبر · ${result.periods.map(monthName).join('، ')}<br>با ثبت، تأیید می‌کنید که مرز تاریخ داده‌ها متعلق به همین ماه شمسی است.</div>${result.warnings.length ? `<ul>${result.warnings.map(w => `<li>${esc(w)}</li>`).join('')}</ul><label class="field-check"><input id="confirm-warnings" type="checkbox">هشدارها را بررسی کردم و انتشار را تأیید می‌کنم.</label>` : ''}`;
   $('#publish-import').disabled = false;
  } catch (e) { importValidation = null; $('#quality-result').innerHTML = `<div class="warning">${esc(e.message)}</div>`; } finally { button.disabled = false; }
 };
 $('#publish-import').onclick = async () => {
  if (!importValidation) return;
  if ($('#confirm-warnings') && !$('#confirm-warnings').checked) return toast('هشدارهای کیفیت را تأیید کنید.');
  $('#publish-import').disabled = true;
  try { const result = await api('/api/import', { ...importValidation, confirmed_warnings: true }); demo = false; localStorage.setItem('planning-mode', 'live'); selectedMonth = ''; vertical = ''; payment = ''; scenarioTarget = ''; await load(); toast(`${num(result.count)} ردیف واقعی با موفقیت ثبت شد.`); } catch (e) { toast(e.message); $('#publish-import').disabled = false; }
 };
}
document.addEventListener('click', async e => {
 const button = e.target.closest('[data-action]'); if (!button) return;
 const action = button.dataset.action;
 if (action === 'navigate') navigate(button.dataset.page);
 if (action === 'go-live' || action === 'go-demo') { demo = action === 'go-demo'; localStorage.setItem('planning-mode', demo ? 'demo' : 'live'); selectedMonth = ''; vertical = ''; payment = ''; planId = ''; scenarioTarget = ''; lastForecast = null; data = null; $('#main').innerHTML = '<div class="loading">در حال تغییر فضای داده…</div>'; if (!demo) location.hash = 'import'; await load(); }
 if (action === 'template') { const kind = $('#import-kind')?.value || 'performance'; exportRows([templates[kind]], `template-${kind}`); }
 if (action === 'raw-export') exportRows(actualRows(), selectedMonth);
 if (action === 'export') {
  if (['forecast', 'scenario'].includes(page)) exportRows(lastForecast?.rows || [], 'forecast');
  else if (page === 'cohort') exportRows(filtered(data.cohort), 'cohort');
  else if (page === 'voucher') exportRows(data.voucher.filter(r => r.persian_year_month === selectedMonth && (!vertical || r.vertical === vertical)), 'voucher');
  else { const plan = planRows(); exportRows(actualRows().map(r => { const p = plan.find(p => p.vertical === r.vertical && p.payment_method === r.payment_method); return { ...r, plan_version_id: plan.length ? planId : '', plan_gmv_toman: p?.gross_gmv_toman ?? '', gmv_achievement_pct: p?.gross_gmv_toman ? r.gross_gmv_toman / p.gross_gmv_toman * 100 : '', gmv_variance_toman: p ? r.gross_gmv_toman - p.gross_gmv_toman : '', data_mode: demo ? 'DEMO' : 'ACTUAL' }; }), `report-${selectedMonth}`); }
 }
 if (action === 'forecast-details' && lastForecast) openModal(`<h2>جزئیات و منبع محاسبات</h2><p>ماه هدف ${monthName(lastForecast.target)} · فقط داده‌های پیش از ماه هدف در محاسبه وارد شده‌اند.</p><div class="table-scroll"><table><thead><tr><th>سگمنت</th><th>روش</th><th>روند جدید</th><th>مبنای شمسی</th><th>شناسه منبع</th></tr></thead><tbody>${lastForecast.rows.map(r => `<tr><td>${esc(vname(r.vertical))}<br>${esc(r.payment_method)}</td><td>${r.method === 'cohort' ? 'کوهورت' : 'تقریب تجمیعی'}</td><td>${pct(r.trend_pct)}</td><td>${r.baseline_months.map(monthName).join('<br>')}</td><td class="mono">${r.source_run_ids.map(esc).join('<br>')}</td></tr>`).join('')}</tbody></table></div><p>کاربران جدید = مبنای کاربران جدید × (۱ + روند تاریخی) × (۱ + فرض رشد) × ضریب کمپین. سفارش = کاربر فعال × دفعات سفارش. GMV = سفارش × AOV.</p>`);
});
window.addEventListener('hashchange', () => { render(); window.scrollTo({ top: 0 }); });
$('#main').innerHTML = '<div class="loading">در حال آماده‌سازی فضای برنامه‌ریزی…</div>';
load();
