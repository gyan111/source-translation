import mysql from 'mysql2/promise';

let pool = null;
let isConnected = false;

/**
 * Initializes MySQL / MariaDB connection pool and ensures the required tables exist.
 */
export async function initDatabase() {
  const host = process.env.DB_HOST || 'localhost';
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'source_translation';
  const port = parseInt(process.env.DB_PORT || '3306', 10);

  try {
    // 1. Create connection without database first to ensure DB exists if permitted
    try {
      const tempConn = await mysql.createConnection({
        host,
        user,
        password,
        port,
      });
      await tempConn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
      await tempConn.end();
    } catch (dbCreateErr) {
      // In restricted environments like Toolforge, database already exists and user may not have CREATE DATABASE permission
      console.info(`[Database] Skipping CREATE DATABASE check: ${dbCreateErr.message}`);
    }

    // 2. Initialize pool
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
    });

    // Test connection
    const connection = await pool.getConnection();
    isConnected = true;
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
    connection.release();
    console.log('[Database] Schema verified: `translation_events` table is ready.');
  } catch (error) {
    isConnected = false;
    console.warn(`[Database] Warning: Could not connect to MySQL/MariaDB (${error.message}). Analytics will run gracefully in silent mode until DB is configured.`);
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
