require('dotenv').config();
const {pool} = require('./common/db');
const {readSiteMappingData} = require('./common/utils');
const {mapSites} = require('./migration/map_sites');

async function main() {
  try {
    await pool.query('BEGIN');
    console.log(`Migration Starts`);
    const xlData = readSiteMappingData();
    await mapSites(xlData,pool);
    console.log(`Migration Success`);
    await pool.query('COMMIT');
  } catch(e) {
    await pool.query('ROLLBACK')
    console.log(`Migration Failure`);
    console.log(e);
  } finally {
    pool.end();
  }
};

main();