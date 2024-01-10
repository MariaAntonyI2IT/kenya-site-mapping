const {smd,pf,validation} = require('../common/constants');
const {readFileSync,writeFileSync,existsSync,rmSync} = require('fs');
const {parseAsync} = require('json2csv');
const {convertCsvToXlsx} = require('@aternus/csv-to-xlsx');

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

let usersData = {
  ou: {},
  account: {},
  site: {}
}

let siteData = {};

const siteUserData = [];

const populateOrgData = () => {
  const orgJsonFile = `report/${smd.json.orgnaization}.json`
  orgData = JSON.parse(readFileSync(orgJsonFile,{encoding: 'utf-8'}));
}

const populateUsersData = () => {
  const accountFile = `report/${validation.accountReport}.json`;
  usersData.account = JSON.parse(readFileSync(accountFile,{encoding: 'utf-8'}));
  const ouFile = `report/${validation.ouReport}.json`;
  usersData.ou = JSON.parse(readFileSync(ouFile,{encoding: 'utf-8'}));
  const siteFile = `report/${validation.siteReport}.json`;
  usersData.site = JSON.parse(readFileSync(siteFile,{encoding: 'utf-8'}));
}

const populateSiteData = () => {
  const privateJsonFile = `report/${pf.json.site}.json`
  siteData = JSON.parse(readFileSync(privateJsonFile,{encoding: 'utf-8'}));
}

const populateData = () => {
  populateOrgData();
  populateUsersData();
  populateSiteData();
}

const getUniqueUsers = (data) => {
  const uniqueUsers = [];
  const usersData = [];
  for(const userData of data) {
    if(!uniqueUsers.includes(userData.username)) {
      uniqueUsers.push(userData.username);
      usersData.push({username: userData.username,propsedAccount: userData.propsedAccount});
    }
  }
  return usersData;
}

const updatePrivateSites = async (pool) => {
  const keys = Object.keys(siteData);
  for(const siteKey of keys) {
    const site = siteData[siteKey].site;
    console.log(`Updating Private facility site (${site.name})`);
    await pool.query(`UPDATE public.organization SET is_deleted = $1 WHERE id = $2`,[
      false,site.tenantId
    ]);
    await pool.query(`UPDATE public.site SET is_deleted = $1 WHERE id = $2`,[
      false,site.id
    ]);
    console.log(`Updated Private facility site (${site.name})`);
  }
}

const updateKSMSiteUsers = async (pool) => {
  populateData();
  const accountAdminId = (await pool.query(`select id from "role" where name = $1 and is_active = true and is_deleted = false`,['ACCOUNT_ADMIN'])).rows[0].id;
  console.log(accountAdminId);
  const siteUsers = getUniqueUsers(usersData.site);
  console.log(siteUsers.length)
  for(const user of siteUsers) {
    let totalCount = 0;
    let patientTables = [];
    const userResult = await pool.query(`select id, tenant_id from "user" where username = $1 and is_active = false and is_deleted = true and comments = $2`,[user.username,'Deleted the Site user (KSM)']);
    if(userResult.rows.length !== 1) {
      throw ('Error:: User mismatch');
    }
    const userId = userResult.rows[0].id;
    const userTenantId = userResult.rows[0].tenant_id;
    const tables = ['patient_tracker','patient','screening_log','glucose_log','bp_log','red_risk_notification','customized_module','patient_assessment','prescription',
      'prescription_history','patient_lab_test','patient_lab_test_result','patient_lifestyle','patient_nutrition_lifestyle','patient_psychology',
      'mental_health','patient_medical_review','patient_comorbidity','patient_complication','patient_current_medication',
      'patient_diagnosis','patient_medical_compliance','patient_pregnancy_details','patient_symptom','patient_treatment_plan','patient_transfer'];
    for(let table of tables) {
      const count = (await pool.query(`select count(*) from ${table} where created_by = $1 or updated_by = $1`,[userId])).rows[0].count;
      if(parseInt(count) !== 0) {
        patientTables.push(table);
      }
      totalCount += parseInt(count);
    }
    console.log(`${user.username} -- ${totalCount}`);
    if(user.username === 'salome.githiga@yahoo.com') {
      console.log(`Static user ${user.username} - ${userId}`);
      const sites = [
        'Ngorano Health Centre'
      ];
      for(let i = 0; i < sites.length; i++) {
        const siteData = (await pool.query(`select * from site where name =$1 and is_active=true and is_deleted = false`,[sites[i]])).rows;
        if(siteData.length !== 1) {
          throw ('Error:: static Site mismatch');
        }
        const site = siteData[0];
        if(i == 0) {
          await pool.query(`update "user" set is_active = true, is_deleted = false, comments = $2, tenant_id = $3 where id = $1`,[userId,'Updated site user (KSM)',site.tenant_id]);
          await pool.query(`delete from user_organization where user_id = $1`,[userId]);
          await pool.query(`insert into user_organization (user_id, organization_id) values ($1, $2)`,[userId,site.tenant_id]);
        } else {
          await pool.query(`insert into user_organization (user_id, organization_id) values ($1, $2)`,[userId,site.tenant_id]);
        }
      }
      siteUserData.push({userId,username: user.username,role: 'SITE_USER',patientTables: '',site: sites.join(',')});

    } else if(user.username === 'pmutua53@yahoo.com') {
      console.log(`Static user ${user.username} - ${userId}`);
      const sites = [
        'Makindu Sub-county Hospital',
        'Emali Model Health Centre',
        'Ilatu Health Centre (Makindu)',
        'Kikumini Health Centre'
      ];
      for(let i = 0; i < sites.length; i++) {
        const siteData = (await pool.query(`select * from site where name =$1 and is_active=true and is_deleted = false`,[sites[i]])).rows;
        if(siteData.length !== 1) {
          throw ('Error:: static Site mismatch');
        }
        const site = siteData[0];
        if(i == 0) {
          await pool.query(`update "user" set is_active = true, is_deleted = false, comments = $2, tenant_id = $3 where id = $1`,[userId,'Updated site user (KSM)',site.tenant_id]);
          await pool.query(`delete from user_organization where user_id = $1`,[userId]);
          await pool.query(`insert into user_organization (user_id, organization_id) values ($1, $2)`,[userId,site.tenant_id]);
        } else {
          await pool.query(`insert into user_organization (user_id, organization_id) values ($1, $2)`,[userId,site.tenant_id]);
        }
      }
      siteUserData.push({userId,username: user.username,role: 'SITE_USER',patientTables: '',site: sites.join(',')});

    } else if(totalCount == 0) {
      const accountData = orgData.proposed.__accountMap__[user.propsedAccount];
      await pool.query(`update "user" set is_active = true, is_deleted = false, comments = $2, tenant_id = $3 where id = $1`,[userId,'Updated Account Admin role for site user (KSM)',accountData.tenantId]);
      await pool.query(`delete from user_organization where user_id = $1`,[userId]);
      await pool.query(`insert into user_organization (user_id, organization_id) values ($1, $2)`,[userId,accountData.tenantId]);
      await pool.query(`delete from user_role where user_id = $1`,[userId]);
      await pool.query(`insert into user_role (user_id, role_id) values ($1, $2)`,[userId,accountAdminId]);
      siteUserData.push({userId,username: user.username,role: 'ACCOUNT_ADMIN',patientTables: patientTables.join(','),account: user.propsedAccount});
    } else {
      const siteData = (await pool.query(`select id, name from site where tenant_id = $1`,[userTenantId])).rows[0];
      const proposedSiteData = orgData.proposed.__siteMap__[siteData.name];
      if(proposedSiteData && proposedSiteData.id === siteData.id) {
        console.log("matched")
        await pool.query(`update "user" set is_active = true, is_deleted = false, comments = $2 where id = $1`,[userId,'Updated site user (KSM)']);
        await pool.query(`delete from user_organization where user_id = $1 and organization_id != $2`,[userId,userTenantId]);
      } else {
        throw ('Error:: user Site mismatch');
      }
      siteUserData.push({userId,username: user.username,role: 'SITE_USER',patientTables: patientTables.join(','),site: siteData.name});
    }
  }
  writeCsv(siteUserData);
}

