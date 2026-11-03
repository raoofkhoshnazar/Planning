import math
import statistics

TABLES = {
    'performance': ['active_users', 'new_users', 'returning_users', 'orders', 'gross_gmv_toman', 'aov_toman', 'voucher_orders', 'non_voucher_orders', 'total_voucher_toman'],
    'cohort': ['cohort_age', 'active_users', 'orders', 'gross_gmv_toman', 'aov_toman', 'organic_users', 'non_organic_users'],
    'organic': ['organic_orders', 'non_organic_orders', 'organic_users', 'non_organic_users', 'organic_gmv_toman', 'non_organic_gmv_toman', 'organic_aov_toman', 'non_organic_aov_toman'],
    'voucher': ['voucher_orders', 'new_voucher_users', 'previous_voucher_users', 'total_voucher_toman', 'voucher_orders_gmv_toman', 'voucher_orders_aov_toman'],
}
COUNTS = {'active_users', 'new_users', 'returning_users', 'orders', 'voucher_orders', 'non_voucher_orders', 'organic_orders', 'non_organic_orders', 'organic_users', 'non_organic_users', 'new_voucher_users', 'previous_voucher_users', 'cohort_age'}
DIGITS = str.maketrans('۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩', '01234567890123456789')


def period(value):
    value = str(value).translate(DIGITS).strip().replace('/', '-')
    parts = value.split('-')
    if len(parts) != 2 or not all(p.isdigit() for p in parts):
        raise ValueError('ماه شمسی باید به شکل 1405-07 باشد.')
    y, m = map(int, parts)
    if not 1300 <= y <= 1600 or not 1 <= m <= 12:
        raise ValueError('ماه یا سال شمسی معتبر نیست.')
    return f'{y:04d}-{m:02d}'


def shift(month, delta):
    y, m = map(int, period(month).split('-'))
    n = y * 12 + m - 1 + delta
    return f'{n // 12:04d}-{n % 12 + 1:02d}'


def distance(a, b):
    ay, am = map(int, a.split('-'))
    by, bm = map(int, b.split('-'))
    return (by - ay) * 12 + bm - am


def ratio(a, b):
    return a / b if b else None


