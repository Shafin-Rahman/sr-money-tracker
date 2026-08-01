import pg from 'pg';
import config from '../config.js';

const { Pool } = pg;

const poolConfig = {
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
};

if (config.databaseUrl) {
  poolConfig.connectionString = config.databaseUrl;
}

const pool = new Pool(poolConfig);

function toPg(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

export async function get(sql, ...params) {
  const result = await pool.query(toPg(sql), params);
  return result.rows[0] ?? null;
}

export async function all(sql, ...params) {
  const result = await pool.query(toPg(sql), params);
  return result.rows;
}

export async function run(sql, ...params) {
  const result = await pool.query(toPg(sql), params);
  return result;
}

export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const tx = {
      get: async (sql, ...params) => {
        const r = await client.query(toPg(sql), params);
        return r.rows[0] ?? null;
      },
      all: async (sql, ...params) => {
        const r = await client.query(toPg(sql), params);
        return r.rows;
      },
      run: (sql, ...params) => client.query(toPg(sql), params),
    };
    const result = await fn(tx);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export function getPool() {
  return pool;
}
