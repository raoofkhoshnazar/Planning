import copy
import json
from pathlib import Path
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import planning
import server
from bundle_import import prepare_bundle


def fixture():
    demo = planning.demo_data()
    perf = dict(demo['performance'][-1])
    perf.pop('persian_year_month')
    perf['M.month'] = '2026-10-01'
    org = dict(demo['organic'][-1])
    org.pop('persian_year_month')
    org.update(month='2026-10-01', organic_orders=perf['orders'], non_organic_orders=0, organic_gmv_toman=perf['gross_gmv_toman'], non_organic_gmv_toman=0, organic_aov_toman=perf['aov_toman'], non_organic_aov_toman='')
    cohort = dict(demo['cohort'][-1])
    cohort.pop('persian_year_month')
    cohort.pop('cohort_persian_month')
    cohort.update(activity_month='2026-10-01', cohort_month='2025-11-01', cohort_age=11)
    voucher = dict(demo['voucher'][-1])
    voucher.pop('persian_year_month')
    voucher['month'] = '2026-10-01'
    return {'files': {kind: {'source': f'{kind}.csv', 'rows': [row]} for kind, row in [('performance', perf), ('cohort', cohort), ('organic', org), ('voucher', voucher)]}}


class BundleTests(unittest.TestCase):
    def setUp(self):
        self.empty = {k: [] for k in planning.TABLES}
        self.payload = fixture()

    def test_raw_four_files_and_nullable_aov(self):
        result = prepare_bundle(self.payload, self.empty)
        self.assertEqual(result['target'], '2026-11')
        self.assertEqual(result['calendar'], 'gregorian')
        org = next(f for f in result['files'] if f['kind'] == 'organic')['rows'][0]
        self.assertIsNone(org['non_organic_aov_toman'])
        self.assertEqual(self.payload['files']['organic']['rows'][0]['non_organic_aov_toman'], '')

    def test_missing_duplicate_and_future(self):
        missing = copy.deepcopy(self.payload)
        del missing['files']['organic']
        with self.assertRaises(ValueError):
            prepare_bundle(missing, self.empty)
        duplicate = copy.deepcopy(self.payload)
        duplicate['files']['performance']['rows'] *= 2
        with self.assertRaises(ValueError):
            prepare_bundle(duplicate, self.empty)
        future = copy.deepcopy(self.payload)
        future['files']['voucher']['rows'][0]['month'] = '2026-11-01'
        with self.assertRaisesRegex(ValueError, 'نشت'):
            prepare_bundle(future, self.empty)

    def test_quarantine_requires_reporting_and_does_not_mutate(self):
        bad = {**self.payload['files']['cohort']['rows'][0], 'cohort_age': -1, 'cohort_month': '2026-11-01'}
        self.payload['files']['cohort']['rows'].append(bad)
        result = prepare_bundle(self.payload, self.empty)
        self.assertEqual(len(result['rejected']), 1)
        self.assertEqual(result['rejected'][0]['row_number'], 3)
        self.assertEqual(result['rejected'][0]['data']['cohort_age'], -1)
        self.assertEqual(next(f for f in result['files'] if f['kind'] == 'cohort')['count'], 1)
        self.assertTrue(any('قرنطینه' in w for w in result['warnings']))

    def test_mixed_calendars_blocked(self):
        self.empty['performance'] = [planning.demo_data()['performance'][-1]]
        with self.assertRaises(ValueError):
            prepare_bundle(self.payload, self.empty)


class BundleAPITests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(dir=server.ROOT)
        cls.old_db = server.DB
        server.DB = Path(cls.temp.name) / 'bundle.sqlite3'
        cls.http = ThreadingHTTPServer(('127.0.0.1', 0), server.Handler)
        cls.thread = threading.Thread(target=cls.http.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = f'http://127.0.0.1:{cls.http.server_port}'

    @classmethod
    def tearDownClass(cls):
        cls.http.shutdown()
        cls.http.server_close()
        cls.thread.join()
        server.DB = cls.old_db
        cls.temp.cleanup()

    def call(self, path, payload=None):
        request = Request(self.base + path, data=json.dumps(payload).encode() if payload else None, headers={'Content-Type': 'application/json'})
        try:
            with urlopen(request) as response:
                return response.status, json.loads(response.read())
        except HTTPError as error:
            return error.code, json.loads(error.read())

    def test_atomic_bundle_import_and_forecast(self):
        payload = fixture()
        status, checked = self.call('/api/import/bundle/validate', payload)
        self.assertEqual(status, 200)
        self.assertEqual(checked['target'], '2026-11')
        _, state = self.call('/api/state')
        self.assertEqual(state['performance'], [])
        status, _ = self.call('/api/import/bundle', payload)
        self.assertEqual(status, 400)
        _, state = self.call('/api/state')
        self.assertTrue(all(not state[k] for k in planning.TABLES))
        status, imported = self.call('/api/import/bundle', {**payload, 'confirmed_warnings': True})
        self.assertEqual(status, 200)
        _, state = self.call('/api/state')
        self.assertEqual(len(state['runs']), 4)
        self.assertTrue(all(len(state[k]) == 1 for k in planning.TABLES))
        self.assertEqual(state['training_bundle']['calendar'], 'gregorian')
        status, result = self.call('/api/forecast', {'target': '2026-11', 'assumptions': {}})
        self.assertEqual(status, 200)
        self.assertEqual(len(result['rows']), 1)
        status, _ = self.call('/api/import/bundle', {**payload, 'confirmed_warnings': True})
        self.assertEqual(status, 400)
        _, state = self.call('/api/state')
        self.assertEqual(len(state['runs']), 4)
