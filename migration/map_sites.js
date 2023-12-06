const {smd,validation} = require('../common/constants');
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
};

const setOrgData = (xlData) => {
  for(const xl of xlData) {
    if(!xl[smd.fields.moveTo]) {

      // proposed
      if(!orgData.proposed.__accountMap__[xl[smd.fields.proposedAccount]]) {
        orgData.proposed.__accountMap__[xl[smd.fields.proposedAccount]] = {id: null,tenantId: null};
      }
      if(!orgData.proposed.__ouMap__[xl[smd.fields.proposedOu]]) {
        orgData.proposed.__ouMap__[xl[smd.fields.proposedOu]] = {id: null,tenantId: null,account: xl[smd.fields.proposedAccount]};
      }
      if(!orgData.proposed.__siteMap__[xl[smd.fields.proposedSite]]) {
        orgData.proposed.__siteMap__[xl[smd.fields.proposedSite]] = {
          id: null,tenantId: null,mflCode: xl[smd.fields.mflCode],account: xl[smd.fields.proposedAccount],ou: xl[smd.fields.proposedOu],currentSite: xl[smd.fields.currentSite],nameChange: null
        };
      }
      if(!orgData.proposed.__programMap__[xl[smd.fields.currentProgram]]) {
        orgData.proposed.__programMap__[xl[smd.fields.currentProgram]] = [xl[smd.fields.proposedSite]]
      } else {
        orgData.proposed.__programMap__[xl[smd.fields.currentProgram]].push(xl[smd.fields.proposedSite]);
      }


      //actual
      if(!orgData.actual.__accountMap__[xl[smd.fields.currentAccount]]) {
        orgData.actual.__accountMap__[xl[smd.fields.currentAccount]] = {id: null,tenantId: null};
      }
      if(!orgData.actual.__ouMap__[xl[smd.fields.currentOu]]) {
        orgData.actual.__ouMap__[xl[smd.fields.currentOu]] = {id: null,tenantId: null,account: xl[smd.fields.currentAccount]};
      }
      if(!orgData.actual.__siteMap__[xl[smd.fields.currentSite]]) {
        orgData.actual.__siteMap__[xl[smd.fields.currentSite]] = {account: xl[smd.fields.currentAccount],ou: xl[smd.fields.currentOu],proposedSite: xl[smd.fields.proposedSite]};
      }

    } else {
      orgData.proposed.__moveToMap__[xl[smd.fields.currentSite]] = xl[smd.fields.moveTo];
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
    orgData.proposed.__siteMap__[site].id = siteData.id;
    orgData.proposed.__siteMap__[site].tenantId = siteData.tenantId;
    orgData.proposed.__siteMap__[site].nameChange = siteDetail.currentSite === site ? '' : site;
    console.log(`Updated site ${site}`);
  }
};

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

const deactivateUser = async (pool) => {
  const jsonFile = `report/${validation.userReport}.json`
  const userValidation = JSON.parse(readFileSync(jsonFile,{encoding: 'utf-8'}));
  const uniqueUsers = [];
  for(const userData of userValidation) {
    if(!uniqueUsers.includes(userData.username)) uniqueUsers.push(userData.username);
  }
  console.log(uniqueUsers.length);
  for(const user of uniqueUsers) {
    await deleteUser(user,orgData.country.id,pool);
  }
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
    console.log(`Cleared ove to site ${moveTo}`);
  }
};

const clear = async (pool) => {
  await cleanCurrentAccounts(pool);
  await cleanCurrentOus(pool);
  await cleanSites(pool);
};

const mapPrograms = async (pool) => {
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
    console.log(`Updated Program ${program}`);
  }
};


const mapSites = async (xlData,pool) => {
  await setCountryData(pool);
  setOrgData(xlData);
  await createAccounts(pool);
  await createOus(pool);
  await updateSites(pool);
  await deactivateUser(pool);
  await transferPatients(pool);
  await mapPrograms(pool);
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

