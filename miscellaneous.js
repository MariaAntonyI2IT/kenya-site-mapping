require('dotenv').config();
const {pool} = require('./common/db');
const {updatePatientRelatedTables} = require('./migration/misc');

async function main() {
  try {
    await pool.query('BEGIN');
    console.log(`Miscellaneous Starts`);
    await updatePatientRelatedTables(pool);
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