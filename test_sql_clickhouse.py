import json
import subprocess
import tempfile
import unittest
from pathlib import Path

try:
    from chdb.session import Session
except ImportError:
    Session = None

ROOT = Path(__file__).resolve().parent


@unittest.skipIf(Session is None, 'Optional embedded ClickHouse engine is not installed')
class ClickHouseQueryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix='sql-test-', dir=ROOT)
        cls.db = Session(cls.temp.name)
        cls.db.query('SET max_threads=1, max_memory_usage=268435456, max_execution_time=30')
        cls.db.query('CREATE DATABASE fms_credit')
        cls.db.query('CREATE DATABASE minio_db')
        cls.db.query('''CREATE TABLE fms_credit.tbl_order (
            id UInt64, wallet_id UInt64, registered_at DateTime,
            registered_date Date, venture_id UInt64, status String,
            merchant_type String, payment_method_type String,
            amount Int64, voucher_discount_amount Nullable(Int64)
        ) ENGINE=Memory''')
        cls.db.query('''CREATE TABLE minio_db.commercial_data (
            venture_id String, vertical String, category String
        ) ENGINE=Memory''')
        cls.db.query("""INSERT INTO minio_db.commercial_data VALUES
            ('1','Fashion','fashion'),('1','Fashion','fashion'),
            ('2','Digital','digital'),('3','H&B','beauty'),
            ('4','Snapp-Venture','ventures')""")
        cls.fixture = [
            (1, 10, '2021-12-10 09:00:00', '2021-12-10', 1, 'SETTLE', 'ONLINE', 'INSTALLMENT', 10000, 0),
            (2, 10, '2026-09-01 09:00:00', '2026-09-01', 1, 'SETTLE', 'ONLINE', 'POSTPAID', 20000, 1000),
            (3, 11, '2026-09-02 09:00:00', '2026-09-02', 2, 'SETTLE', 'ONLINE', 'FINANCING', 30000, 2000),
            (4, 11, '2026-10-02 09:00:00', '2026-10-02', 1, 'SETTLE', 'ONLINE', 'PAY_NOW', 40000, 0),
            (5, 12, '2026-10-05 09:00:00', '2026-10-05', 3, 'SETTLE', 'IN_STORE', 'INSTALLMENT', 50000, 3000),
            (6, 13, '2026-10-06 09:00:00', '2026-10-06', 1, 'SETTLE', 'SOCIAL', 'WALLET', 60000, None),
            (7, 10, '2026-10-10 09:00:00', '2026-10-10', 2, 'SETTLE', 'IN_STORE_QR', 'PAY_PRO', 70000, 0),
            (8, 10, '2026-11-01 00:00:00', '2026-11-01', 1, 'SETTLE', 'ONLINE', 'INSTALLMENT', 900000, 10000),
            (9, 14, '2026-10-10 09:00:00', '2026-10-10', 4, 'SETTLE', 'ONLINE', 'INSTALLMENT', 80000, 0),
            (10, 15, '2026-10-12 09:00:00', '2026-10-12', 1, 'CANCEL', 'ONLINE', 'INSTALLMENT', 1000000, 0),
        ]
        cls.insert(cls.fixture)
        cls.queries = json.loads((ROOT / 'extraction-contract.json').read_text())['queries']

    @classmethod
    def tearDownClass(cls):
        cls.db.close()
        cls.temp.cleanup()

    @classmethod
    def insert(cls, rows):
        def sql(value):
            if value is None:
                return 'NULL'
            return "'" + value.replace("'", "''") + "'" if isinstance(value, str) else str(value)
        values = ','.join('(' + ','.join(sql(value) for value in row) + ')' for row in rows)
        cls.db.query('INSERT INTO fms_credit.tbl_order VALUES ' + values)

    @classmethod
    def execute(cls, name):
        return json.loads(str(cls.db.query(cls.queries[name], 'JSON')))['data']

    def test_all_eight_queries_execute_and_reconcile(self):
        result = {name: self.execute(name) for name in self.queries}
        self.assertEqual(len(result), 8)
        sizes = result['01_cohort_sizes.csv']
        activity = result['02_cohort_activity.csv']
        mix = result['03_cohort_mix.csv']
        controls = result['04_monthly_control.csv']
        voucher = result['05_voucher_monthly.csv']
        self.assertTrue(all(result.values()))
        self.assertEqual(sum(int(r['orders']) for r in activity), 6)
        self.assertEqual(sum(int(r['orders']) for r in mix), 6)
        self.assertEqual(sum(int(r['orders']) for r in controls), 6)
        self.assertEqual(sum(float(r['gross_gmv_toman']) for r in activity), 27000)
        self.assertEqual(sum(int(r['voucher_orders']) for r in voucher), 3)
        self.assertEqual({r['sector'] for r in controls}, {'Commercial', 'InStore', 'Social'})
        self.assertTrue(any(r['cohort_month'] == 'PRE_HISTORY' for r in sizes))
        self.assertTrue(any(r['order_voucher_status'] == 'Unknown' for r in mix))
        self.assertTrue(all(r['activity_month'] < '2026-11' for r in activity))
        self.assertTrue(all(r['cohort_age'] is None or r['cohort_age'] >= 0 for r in activity))
        self.assertEqual(sum(int(r['cohort_size']) for r in sizes), 5)
        for name in ['02_cohort_activity.csv', '03_cohort_mix.csv', '04_monthly_control.csv']:
            self.assertEqual(sum(float(r['gross_gmv_toman']) for r in result[name]), 27000)
        calendar = result['06_business_calendar.csv']
        self.assertEqual(calendar[-1]['month'], '2027-12')
        self.assertEqual(next(r for r in calendar if r['month'] == '2024-02')['calendar_days'], 29)
        self.assertEqual(next(r for r in calendar if r['month'] == '2026-11')['is_complete_at_cutoff'], 0)
        quality = {r['metric']: int(r['value']) for r in result['08_data_quality.csv']}
        self.assertEqual(quality['duplicate_order_id_excess_rows'], 0)
        self.assertEqual(quality['conflicting_venture_mappings'], 0)
        self.assertEqual(quality['rows_without_unique_mapping'], 0)

    def test_query_exports_are_accepted_by_the_app(self):
        kinds = ['sizes', 'activity', 'mix', 'control', 'voucher', 'calendar', 'coverage', 'quality']
        payload = {'json': {kind: self.execute(name) for kind, name in zip(kinds, self.queries)}, 'csv': {kind: str(self.db.query(sql, 'CSVWithNames')) for kind, sql in zip(kinds, self.queries.values())}}
        script = '''const fs=require('fs'),vm=require('vm');
const ctx=vm.createContext({Intl,Date,localStorage:{getItem:()=>null}});
for(const f of ['input-contract.js','scenarios.js','planning-v2.js'])vm.runInContext(fs.readFileSync(f,'utf8'),ctx);
const payload=JSON.parse(fs.readFileSync(0,'utf8'));
for(const rows of [payload.json,Object.fromEntries(Object.entries(payload.csv).map(([k,text])=>[k,ctx.AggregatePlanning.parse(text)]))]){
 const imported=ctx.AggregatePlanning.validate(rows,{cutoff:'2026-11-01',confirmed:true});
 if(imported.activity.length!==rows.activity.length)throw Error('Import row mismatch');
}
console.log('All eight actual ClickHouse JSON/CSV exports were accepted by the app.');'''
        subprocess.run(['node', '-e', script], input=json.dumps(payload), text=True, cwd=ROOT, check=True, capture_output=True)

    def test_alias_and_nullable_join_settings(self):
        try:
            for prefer in (0, 1):
                for nullable in (0, 1):
                    self.db.query(f'SET prefer_column_name_to_alias={prefer}, join_use_nulls={nullable}')
                    for name in self.queries:
                        with self.subTest(query=name, prefer_column_name_to_alias=prefer, join_use_nulls=nullable):
                            rows = self.execute(name)
                            self.assertTrue(rows)
                            self.assertTrue(all('.' not in key for key in rows[0]))
                            self.assertFalse({'wallet_id', 'order_id', 'venture_id'} & set(rows[0]))
        finally:
            self.db.query('SET prefer_column_name_to_alias=0, join_use_nulls=0')

    def test_decimal_amount_columns(self):
        self.db.query('''CREATE TABLE fms_credit.tbl_order_decimal ENGINE=Memory AS
            SELECT id, wallet_id, registered_at, registered_date, venture_id,
                   status, merchant_type, payment_method_type,
                   toDecimal64(amount, 2) AS amount,
                   CAST(voucher_discount_amount AS Nullable(Decimal64(2))) AS voucher_discount_amount
            FROM fms_credit.tbl_order''')
        for name, sql in self.queries.items():
            with self.subTest(query=name):
                result = json.loads(str(self.db.query(sql.replace('fms_credit.tbl_order', 'fms_credit.tbl_order_decimal'), 'JSON')))['data']
                self.assertTrue(result)
                if name == '04_monthly_control.csv':
                    self.assertEqual(sum(float(r['gross_gmv_toman']) for r in result), 27000)

    def test_original_alias_failure_is_reproduced(self):
        with self.assertRaisesRegex(Exception, r'Code: 184'):
            self.db.query('''SELECT toUInt64(venture_id) AS venture_id,
                min(upper(trimBoth(toString(vertical)))) AS vertical,
                min(toString(category)) AS category
                FROM minio_db.commercial_data GROUP BY toUInt64(venture_id)
                HAVING uniqExact(tuple(upper(trimBoth(toString(vertical))), toString(category))) = 1''')

    def test_mapping_conflict_is_reported_without_inflation(self):
        try:
            self.db.query("INSERT INTO minio_db.commercial_data VALUES ('1','Gold','gold')")
            quality = {r['metric']: int(r['value']) for r in self.execute('08_data_quality.csv')}
            self.assertEqual(quality['conflicting_venture_mappings'], 1)
            self.assertGreater(quality['rows_without_unique_mapping'], 0)
            counts = self.execute('04_monthly_control.csv')
            self.assertEqual(sum(int(r['orders']) for r in counts), 3)
        finally:
            self.db.query('TRUNCATE TABLE minio_db.commercial_data')
            self.db.query("INSERT INTO minio_db.commercial_data VALUES ('1','Fashion','fashion'),('1','Fashion','fashion'),('2','Digital','digital'),('3','H&B','beauty'),('4','Snapp-Venture','ventures')")

    def test_empty_orders_still_produce_valid_calendar_and_quality(self):
        try:
            self.db.query('TRUNCATE TABLE fms_credit.tbl_order')
            for name in self.queries:
                result = self.execute(name)
                self.assertTrue(result if name in ['06_business_calendar.csv', '08_data_quality.csv'] else not result)
        finally:
            self.insert(self.fixture)


if __name__ == '__main__':
    unittest.main()
