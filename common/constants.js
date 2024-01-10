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
    },
    report: {
      siteUsers: 'site_users',
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
  },
  ksmProgram: {
    'Novo Nordisk': {
      merge: 'Novo',
      name: ''
    },
    'Novartis (Afya Dumu)': {
      merge: 'Novartis',
      name: 'Afya Dumu'
    },
    'Path': {
      merge: '',
      name: ''
    },
    'Mwanga': {
      merge: 'Redcross',
      name: 'Roche- Mwanga'
    },
    'The Root Cause': {
      merge: '',
      name: ''
    }
  }
};