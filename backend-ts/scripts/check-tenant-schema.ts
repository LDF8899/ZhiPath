import dataSource from '../src/database/data-source';

/** Fail CI/deploy when a user-owned MySQL table is missing an explicit tenant boundary. */
async function main() {
  await dataSource.initialize();
  try {
    const missing = await dataSource.query(`
      SELECT DISTINCT c.table_name AS tableName
      FROM information_schema.columns c
      WHERE c.table_schema = DATABASE()
        AND c.column_name = 'user_id'
        AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns t
          WHERE t.table_schema = c.table_schema
            AND t.table_name = c.table_name
            AND t.column_name = 'tenant_id'
        )
      ORDER BY c.table_name
    `);
    if (missing.length) {
      throw new Error(`缺少 tenant_id 的用户表: ${missing.map((row: any) => row.tableName).join(', ')}`);
    }

    const requiredForeignKeys = [
      ['learning_plans_v3', 'fk_learning_plans_tenant'],
      ['learning_branches_v3', 'fk_learning_branches_v3_tenant'],
      ['learning_commits_v3', 'fk_learning_commits_v3_tenant'],
      ['learning_tasks_v3', 'fk_learning_tasks_v3_tenant'],
      ['learning_sessions_v3', 'fk_learning_sessions_v3_tenant'],
    ];
    const constraints = await dataSource.query(`
      SELECT table_name AS tableName, constraint_name AS constraintName
      FROM information_schema.table_constraints
      WHERE constraint_schema = DATABASE() AND constraint_type = 'FOREIGN KEY'
    `);
    const set = new Set(constraints.map((row: any) => `${row.tableName}:${row.constraintName}`));
    const missingKeys = requiredForeignKeys
      .filter(([table, key]) => !set.has(`${table}:${key}`))
      .map(([table, key]) => `${table}.${key}`);
    if (missingKeys.length) throw new Error(`关键租户外键缺失: ${missingKeys.join(', ')}`);

    console.log(`租户 schema 检查通过：${constraints.length} 个外键，所有用户表均含 tenant_id`);
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
