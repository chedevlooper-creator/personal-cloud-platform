const postgres = require('postgres');
const sql = postgres('postgres://postgres:postgres@localhost:5432/pcp');
sql`SELECT 1`.then(console.log).catch(console.error).finally(() => sql.end());
