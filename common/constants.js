module.exports = {
  smd: {
    path: process.env.SMD_PATH,
    sheet: 'KSM',
    fields: {
      proposedAccount: 'Account Expanded',
      proposedOu: 'Operating Unit',
      proposedSite: 'Facility',
      currentAccount: 'Current Account',
      currentOu: 'Current OU',
      currentSite: 'Current Facility',
      currentProgram: 'Program Expaned',
      moveTo: 'Move To',
      mflCode: 'MFL Code',
      workflow: 'Workflow'
    },
    json: {
      orgnaization: 'kenya_site_mapping'
    }
  },
  validation: {
    siteReport: 'site_validation',
    accountReport: 'account_validation',
    ouReport: 'ou_validation'
  },
  pf: {
    path: process.env.SMD_PATH,
    sheet: 'Private facilities',
    fields: {
      site: 'Current Facility'
    },
    json: {
      site: 'private_facilities'
    }
  }
};