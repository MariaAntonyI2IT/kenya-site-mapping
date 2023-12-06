require('dotenv').config();
const {pool} = require('./common/db');
const {readSiteMappingData} = require('./common/utils');
const {validateProposedData} = require('./validation/proposed_data_validation');
const {validateCurrentData} = require('./validation/current_data_validation');

async function main() {
  try {
    console.log(`Validation Starts`);
    const xlData = readSiteMappingData();
    const result = await pool.query(`select id from country where name = $1 and is_active =true and is_deleted = false`,['Kenya']);
    global.countryId = parseInt(result.rows[0].id);
    await validateProposedData(xlData,pool);
    await validateCurrentData(xlData,pool);
    console.log(`Validation Success`);
  } catch(e) {
    console.log(`Validation Failure`);
    console.log(e);
  } finally {
    pool.end();
  }
};

main();

