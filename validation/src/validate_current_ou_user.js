const {smd,validation} = require('../../common/constants');
const {writeFileSync,rmSync,existsSync} = require('fs');
const {parseAsync} = require('json2csv');
const {convertCsvToXlsx} = require('@aternus/csv-to-xlsx');

const ouData = [];

const getFormattedOuData = (xlData) => {
  const data = {ou: [],__oumap__: {}};
  for(const xl of xlData) {
    if(!data.ou.includes(xl[smd.fields.currentOu])) {
      data.ou.push(xl[smd.fields.currentOu]);
    }
    if(!data.__oumap__[xl[smd.fields.currentOu]]) {
      data.__oumap__[xl[smd.fields.currentOu]] = {
        currentAccount: xl[smd.fields.currentAccount]
      }
    }
  }
  data.ou.sort((a,b) => (a > b ? 1 : -1));
  return data;
};


const validatOuUsers = async (xlData,pool) => {
  const formattedData = getFormattedOuData(xlData);
  for(const data of formattedData.ou) {
    console.log(`Validating OU ${data}`);
    const result = await pool.query(
      `select u.username from "user" u where u.tenant_id =
      (select tenant_id from operating_unit ou where ou.name  = $1 and ou.is_active =true and ou.is_deleted =false and ou.country_id = $2)
      and u.is_active =true and u.is_deleted =false
      `,[data,global.countryId]);
    for(let ouDetail of result.rows) {
      ouData.push({username: ouDetail.username,currentAccount: formattedData.__oumap__[data].currentAccount,currentOu: data});
    }
  }
  await writeCsv(ouData);
};

async function writeCsv(data) {
  data.sort((a,b) => (a.currentAccount > b.currentAccount ? 1 : -1));
  const fields = [{
    label: 'User',
    value: 'username',
  },{
    label: 'Current Account',
    value: 'currentAccount',
  },
  {
    label: 'Current OU',
    value: 'currentOu',
  }
  ];
  const opts = {fields};
  const csv = await parseAsync(data,opts);
  const csvFile = `report/${validation.ouReport}.csv`;
  const xlsxFile = `report/${validation.ouReport}.xlsx`
  if(existsSync(csvFile)) rmSync(csvFile);
  if(existsSync(xlsxFile)) rmSync(xlsxFile);
  writeFileSync(csvFile,csv,{encoding: 'utf-8'});
  convertCsvToXlsx(csvFile,xlsxFile);
}

module.exports = {
  validatOuUsers
};