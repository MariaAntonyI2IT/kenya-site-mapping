const {validateAccountData} = require('./src/validate_propose_account');
const {validateOuData} = require('./src/validate_propose_ou');

const validateProposedData = async (xlData,pool) => {
  try {
    console.log(`Validation Starts (proposed data)`);
    await validateAccountData(xlData,pool);
    await validateOuData(xlData,pool);
    console.log(`Validation Success (proposed data)`);
  } catch(e) {
    console.log(`Validation Failure (proposed data)`);
    throw (e);
  }
};

module.exports = {
  validateProposedData
};