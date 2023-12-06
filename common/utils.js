const XLSX = require('xlsx');
const {smd} = require('./constants');

const readSiteMappingData = (path,sheet) => {
  path = path || smd.path;
  sheet = sheet || smd.sheet;
  const workbook = XLSX.readFile(path);
  return XLSX.utils.sheet_to_json(workbook.Sheets[sheet]);
};

module.exports = {readSiteMappingData};