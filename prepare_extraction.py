import json
import re
from pathlib import Path

root = Path(__file__).resolve().parent
source = root / 'uploads' / 'bnpl_forecasting_methodology.md'
blocks = re.findall(r'```sql\n(.*?)```', source.read_text(), re.S)
common = blocks[0]
common = common.replace("toDate('2022-03-21')", "toDate('2022-01-01')").replace("toDate('2026-11-22') AS data_cutoff_exclusive", "toDate('2026-11-01') AS data_cutoff_exclusive").replace("toDate('2026-11-22') AS forecast_month_start", "toDate('2027-12-01') AS forecast_month_start").replace("toDate('2026-12-22') AS forecast_month_end_exclusive", "toDate('2028-01-01') AS forecast_month_end_exclusive")
a = common.index('year_anchors AS')
b = common.index('commercial_map AS')
common = common[:a] + '''calendar AS
(
    SELECT
        formatDateTime(addMonths(P.history_start, n), '%Y-%m') AS month_id,
        toInt32(toYear(addMonths(P.history_start,n))*12 + toMonth(addMonths(P.history_start,n))-1) AS month_index,
        addMonths(P.history_start,n) AS month_start,
        addMonths(P.history_start,n+1) AS month_end_exclusive
    FROM params AS P
    ARRAY JOIN range(toUInt32(dateDiff('month',P.history_start,P.forecast_month_end_exclusive))) AS n
),
month_lookup AS
(
    SELECT arraySort(x -> x.2, groupArray(tuple(month_id,month_start,month_end_exclusive,month_index))) AS periods
    FROM calendar
),
''' + common[b:]
a = common.index('commercial_map AS')
b = common.index('all_settled AS')
common = common[:a] + '''commercial_map_variants AS
(
    SELECT DISTINCT
        toUInt64(CD.venture_id) AS mapped_venture_id,
        upper(trimBoth(toString(CD.vertical))) AS mapped_vertical,
        toString(CD.category) AS mapped_category
    FROM minio_db.commercial_data AS CD
),
commercial_map AS
(
    SELECT
        mapped_venture_id AS venture_id,
        min(mapped_vertical) AS vertical,
        min(mapped_category) AS category,
        1 AS mapping_found
    FROM commercial_map_variants
    GROUP BY mapped_venture_id
    HAVING count() = 1
),
''' + common[b:]
common = common.replace('D.vertical AS vertical,', "D.vertical AS vertical,\n        multiIf(S.merchant_type = 'ONLINE','Commercial',S.merchant_type IN ('IN_STORE','IN_STORE_QR'),'InStore','Social') AS sector,")
common = common.replace("WHERE S.merchant_type = 'ONLINE'\n      AND D.vertical != 'SNAPP-VENTURE'\n      AND D.category NOT IN ('in_store', 'social', 'ventures')", "WHERE S.merchant_type IN ('ONLINE','IN_STORE','IN_STORE_QR','SOCIAL')\n      AND (S.merchant_type != 'ONLINE' OR (D.vertical != 'SNAPP-VENTURE' AND D.category NOT IN ('in_store','social','ventures')))")
common = common.replace('        wallet_id,\n        argMin(order_date', '        wallet_id,\n        sector,\n        argMin(order_date')
common = common.replace('FROM commercial_orders\n    GROUP BY wallet_id', 'FROM commercial_orders\n    GROUP BY wallet_id, sector')
common = common.replace('        wallet_id,\n        first_commercial_date,', '        wallet_id,\n        sector,\n        first_commercial_date,')
common = common.replace('        O.vertical,\n        O.payment_method,', '        O.vertical,\n        O.sector,\n        O.payment_method,')
common = common.replace('ON O.wallet_id = C.wallet_id', 'ON O.wallet_id = C.wallet_id AND O.sector = C.sector')
common = common.replace('PRE_1401', 'PRE_HISTORY')
settled_fields = ['order_id', 'wallet_id', 'order_at', 'order_date', 'venture_id', 'merchant_type', 'payment_method_raw', 'amount_raw', 'voucher_discount_raw', 'voucher_is_null']
commercial_fields = settled_fields + ['vertical', 'sector', 'payment_method', 'order_voucher_status']
member_fields = ['wallet_id', 'sector', 'first_commercial_date', 'first_commercial_order_id', 'first_commercial_voucher']
for prefix, fields in [('S', settled_fields), ('F', member_fields), ('O', commercial_fields)]:
    common = common.replace(f'        {prefix}.*,', ',\n'.join(f'        {prefix}.{field} AS {field}' for field in fields) + ',')