def validate(kind, rows, selected_period=None):
    if kind not in TABLES or not isinstance(rows, list) or not rows or len(rows) > 30000:
        raise ValueError('نوع خروجی یا تعداد ردیف‌ها معتبر نیست (۱ تا ۳۰٬۰۰۰ ردیف).')
    source_months = {str(r.get('month', r.get('month_key', r.get('activity_month', '')))) for r in rows if isinstance(r, dict)}
    normalized, keys, warnings = [], set(), []
    for index, original in enumerate(rows, 1):
        if not isinstance(original, dict):
            raise ValueError(f'ردیف {index}: ساختار معتبر نیست.')
        r = dict(original)
        if not r.get('persian_year_month'):
            if not selected_period or len(source_months) > 1:
                raise ValueError('برای فایل چندماهه ستون persian_year_month الزامی است؛ برای فایل تک‌ماهه ماه شمسی را انتخاب کنید.')
            r['persian_year_month'] = selected_period
        r['persian_year_month'] = period(r['persian_year_month'])
        for field in ['vertical'] + ([] if kind == 'voucher' else ['payment_method']):
            if not isinstance(r.get(field), str) or not r[field].strip() or len(r[field]) > 100:
                raise ValueError(f'ردیف {index}: ستون {field} الزامی است.')
            r[field] = r[field].strip()
        for field in TABLES[kind]:
            try:
                number = float(str(r[field]).translate(DIGITS).replace(',', '').replace('٬', ''))
            except (ValueError, KeyError, TypeError):
                raise ValueError(f'ردیف {index}: مقدار ستون {field} معتبر نیست.')
            if not math.isfinite(number) or number < 0 or number > 1e18 or (field in COUNTS and not number.is_integer()):
                raise ValueError(f'ردیف {index}: {field} باید عدد غیرمنفی و متناسب با نوع ستون باشد.')
            r[field] = int(number) if field in COUNTS else number
        key = [r['persian_year_month'], r['vertical']]
        if kind != 'voucher':
            key.append(r['payment_method'])
        if kind == 'cohort':
            r['cohort_persian_month'] = period(r.get('cohort_persian_month', ''))
            if distance(r['cohort_persian_month'], r['persian_year_month']) != r['cohort_age']:
                raise ValueError(f'ردیف {index}: سن کوهورت با ماه شمسی ورود و فعالیت سازگار نیست.')
            key.append(r['cohort_persian_month'])
        if kind == 'performance':
            if r['voucher_orders'] + r['non_voucher_orders'] != r['orders']:
                raise ValueError(f'ردیف {index}: جمع سفارش‌های ووچردار و بدون ووچر با سفارش کل برابر نیست.')
            if r['new_users'] > r['active_users'] or r['returning_users'] > r['active_users'] or r['active_users'] > r['orders']:
                raise ValueError(f'ردیف {index}: تعداد کاربران با سفارش‌ها سازگار نیست.')
            expected = ratio(r['gross_gmv_toman'], r['orders'])
            if expected is not None and abs(expected - r['aov_toman']) > max(1, expected * .01):
                raise ValueError(f'ردیف {index}: AOV با GMV تقسیم بر سفارش تطابق ندارد.')
            if not r['orders'] and r['gross_gmv_toman']:
                raise ValueError(f'ردیف {index}: GMV بدون سفارش معتبر نیست.')
        if kind == 'cohort' and r['organic_users'] + r['non_organic_users'] != r['active_users']:
            raise ValueError(f'ردیف {index}: جمع کاربران ارگانیک و غیرارگانیک با کاربران فعال برابر نیست.')
        if kind == 'voucher' and r['total_voucher_toman'] > r['voucher_orders_gmv_toman']:
            raise ValueError(f'ردیف {index}: هزینهٔ ووچر از GMV سفارش‌های ووچردار بیشتر است.')
        key = '|'.join(key)
        if key in keys:
            raise ValueError(f'ردیف {index}: کلید تجمیع تکراری است.')
        keys.add(key)
        r['_key'] = key
        if r.get('payment_method') == 'Unknown':
            warnings.append(f'ردیف {index}: روش پرداخت ناشناخته است.')
        normalized.append(r)
    return normalized, warnings


def assumptions(data):
    defaults = {'baseline': 'previous', 'new_growth': 0, 'aov_growth': 0, 'retention': 90, 'frequency': 0, 'voucher_share': -1, 'voucher_cost': 0, 'budget': 0, 'campaign': 1, 'auto_trend': True, 'notes': ''}
    out = {**defaults, **data}
    if out['baseline'] not in ['previous', 'average', 'year']:
        raise ValueError('مبنای پیش‌بینی معتبر نیست.')
    limits = {'new_growth': (-100, 500), 'aov_growth': (-100, 500), 'retention': (0, 100), 'frequency': (0, 100), 'voucher_share': (-1, 100), 'voucher_cost': (0, 1e15), 'budget': (0, 1e18), 'campaign': (0, 10)}
    for k, (low, high) in limits.items():
        try:
            out[k] = float(out[k])
        except (TypeError, ValueError):
            raise ValueError('فرض‌های سناریو باید عدد باشند.')
        if not math.isfinite(out[k]) or not low <= out[k] <= high:
            raise ValueError(f'مقدار {k} خارج از دامنه است.')
    if out['campaign'] != 1 and not str(out['notes']).strip():
        raise ValueError('برای ضریب کمپین، مستند یا دلیل فرض را وارد کنید.')
    out['auto_trend'] = bool(out['auto_trend'])
    out['notes'] = str(out['notes'])[:3000]
    return out


