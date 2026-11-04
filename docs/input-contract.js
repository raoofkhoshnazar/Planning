(() => {
 'use strict';
 const schema={
 sizes:'sector cohort_month cohort_month_index user_type cohort_size first_commercial_voucher_users',
 activity:'sector activity_month activity_month_index cohort_month cohort_month_index cohort_age user_type active_users orders gross_gmv_toman voucher_spend_toman',
 mix:'sector activity_month activity_month_index cohort_month cohort_age user_type vertical payment_method order_voucher_status orders cell_active_users_nonadditive gross_gmv_toman voucher_spend_toman',
 control:'sector activity_month active_users new_commercial_users existing_cohort_active_users organic_origin_users nonorganic_origin_users unknown_origin_users orders voucher_orders non_voucher_orders unknown_voucher_orders gross_gmv_toman voucher_spend_toman',
 voucher:'sector activity_month vertical voucher_orders voucher_users entry_month_voucher_users existing_cohort_voucher_users first_commercial_order_voucher_users voucher_spend_toman voucher_orders_gmv_toman',
 calendar:'month month_index month_start month_end_exclusive calendar_days is_complete_at_cutoff active_days campaign_days business_events plan_known_at_cutoff committed_voucher_budget_toman',
 coverage:'sector payment_method first_observed_month last_observed_month observed_months_in_window historical_orders confirmed_launch_month confirmed_stop_month available_in_forecast_month confirmed_constraints',
 quality:'scope metric value'};
 const strings=new Set('sector cohort_month user_type activity_month vertical payment_method order_voucher_status month month_start month_end_exclusive business_events first_observed_month last_observed_month confirmed_launch_month confirmed_stop_month confirmed_constraints scope metric'.split(' '));
 const nullable=new Set('cohort_month_index cohort_age active_days campaign_days business_events plan_known_at_cutoff committed_voucher_budget_toman confirmed_launch_month confirmed_stop_month available_in_forecast_month confirmed_constraints'.split(' '));
 function normalize(kind,rows){
  const fields=schema[kind]?.split(' ');if(!fields)throw Error('نوع فایل ناشناخته است.');
  if(rows.headers&&fields.some(k=>!rows.headers.includes(k)))throw Error(`سرستون‌های فایل ${kind} باید مطابق خروجی کوئری باشند: ${fields.join(', ')}`);
  return rows.map((raw,i)=>{
   if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error(`ردیف ${i+2}: ساختار نامعتبر است.`);
   const result={};for(const k of [...fields,...Object.keys(raw).filter(k=>!fields.includes(k))]){
    if(!Object.hasOwn(raw,k))continue;let v=raw[k];
    if(v==='\\N'||v===null||v===''){if(nullable.has(k)){result[k]=null;continue;}}
    if(fields.includes(k)&&!strings.has(k)){
     if(v===null||v===''||typeof v==='boolean'||typeof v==='object'||!/^\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(String(v)))throw Error(`ردیف ${i+2}: نوع عددی ستون ${k} نامعتبر است.`);
     v=Number(v);if(!Number.isFinite(v)||v<0||(!k.endsWith('_toman')&&!Number.isSafeInteger(v)))throw Error(`ردیف ${i+2}: مقدار ${k} معتبر نیست.`);
    }else if(fields.includes(k)&&typeof v!=='string')throw Error(`ردیف ${i+2}: ستون ${k} باید متن باشد.`);
    result[k]=v;
   }
   for(const [field,m] of [['cohort_month_index',result.cohort_month],['activity_month_index',result.activity_month],['month_index',result.month]])if(result[field]!=null&&m&&m!=='PRE_HISTORY'){
    const normalized=String(m).slice(0,7),expected=Number(normalized.slice(0,4))*12+Number(normalized.slice(5))-1;if(result[field]!==expected)throw Error(`ردیف ${i+2}: ${field} با ماه میلادی سازگار نیست.`);
   }
   if(result.cohort_month==='PRE_HISTORY'&&['cohort_age','cohort_month_index'].some(k=>result[k]!=null))throw Error('سن و شاخص کوهورت PRE_HISTORY باید خالی باشند.');
   return result;
  });
 }
 globalThis.PlanningInputContract={schema,normalize};
})();
