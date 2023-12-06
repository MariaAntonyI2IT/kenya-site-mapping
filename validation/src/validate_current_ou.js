const {smd} = require('../../common/constants');

/*
Validate Sites under OU for proper migration
*/
const getFormattedOuData = (xlData) => {
  const data = {};
  for(const xl of xlData) {
    if(data[xl[smd.fields.currentOu]]) {
      data[xl[smd.fields.currentOu]].push(xl[smd.fields.currentSite]);
    } else {
      data[xl[smd.fields.currentOu]] = [xl[smd.fields.currentSite]];
    }
  }
  return data;
};

const validateOU = async (xlData,pool) => {
  const ouData = getFormattedOuData(xlData);
  const keys = Object.keys(ouData);
  for(const ou of keys) {
    console.log(`Validating OU ${ou}`);
    const sites = ouData[ou];
    const result = await pool.query(
      `select s.name as site from site s 
      inner join operating_unit ou on ou.id = s.operating_unit_id
      where ou.name = $1 and ou.is_active =true and ou.is_deleted =false and
      s.is_active =true and s.is_deleted =false and ou.country_id = $2
      `,[ou,global.countryId]);
    for(const siteData of result.rows) {
      if(sites.indexOf(siteData.site) == -1) {
        throw (`Error::: OU Site ${siteData.site} is missing in ${ou}`);
      }
    }
    if(sites.length !== result.rows.length) {
      throw (`Error::: OU Sites Mismatch`);
    }
  }
  console.log(`Validated OU data`);
}

module.exports = {
  validateOU
};