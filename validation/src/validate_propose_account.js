const {smd} = require('../../common/constants');

const getFormattedAccountData = (xlData) => {
  const data = []
  for(const xl of xlData) {
    if(!xl[smd.fields.proposedSite]) {
      continue;
    }
    if(!data.includes(xl[smd.fields.proposedAccount])) {
      data.push(xl[smd.fields.proposedAccount]);
    }
  }
  data.sort((a,b) => (a > b ? 1 : -1));
  return data;
};

const validateAccountData = async (xlData,pool) => {
  const accountData = getFormattedAccountData(xlData);
  for(const data of accountData) {
    console.log(`Validating Account ${data}`);
    const result = await pool.query(
      `select ac.name as account from account ac
      where ac.name = $1 and 
	  ac.is_active =true and ac.is_deleted =false and ac.country_id = $2
      `,[data,global.countryId]);
    if(result.rows.length !== 0) {
      throw (`Error::: Account found (${data})`);
    }
  }
};

module.exports = {
  validateAccountData
};