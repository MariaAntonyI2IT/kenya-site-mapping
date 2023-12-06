const {smd} = require('../../common/constants');

/*
Validate OU under Account for proper migration
*/
const getFormattedAccountData = (xlData) => {
  const data = {};
  for(const xl of xlData) {
    if(data[xl[smd.fields.currentAccount]]) {
      if(!data[xl[smd.fields.currentAccount]].includes(xl[smd.fields.currentOu])) {
        data[xl[smd.fields.currentAccount]].push(xl[smd.fields.currentOu]);
      }
    } else {
      data[xl[smd.fields.currentAccount]] = [xl[smd.fields.currentOu]];
    }
  }
  return data;
};

const validateAccount = async (xlData,pool) => {
  const accData = getFormattedAccountData(xlData);
  const keys = Object.keys(accData);
  for(const acc of keys) {
    console.log(`Validating Account ${acc}`);
    const ou = accData[acc];
    const result = await pool.query(
      `select distinct(ou.name) as ou from operating_unit ou
      inner join account ac on ac.id = ou.account_id
      inner join site s on s.operating_unit_id = ou.id
      where ac.name = $1 and ac.is_active =true and ac.is_deleted =false and
      ou.is_active =true and ou.is_deleted =false and
      s.is_active =true and s.is_deleted =false and ac.country_id = $2
      `,[acc,global.countryId]);
    for(const ouData of result.rows) {
      if(ou.indexOf(ouData.ou) == -1) {
        throw (`Error::: Account OU${ouData.ou} is missing in ${acc}`);
      }
    }
    if(ou.length !== result.rows.length) {
      throw (`Error::: Account OU Mismatch`);
    }
  }
  console.log(`Validated Account data`);
};

module.exports = {
  validateAccount
};