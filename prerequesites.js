require('dotenv').config();
const {pool} = require('./common/db');
const {mkdirSync,existsSync} = require('fs');

async function main() {
  try {
    if(!existsSync('report')) mkdirSync('report');
    await pool.query('BEGIN');
    const updateTenant = await pool.query(`update "user"
    set tenant_id = null
    where id in (select distinct(u.id) from "user" u
    inner join user_role ur on u.id = ur.user_id
    inner join role r on r.id = ur.role_id 
    where r.name in ('SUPER_USER', 'SUPER_ADMIN') and u.tenant_id is not null
    )`);
    console.log(`Updated tenant ${updateTenant.rowCount}`)
    const users = await pool.query(`select u.id, u.tenant_id from "user" u
    inner join site s on s.tenant_id =u.tenant_id 
    inner join operating_unit ou on ou.id =s.operating_unit_id 
    inner join account acc on acc.id =s.account_id 
    where u.is_active = true and u.is_deleted = false
    and s.is_active = true and s.is_deleted = false
    and ou.is_active = true and ou.is_deleted = false 
    and acc.is_active = true and acc.is_deleted = false and u.tenant_id is not null
    order by u.id asc`);
    for(const user of users.rows) {
      process.stdout.write('\033[0G');
      process.stdout.write(`Validating user ${user.id}`);
      const user_organization = await pool.query(`select * from user_organization where user_id = $1 and organization_id = $2`,[user.id,user.tenant_id]);
      if(!user_organization.rows.length) {
        console.log(user);
        const user_org = await pool.query(`select user_id, organization_id from user_organization where user_id = $1`,[user.id]);
        await pool.query(`update "user" set tenant_id = $1 where id = $2`,[user_org.rows[0].organization_id,user.id]);
        console.log(`Updated deafult organization ${user.id}`);
      }
    }
    console.log('\n');
    await pool.query('COMMIT');
  } catch(ex) {
    console.log(ex);
    await pool.query('ROLLBACK')
  } finally {
    pool.end();
  }
}



main();