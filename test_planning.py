import json
from pathlib import Path
import sqlite3
import tempfile
import threading
import unittest
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from http.server import ThreadingHTTPServer

import planning as p
import server


class PlanningTests(unittest.TestCase):
    def setUp(self):
        self.demo = p.demo_data()
        self.row = dict(self.demo['performance'][-1])

    def test_persian_period_and_year_rollover(self):
        self.assertEqual(p.period('۱۴۰۵/۰۷'), '1405-07')
        self.assertEqual(p.shift('1405-12', 1), '1406-01')
        self.assertEqual(p.shift('1405-01', -1), '1404-12')
        self.assertEqual(p.period('2026-11'), '2026-11')
        self.assertEqual(p.shift('2026-12', 1), '2027-01')
        for bad in ['1405-13', '1800-11', '1405-00', 'nonsense']:
            with self.assertRaises(ValueError):
                p.period(bad)

    def test_demo_contracts(self):
        for kind, rows in self.demo.items():
            normalized, warnings = p.validate(kind, rows)
            self.assertEqual(len(normalized), len(rows))
            self.assertFalse(warnings)

    def test_duplicate_and_order_components(self):
        with self.assertRaisesRegex(ValueError, 'تکراری'):
            p.validate('performance', [self.row, self.row])
        self.row['orders'] += 1
        with self.assertRaisesRegex(ValueError, 'جمع سفارش'):
            p.validate('performance', [self.row])

    def test_aov_and_counts(self):
        self.row['aov_toman'] *= 2
        with self.assertRaisesRegex(ValueError, 'AOV'):
            p.validate('performance', [self.row])
        self.row['active_users'] = 1.1
        with self.assertRaises(ValueError):
            p.validate('performance', [self.row])

    def test_nonfinite_negative_missing(self):
        for v in [-1, float('inf'), float('nan'), 'invalid']:
            row = {**self.row, 'gross_gmv_toman': v}
            with self.assertRaises(ValueError):
                p.validate('performance', [row])
        del self.row['orders']
        with self.assertRaises(ValueError):
            p.validate('performance', [self.row])

    def test_explicit_calendar_mapping(self):
        row = {**self.row, 'M.month': '2026-10-01'}
        del row['persian_year_month']
        normalized, _ = p.validate('performance', [row], '1405-07')
        self.assertEqual(normalized[0]['persian_year_month'], '2026-10')
        self.assertEqual(normalized[0]['calendar_basis'], 'gregorian')
        normalized, _ = p.validate('performance', [row, {**row, 'M.month': '2026-09-01'}])
        self.assertEqual(len(normalized), 2)
        with self.assertRaises(ValueError):
            p.validate('performance', [{**row, 'M.month': '2026-09-15'}])

    def test_cohort_age(self):
        row = {**self.demo['cohort'][-1], 'cohort_age': 99}
        with self.assertRaises(ValueError):
            p.validate('cohort', [row])

    def test_forecast_identities_and_budget(self):
        result = p.forecast(self.demo['performance'], [], '1405-08', {'budget': 0})
        self.assertTrue(result['over_budget'])
        self.assertEqual(len(result['rows']), 10)
        for r in result['rows']:
            self.assertEqual(r['gross_gmv_toman'], r['orders'] * r['aov_toman'])
            self.assertEqual(r['orders'], r['voucher_orders'] + r['non_voucher_orders'])
            self.assertEqual(r['method'], 'aggregate')
            self.assertTrue(r['baseline_months'] < ['1405-08'])
        self.assertEqual(result['voucher_cost'], sum(r['total_voucher_toman'] for r in result['rows']))

    def test_future_leakage(self):
        base = p.forecast(self.demo['performance'], self.demo['cohort'], '1405-07', {})
        future = {**self.row, 'persian_year_month': '1405-08', 'orders': 999999999}
        target = {**self.row, 'persian_year_month': '1405-07', 'orders': 999999999}
        result = p.forecast(self.demo['performance'] + [future, target], self.demo['cohort'], '1405-07', {})
        self.assertEqual(base, result)

    def test_baselines_do_not_silently_fallback(self):
        with self.assertRaisesRegex(ValueError, 'کامل نیست'):
            p.forecast([r for r in self.demo['performance'] if r['persian_year_month'] != '1404-08'], [], '1405-08', {'baseline': 'year'})
        with self.assertRaisesRegex(ValueError, 'کامل نیست'):
            p.forecast(self.demo['performance'], [], '1405-10', {})
        p.forecast(self.demo['performance'], [], '1405-08', {'baseline': 'average'})

    def test_two_month_trend_and_clipping(self):
        a = {**self.row, 'persian_year_month': '1405-06', 'new_users': 100}
        b = {**self.row, 'persian_year_month': '1405-07', 'new_users': 200}
        result = p.forecast([a, b], [], '1405-08', {})
        self.assertAlmostEqual(result['rows'][0]['trend_pct'], 30)
        self.assertEqual(result['rows'][0]['new_users'], 260)

    def test_campaign_requires_evidence_and_invalid_assumptions(self):
        with self.assertRaises(ValueError):
            p.assumptions({'campaign': 2})
        for data in [{'retention': 101}, {'budget': -1}, {'new_growth': float('nan')}]:
            with self.assertRaises(ValueError):
                p.assumptions(data)

    def test_cohort_method_when_target_ages_available(self):
        perf = [{**self.row, 'persian_year_month': '1405-07'}]
        common = {'vertical': self.row['vertical'], 'payment_method': self.row['payment_method']}
        cohorts = [
            {**common, 'persian_year_month': '1405-07', 'cohort_persian_month': '1405-07', 'cohort_age': 0, 'active_users': 100},
            {**common, 'persian_year_month': '1405-06', 'cohort_persian_month': '1405-06', 'cohort_age': 0, 'active_users': 100},
            {**common, 'persian_year_month': '1405-07', 'cohort_persian_month': '1405-06', 'cohort_age': 1, 'active_users': 50},
        ]
        result = p.forecast(perf, cohorts, '1405-08', {'retention': 100})
        self.assertEqual(result['rows'][0]['method'], 'cohort')
        self.assertEqual(result['rows'][0]['active_users'] - result['rows'][0]['new_users'], 100)
        self.assertTrue(result['rows'][0]['retention_interpolated_or_extended'])

    def test_division_by_zero_is_not_fake_zero(self):
        self.assertIsNone(p.ratio(0, 0))


