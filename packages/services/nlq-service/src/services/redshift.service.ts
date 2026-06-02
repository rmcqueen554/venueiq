import { Pool } from 'pg';
import { logger } from '@venueiq/shared-utils';

const pool = new Pool({
  connectionString: process.env.REDSHIFT_URL ?? process.env.TENANTS_DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export const redshiftService = {
  async executeQuery(sql: string, tenantId: string): Promise<{ rows: unknown[]; duration_ms: number }> {
    const start = Date.now();
    const client = await pool.connect();

    try {
      // Set session-level tenant context (double-layer RLS)
      await client.query(`SET app.tenant_id = '${tenantId.replace(/'/g, "''")}'`);

      const result = await client.query(sql);
      const duration_ms = Date.now() - start;

      logger.debug({ rows: result.rowCount, duration_ms }, 'Redshift query executed');
      return { rows: result.rows, duration_ms };
    } catch (err: any) {
      logger.error({ err, sql: sql.substring(0, 200) }, 'Redshift query failed');
      throw new Error(`Query failed: ${err.message}`);
    } finally {
      client.release();
    }
  },

  async isHealthy(): Promise<boolean> {
    try {
      await pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  },
};
