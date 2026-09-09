import { MigrationInterface, QueryRunner } from 'typeorm';

export class ConfigureClientNavigation1788867000003 implements MigrationInterface {
  name = 'ConfigureClientNavigation1788867000003';

  async up(queryRunner: QueryRunner): Promise<void> {
    const configs: Array<[string, string, Record<string, unknown>]> = [
      ['zhipath-web', 'dashboard', { label: '学习首页', route: '/user/home', order: 10 }],
      ['zhipath-web', 'learning-paths', { label: '学习路径', route: '/user/learning-path', order: 20 }],
      ['zhipath-web', 'assessment', { label: '能力测评', route: '/user/exam', order: 30 }],
      ['zhipath-web', 'remediation', { label: '智能补弱', route: '/user/remediation', order: 40 }],
      ['codenova-web', 'dashboard', { label: '今日学习', route: '/today', order: 10 }],
      ['codenova-web', 'learning-paths', { label: '成长路线', route: '/paths', order: 20 }],
      ['codenova-web', 'assessment', { label: '能力校准', route: '/assessment', order: 30 }],
      ['codenova-web', 'remediation', { label: '智能补弱', route: '/remediation', order: 40 }],
    ];
    for (const [clientKey, featureKey, config] of configs) {
      await queryRunner.query(
        `UPDATE client_features f JOIN client_apps c ON c.id = f.client_app_id
            SET f.config_json = ?
          WHERE c.client_key = ? AND f.feature_key = ?`,
        [JSON.stringify(config), clientKey, featureKey],
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('UPDATE client_features SET config_json = JSON_OBJECT()');
  }
}
