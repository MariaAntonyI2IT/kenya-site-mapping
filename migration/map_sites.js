const {smd,validation,ksmProgram} = require('../common/constants');
const {createAccount,createOU,updateSite,deleteAccount,deleteOu,deleteSite,deleteUser} = require('./org');
const {transferPatient} = require('./patient_transfer');
const {writeFileSync,existsSync,rmSync,readFileSync} = require('fs');
const {transferSiteUsers} = require('./users');

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
  workflowAccount: {}
};

const setOrgData = (xlData) => {
  for(const xl of xlData) {
    if(!xl[smd.fields.moveTo]) {

      // proposed
      if(!orgData.proposed.__accountMap__[xl[smd.fields.proposedAccount].trim()]) {
        orgData.proposed.__accountMap__[xl[smd.fields.proposedAccount].trim()] = {id: null,tenantId: null};
      }
      if(!orgData.proposed.__ouMap__[xl[smd.fields.proposedOu].trim()]) {
        orgData.proposed.__ouMap__[xl[smd.fields.proposedOu].trim()] = {id: null,tenantId: null,account: xl[smd.fields.proposedAccount].trim()};
      }
      if(!orgData.proposed.__siteMap__[xl[smd.fields.proposedSite].trim()]) {
        orgData.proposed.__siteMap__[xl[smd.fields.proposedSite].trim()] = {
          id: null,tenantId: null,mflCode: xl[smd.fields.mflCode],account: xl[smd.fields.proposedAccount].trim(),ou: xl[smd.fields.proposedOu].trim(),currentSite: xl[smd.fields.currentSite],nameChange: null
        };
      }
      if(!orgData.proposed.__programMap__[xl[smd.fields.currentProgram]]) {
        orgData.proposed.__programMap__[xl[smd.fields.currentProgram]] = [xl[smd.fields.proposedSite].trim()]
      } else {
        orgData.proposed.__programMap__[xl[smd.fields.currentProgram]].push(xl[smd.fields.proposedSite].trim());
      }


      //actual
      if(!orgData.actual.__accountMap__[xl[smd.fields.currentAccount]]) {
        orgData.actual.__accountMap__[xl[smd.fields.currentAccount]] = {id: null,tenantId: null};
      }
      if(!orgData.actual.__ouMap__[xl[smd.fields.currentOu]]) {
        orgData.actual.__ouMap__[xl[smd.fields.currentOu]] = {id: null,tenantId: null,account: xl[smd.fields.currentAccount]};
      }
      if(!orgData.actual.__siteMap__[xl[smd.fields.currentSite]]) {
        orgData.actual.__siteMap__[xl[smd.fields.currentSite]] = {account: xl[smd.fields.currentAccount],ou: xl[smd.fields.currentOu],proposedSite: xl[smd.fields.proposedSite].trim()};
      }

    } else {
      orgData.proposed.__moveToMap__[xl[smd.fields.currentSite]] = xl[smd.fields.moveTo];
    }
    if(xl[smd.fields.proposedAccount] && !orgData.workflowAccount[xl[smd.fields.proposedAccount].trim()]) {
      orgData.workflowAccount[xl[smd.fields.proposedAccount].trim()] = xl[smd.fields.workflow].split(',').map(wf => wf.trim());
    }
  }
};


const setCountryData = async (pool) => {
  const result = await pool.query(`select id, tenant_id from country where name = $1 and is_active =true and is_deleted = false`,['Kenya']);
  orgData.country.id = parseInt(result.rows[0].id);
  orgData.country.tenantId = parseInt(result.rows[0].tenant_id);
};

const createAccounts = async (pool) => {
  const keys = Object.keys(orgData.proposed.__accountMap__);
  for(const account of keys) {
    console.log(`Creating account ${account}`);
    const accountData = await createAccount(account,orgData.country,pool);
    orgData.proposed.__accountMap__[account].id = accountData.id;
    orgData.proposed.__accountMap__[account].tenantId = accountData.tenantId;
    console.log(`Created account ${account}`);
  }
};

const createOus = async (pool) => {
  const keys = Object.keys(orgData.proposed.__ouMap__);
  for(const ou of keys) {
    console.log(`Creating ou ${ou}`);
    const ouDetail = orgData.proposed.__ouMap__[ou];
    const accountData = orgData.proposed.__accountMap__[ouDetail.account];
    const ouData = await createOU(ou,accountData,orgData.country,pool);
    orgData.proposed.__ouMap__[ou].id = ouData.id;
    orgData.proposed.__ouMap__[ou].tenantId = ouData.tenantId;
    console.log(`Created ou ${ou}`);
  }
};

