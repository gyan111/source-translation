import mysql from 'mysql2/promise';

let pool = null;
let isConnected = false;
let isConnecting = false;
let retryTimer = null;
let lastConnectionError = null;

function scheduleRetry() {
  if (retryTimer || isConnected) return;
  retryTimer = setTimeout(async () => {
    retryTimer = null;
    if (!isConnected) {
      console.log('[Database] Retrying connection to MySQL/MariaDB...');
      await initDatabase();
    }
  }, 15000);
}

/**
 * Initializes MySQL / MariaDB connection pool and ensures the required tables exist.
 */
export async function initDatabase() {
  if (isConnecting) return;
  isConnecting = true;

  const host = process.env.DB_HOST || 'localhost';
  const user = process.env.DB_USER || process.env.TOOL_TOOLSDB_USER || 'root';
  const password = process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : (process.env.TOOL_TOOLSDB_PASSWORD || '');
  const database = process.env.DB_NAME || 'source_translation';
  const port = parseInt(process.env.DB_PORT || '3306', 10);

  const isRemoteOrToolforge = host.includes('wikimedia.cloud') || Boolean(process.env.TOOL_TOOLSDB_USER) || host !== 'localhost';

  try {
    // 1. Create database check only in local development (Toolforge databases are managed by tool accounts)
    if (!isRemoteOrToolforge) {
      try {
        const tempConn = await mysql.createConnection({
          host,
          user,
          password,
          port,
          connectTimeout: 5000,
        });
        await tempConn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
        await tempConn.end();
      } catch (dbCreateErr) {
        console.info(`[Database] Skipping CREATE DATABASE check: ${dbCreateErr.message}`);
      }
    }

    // 2. Initialize pool
    if (!pool) {
      pool = mysql.createPool({
        host,
        user,
        password,
        database,
        port,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        charset: 'utf8mb4',
        connectTimeout: 10000,
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000,
      });
    }

    // Test connection
    const connection = await pool.getConnection();
    try {
      isConnected = true;
      lastConnectionError = null;
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      console.log(`[Database] Connected successfully to MySQL/MariaDB (${database}@${host}:${port})`);

      // 3. Create translation_events table
      const createTableQuery = `
        CREATE TABLE IF NOT EXISTS translation_events (
          id INT AUTO_INCREMENT PRIMARY KEY,
          session_id VARCHAR(64) NULL,
          wiki_user VARCHAR(255) DEFAULT 'anonymous',
          event_type VARCHAR(50) NOT NULL,
          source_lang VARCHAR(10) NOT NULL,
          target_lang VARCHAR(10) NOT NULL,
          source_title VARCHAR(255) NOT NULL,
          target_title VARCHAR(255) NULL,
          word_count INT DEFAULT 0,
          char_count INT DEFAULT 0,
          section_count INT DEFAULT 0,
          mt_engine VARCHAR(50) DEFAULT 'google',
          target_namespace VARCHAR(50) NULL,
          revision_id BIGINT UNSIGNED NULL,
          metadata JSON NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_event_type (event_type),
          INDEX idx_target_lang (target_lang),
          INDEX idx_created_at (created_at),
          INDEX idx_wiki_user (wiki_user)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `;

      await connection.query(createTableQuery);
      console.log('[Database] Schema verified: `translation_events` table is ready.');
    } finally {
      connection.release();
    }
  } catch (error) {
    isConnected = false;
    lastConnectionError = error.message;
    console.warn(`[Database] Warning: Could not connect to MySQL/MariaDB (${error.message}). Analytics will run in memory mode and retry in background.`);
    scheduleRetry();
  } finally {
    isConnecting = false;
  }
}

/**
 * Executes a query with params.
 * @param {string} sql
 * @param {Array} params
 * @returns {Promise<any>}
 */
export async function query(sql, params = []) {
  if (!pool || !isConnected) {
    return [];
  }
  const [rows] = await pool.query(sql, params);
  return rows;
}

export function isDatabaseConnected() {
  return isConnected;
}

export function getDatabaseError() {
  return lastConnectionError;
}

export async function tryReconnect() {
  if (!isConnected && !isConnecting) {
    await initDatabase();
  }
  return isConnected;
}
