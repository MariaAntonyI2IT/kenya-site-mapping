const {smd,pf} = require('../common/constants');
const {readFileSync} = require('fs');
const {pool} = require('../common/db');

let orgData = {
  proposed: {
    __accountMap__: {},
    __ouMap__: {},
    __siteMap__: {},
    __moveToMap__: {},
    __programMap__: {}
  },
  actual: {
    __accountMap__: {},
    __ouMap__: {},
    __siteMap__: {}
  },
  country: {
    id: null,
    tenantId: null
  },
};

let siteData = {};

const populateOrgData = () => {
  const orgJsonFile = `report/${smd.json.orgnaization}.json`
  orgData = JSON.parse(readFileSync(orgJsonFile,{encoding: 'utf-8'}));
  const privateJsonFile = `report/${pf.json.site}.json`
  siteData = JSON.parse(readFileSync(privateJsonFile,{encoding: 'utf-8'}));
}
const transferPatients = async (pool) => {
  const keys = Object.keys(orgData.proposed.__siteMap__);
  for(const site of keys) {
    console.log(`Updating site ${site}`);
    const siteDetail = orgData.proposed.__siteMap__[site];
    const accountData = orgData.proposed.__accountMap__[siteDetail.account];
    const ouData = orgData.proposed.__ouMap__[siteDetail.ou];
    await updatePatientDetails(accountData,ouData,siteDetail,pool);
    console.log(`Updated site ${site}`);
  }
};

const deletePrograms = async(pool) =>{
  const keys = Object.keys(orgData.proposed.__moveToMap__);
  for(const moveTo of keys) {
    const oldSite = moveTo;
    console.log(`Updating moveTo (program) ${oldSite}`);
    await pool.query(`DELETE FROM public.site_program
    WHERE site_id = (select id from site where name = $1)`, [oldSite]);
    await pool.query(`DELETE FROM public.deleted_site_program
    WHERE site_id = (select id from site where name = $1)`, [oldSite]);
    console.log(`Updated moveTo (program) ${oldSite}`);
  }
  const privateKeys = Object.keys(siteData);
  for(const site of privateKeys) {
    console.log(`Updating Private facility (program) ${site}`);
    await pool.query(`DELETE FROM public.site_program
    WHERE site_id = (select id from site where name = $1)`, [site]);
    await pool.query(`DELETE FROM public.deleted_site_program
    WHERE site_id = (select id from site where name = $1)`, [site]);
    console.log(`Updated Private facility (program) ${site}`);
  }
}
const updatePatientDetails = async (account,ou,site,pool) => {
  const patientDetails = (await pool.query(`select pt.patient_id, pt.id as patient_track_id, s.id as oldSiteId from patient_tracker pt
	left join patient p on p.id = pt.patient_id 
	inner join site s on s.id =pt.site_id 
  where s.id = $1 and s.is_active =true and s.is_deleted= false`,[site.id])).rows;
  if(patientDetails.length) {
    await updatePatientTracker(patientDetails,account,ou,pool);
    await updateScreeningLog(site,account,ou,pool);
  } else {
    console.log(`No Patient found`);
  }
};

const updatePatientTracker = async (patientDetails,account,ou,pool) => {
  console.log(`updating patient tracker`);
  const ptIds = patientDetails.map(pd => pd.patient_track_id);
  const result = await pool.query(`update patient_tracker set operating_unit_id = $1, account_id = $2 where id in (${ptIds.join(',')})`,
    [ou.id,account.id]);
  console.log(`updated patient tracker (${result.rowCount})`);
}

const updateScreeningLog = async (site,account,ou,pool) => {
  console.log(`updating screening_log`);
  const result = await pool.query(`update screening_log set operating_unit_id = $1, account_id = $2 where site_id = $3`,
    [ou.id,account.id,site.id]);
  console.log(`updated screening_log (${result.rowCount})`);
}


const updatePatientRelatedTables = async (pool) => {
  populateOrgData();
  await transferPatients(pool);
  await deletePrograms(pool);
};

module.exports = {
  updatePatientRelatedTables
};