const updateSites = async (pool) => {
  const keys = Object.keys(orgData.proposed.__siteMap__);
  for(const site of keys) {
    console.log(`Update site ${site}`);
    const siteDetail = orgData.proposed.__siteMap__[site];
    const accountData = orgData.proposed.__accountMap__[siteDetail.account];
    const ouData = orgData.proposed.__ouMap__[siteDetail.ou];
    const siteData = await updateSite(siteDetail.currentSite,site,siteDetail.mflCode,accountData,ouData,orgData.country.id,pool);
    siteDetail.id = siteData.id;
    siteDetail.tenantId = siteData.tenantId;
    siteDetail.nameChange = siteDetail.currentSite === site ? '' : site;
    await updatePatientDetails(accountData,ouData,siteDetail,pool);
    console.log(`Updated site ${site}`);
  }
};

const updatePatientDetails = async (account,ou,site,pool) => {
  const patientDetails = (await pool.query(`select pt.patient_id, pt.id as patient_track_id, s.id as old_site_id from patient_tracker pt
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


const transferPatients = async (pool) => {
  const keys = Object.keys(orgData.proposed.__moveToMap__);
  for(const moveTo of keys) {
    const oldSite = moveTo;
    const newSite = orgData.proposed.__moveToMap__[moveTo];
    console.log(`Moving patient from ${oldSite} to ${newSite}`);
    const siteData = orgData.proposed.__siteMap__[orgData.actual.__siteMap__[newSite].proposedSite];
    const accountData = orgData.proposed.__accountMap__[siteData.account];
    const ouData = orgData.proposed.__ouMap__[siteData.ou];
    await transferSiteUsers(oldSite,siteData,pool);
    await transferPatient(oldSite,accountData,ouData,siteData,pool);
    console.log(`Moved patient from ${oldSite} to ${newSite}`);
  }
};

const deactivateSiteUser = async (pool) => {
  const jsonFile = `report/${validation.siteReport}.json`
  const userValidation = JSON.parse(readFileSync(jsonFile,{encoding: 'utf-8'}));
  const uniqueUsers = [];
  for(const userData of userValidation) {
    if(!uniqueUsers.includes(userData.username)) uniqueUsers.push(userData.username);
  }
  console.log(uniqueUsers.length);
  for(const user of uniqueUsers) {
    await deleteUser(user,orgData.country.id,'Deleted the Site user (KSM)',pool);
  }
};

const deactivateOuUser = async (pool) => {
  const jsonFile = `report/${validation.ouReport}.json`
  const userValidation = JSON.parse(readFileSync(jsonFile,{encoding: 'utf-8'}));
  const uniqueUsers = [];
  for(const userData of userValidation) {
    if(!uniqueUsers.includes(userData.username)) uniqueUsers.push(userData.username);
  }
  console.log(uniqueUsers.length);
  for(const user of uniqueUsers) {
    await deleteUser(user,orgData.country.id,'Deleted the OU user (KSM)',pool);
  }
};

const deactivateAccountUser = async (pool) => {
  const jsonFile = `report/${validation.accountReport}.json`
  const userValidation = JSON.parse(readFileSync(jsonFile,{encoding: 'utf-8'}));
  const uniqueUsers = [];
  for(const userData of userValidation) {
    if(!uniqueUsers.includes(userData.username)) uniqueUsers.push(userData.username);
  }
  console.log(uniqueUsers.length);
  for(const user of uniqueUsers) {
    await deleteUser(user,orgData.country.id,'Deleted the Account user (KSM)',pool);
  }
};

const deactivateUsers = async (pool) => {
  await deactivateSiteUser(pool);
  await deactivateOuUser(pool);
  await deactivateAccountUser(pool);
};

const cleanCurrentAccounts = async (pool) => {
  const keys = Object.keys(orgData.actual.__accountMap__);
  for(const account of keys) {
    console.log(`Clear current account ${account}`);
    const accountData = await deleteAccount(account,orgData.country.id,pool);
    orgData.actual.__accountMap__[account].id = accountData.id;
    orgData.actual.__accountMap__[account].tenantId = accountData.tenantId;
    console.log(`Cleared current account ${account}`);
  }
};

const cleanCurrentOus = async (pool) => {
  const keys = Object.keys(orgData.actual.__ouMap__);
  for(const ou of keys) {
    console.log(`Clear current ou ${ou}`);
    const ouData = await deleteOu(ou,orgData.country.id,pool);
    orgData.actual.__ouMap__[ou].id = ouData.id;
    orgData.actual.__ouMap__[ou].tenantId = ouData.tenantId;
    console.log(`Cleared current ou ${ou}`);
  }
};

const cleanSites = async (pool) => {
  const keys = Object.keys(orgData.proposed.__moveToMap__);
  for(const moveTo of keys) {
    console.log(`Clear move to site ${moveTo}`);
    await deleteSite(moveTo,orgData.country.id,pool);
    console.log(`Cleared move to site ${moveTo}`);
  }
};

const clear = async (pool) => {
  await cleanCurrentAccounts(pool);
  await cleanCurrentOus(pool);
  await cleanSites(pool);
};

const mapSitePrograms = async (pool) => {
  const keys = Object.keys(orgData.proposed.__programMap__);
  for(const program of keys) {
    console.log(`Updating Program ${program}`);
    const currSiteResult = await pool.query(`select p.id, sp.site_id from program p
      inner join site_program sp on sp.program_id = p.id
      where p.name  = $1 and country_id = $2 and is_active = true and is_deleted = false`,[program,orgData.country.id]);
    const programId = currSiteResult.rows[0].id;
    const currentMappedSites = currSiteResult.rows.map(res => parseInt(res.site_id));
    const proposedMappedSites = orgData.proposed.__programMap__[program].map(s => parseInt(orgData.proposed.__siteMap__[s].id));
    for(const proposedSite of proposedMappedSites) {
      if(!currentMappedSites.includes(proposedSite)) {
        await pool.query(`INSERT INTO public.site_program(
          site_id, program_id)
          VALUES ($1, $2)`,[proposedSite,programId]);
        await pool.query(`DELETE FROM public.deleted_site_program
          WHERE site_id = $1 and program_id = $2`,[proposedSite,programId]);
      }
    }
    for(const currentSite of currentMappedSites) {
      if(!proposedMappedSites.includes(currentSite)) {
        throw (`current site program is mismatched with proposed one (program - ${program}, site - ${currentSite})`);
      }
    }
    console.log(`Updated Program ${program}`);
  }
};

const mapPrograms = async (pool) => {
  const programs = Object.keys(ksmProgram);
  for(const program of programs) {
    console.log(`Updating KSM Program ${program}`);
    const programObj = ksmProgram[program];
    const result = await pool.query(`select id from program where is_active=true 
    and is_deleted = false and name = $1 and country_id = $2`,[program,orgData.country.id]);
    if(result.rows.length !== 1) {
      throw (`Error::: Program is missing (${program})`);
    }
    programObj.id = result.rows[0].id;
    if(programObj.name) {
      await pool.query(`update program set name = $1 where id = $2`,[programObj.name,programObj.id]);
    }
    if(programObj.merge) {
      const result = await pool.query(`select id from program where is_active=true 
      and is_deleted = false and name = $1 and country_id = $2`,[programObj.merge,orgData.country.id]);
      if(result.rows.length !== 1) {
        throw (`Error::: Program merge is missing (${programObj.merge})`);
      }
      programObj.mergeId = result.rows[0].id;
      await pool.query(`update program set is_active = $1, is_deleted = $2  where id = $3`,[false,true,programObj.mergeId]);
      await pool.query(`update patient set program_id = $1 where program_id = $2`,[programObj.id,programObj.mergeId]);
    }
    console.log(`Updated KSM Program ${program}`);
  }
  orgData.ksmProgram = ksmProgram;
  await mapSitePrograms(pool);
};


const deletePrograms = async (pool) => {
  const keys = Object.keys(orgData.proposed.__moveToMap__);
  for(const moveTo of keys) {
    const oldSite = moveTo;
    console.log(`Updating moveTo (program) ${oldSite}`);
    await pool.query(`DELETE FROM public.site_program
    WHERE site_id = (select id from site where name = $1)`,[oldSite]);
    await pool.query(`DELETE FROM public.deleted_site_program
    WHERE site_id = (select id from site where name = $1)`,[oldSite]);
    console.log(`Updated moveTo (program) ${oldSite}`);
  }
}

const updatePrograms = async (pool) => {
  await deletePrograms(pool);
  await mapPrograms(pool);
}

const getWorkflowObj = async (pool) => {
  const workflowObj = {};
  const result = await pool.query(`select id, workflow as name from clinical_workflow where is_active=true and is_deleted = false`,[]);
  for(const workflow of result.rows) {
    workflowObj[workflow.name] = workflow.id;
  }
  return workflowObj;
};


const updateClinicalWorkflow = async (pool) => {
  const workflowObj = await getWorkflowObj(pool);
  const keys = Object.keys(orgData.workflowAccount);
  for(const account of keys) {
    const workflows = orgData.workflowAccount[account];
    console.log(`Updating workflow for account ${account}`);
    for(const workflow of workflows) {
      const accountId = orgData.proposed.__accountMap__[account].id;
      const workflowId = workflowObj[workflow];
      if(!accountId || !workflowId) {
        throw (`Error::: Workflow missing account (${account}) workflow (${workflow})`);
      }
      await pool.query(`INSERT INTO public.account_clinical_workflow(
        account_id, clinical_workflow_id)
        VALUES ($1, $2)`,[accountId,workflowId]);
    }
    console.log(`Updated workflow for account ${account}`);
  }
}

const mapSites = async (xlData,pool) => {
  await setCountryData(pool);
  setOrgData(xlData);
  await createAccounts(pool);
  await createOus(pool);
  await updateSites(pool);
  await deactivateUsers(pool);
  await transferPatients(pool);
  await updateClinicalWorkflow(pool)
  await updatePrograms(pool);
  await clear(pool);
  writeOrgJSON();
};

const writeOrgJSON = () => {
  const jsonFile = `report/${smd.json.orgnaization}.json`
  if(existsSync(jsonFile)) rmSync(jsonFile);
  writeFileSync(jsonFile,JSON.stringify(orgData,null,4),{encoding: 'utf-8'});
};

module.exports = {
  mapSites
};
