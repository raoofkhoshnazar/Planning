import datetime as dt
import json
import mimetypes
import os
from pathlib import Path
import sqlite3
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

from bundle_import import prepare_bundle
from planning import TABLES, assumptions, demo_data, forecast, period, validate

ROOT = Path(__file__).resolve().parent
DB = ROOT / 'data' / 'planning.sqlite3'


def connect():
    DB.parent.mkdir(exist_ok=True)
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA foreign_keys=ON')
    conn.executescript('''
    CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, payload TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY, loaded_at TEXT NOT NULL, kind TEXT NOT NULL, count INTEGER NOT NULL, warnings TEXT NOT NULL, source TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS actuals(kind TEXT NOT NULL, row_key TEXT NOT NULL, run_id TEXT NOT NULL REFERENCES runs(id), payload TEXT NOT NULL, PRIMARY KEY(kind,row_key));
    CREATE TRIGGER IF NOT EXISTS immutable_actual_update BEFORE UPDATE ON actuals BEGIN SELECT RAISE(ABORT,'Actual data is immutable'); END;
    CREATE TRIGGER IF NOT EXISTS immutable_actual_delete BEFORE DELETE ON actuals BEGIN SELECT RAISE(ABORT,'Actual data is immutable'); END;
    CREATE TABLE IF NOT EXISTS scenarios(id TEXT PRIMARY KEY, name TEXT NOT NULL, target TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, approved_at TEXT, payload TEXT NOT NULL, result TEXT NOT NULL, mode TEXT NOT NULL);
    CREATE TRIGGER IF NOT EXISTS locked_plan_update BEFORE UPDATE ON scenarios WHEN OLD.status='approved' BEGIN SELECT RAISE(ABORT,'Approved plan is immutable'); END;
    CREATE TRIGGER IF NOT EXISTS locked_plan_delete BEFORE DELETE ON scenarios WHEN OLD.status='approved' BEGIN SELECT RAISE(ABORT,'Approved plan is immutable'); END;
    ''')
    return conn