for prefix, fields in [('O', ['order_id', 'wallet_id', 'vertical', 'sector', 'payment_method', 'order_voucher_status', 'amount_raw', 'voucher_discount_raw', 'voucher_is_null']), ('C', ['cohort_month', 'cohort_month_index', 'user_type', 'first_commercial_order_id', 'first_commercial_voucher'])]:
    for field in fields:
        common = common.replace(f'        {prefix}.{field},', f'        {prefix}.{field} AS {field},')
queries = {}
names = ['01_cohort_sizes','02_cohort_activity','03_cohort_mix','04_monthly_control','05_voucher_monthly','06_business_calendar','07_payment_coverage','08_data_quality']
for i, (name, select) in enumerate(zip(names, blocks[1:])):
    select = select.replace('PRE_1401','PRE_HISTORY')
    if i == 0:
        select = select.replace('SELECT\n    cohort_month', 'SELECT\n    sector,\n    cohort_month').replace('GROUP BY cohort_month,', 'GROUP BY sector, cohort_month,')
    elif i in [1,2,3,4]:
        select = select.replace('SELECT\n    A.activity_month,', 'SELECT\n    A.sector,\n    A.activity_month,').replace('GROUP BY\n    A.activity_month', 'GROUP BY\n    A.sector, A.activity_month').replace('GROUP BY A.activity_month', 'GROUP BY A.sector, A.activity_month')
    elif i == 6:
        select = select.replace('SELECT\n    O.payment_method,', 'SELECT\n    O.sector,\n    O.payment_method,').replace('GROUP BY O.payment_method', 'GROUP BY O.sector, O.payment_method')
    elif i == 7:
        select = select.replace("'online_settled'", "'eligible_settled'").replace("WHERE S.merchant_type = 'ONLINE'", "WHERE S.merchant_type IN ('ONLINE','IN_STORE','IN_STORE_QR','SOCIAL')")
        select = select.replace('ORDER BY scope, metric;', "UNION ALL\nSELECT 'all_settled', 'null_order_id_rows', toUInt64(countIf(isNull(order_id))) FROM all_settled")
        select = 'SELECT Q.scope AS scope, Q.metric AS metric, Q.value AS value\nFROM\n(\n' + select.rstrip().rstrip(';') + '\n) AS Q\nORDER BY Q.scope, Q.metric;'
    queries[name+'.csv'] = common + '\n' + select
contract = {
    'version': 2, 'sql_revision': 2,
    'sql_fixes': [
        'Normalize and deduplicate mapping variants before aggregation; prevent aggregate aliases from expanding inside HAVING.',
        'Use explicit aliases instead of joined CTE star projections to keep stable wallet and cohort column names.',
        'Sort the outer UNION ALL result for data-quality controls, not the final UNION branch.',
    ],
    'calendar': 'Gregorian only; YYYY-MM and first-of-month YYYY-MM-01',
    'scope': 'Commercial=ONLINE; InStore=IN_STORE/IN_STORE_QR; Social=SOCIAL. Cohort is first eligible successful order within each sector, not first vertical/payment entry. Cross-sector unique users cannot be summed.',
    'user_type': 'Voucher on first global SETTLE order across sectors, fixed forever; Unknown is retained.',
    'instructions': [
        'Run each full SQL separately on the authorized internal ClickHouse analytical environment. These queries have not been executed on your database.',
        'Set history_start to the first Gregorian training month, data_cutoff_exclusive to the day after the last fully closed month (first of next month). Keep full earlier order history for first-order and PRE_HISTORY identification.',
        'Default cutoff 2026-11-01 is an example, not a claim November is closed. Calendar runs through 2027-12.',
        'Confirm SETTLE semantics, registered_date timezone, deleted-order policy, stable wallet identity, mapping validity and money_divisor=10 (rial to toman once).',
        'Pass uniqueness, missing mapping and invalid amounts checks before exporting. No identifiers, individual orders or user panels may leave the organization.',
        'If small cells are suppressed, do not substitute zero or reconstruct by subtraction. This exact-reconciliation implementation requires an approved coarser aggregate contract before accepting suppressed files.',
        'Complete calendar events and active days only when known at cutoff; blanks are unknown. Calendar metadata is collected; the baseline does not claim calibrated event effects.',
        'Complete available_in_forecast_month with 0/1 where confirmed; blank means unknown, not inactive. Optionally add forecast_month YYYY-MM per payment/sector for month-specific availability. First observation is not launch date.',
        'Sector-specific cohorts mean a person may occur in multiple sectors. Sector totals must not be described as cross-sector unique people.',
        'Only aggregated CSV/JSON is accepted. Upload all 8 files together; publish is atomic and strict reconciliation is required. Legacy four files cannot satisfy fixed cohort size / joint mix requirements.',
    ],
    'queries': queries,
}
(root / 'extraction-contract.json').write_text(json.dumps(contract, ensure_ascii=False, indent=2))
print('Prepared eight Gregorian ClickHouse queries and extraction contract.')
