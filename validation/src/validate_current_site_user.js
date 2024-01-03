const {smd,validation} = require('../../common/constants');
const {writeFileSync,rmSync,existsSync} = require('fs');
const {parseAsync} = require('json2csv');
const {convertCsvToXlsx} = require('@aternus/csv-to-xlsx');

/*
Validate Users
*/
let mismatch = [];
let dupCheck = {};
let matched = {};


const getUserValidationFormattedData = (xlData) => {
  const data = {__moveToMap__: [],__ouMap__: {},__siteMap__: {}};
  for(const xl of xlData) {
    if(xl[smd.fields.moveTo]) {
      data.__moveToMap__.push({from: xl[smd.fields.currentSite],to: xl[smd.fields.moveTo]});
    } else {
      if(data.__ouMap__[xl[smd.fields.proposedOu].trim()]) {
        data.__ouMap__[xl[smd.fields.proposedOu].trim()].push(xl[smd.fields.currentSite]);
      } else {
        data.__ouMap__[xl[smd.fields.proposedOu].trim()] = [xl[smd.fields.currentSite]];
      }
      if(data.__siteMap__[xl[smd.fields.currentSite]]) {
        throw ('Site already exists');
      }
      data.__siteMap__[xl[smd.fields.currentSite]] = {
        proposedOu: xl[smd.fields.proposedOu].trim(),proposedAccount: xl[smd.fields.proposedAccount].trim(),proposedSite: xl[smd.fields.proposedSite].trim(),
        currentAccount: xl[smd.fields.currentAccount],currentOu: xl[smd.fields.currentOu],currentSite: xl[smd.fields.currentSite]
      };
    }
  }
  data.__moveToMap__.forEach((site) => {
    const ou = data.__siteMap__[site.to].proposedOu;
    data.__ouMap__[ou].push(site.from);
  });
  return data;
};

const validatSiteUsers = async (xlData,pool) => {
  const formattedData = getUserValidationFormattedData(xlData);
  await validateFacilities(formattedData.__ouMap__,formattedData.__siteMap__,formattedData.__moveToMap__,pool);
  processFacilities();
  console.log(mismatch.length);
  writeCsv(mismatch);
};

const validateFacilities = async (ouMap,siteMap,moveToMap,pool) => {
  const keys = Object.keys(ouMap);
  for(const ou of keys) {
    const sites = ouMap[ou];
    for(const site of sites) {
      console.log(`Validating ${site} under ${ou}`);
      const siteData = await pool.query(
        `select s.tenant_id from site s where name = $1
        and s.is_active = true and s.is_deleted = false and s.country_id = $2`,[site,global.countryId]
      );
      const tenantId = siteData.rows[0].tenant_id;
      const userData = await pool.query(
        `select u.username, s.name as site, u.tenant_id, ac.name as account, ou.name as ou from "user" u
        inner join user_organization uo on uo.user_id = u.id
        inner join site s on uo.organization_id = s.tenant_id
        inner join operating_unit ou on ou.id = s.operating_unit_id
        inner join account ac on ac.id = s.account_id
        where u.username in (
        select u.username as username from "user" u 
              inner join user_organization uo on uo.user_id = u.id
            where uo.organization_id= $1
          and u.is_active = true and u.is_deleted = false
        ) and u.is_active = true and u.is_deleted = false and
        ou.is_active =true and ou.is_deleted =false and
        s.is_active =true and s.is_deleted =false and
        ac.is_active =true and ac.is_deleted =false
        and s.country_id = $2
        order by u.id    
        `,[tenantId,global.countryId]);
      for(const user of userData.rows) {
        const siteDetails = siteMap[site] || siteMap[moveToMap.find(s => s.from == site).to];
        const data = {
          username: user.username,propsedAccount: siteDetails.proposedAccount,proposedOu: siteDetails.proposedOu,
          proposedSite: siteDetails.proposedSite,currentAccount: siteDetails.currentAccount,currentOu: siteDetails.currentOu,
          currentSite: siteDetails.currentSite
        };
        if(sites.indexOf(user.site) == -1) {
          let dupCheckKey = Object.values(data).join('-');
          if(!dupCheck[dupCheckKey]) {
            mismatch.push(data);
            dupCheck[dupCheckKey] = true;
          }
        } else {
          if(matched[data.username]) {
            matched[data.username].push(data);
          } else {
            matched[data.username] = [data];
          }
        }
      }
    }
  }
}

const processFacilities = () => {
  const uniqueUsers = [];
  for(const userData of mismatch) {
    if(!uniqueUsers.includes(userData.username)) uniqueUsers.push(userData.username);
  }
  console.log(uniqueUsers.length + " - unique users");
  for(const username of uniqueUsers) {
    const users = matched[username] || [];
    for(const data of users) {
      let dupCheckKey = Object.values(data).join('-');
      if(!dupCheck[dupCheckKey]) {
        mismatch.push(data);
        dupCheck[dupCheckKey] = true;
      }
    }
  }
}

async function writeCsv(data) {
  data.sort((a,b) => (a.username > b.username ? 1 : -1));
  const fields = [{
    label: 'User',
    value: 'username',
  },{
    label: 'Proposed Account',
    value: 'propsedAccount',
  },{
    label: 'Proposed OU',
    value: 'proposedOu',
  },{
    label: 'Proposed Facility',
    value: 'proposedSite',
  },{
    label: 'Current Account',
    value: 'currentAccount',
  },{
    label: 'Current OU',
    value: 'currentOu',
  },{
    label: 'Current Facility',
    value: 'currentSite',
  }
  ];
  const opts = {fields};
  const csv = await parseAsync(data,opts);
  const csvFile = `report/${validation.siteReport}.csv`;
  const xlsxFile = `report/${validation.siteReport}.xlsx`;
  const jsonFile = `report/${validation.siteReport}.json`;
  if(existsSync(csvFile)) rmSync(csvFile);
  if(existsSync(xlsxFile)) rmSync(xlsxFile);
  if(existsSync(jsonFile)) rmSync(jsonFile);
  writeFileSync(csvFile,csv,{encoding: 'utf-8'});
  convertCsvToXlsx(csvFile,xlsxFile);
  writeFileSync(jsonFile,JSON.stringify(data,null,4));
}

module.exports = {
  validatSiteUsers
};
