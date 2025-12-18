const mysql = require('mysql2/promise');
require('dotenv').config();

// 创建数据库连接池
let pool;

try {
  // 获取环境变量
  const {
    DB_HOST = 'localhost',
    DB_USER = 'root',
    DB_PASSWORD = '123456',
    DB_NAME = 'soulp',
    DB_PORT = 3306
  } = process.env;
  
  console.log('正在连接到数据库...');
  console.log(`数据库信息: ${DB_HOST}:${DB_PORT}/${DB_NAME}`);
  
  // 创建连接池
  pool = mysql.createPool({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    port: DB_PORT,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });
  
  console.log('数据库连接池已创建');
  
  // 测试连接
  pool.query('SELECT 1')
    .then(() => {
      console.log('数据库连接测试成功!');
    })
    .catch(err => {
      console.error('数据库连接测试失败:', err);
    });
    
} catch (err) {
  console.error('初始化数据库连接失败:', err);
  process.exit(1); // 致命错误，退出应用
}

module.exports = { pool };