require('dotenv').config();
const {pf} = require('./common/constants');
const {pool} = require('./common/db');
const {readSiteMappingData} = require('./common/utils');
const {deactivateFacilities} = require('./migration/deactivate_facilities');

async function main() {
  try {
    await pool.query('BEGIN');
    console.log(`Deactivate Facility Starts`);
    const xlData = readSiteMappingData(pf.path,pf.sheet);
    await deactivateFacilities(xlData,pool);
    console.log(`Deactivate Facility Success`);
    await pool.query('COMMIT');
  } catch(e) {
    await pool.query('ROLLBACK')
    console.log(`Deactivate Facility Failure`);
    console.log(e);
  } finally {
    pool.end();
  }
};

main();