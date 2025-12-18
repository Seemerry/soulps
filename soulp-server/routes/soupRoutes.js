const express = require('express');
const router = express.Router();
const db = require('../db');

// 获取所有汤
router.get('/', async (req, res) => {
  try {
    // 获取查询参数
    const { query, tag, rating, sortBy = 'created_at', orderBy = 'desc', limit = 20, page = 1 } = req.query;
    
    // 计算偏移量用于分页
    const offset = (page - 1) * limit;
    
    // 构建基础SQL查询
    let sql = `
      SELECT s.*, u.nickname as author_name 
      FROM soup s
      LEFT JOIN users u ON s.author_id = u.id
    `;
    
    // 添加搜索条件
    const conditions = [];
    const params = [];
    
    if (query) {
      conditions.push('(s.title LIKE ? OR s.puzzle_prompt LIKE ?)');
      params.push(`%${query}%`, `%${query}%`);
    }
    
    if (tag) {
      sql += ' JOIN soup_tag st ON s.id = st.soup_id JOIN tags t ON st.tag_id = t.id';
      conditions.push('t.name = ?');
      params.push(tag);
    }
    
    if (rating) {
      conditions.push('s.content_rating = ?');
      params.push(rating);
    }
    
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    
    // 添加排序
    sql += ` ORDER BY s.${sortBy} ${orderBy}`;
    
    // 添加分页
    sql += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    // 执行查询
    const [soups] = await db.pool.query(sql, params);
    
    // 获取总数量（用于分页）
    let countSql = 'SELECT COUNT(*) as total FROM soup s';
    
    if (tag) {
      countSql += ' JOIN soup_tag st ON s.id = st.soup_id JOIN tags t ON st.tag_id = t.id';
    }
    
    if (conditions.length > 0) {
      countSql += ' WHERE ' + conditions.join(' AND ');
    }
    
    const [countResult] = await db.pool.query(countSql, params.slice(0, params.length - 2));
    const total = countResult[0].total;
    
    // 返回数据
    res.json({
      soups,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('获取汤列表错误:', err);
    res.status(500).json({ 
      error: '获取汤列表失败',
      details: err.message
    });
  }
});

// 获取所有标签
router.get('/tags', async (req, res) => {
  try {
    const [tags] = await db.pool.query('SELECT * FROM tags ORDER BY name');
    res.json(tags);
  } catch (err) {
    console.error('获取标签列表错误:', err);
    res.status(500).json({ error: '获取标签列表失败' });
  }
});

// 获取用户创建的海龟汤列表
router.get('/user/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const { limit = 20, page = 1 } = req.query;
    
    // 计算偏移量用于分页
    const offset = (page - 1) * limit;
    
    // 构建SQL查询获取用户创建的汤
    const sql = `
      SELECT s.*, u.nickname as author_name 
      FROM soup s
      LEFT JOIN users u ON s.author_id = u.id
      WHERE s.author_id = ?
      ORDER BY s.created_at DESC
      LIMIT ? OFFSET ?
    `;
    
    // 执行查询
    const [soups] = await db.pool.query(sql, [userId, parseInt(limit), parseInt(offset)]);
    
    // 获取总数量
    const [countResult] = await db.pool.query(
      'SELECT COUNT(*) as total FROM soup WHERE author_id = ?', 
      [userId]
    );
    const total = countResult[0].total;
    
    // 返回数据
    res.json({
      soups,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('获取用户海龟汤列表错误:', err);
    res.status(500).json({ 
      error: '获取用户海龟汤列表失败',
      details: err.message
    });
  }
});

// 获取单个汤的详情
router.get('/:id', async (req, res) => {
  try {
    const soupId = req.params.id;
    
    // 获取汤的基本信息
    const [soups] = await db.pool.query(`
      SELECT s.*, u.nickname as author_name 
      FROM soup s
      LEFT JOIN users u ON s.author_id = u.id
      WHERE s.id = ?
    `, [soupId]);
    
    if (soups.length === 0) {
      return res.status(404).json({ error: '海龟汤不存在' });
    }
    
    const soup = soups[0];
    
    // 获取汤的标签
    const [tags] = await db.pool.query(`
      SELECT t.* 
      FROM tags t
      JOIN soup_tag st ON t.id = st.tag_id
      WHERE st.soup_id = ?
    `, [soupId]);
    
    // 返回完整数据
    res.json({
      ...soup,
      tags
    });
  } catch (err) {
    console.error('获取汤详情错误:', err);
    res.status(500).json({ error: '获取汤详情失败' });
  }
});

// 创建新的汤
router.post('/', async (req, res) => {
  try {
    const { title, puzzle_prompt, solution, content_rating, tags } = req.body;
    const userId = req.user?.id; // 从JWT获取用户ID
    
    if (!userId) {
      return res.status(401).json({ error: '未授权，请先登录' });
    }
    
    if (!title || !puzzle_prompt || !solution) {
      return res.status(400).json({ error: '标题、谜题和解答不能为空' });
    }
    
    // 创建汤
    const [result] = await db.pool.query(
      'INSERT INTO soup (title, puzzle_prompt, solution, content_rating, author_id, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
      [title, puzzle_prompt, solution, content_rating, userId]
    );
    
    const soupId = result.insertId;
    
    // 如果有标签，添加标签关联
    if (tags && Array.isArray(tags) && tags.length > 0) {
      const tagValues = tags.map(tagId => [soupId, tagId]);
      await db.pool.query(
        'INSERT INTO soup_tag (soup_id, tag_id) VALUES ?',
        [tagValues]
      );
    }
    
    res.status(201).json({
      message: '海龟汤创建成功',
      soupId
    });
  } catch (err) {
    console.error('创建汤错误:', err);
    res.status(500).json({ error: '创建海龟汤失败' });
  }
});

// 更新汤信息
router.put('/:id', async (req, res) => {
  // ... existing code ...
});

// 删除汤
router.delete('/:id', async (req, res) => {
  try {
    // 验证用户身份
    const userId = req.user ? req.user.id : null;
    if (!userId) {
      return res.status(401).json({ error: '未授权的操作' });
    }
    
    const soupId = req.params.id;
    
    // 先验证该汤是否属于当前用户
    const [soupResult] = await db.pool.query(
      'SELECT author_id FROM soup WHERE id = ?',
      [soupId]
    );
    
    if (soupResult.length === 0) {
      return res.status(404).json({ error: '海龟汤不存在' });
    }
    
    console.log('删除海龟汤 - 用户ID比较:', {
      requestUserId: userId,
      requestUserIdType: typeof userId,
      soupAuthorId: soupResult[0].author_id,
      soupAuthorIdType: typeof soupResult[0].author_id
    });
    
    // 检查是否是作者 - 确保类型一致，转换为整数进行比较
    const requestUserId = parseInt(userId, 10);
    const authorId = parseInt(soupResult[0].author_id, 10);
    
    if (authorId !== requestUserId) {
      return res.status(403).json({ 
        error: '无权限删除此海龟汤',
        details: `请求用户ID ${requestUserId} 与作者ID ${authorId} 不匹配`
      });
    }
    
    // 开始事务
    const connection = await db.pool.getConnection();
    await connection.beginTransaction();
    
    try {
      // 先删除标签关联
      await connection.query(
        'DELETE FROM soup_tag WHERE soup_id = ?',
        [soupId]
      );
      
      // 注意：soup_rating表不存在，因此不再尝试删除评分记录
      
      // 删除汤
      const [deleteResult] = await connection.query(
        'DELETE FROM soup WHERE id = ?',
        [soupId]
      );
      
      // 提交事务
      await connection.commit();
      
      res.json({ 
        success: true, 
        message: '海龟汤删除成功',
        deleted: deleteResult.affectedRows > 0
      });
    } catch (err) {
      // 回滚事务
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('删除海龟汤错误:', err);
    res.status(500).json({ 
      error: '删除海龟汤失败',
      details: err.message
    });
  }
});

module.exports = router; 