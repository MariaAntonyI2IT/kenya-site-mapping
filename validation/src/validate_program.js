const {smd} = require('../../common/constants');

/*
Validate program proper migration
*/
const getFormattedProgramData = (xlData) => {
  const data = {};
  for(const xl of xlData) {
    if(!data[xl[smd.fields.currentProgram]]) {
      data[xl[smd.fields.currentProgram]] = true
    }
  }
  return data;
};

const validateProgram = async (xlData,pool) => {
  const programdata = getFormattedProgramData(xlData);
  const keys = Object.keys(programdata);
  for(const program of keys) {
    console.log(`Validating Program ${program}`);
    const result = await pool.query(
      `select name from program where name = $1 and is_active = true and is_deleted = false and country_id = $2
      `,[program,global.countryId]);
    if(result.rows.length !== 1) {
      throw (`Error::: Program is missing (${program})`);
    }
    console.log(`Validated Program ${program}`);
  }
}

module.exports = {
  validateProgram
};