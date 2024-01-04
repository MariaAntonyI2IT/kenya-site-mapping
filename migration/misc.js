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
  workflowAccount: {}
};


const populateOrgData = () => {
  const orgJsonFile = `report/${smd.json.orgnaization}.json`
  orgData = JSON.parse(readFileSync(orgJsonFile,{encoding: 'utf-8'}));
  const privateJsonFile = `report/${pf.json.site}.json`
  siteData = JSON.parse(readFileSync(privateJsonFile,{encoding: 'utf-8'}));
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
  populateOrgData();
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

module.exports = {
  transferMigratedSiteUsers
};