def forecast(performance, cohorts, target, raw_assumptions):
    target = period(target)
    a = assumptions(raw_assumptions)
    history = [r for r in performance if r['persian_year_month'] < target]
    if not history:
        raise ValueError('پیش از ماه هدف، دادهٔ واقعی وجود ندارد.')
    groups = sorted({(r['vertical'], r['payment_method']) for r in history})
    results = []
    for vertical, payment in groups:
        series = sorted([r for r in history if (r['vertical'], r['payment_method']) == (vertical, payment)], key=lambda r: r['persian_year_month'])
        months = [shift(target, -1)] if a['baseline'] == 'previous' else [shift(target, -i) for i in range(1, 4)] if a['baseline'] == 'average' else [shift(target, -12)]
        base = [r for r in series if r['persian_year_month'] in months]
        if len(base) != len(months):
            raise ValueError(f'دادهٔ مبنای {vertical} / {payment} برای {"، ".join(months)} کامل نیست. مبنای دیگری انتخاب کنید.')
        avg = lambda field: statistics.mean(r[field] for r in base)
        base_orders = avg('orders')
        base_active = avg('active_users')
        base_aov = ratio(sum(r['gross_gmv_toman'] for r in base), sum(r['orders'] for r in base)) or 0
        growth = 0
        if a['auto_trend'] and len(series) >= 2:
            changes = [min(.3, max(-.3, cur['new_users'] / prev['new_users'] - 1)) for prev, cur in zip(series[-4:], series[-4:][1:]) if prev['new_users'] and distance(prev['persian_year_month'], cur['persian_year_month']) == 1]
            growth = statistics.mean(changes) if changes else 0
        new = round(avg('new_users') * (1 + growth) * (1 + a['new_growth'] / 100) * a['campaign'])
        segment_cohorts = [c for c in cohorts if c['vertical'] == vertical and c['payment_method'] == payment and c['persian_year_month'] < target]
        seeds = {c['cohort_persian_month']: c['active_users'] for c in segment_cohorts if c['cohort_age'] == 0}
        rates = {}
        for c in segment_cohorts:
            size = seeds.get(c['cohort_persian_month'])
            if size and c['cohort_age'] > 0:
                bucket = rates.setdefault(c['cohort_age'], [0, 0])
                bucket[0] += c['active_users']
                bucket[1] += size
        needed = {distance(m, target) for m in seeds}
        use_cohorts = bool(seeds) and bool(rates)
        extrapolated = False
        if use_cohorts:
            curve = {age: min(1, totals[0] / totals[1]) for age, totals in rates.items()}
            ages = sorted(curve)
            def retention_at(age):
                if age in curve:
                    return curve[age]
                lower = [x for x in ages if x < age]
                upper = [x for x in ages if x > age]
                if lower and upper:
                    lo, hi = lower[-1], upper[0]
                    return curve[lo] + (curve[hi] - curve[lo]) * (age - lo) / (hi - lo)
                return curve[lower[-1] if lower else upper[0]]
            extrapolated = any(age not in curve for age in needed)
            old = round(sum(size * retention_at(distance(m, target)) * a['retention'] / 100 for m, size in seeds.items()))
            method = 'cohort'
        else:
            old = round(max(0, base_active - avg('new_users')) * a['retention'] / 100)
            method = 'aggregate'
        active = new + old
        frequency = a['frequency'] or ratio(base_orders, base_active) or 0
        orders = round(active * frequency)
        aov = base_aov * (1 + a['aov_growth'] / 100)
        share = a['voucher_share'] / 100 if a['voucher_share'] >= 0 else (ratio(avg('voucher_orders'), base_orders) or 0)
        vorders = round(orders * share)
        cost = a['voucher_cost'] or ratio(avg('total_voucher_toman'), avg('voucher_orders')) or 0
        results.append({'persian_year_month': target, 'vertical': vertical, 'payment_method': payment, 'new_users': new, 'active_users': active, 'orders': orders, 'aov_toman': aov, 'gross_gmv_toman': orders * aov, 'voucher_orders': vorders, 'non_voucher_orders': orders - vorders, 'total_voucher_toman': vorders * cost, 'method': method, 'retention_interpolated_or_extended': extrapolated, 'baseline_months': months, 'source_run_ids': sorted({r.get('source_run_id', 'demo') for r in base}), 'trend_pct': growth * 100})
    cost = sum(r['total_voucher_toman'] for r in results)
    return {'target': target, 'rows': results, 'assumptions': a, 'voucher_cost': cost, 'budget': a['budget'], 'over_budget': cost > a['budget'], 'budget_remaining': a['budget'] - cost, 'warnings': ['کاربران تجمیعی جمع سگمنت‌ها هستند؛ تعداد کاربران یکتای کل نیستند.', 'پیش‌بینی تحلیلی است، نه تضمین عملکرد یا برنامهٔ مالی قطعی.'] + (['کوهورت کامل برای سن‌های هدف موجود نیست؛ در سگمنت‌های علامت‌دار از تقریب کاربران قدیمی استفاده شد.'] if any(r['method'] == 'aggregate' for r in results) else []) + (['برای سن‌های فاقد مشاهده، منحنی نگهداشت بین سن‌های موجود خطی و پس از آخرین سن، ثابت امتداد یافته است؛ کوهورت‌های بدون سن صفر در مدل وارد نمی‌شوند.'] if any(r['retention_interpolated_or_extended'] for r in results) else [])}


