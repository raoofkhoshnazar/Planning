from planning import TABLES, period, shift, validate


def prepare_bundle(payload, stored):
    inputs = payload.get('files')
    if not isinstance(inputs, dict) or set(inputs) != set(TABLES):
        raise ValueError('هر چهار فایل عملکرد، کوهورت، ارگانیک و ووچر را انتخاب کنید.')
    files, warnings, rejected = [], [], []
    candidate = {kind: list(stored[kind]) for kind in TABLES}
    for kind in TABLES:
        source = inputs[kind]
        if not isinstance(source, dict) or not isinstance(source.get('rows'), list):
            raise ValueError(f'فایل {kind}: ساختار ردیف‌ها معتبر نیست.')
        raw_rows = source.get('rows')
        if kind == 'cohort' and isinstance(raw_rows, list):
            accepted = []
            for i, row in enumerate(raw_rows):
                if isinstance(row, dict) and str(row.get('cohort_age', '')).strip().lstrip('-').isdigit() and int(row['cohort_age']) < 0:
                    rejected.append(dict(kind=kind, source=source.get('source', kind), row_number=i + 2, reason='سن کوهورت منفی است؛ ماه فعالیت پیش از ماه ورود ثبت شده است.', data=row))
                else:
                    accepted.append(row)
            raw_rows = accepted
        rows, notices = validate(kind, raw_rows)
        def row_key(r):
            return (r['persian_year_month'], r['vertical'], r.get('payment_method', ''), r.get('cohort_persian_month', ''))
        existing = {row_key(r) for r in candidate[kind]}
        if any(row_key(r) in existing for r in rows):
            raise ValueError(f'فایل {kind}: دادهٔ تکراری ثبت نمی‌شود.')
        candidate[kind].extend(rows)
        files.append(dict(kind=kind, source=str(source.get('source', kind))[:200], rows=rows, count=len(rows), periods=sorted({r['persian_year_month'] for r in rows})))
        warnings.extend(notices)
    latest = max(r['persian_year_month'] for r in files[0]['rows'])
    target = period(payload['target']) if payload.get('target') else shift(latest, 1)
    if target != shift(latest, 1):
        raise ValueError('ماه هدف باید ماه بلافاصله پس از آخرین ماه عملکرد باشد.')
    basis = files[0]['rows'][0]['calendar_basis']
    for file in files:
        if any(r['persian_year_month'] >= target for r in file['rows']):
            raise ValueError(f"فایل {file['kind']} شامل دادهٔ ماه هدف یا آینده است؛ نشت داده مجاز نیست.")
        if any(r['calendar_basis'] != basis for r in file['rows']):
            raise ValueError('تقویم هر چهار فایل باید یکسان باشد.')
        missing = set(files[0]['periods']) - set(file['periods'])
        if missing:
            warnings.append(f"فایل {file['kind']}: برای {len(missing)} ماه عملکرد داده وجود ندارد.")
    if any(r.get('calendar_basis', 'gregorian' if int(r['persian_year_month'][:4]) >= 1900 else 'persian') != basis for r in stored['performance']):
        raise ValueError('داده‌های میلادی و شمسی را نمی‌توان در یک مجموعه ترکیب کرد.')
    index = {(r['persian_year_month'], r['vertical'], r['payment_method']): r for r in candidate['performance']}
    for o in candidate['organic']:
        p = index.get((o['persian_year_month'], o['vertical'], o['payment_method']))
        if p and (o['organic_orders'] + o['non_organic_orders'] != p['orders'] or abs(o['organic_gmv_toman'] + o['non_organic_gmv_toman'] - p['gross_gmv_toman']) > 1):
            warnings.append(f"عدم تطابق ارگانیک با عملکرد: {o['persian_year_month']} / {o['vertical']} / {o['payment_method']}")
    monthly = {}
    for r in candidate['performance']:
        group = monthly.setdefault((r['persian_year_month'], r['vertical']), [0, 0])
        group[0] += r['voucher_orders']
        group[1] += r['total_voucher_toman']
    mismatches = 0
    for v in candidate['voucher']:
        group = monthly.get((v['persian_year_month'], v['vertical']))
        if not group or group[0] != v['voucher_orders'] or abs(group[1] - v['total_voucher_toman']) > 1:
            mismatches += 1
    if mismatches:
        warnings.append(f'{mismatches} ردیف ووچر با جمع عملکرد تطابق ندارد؛ تحلیل ووچر مستقل است و پیش‌بینی بر مبنای عملکرد انجام می‌شود.')
    if rejected:
        warnings.append(f'{len(rejected)} ردیف کوهورت با سن منفی قرنطینه شد و در تحلیل و پیش‌بینی استفاده نمی‌شود؛ گزارش ردیف‌ها را دریافت و منبع را اصلاح کنید.')
    return dict(files=files, warnings=list(dict.fromkeys(warnings)), target=target, calendar=basis, rejected=rejected)
