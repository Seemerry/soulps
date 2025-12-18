const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

async function initializeDatabase() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'soulp_game'  // 直接使用现有数据库
  });

  try {
    // 读取并执行SQL文件
    const sqlPath = path.join(__dirname, 'init.sql');
    const sqlContent = await fs.readFile(sqlPath, 'utf8');
    
    // 分割SQL语句并执行
    const statements = sqlContent.split(';').filter(stmt => stmt.trim());
    for (let statement of statements) {
      if (statement.trim()) {
        await connection.query(statement);
        console.log('执行SQL语句成功');
      }
    }
    
    console.log('数据库初始化成功！');
  } catch (error) {
    console.error('数据库初始化失败:', error);
    console.error('具体错误:', error.message);
  } finally {
    await connection.end();
  }
}

initializeDatabase(); 