def demo_data():
    performance, cohorts, organic, voucher = [], [], [], []
    verticals = [('FASHION', 1.1), ('DIGITAL', 1.7), ('BEAUTY', .72), ('HOME', .9), ('SPORT', .48)]
    for i in range(12):
        month = shift('1404-08', i)
        for vi, (vertical, weight) in enumerate(verticals):
            vouchers = []
            for pi, payment in enumerate(['Installment', 'PayNow']):
                factor = weight * (1 if pi == 0 else .44)
                new = round((1850 + i * 86) * factor)
                active = round((10200 + i * 480 + math.sin(i * .9 + vi) * 700) * factor)
                orders = round(active * (1.63 + i * .025))
                aov = round((1750000 + i * 23000) * (1 + vi * .07))
                vo = round(orders * (.26 - i * .003 + vi * .008))
                vc = vo * (63000 + vi * 5000)
                row = dict(persian_year_month=month, vertical=vertical, payment_method=payment, active_users=active, new_users=new, returning_users=round(active * .12), orders=orders, gross_gmv_toman=orders * aov, aov_toman=aov, voucher_orders=vo, non_voucher_orders=orders - vo, total_voucher_toman=vc, source_run_id='demo')
                performance.append(row)
                organic.append(dict(persian_year_month=month, vertical=vertical, payment_method=payment, organic_orders=orders - vo, non_organic_orders=vo, organic_users=round(active * .7), non_organic_users=active - round(active * .7), organic_gmv_toman=(orders - vo) * aov, non_organic_gmv_toman=vo * aov, organic_aov_toman=aov, non_organic_aov_toman=aov))
                vouchers.append(row)
                for age in range(i + 1):
                    cohort_month = shift(month, -age)
                    size = round((1850 + (i - age) * 86) * factor)
                    cu = round(size * (.58 ** (age ** .48))) if age else size
                    co = round(cu * 1.7)
                    cohorts.append(dict(persian_year_month=month, cohort_persian_month=cohort_month, cohort_age=age, vertical=vertical, payment_method=payment, active_users=cu, orders=co, gross_gmv_toman=co * aov, aov_toman=aov, organic_users=round(cu * .7), non_organic_users=cu - round(cu * .7)))
            voucher.append(dict(persian_year_month=month, vertical=vertical, voucher_orders=sum(r['voucher_orders'] for r in vouchers), new_voucher_users=round(sum(r['new_users'] for r in vouchers) * .3), previous_voucher_users=round(sum(r['active_users'] for r in vouchers) * .15), total_voucher_toman=sum(r['total_voucher_toman'] for r in vouchers), voucher_orders_gmv_toman=sum(r['voucher_orders'] * r['aov_toman'] for r in vouchers), voucher_orders_aov_toman=vouchers[0]['aov_toman']))
    return dict(performance=performance, cohort=cohorts, organic=organic, voucher=voucher)
