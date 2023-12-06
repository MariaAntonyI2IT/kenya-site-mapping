const {smd} = require('../../common/constants');

const getFormattedOuData = (xlData) => {
  const data = [];
  for(const xl of xlData) {
    if(!xl[smd.fields.proposedSite]) {
      continue;
    }
    if(!data.includes(xl[smd.fields.proposedOu])) {
      data.push(xl[smd.fields.proposedOu]);
    }
  }
  data.sort((a,b) => (a > b ? 1 : -1));
  return data;
};

const validateOuData = async (xlData,pool) => {
  const ouData = getFormattedOuData(xlData);
  for(const data of ouData) {
    console.log(`Validating OU ${data}`);
    const result = await pool.query(
      `select ou.name as ouName from operating_unit ou
      where ou.name = $1 and 
      ou.is_active =true and ou.is_deleted =false and ou.country_id = $2
      `,[data,global.countryId]);
    if(result.rows.length !== 0) {
      throw (`Error::: OU found (${data})`);
    }
  }
};

module.exports = {
  validateOuData
};