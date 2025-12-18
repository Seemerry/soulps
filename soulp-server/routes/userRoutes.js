//用户注册代码
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const router = express.Router();

// 注册接口
router.post('/register', async (req, res) => {
  try {
    const { nickname, account, password } = req.body;

    // 字段验证（修正变量名）
    if (!nickname || !account || !password) {
      return res.status(400).json({ error: '昵称、账号和密码必填' });
    }

    // 密码强度验证
    if (password.length < 8) {
      return res.status(400).json({ error: '密码至少需要8个字符' });
    }

    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 修正插入语句字段（匹配数据库表结构）
    const [result] = await db.pool.query(
      'INSERT INTO users (nickname, account, password) VALUES (?, ?, ?)',
      [nickname, account, hashedPassword]
    );

    const userId = result.insertId;
    
    // 生成JWT令牌
    const token = jwt.sign(
      { 
        id: userId,
        account: account 
      },
      process.env.JWT_SECRET,
      { 
        expiresIn: process.env.JWT_EXPIRES || '1h',
        algorithm: 'HS256' 
      }
    );

    res.json({ 
      message: '注册成功',
      token,
      user: {
        id: userId,
        nickname,
        account,
        created_at: new Date().toISOString()
      }
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: '账号已存在' });
    }
    res.status(500).json({ error: '服务器错误' });
  }
});

// 登录接口修正（补全try/catch）
router.post('/login', async (req, res) => {
  try {
    const { account, password } = req.body;
    
    const [results] = await db.pool.query(
      'SELECT id, nickname, account, password FROM users WHERE account = ?',
      [account]
    );

    if (results.length === 0) {
      return res.status(401).json({ error: '用户不存在' });
    }

    const user = results[0];
    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) {
      return res.status(401).json({ error: '密码错误' });
    }

    const token = jwt.sign(
      { 
        id: user.id,
        account: user.account 
      },
      process.env.JWT_SECRET,
      { 
        expiresIn: process.env.JWT_EXPIRES || '1h',
        algorithm: 'HS256' 
      }
    );

    res.json({ 
      token,
      userInfo: {
        id: user.id,
        nickname: user.nickname,
        account: user.account
      }
    });
  } catch (err) {
    console.error('登录错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取用户详情
router.get('/profile', async (req, res) => {
  try {
    console.log('收到获取用户详情请求');
    console.log('请求头:', req.headers);
    console.log('用户对象:', req.user);
    
    // 通过JWT中的用户ID获取用户信息
    const userId = req.user?.id;
    
    // 如果找不到用户ID，尝试从请求头手动解析token
    if (!userId) {
      console.log('未能从req.user获取用户ID，尝试手动解析token');
      const authHeader = req.headers.authorization;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const token = authHeader.substring(7);
          console.log('从请求头提取的Token:', token.substring(0, 15) + '...');
          
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          console.log('手动解析的Token内容:', decoded);
          
          if (decoded && decoded.id) {
            console.log('成功从Token中提取用户ID:', decoded.id);
            req.user = decoded;
          } else {
            console.error('Token解析成功但没有用户ID');
            return res.status(401).json({ error: '未授权，Token不包含用户ID' });
          }
        } catch (tokenErr) {
          console.error('手动解析Token失败:', tokenErr);
          return res.status(401).json({ error: '未授权，Token无效', details: tokenErr.message });
        }
      } else {
        console.error('未找到Authorization请求头或格式不正确');
        return res.status(401).json({ error: '未授权，请先登录' });
      }
    }
    
    // 到这里，我们应该有req.user.id了
    const userIdToUse = req.user.id;
    console.log('将使用用户ID进行查询:', userIdToUse);

    // 获取用户基本信息，不包含密码
    const [users] = await db.pool.query(
      'SELECT id, nickname, account, puzzle_score, hosting_score, creation_score, created_at FROM users WHERE id = ?',
      [userIdToUse]
    );
    
    if (users.length === 0) {
      console.error('未找到用户数据，用户ID:', userIdToUse);
      return res.status(404).json({ error: '用户不存在' });
    }
    
    const user = users[0];
    console.log('获取到用户数据:', user);
    
    // 获取用户创建的汤的数量
    const [soupCountResult] = await db.pool.query(
      'SELECT COUNT(*) as count FROM soup WHERE author_id = ?',
      [userIdToUse]
    );
    
    // 获取用户参与的房间数量
    const [roomCountResult] = await db.pool.query(
      'SELECT COUNT(DISTINCT room_id) as count FROM room_participants WHERE user_id = ?',
      [userIdToUse]
    );
    
    // 获取用户创建的房间数量
    const [hostRoomCountResult] = await db.pool.query(
      'SELECT COUNT(*) as count FROM rooms WHERE host_id = ?',
      [userIdToUse]
    );
    
    // 整合所有数据
    const userData = {
      ...user,
      soupCount: soupCountResult[0].count || 0,
      joinedRoomCount: roomCountResult[0].count || 0,
      hostRoomCount: hostRoomCountResult[0].count || 0,
      // 计算总分
      totalScore: (user.puzzle_score || 0) + (user.hosting_score || 0) + (user.creation_score || 0)
    };
    
    console.log('返回用户完整数据:', userData);
    res.json(userData);
  } catch (err) {
    console.error('获取用户详情失败:', err);
    res.status(500).json({ error: '获取用户详情失败', details: err.message });
  }
});

module.exports = router;