class APITests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(dir=server.ROOT)
        cls.old_db = server.DB
        server.DB = Path(cls.temp.name) / 'test.sqlite3'
        cls.http = ThreadingHTTPServer(('127.0.0.1', 0), server.Handler)
        cls.worker = threading.Thread(target=cls.http.serve_forever, daemon=True)
        cls.worker.start()
        cls.base = f'http://127.0.0.1:{cls.http.server_port}'

    @classmethod
    def tearDownClass(cls):
        cls.http.shutdown()
        cls.http.server_close()
        cls.worker.join()
        server.DB = cls.old_db
        cls.temp.cleanup()

    def call(self, path, payload=None):
        req = Request(self.base + path, data=json.dumps(payload).encode() if payload else None, headers={'Content-Type': 'application/json'})
        try:
            with urlopen(req) as response:
                return response.status, json.loads(response.read())
        except HTTPError as error:
            return error.code, json.loads(error.read())

    def test_01_static_and_demo_state(self):
        for path in ['/', '/app.js', '/styles.css', '/forecast-reports.js', '/planning-v2.js', '/backtest.js', '/extraction-contract.json']:
            with urlopen(self.base + path) as response:
                self.assertEqual(response.status, 200)
                self.assertGreater(len(response.read()), 100)
        status, data = self.call('/api/state?demo=1')
        self.assertEqual(status, 200)
        self.assertEqual(len(data['performance']), 120)
        _, live = self.call('/api/state')
        self.assertEqual(live['performance'], [])

    def test_02_import_atomic_immutable_and_persistent(self):
        row = p.demo_data()['performance'][-1]
        payload = {'kind': 'performance', 'rows': [row], 'source': 'monthly.csv'}
        status, check = self.call('/api/import/validate', payload)
        self.assertEqual(status, 200)
        self.assertEqual(check['count'], 1)
        _, before = self.call('/api/state')
        self.assertEqual(before['performance'], [])
        status, result = self.call('/api/import', payload)
        self.assertEqual(status, 200)
        status, duplicate = self.call('/api/import', payload)
        self.assertEqual(status, 400)
        _, after = self.call('/api/state')
        self.assertEqual(len(after['performance']), 1)
        self.assertEqual(after['performance'][0]['source_run_id'], result['run_id'])
        with server.connect() as conn:
            with self.assertRaises(sqlite3.IntegrityError):
                conn.execute("UPDATE actuals SET payload='{}'")
            with self.assertRaises(sqlite3.IntegrityError):
                conn.execute('DELETE FROM actuals')
        invalid = {**row, 'vertical': 'BAD', 'orders': -1}
        status, _ = self.call('/api/import', {'kind': 'performance', 'rows': [{**row, 'vertical': 'GOOD'}, invalid]})
        self.assertEqual(status, 400)
        _, state = self.call('/api/state')
        self.assertEqual(len(state['performance']), 1)

    def test_03_scenario_snapshot_and_approval(self):
        payload = {'demo': True, 'name': 'Test baseline', 'target': '1405-08', 'assumptions': {'budget': 1e12}}
        status, result = self.call('/api/scenarios', payload)
        self.assertEqual(status, 200)
        identifier = result['id']
        status, _ = self.call('/api/scenarios/approve', {'id': identifier})
        self.assertEqual(status, 200)
        _, state = self.call('/api/state?demo=1')
        row = next(s for s in state['scenarios'] if s['id'] == identifier)
        self.assertEqual(row['status'], 'approved')
        self.assertEqual(row['result'], result['result'])
        _, live = self.call('/api/state')
        self.assertFalse(any(s['id'] == identifier for s in live['scenarios']))
        with server.connect() as conn:
            with self.assertRaises(sqlite3.IntegrityError):
                conn.execute("UPDATE scenarios SET name='changed' WHERE id=?", (identifier,))
        status, _ = self.call('/api/scenarios/approve', {'id': identifier})
        self.assertEqual(status, 400)

    def test_04_overbudget_and_unsafe_paths(self):
        _, result = self.call('/api/scenarios', {'demo': True, 'name': 'Over budget', 'target': '1405-08', 'assumptions': {'budget': 0}})
        status, _ = self.call('/api/scenarios/approve', {'id': result['id']})
        self.assertEqual(status, 400)
        for path in ['/server.py', '/data/planning.sqlite3', '/uploads/test', '/../../etc/passwd']:
            status, _ = self.call(path)
            self.assertEqual(status, 404)
        req = Request(self.base + '/api/forecast', data=b'{}', headers={'Origin': 'https://untrusted.example'})
        with self.assertRaises(HTTPError) as error:
            urlopen(req)
        self.assertEqual(error.exception.code, 403)


if __name__ == '__main__':
    unittest.main()
