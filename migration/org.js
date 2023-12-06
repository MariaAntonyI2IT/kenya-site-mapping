const createOrganization = async (formName,name,parentOrgId,pool) => {
  const result = await pool.query(`INSERT INTO public.organization(
      form_name, name, sequence, parent_organization_id, tenant_id, created_by, updated_by, created_at, updated_at, is_active, is_deleted)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning id`,[
    formName,name,0,parentOrgId,parentOrgId,1,1,new Date(),new Date(),true,false
  ]);
  return result.rows[0].id;
};

const updateOrganization = async (id,formId,pool) => {
  await pool.query(`UPDATE public.organization SET form_data_id = $1 WHERE id = $2`,[
    formId,id
  ]);
};

const createAccount = async (accountName,country,pool) => {
  const orgId = await createOrganization('account',accountName,country.tenantId,pool);
  const result = await pool.query(`INSERT INTO public.account(
    name, is_users_restricted, max_no_of_users, country_id, tenant_id, created_by, updated_by, created_at, updated_at, is_active, is_deleted)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning id`,[accountName,false,100,country.id,orgId,1,1,new Date(),new Date(),true,false]);
  const accountId = result.rows[0].id;
  await updateOrganization(orgId,accountId,pool);
  return {
    id: accountId,
    tenantId: orgId
  };
};


const createOU = async (ouName,account,country,pool) => {
  const orgId = await createOrganization('operatingunit',ouName,account.tenantId,pool);
  const result = await pool.query(`INSERT INTO public.operating_unit(
    name, country_id, account_id, tenant_id, created_by, updated_by, created_at, updated_at, is_active, is_deleted)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning id`,[ouName,country.id,account.id,orgId,1,1,new Date(),new Date(),true,false]);
  const ouId = result.rows[0].id;
  await updateOrganization(orgId,ouId,pool);
  return {
    id: ouId,
    tenantId: orgId
  };
};

const updateSite = async (oldSite,newSite,mflCode,account,ou, countryId, pool) => {
  const existingSite = await pool.query(`select id, tenant_id from site where name = $1 and is_active =true and is_deleted = false and country_id = $2`,[oldSite, countryId]);
  const existingSiteId = existingSite.rows[0].id;
  const existingSiteTenantId = existingSite.rows[0].tenant_id;
  await pool.query(`UPDATE public.organization SET name = $1, parent_organization_id = $2, tenant_id =$3 WHERE id = $4`,[
    newSite,ou.tenantId,ou.tenantId,existingSiteTenantId
  ]);
  await pool.query(`UPDATE public.site SET name = $1, account_id = $2, operating_unit_id =$3, mfl_code = $4 WHERE id = $5`,[
    newSite,account.id,ou.id,mflCode,existingSiteId
  ]);
  return {
    id: existingSiteId,
    tenantId: existingSiteTenantId
  };
};


const deleteAccount = async (accountName,countryId,pool) => {
  const account = await pool.query(`select id, tenant_id from account where name = $1 and is_active =true and is_deleted = false and country_id = $2`,[accountName, countryId]);
  const accountId = account.rows[0].id;
  const accountTenantId = account.rows[0].tenant_id;
  await pool.query(`UPDATE public.organization SET is_active = $1, is_deleted = $2 WHERE id = $3`,[
    false,true,accountTenantId
  ]);
  await pool.query(`UPDATE public.account SET is_active = $1, is_deleted = $2 WHERE id = $3`,[
    false,true,accountId
  ]);
  return {
    id: accountId,
    tenantId: accountTenantId
  };
};

const deleteOu = async (ouName,countryId,pool) => {
  const ou = await pool.query(`select id, tenant_id from operating_unit where name = $1 and is_active =true and is_deleted = false and country_id = $2`,[ouName,countryId]);
  const ouId = ou.rows[0].id;
  const ouTenantId = ou.rows[0].tenant_id;
  await pool.query(`UPDATE public.organization SET is_active = $1, is_deleted = $2 WHERE id = $3`,[
    false,true,ouTenantId
  ]);
  await pool.query(`UPDATE public.operating_unit SET is_active = $1, is_deleted = $2 WHERE id = $3`,[
    false,true,ouId
  ]);
  return {
    id: ouId,
    tenantId: ouTenantId
  };
};

const deleteSite = async (siteName,countryId,pool) => {
  const site = await pool.query(`select id, tenant_id from site where name = $1 and is_active =true and is_deleted = false and country_id = $2`,[siteName,countryId]);
  const siteId = site.rows[0].id;
  const siteTenantId = site.rows[0].tenant_id;
  await pool.query(`UPDATE public.organization SET is_active = $1, is_deleted = $2 WHERE id = $3`,[
    false,true,siteTenantId
  ]);
  await pool.query(`UPDATE public.site SET is_active = $1, is_deleted = $2 WHERE id = $3`,[
    false,true,siteId
  ]);
  return {
    id: siteId,
    tenantId: siteTenantId
  };
};

const deleteUser = async (userName,countryId,pool) => {
  const user = await pool.query(`select id, tenant_id from "user" where username = $1 and is_active =true and is_deleted = false and country_id = $2`,[userName,countryId]);
  const userId = user.rows[0].id;
  const userTenantId = user.rows[0].tenant_id;
  await pool.query(`update "user" set is_active = false and is_deleted = true where id = $1`,[userId]);
  return {
    id: userId,
    tenantId: userTenantId
  };
};

module.exports = {
  createAccount,createOU,createOrganization,updateSite,deleteAccount,deleteOu,deleteSite,deleteUser
}
