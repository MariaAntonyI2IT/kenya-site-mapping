const {smd} = require('../../common/constants');

/*
Validate move to sites
*/
const getFormattedData = (xlData) => {
  const data = {sites: [],moveTo: []};
  for(const xl of xlData) {
    if(xl[smd.fields.moveTo]) {
      data.moveTo.push(xl[smd.fields.moveTo]);
    } else {
      data.sites.push(xl[smd.fields.currentSite]);
    }
  }
  return data;
};

const validateMoveTo = async (xlData) => {
  const data = getFormattedData(xlData);
  for(let moveToSite of data.moveTo) {
    console.log(`Validating Move To ${moveToSite}`);
    if(!data.sites.includes(moveToSite)) {
      throw (`Error::: Move To site not found ${moveToSite}`);
    }
  }
  console.log(`Validated Move To data`);
}

module.exports = {
  validateMoveTo
};