const migrateSiteUsers = async (oldSite,site,pool) => {
  const oldSiteDetails = (await pool.query(`select id, tenant_id from site where name = $1`,[oldSite])).rows;
  if(oldSiteDetails.length != 1) {
    throw ('Error:: Move to Site mismatch');
  }
  const oldSiteDetail = oldSiteDetails[0];
  const userDetails = (await pool.query(`select u.id from "user" u
  inner join user_organization uo on u.id = uo.user_id
  inner join site s on s.tenant_id = uo.organization_id
  where u.is_active = true and u.is_deleted = false and 
  s.id = $1
  `,[oldSiteDetail.id])).rows;
  if(userDetails.length) {
    console.log(userDetails.length);
    for(let user of userDetails) {
      const res = (await pool.query(`select * from user_organization where organization_id = $1 and user_id = $2 `,[site.tenantId,user.id])).rows;
      if(res.length) {
        await pool.query(`delete from user_organization where organization_id = $1 and user_id = $2`,[oldSiteDetail.tenant_id,user.id]);
      } else {
        await pool.query(`update user_organization set organization_id = $1 where organization_id = $2 and user_id = $3 `,[site.tenantId,oldSiteDetail.tenant_id,user.id]);
      }
    }
  } else {
    console.log(`No Users found`);
  }
}

const transferMigratedSiteUsers = async (pool) => {
  populateData();
  const keys = Object.keys(orgData.proposed.__moveToMap__);
  for(const moveTo of keys) {
    const oldSite = moveTo;
    const newSite = orgData.proposed.__moveToMap__[moveTo];
    console.log(`Moving patient from ${oldSite} to ${newSite}`);
    const siteData = orgData.proposed.__siteMap__[orgData.actual.__siteMap__[newSite].proposedSite];
    await migrateSiteUsers(oldSite,siteData,pool);
    console.log(`Moved patient from ${oldSite} to ${newSite}`);
  }
};

async function writeCsv(data) {
  data.sort((a,b) => (a.role > b.role ? 1 : -1));
  const fields = [{
    label: 'User Id',
    value: 'userId',
  },
  {
    label: 'User',
    value: 'username',
  },{
    label: 'Role',
    value: 'role',
  },{
    label: 'Account',
    value: 'account',
  },{
    label: 'Facility',
    value: 'site',
  }
  ];
  const opts = {fields};
  const csv = await parseAsync(data,opts);
  const csvFile = `report/${smd.report.siteUsers}.csv`;
  const xlsxFile = `report/${smd.report.siteUsers}.xlsx`;
  const jsonFile = `report/${smd.report.siteUsers}.json`;
  if(existsSync(csvFile)) rmSync(csvFile);
  if(existsSync(xlsxFile)) rmSync(xlsxFile);
  if(existsSync(jsonFile)) rmSync(jsonFile);
  writeFileSync(csvFile,csv,{encoding: 'utf-8'});
  convertCsvToXlsx(csvFile,xlsxFile);
  writeFileSync(jsonFile,JSON.stringify(data,null,4));
}

module.exports = {
  transferMigratedSiteUsers,
  updateKSMSiteUsers,
  updatePrivateSites
};
