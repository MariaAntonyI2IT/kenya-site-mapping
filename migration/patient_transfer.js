
const transferPatient = async (oldSite,account,ou,site,pool) => {
  const patientDetails = (await pool.query(`select pt.patient_id, pt.id as patient_track_id, s.id as oldSiteId from patient_tracker pt
	left join patient p on p.id = pt.patient_id 
	inner join site s on s.id =pt.site_id 
  where s.name = $1 and s.is_active =true and s.is_deleted= false`,[oldSite])).rows;
  if(patientDetails.length) {
    await updatePatient(patientDetails,site,pool);
    await updatePatientTracker(patientDetails,site,account,ou,pool);
    await updateScreeningLog(patientDetails,site,account,ou,pool);
    await updateOtherPatientRecords(patientDetails,site,pool);
  } else {
    console.log(`No Patient found`);
  }
}

const updatePatient = async (patientDetails,site,pool) => {
  const pIds = patientDetails.filter(pd => !!pd.patient_id).map(pd => pd.patient_id);
  if(pIds.length) {
    console.log(`updating patient`);
    const result = await pool.query(`update patient set tenant_id = $1, site_id = $2 where id in (${pIds.join(',')})`,
      [site.tenantId,site.id]);
    console.log(`updated patient (${result.rowCount})`);
  } else {
    console.log(`Patient Id not found`);
  }
}

const updatePatientTracker = async (patientDetails,site,account,ou,pool) => {
  console.log(`updating patient tracker`);
  const ptIds = patientDetails.map(pd => pd.patient_track_id);
  const result = await pool.query(`update patient_tracker set tenant_id = $1, operating_unit_id = $2, account_id = $3, site_id = $4 where id in (${ptIds.join(',')})`,
    [site.tenantId,ou.id,account.id,site.id]);
  console.log(`updated patient tracker (${result.rowCount})`);
}

const updateScreeningLog = async (patientDetails,site,account,ou,pool) => {
  console.log(`updating screening_log`);
  const oldSiteId = patientDetails[0].oldSiteId;
  const result = await pool.query(`update screening_log set tenant_id = $1, operating_unit_id = $2, account_id = $3, site_id = $4 where site_id = $5`,
    [site.tenantId,ou.id,account.id,site.id,oldSiteId]);
  console.log(`updated screening_log (${result.rowCount})`);
}

const updateOtherPatientRecords = async (patientDetails,site,pool) => {
  const ptIds = patientDetails.map(pd => pd.patient_track_id);
  const tables = ['glucose_log','bp_log','red_risk_notification','customized_module','patient_assessment','prescription',
    'prescription_history','patient_lab_test','patient_lab_test_result','patient_lifestyle','patient_nutrition_lifestyle','patient_psychology',
    'mental_health','patient_visit','patient_medical_review','patient_comorbidity','patient_complication','patient_current_medication',
    'patient_diagnosis','patient_medical_compliance','patient_pregnancy_details','patient_symptom','patient_treatment_plan','patient_transfer'];
  for(let table of tables) {
    console.log(`updating ${table}`);
    const result = await pool.query(`update ${table} set tenant_id = $1 where patient_track_id in (${ptIds.join(',')})`,[site.tenantId]);
    console.log(`updated ${table} (${result.rowCount})`);
  }
}

module.exports = {
  transferPatient
};