def dataset(conn, demo=False):
    if demo:
        return demo_data()
    data = {kind: [] for kind in TABLES}
    for row in conn.execute('SELECT kind,payload FROM actuals ORDER BY row_key'):
        data[row['kind']].append(json.loads(row['payload']))
    setting = conn.execute("SELECT payload FROM settings WHERE key='training_bundle'").fetchone()
    if setting:
        data['training_bundle'] = json.loads(setting['payload'])
    return data


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def send(self, code, obj):
        raw = json.dumps(obj, ensure_ascii=False, allow_nan=False).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(raw)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        path = urlparse(self.path).path
        if path == '/api/state':
            with connect() as conn:
                data = dataset(conn, 'demo=1' in self.path)
                data['runs'] = [dict(r) for r in conn.execute('SELECT * FROM runs ORDER BY loaded_at DESC')]
                mode = 'demo' if 'demo=1' in self.path else 'live'
                data['scenarios'] = [{**dict(r), 'payload': json.loads(r['payload']), 'result': json.loads(r['result'])} for r in conn.execute('SELECT * FROM scenarios WHERE mode=? ORDER BY created_at DESC', (mode,))]
            self.send(200, data)
            return
        files = {'/': 'index.html', '/index.html': 'index.html', '/app.js': 'app.js', '/styles.css': 'styles.css', '/forecast-reports.js': 'forecast-reports.js', '/planning-v2.js': 'planning-v2.js', '/extraction-contract.json': 'extraction-contract.json'}
        if path not in files:
            self.send(404, {'error': 'یافت نشد.'})
            return
        file = ROOT / files[path]
        raw = file.read_bytes()
        self.send_response(200)
        self.send_header('Content-Type', (mimetypes.guess_type(file.name)[0] or 'text/plain') + '; charset=utf-8')
        self.send_header('Content-Length', str(len(raw)))
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.end_headers()
        self.wfile.write(raw)

    def do_POST(self):
        try:
            origin = self.headers.get('Origin')
            if origin and urlparse(origin).netloc != self.headers.get('Host'):
                self.send(403, {'error': 'مبدأ درخواست معتبر نیست.'})
                return
            size = int(self.headers.get('Content-Length', '0'))
            if not 0 < size <= 12_000_000:
                self.send(413, {'error': 'حجم فایل باید کمتر از ۱۲ مگابایت باشد.'})
                return
            data = json.loads(self.rfile.read(size))
            if not isinstance(data, dict):
                raise ValueError('ساختار درخواست معتبر نیست.')
            path = urlparse(self.path).path
            with connect() as conn:
                if path in ['/api/import/bundle/validate', '/api/import/bundle']:
                    result = prepare_bundle(data, dataset(conn))
                    summary = {**result, 'files': [{k: v for k, v in file.items() if k != 'rows'} for file in result['files']]}
                    if path.endswith('validate'):
                        self.send(200, summary)
                        return
                    if result['warnings'] and data.get('confirmed_warnings') is not True:
                        raise ValueError('هشدارهای کیفیت را پیش از شروع پلنینگ تأیید کنید.')
                    now = dt.datetime.now(dt.timezone.utc).isoformat()
                    for file in result['files']:
                        run = uuid.uuid4().hex[:12]
                        conn.execute('INSERT INTO runs VALUES(?,?,?,?,?,?)', (run, now, file['kind'], file['count'], json.dumps(result['warnings'], ensure_ascii=False), file['source']))
                        for r in file['rows']:
                            row_key = r.pop('_key')
                            r.update(source_run_id=run, loaded_at=now)
                            conn.execute('INSERT INTO actuals VALUES(?,?,?,?)', (file['kind'], row_key, run, json.dumps(r, ensure_ascii=False)))
                    setting = dict(target=result['target'], calendar=result['calendar'], warnings=result['warnings'], rejected=result['rejected'], loaded_at=now)
                    conn.execute("INSERT INTO settings VALUES('training_bundle',?) ON CONFLICT(key) DO UPDATE SET payload=excluded.payload", (json.dumps(setting, ensure_ascii=False),))
                    conn.commit()
                    self.send(200, summary)
                elif path in ['/api/import/validate', '/api/import']:
                    kind = data.get('kind')
                    rows, warnings = validate(kind, data.get('rows'), data.get('period'))
                    existing = {r['row_key'] for r in conn.execute('SELECT row_key FROM actuals WHERE kind=?', (kind,))}
                    if any(r['_key'] in existing for r in rows):
                        raise ValueError('بخشی از این داده قبلاً ثبت شده است. دادهٔ واقعی بازنویسی نمی‌شود.')
                    stored = dataset(conn)
                    performance = stored['performance']
                    if kind in ('performance', 'organic'):
                        perf_rows = rows if kind == 'performance' else performance
                        organic_rows = rows if kind == 'organic' else stored['organic']
                        for organic in organic_rows:
                            match = next((r for r in perf_rows if all(r[k] == organic[k] for k in ('persian_year_month', 'vertical', 'payment_method'))), None)
                            if match:
                                if organic['organic_orders'] + organic['non_organic_orders'] != match['orders'] or abs(organic['organic_gmv_toman'] + organic['non_organic_gmv_toman'] - match['gross_gmv_toman']) > 1:
                                    raise ValueError('خروجی ارگانیک با سفارش یا GMV عملکرد ماهانه تطابق ندارد.')
                    if kind == 'performance':
                        for r in rows:
                            from planning import shift
                            previous = next((p for p in performance if p['vertical'] == r['vertical'] and p['payment_method'] == r['payment_method'] and p['persian_year_month'] == shift(r['persian_year_month'], -1)), None)
                            if previous and previous['orders'] and abs(r['orders'] / previous['orders'] - 1) > .5:
                                warnings.append(f"تغییر سفارش بیش از ۵۰٪: {r['vertical']} / {r['payment_method']}")
                    if path.endswith('validate'):
                        self.send(200, {'count': len(rows), 'warnings': warnings, 'periods': sorted({r['persian_year_month'] for r in rows})})
                        return
                    if warnings and data.get('confirmed_warnings') is not True:
                        raise ValueError('هشدارهای کیفیت را پیش از انتشار تأیید کنید.')
                    run = uuid.uuid4().hex[:12]
                    now = dt.datetime.now(dt.timezone.utc).isoformat()
                    conn.execute('INSERT INTO runs VALUES(?,?,?,?,?,?)', (run, now, kind, len(rows), json.dumps(warnings, ensure_ascii=False), str(data.get('source', 'file'))[:200]))
                    for r in rows:
                        key = r.pop('_key')
                        r['source_run_id'] = run
                        r['loaded_at'] = now
                        conn.execute('INSERT INTO actuals VALUES(?,?,?,?)', (kind, key, run, json.dumps(r, ensure_ascii=False)))
                    conn.commit()
                    self.send(200, {'run_id': run, 'count': len(rows), 'warnings': warnings})
                elif path in ['/api/forecast', '/api/scenarios']:
                    ds = dataset(conn, data.get('demo') is True)
                    a = assumptions(data.get('assumptions', {}))
                    result = forecast(ds['performance'], ds['cohort'], data.get('target', ''), a, ds.get('training_bundle'))
                    if path == '/api/scenarios':
                        name = str(data.get('name', '')).strip()[:120]
                        if not name:
                            raise ValueError('نام سناریو را وارد کنید.')
                        identifier = uuid.uuid4().hex[:12]
                        now = dt.datetime.now(dt.timezone.utc).isoformat()
                        conn.execute('INSERT INTO scenarios VALUES(?,?,?,?,?,?,?,?,?)', (identifier, name, period(data['target']), 'draft', now, None, json.dumps(a), json.dumps(result), 'demo' if data.get('demo') is True else 'live'))
                        conn.commit()
                        self.send(200, {'id': identifier, 'result': result})
                    else:
                        self.send(200, result)
                elif path == '/api/scenarios/approve':
                    row = conn.execute('SELECT * FROM scenarios WHERE id=?', (str(data.get('id', '')),)).fetchone()
                    if not row or row['status'] != 'draft':
                        raise ValueError('فقط نسخهٔ پیش‌نویس قابل قفل‌کردن است.')
                    if json.loads(row['result'])['over_budget']:
                        raise ValueError('هزینهٔ ووچر از بودجه بیشتر است؛ ابتدا نسخهٔ جدید با بودجه یا فرض اصلاح‌شده بسازید.')
                    conn.execute("UPDATE scenarios SET status='approved',approved_at=? WHERE id=?", (dt.datetime.now(dt.timezone.utc).isoformat(), row['id']))
                    conn.commit()
                    self.send(200, {'status': 'approved'})
                else:
                    self.send(404, {'error': 'مسیر موجود نیست.'})
        except (ValueError, TypeError, KeyError, json.JSONDecodeError) as exc:
            self.send(400, {'error': str(exc)})
        except sqlite3.IntegrityError:
            self.send(409, {'error': 'داده تکراری یا نسخه قفل‌شده است؛ تغییری ثبت نشد.'})
        except Exception:
            self.send(500, {'error': 'خطای داخلی در پردازش؛ تغییری ثبت نشد.'})


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=int(os.environ.get('PORT', '3000')))
    parser.add_argument('--host', default='0.0.0.0')
    args = parser.parse_args()
    with connect():
        pass
    ThreadingHTTPServer((args.host, args.port), Handler).serve_forever()
