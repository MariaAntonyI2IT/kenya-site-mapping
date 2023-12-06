const {smd} = require('../../common/constants');

/*
Validate Whether the site is present under provided OU and account
*/
const getFormattedSiteData = (xlData) => {
  const data = [];
  for(const xl of xlData) {
    data.push({account: xl[smd.fields.currentAccount],ou: xl[smd.fields.currentOu],site: xl[smd.fields.currentSite]});
  }
  return data;
};

const validateSite = async (xlData,pool) => {
  const formattedData = getFormattedSiteData(xlData);
  for(const data of formattedData) {
    console.log(`Validating Site ${data.site}`);
    const result = await pool.query(
      `select ac.name as account, ou.name as ou, s.name as site from site s
      inner join operating_unit ou on s.operating_unit_id = ou.id
      inner join account ac on s.account_id = ac.id
      where s.name = $1 and ou.name = $2 and ac.name = $3 and 
      s.is_active =true and s.is_deleted =false and 
      ou.is_active =true and ou.is_deleted =false and
	  ac.is_active =true and ac.is_deleted =false and s.country_id = $4
      `,[data.site,data.ou,data.account,global.countryId]);
    if(result.rows.length !== 1) {
      throw (`Error::: Site is missing (${data.site})`);
    }
  }
  console.log(`Validated site data (${formattedData.length})`);
};

module.exports = {
  validateSite
};