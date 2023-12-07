const {smd,validation} = require('../../common/constants');
const {writeFileSync,rmSync,existsSync} = require('fs');
const {parseAsync} = require('json2csv');
const {convertCsvToXlsx} = require('@aternus/csv-to-xlsx');

const accData = [];

const getFormattedAccountData = (xlData) => {
  const data = [];
  for(const xl of xlData) {
    if(!data.includes(xl[smd.fields.currentAccount])) {
      data.push(xl[smd.fields.currentAccount]);
    }
  }
  data.sort((a,b) => (a > b ? 1 : -1));
  return data;
};

const validatAccountUsers = async (xlData,pool) => {
  const formattedData = getFormattedAccountData(xlData);
  for(const data of formattedData) {
    console.log(`Validating Account ${data}`);
    const result = await pool.query(
      `select u.username from "user" u where u.tenant_id =
      (select tenant_id from account acc where acc.name  = $1 and acc.is_active =true and acc.is_deleted =false and acc.country_id = $2)
      and u.is_active =true and u.is_deleted =false
      `,[data,global.countryId]);
    for(let accountDetail of result.rows) {
      accData.push({username: accountDetail.username,currentAccount: data})
    }
  }
  await writeCsv(accData);
};

async function writeCsv(data) {
  data.sort((a,b) => (a.currentAccount > b.currentAccount ? 1 : -1));
  const fields = [{
    label: 'User',
    value: 'username',
  },{
    label: 'Current Account',
    value: 'currentAccount',
  }
  ];
  const opts = {fields};
  const csv = await parseAsync(data,opts);
  const csvFile = `report/${validation.accountReport}.csv`;
  const xlsxFile = `report/${validation.accountReport}.xlsx`;
  const jsonFile = `report/${validation.accountReport}.json`;
  if(existsSync(csvFile)) rmSync(csvFile);
  if(existsSync(xlsxFile)) rmSync(xlsxFile);
  if(existsSync(jsonFile)) rmSync(jsonFile);
  writeFileSync(csvFile,csv,{encoding: 'utf-8'});
  convertCsvToXlsx(csvFile,xlsxFile);
  writeFileSync(jsonFile,JSON.stringify(data,null,4));
}

module.exports = {
  validatAccountUsers
};