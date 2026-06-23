import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import neo4j from 'neo4j-driver';

/**
 * Neo4j 连接模块
 *
 * 用于：技能知识图谱
 */
const NEO4J_DRIVER = 'NEO4J_DRIVER';

@Global()
@Module({
  providers: [
    {
      provide: NEO4J_DRIVER,
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        try {
          const driver = neo4j.driver(
            config.get('NEO4J_URI', 'bolt://127.0.0.1:7687'),
            neo4j.auth.basic(
              config.get('NEO4J_USER', 'neo4j'),
              config.get('NEO4J_PASSWORD', 'neo4j123'),
            ),
          );
          await driver.verifyConnectivity();
          console.log('[Neo4j] Connected to', config.get('NEO4J_URI'));
          return driver;
        } catch (err: any) {
          console.warn('[Neo4j] Connection failed, graph features disabled:', err.message);
          return null;
        }
      },
    },
  ],
  exports: [NEO4J_DRIVER],
})
export class Neo4jModule {}

export { NEO4J_DRIVER };
