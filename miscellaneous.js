require('dotenv').config();
const {pool} = require('./common/db');
const {updatePatientRelatedTables,updateClinicalWorkflow} = require('./migration/misc');
const {readSiteMappingData} = require('./common/utils');

async function main() {
  try {
    await pool.query('BEGIN');
    console.log(`Miscellaneous Starts`);
    const xlData = readSiteMappingData();
    await updatePatientRelatedTables(pool);
    await updateClinicalWorkflow(xlData,pool)
    console.log(`Miscellaneous Success`);
    await pool.query('COMMIT');
  } catch(e) {
    await pool.query('ROLLBACK')
    console.log(`Miscellaneous Failure`);
    console.log(e);
  } finally {
    pool.end();
  }
};

main();