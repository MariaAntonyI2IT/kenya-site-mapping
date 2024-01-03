const {pf} = require("../common/constants");
const {writeFileSync,existsSync,rmSync} = require('fs');
const {deleteAccount,deleteOu,deleteSite,deleteUser} = require('./org');

const siteData = {};
const country = {
  id: null,
  tenantId: null
};

const setCountryData = async (pool) => {
  const result = await pool.query(`select id, tenant_id from country where name = $1 and is_active =true and is_deleted = false`,['Kenya']);
  country.id = parseInt(result.rows[0].id);
  country.tenantId = parseInt(result.rows[0].tenant_id);
};

const setSiteData = async (xlData,pool) => {
  for(const xl of xlData) {
    const site = xl[pf.fields.site];
    const result = await pool.query(`
    select s.id as site_id, s.name as site_name, s.tenant_id as site_tenant_id,
     ou.id as ou_id, ou.name as ou_name, ou.tenant_id as ou_tenant_id,
      acc.id as acc_id, acc.name as acc_name, acc.tenant_id as acc_tenant_id from site s
inner join operating_unit ou on ou.id = s.operating_unit_id
inner join account acc on acc.id = s.account_id
where acc.is_active = true and acc.is_deleted = false and
ou.is_active = true and ou.is_deleted = false and
s.is_active = true and s.is_deleted = false 
and s.name = $1 and s.country_id = $2`,[site,country.id]);
    if(result.rows.length == 1) {
      const data = result.rows[0];
      siteData[site] = {
        site: {
          id: data.site_id,
          name: data.site_name,
          tenantId: data.site_tenant_id
        },
        ou: {
          id: data.ou_id,
          name: data.ou_name,
          tenantId: data.ou_tenant_id
        },
        account: {
          id: data.acc_id,
          name: data.acc_name,
          tenantId: data.acc_tenant_id
        }
      }
    } else {
      throw (`Error::: Site Mismatch ${site} (${result.rows.length})`);
    }
  }
};

const validateOu = async (pool) => {
  const keys = Object.keys(siteData);
  for(let site of keys) {
    const {ou} = siteData[site];
    console.log(`validating OU ${ou.name} (${site})`)
    const result = await pool.query(`
       select s.id from site s 
where s.is_active = true and s.is_deleted = false 
and s.operating_unit_id = $1 and s.country_id = $2`,[ou.id,country.id]);
    if(result.rows.length != 1) {
      throw (`Error::: OU Mismatch ${ou.name} (${result.rows.length})`);
    }
    console.log(`validated OU ${ou.name} (${site})`)
  }
};

const validateAccount = async (pool) => {
  const keys = Object.keys(siteData);
  for(let site of keys) {
    const {account} = siteData[site];
    console.log(`validating Account ${account.name} (${site})`)
    const result = await pool.query(`
    select ou.id from operating_unit ou 
    where ou.is_active = true and ou.is_deleted = false 
    and ou.account_id = $1  and ou.country_id = $2`,[account.id,country.id]);
    if(result.rows.length != 1) {
      throw (`Error::: Account Mismatch ${account.name} (${result.rows.length})`);
    }
    console.log(`validated Account ${account.name} (${site})`)
  }
};

const validateUsers = async (pool) => {
  const keys = Object.keys(siteData);
  for(let site of keys) {
    const siteDetail = siteData[site].site;
    console.log(`validating users for site ${site}`);
    const result = await pool.query(`
    select u.id, u.username, u.tenant_id, uo.organization_id from "user" u
inner join user_organization uo on uo.user_id = u.id
where u.is_active = true and u.is_deleted = false and u.tenant_id = $1 and u.country_id = $2
order by id asc`,[siteDetail.tenantId,country.id]);
    for(const userDetail of result.rows) {
      if(siteDetail.tenantId != userDetail.organization_id) {
        throw (`Error::: User validation fails ${userDetail.username}`);
      }
    }
    console.log(`validating users for site ${site}`);
  }
};

const cleanAccounts = async (pool) => {
  const keys = Object.keys(siteData);
  for(let site of keys) {
    const {account} = siteData[site];
    console.log(`Clearing Account ${account.name} (${site})`);
    await deleteAccount(account.name,country.id,pool);
    const result = await pool.query(`
    select u.id, u.username from "user" u
where tenant_id = $1 and is_active =true and is_deleted =false and country_id = $2 order by id asc`,[account.tenantId,country.id]);
    for(let user of result.rows) {
      await deleteUser(user.username,country.id,'Deleted the Account user (KSM)(PF)',pool);
    }
    console.log(`Cleared Account ${account.name} (${site})`)

  }
};

const cleanOus = async (pool) => {
  const keys = Object.keys(siteData);
  for(let site of keys) {
    const {ou} = siteData[site];
    console.log(`Clearing OU ${ou.name} (${site})`);
    await deleteOu(ou.name,country.id,pool);
    const result = await pool.query(`
    select u.id, u.username from "user" u
where tenant_id = $1 and is_active =true and is_deleted =false and country_id = $2 order by id asc`,[ou.tenantId,country.id]);
    for(let user of result.rows) {
      await deleteUser(user.username,country.id,'Deleted the OU user (KSM)(PF)',pool);
    }
    console.log(`Cleared OU ${ou.name} (${site})`)

  }
};

const cleanSites = async (pool) => {
  const keys = Object.keys(siteData);
  for(let site of keys) {
    const siteDetail = siteData[site].site;
    console.log(`Clearing Site ${siteDetail.name}`);
    await deleteSite(siteDetail.name,country.id,pool);
    const result = await pool.query(`
    select u.id, u.username from "user" u
where tenant_id = $1 and is_active =true and is_deleted =false  and country_id = $2 order by id asc`,[siteDetail.tenantId,country.id]);
    for(let user of result.rows) {
      await deleteUser(user.username,country.id,'Deleted the Site user (KSM)(PF)',pool);
    }
    console.log(`Cleared Site ${siteDetail.name}`)
  }
};


const clear = async (pool) => {
  await cleanAccounts(pool);
  await cleanOus(pool);
  await cleanSites(pool);
};

const deletePrograms = async (pool) => {
  const privateKeys = Object.keys(siteData);
  for(const site of privateKeys) {
    console.log(`Updating Private facility (program) ${site}`);
    await pool.query(`DELETE FROM public.site_program
    WHERE site_id = (select id from site where name = $1)`,[site]);
    await pool.query(`DELETE FROM public.deleted_site_program
    WHERE site_id = (select id from site where name = $1)`,[site]);
    console.log(`Updated Private facility (program) ${site}`);
  }
}

const deactivateFacilities = async (xlData,pool) => {
  await setCountryData(pool);
  await setSiteData(xlData,pool);
  await validateOu(pool);
  await validateAccount(pool);
  await validateUsers(pool);
  await deletePrograms(pool);
  await clear(pool);
  writeSiteJSON();
};

const writeSiteJSON = () => {
  const jsonFile = `report/${pf.json.site}.json`
  if(existsSync(jsonFile)) rmSync(jsonFile);
  writeFileSync(jsonFile,JSON.stringify(siteData,null,4),{encoding: 'utf-8'});
};

module.exports = {
  deactivateFacilities
};