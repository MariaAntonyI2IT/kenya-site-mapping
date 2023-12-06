const transferSiteUsers = async (oldSite,site,pool) => {
  const userDetails = (await pool.query(`  
  select u.id, u.username, u.tenant_id from "user" u
  inner join site s on s.tenant_id =u.tenant_id 
  where s.name = $1 and s.is_active =true and s.is_deleted= false`,[oldSite])).rows;
  if(userDetails.length) {
    await transferUsers(userDetails,site,pool);
  } else {
    console.log(`No Users found`);
  }
};

const transferUsers = async (userDetails,site,pool) => {
  for(const user of userDetails) {
    console.log(`updating user related details`);
    await pool.query(`update "user" set tenant_id = $1 where id = $2`,[site.tenantId,user.id]);
    await pool.query(`update user_organization set organization_id = $1 where organization_id = $2 `,[site.tenantId,user.tenant_id]);
    await pool.query(`update device_details set tenant_id = $1 where tenant_id = $2`,[site.tenantId,user.tenant_id]);
    console.log(`updated user related details`);
  }
};

module.exports = {
  transferSiteUsers
};