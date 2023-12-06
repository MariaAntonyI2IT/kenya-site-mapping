const {validateAccount} = require('./src/validate_current_account');
const {validateOU} = require('./src/validate_current_ou');
const {validateSite} = require('./src/validate_current_site');
const {validateMoveTo} = require('./src/validate_current_moveto');
const {validatSiteUsers} = require('./src/validate_current_site_user');
const {validatAccountUsers} = require('./src/validate_current_account_user');
const {validatOuUsers} = require('./src/validate_current_ou_user');
const {validateProgram} = require('./src/validate_program');

const validateCurrentData = async (xlData,pool) => {
  try {
    console.log(`Validation Starts (current data)`);
    await validateAccount(xlData,pool);
    await validateOU(xlData,pool);
    await validateSite(xlData,pool);
    await validateMoveTo(xlData);
    await validatAccountUsers(xlData,pool);
    await validatOuUsers(xlData,pool);
    await validatSiteUsers(xlData,pool);
    await validateProgram(xlData,pool);
    console.log(`Validation Success (current data)`);
  } catch(e) {
    console.log(`Validation Failure (current data)`);
    throw (e);
  }
}

module.exports = {
  validateCurrentData
}