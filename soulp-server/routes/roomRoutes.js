const express = require('express');
const router = express.Router();
const db = require('../db');

// 获取所有房间
router.get('/', async (req, res) => {
  try {
    // 先尝试一个简单的查询
    const [rooms] = await db.pool.query('SELECT * FROM rooms');
    console.log('查询到的房间:', rooms); // 添加日志
    res.json(rooms);
  } catch (err) {
    console.error('获取房间列表错误:', err);
    res.status(500).json({ 
      error: '获取房间列表失败',
      details: err.message  // 添加详细错误信息
    });
  }
});

// 创建新房间
router.post('/', async (req, res) => {
  try {
    console.log('接收到创建房间请求:', req.body);
    
    const { name, isPrivate, password, hostNickname } = req.body;
    const userId = req.user?.id; // 从JWT获取用户ID
    
    // 基本验证
    if (!name || name.trim() === '') {
      console.log('创建房间失败: 房间名称不能为空');
      return res.status(400).json({ error: '房间名称不能为空' });
    }

    if (name.length > 20) {
      console.log('创建房间失败: 房间名称不能超过20个字符');
      return res.status(400).json({ error: '房间名称不能超过20个字符' });
    }

    if (isPrivate && (!password || password.trim() === '')) {
      console.log('创建房间失败: 私密房间需要设置密码');
      return res.status(400).json({ error: '私密房间需要设置密码' });
    }

    // 暂时使用模拟的用户ID
    const hostId = userId || 1; // 如果没有用户ID，使用1（测试用）

    console.log('开始创建房间...', {
      name,
      hostId,
      isPrivate: isPrivate ? 1 : 0,
      hasPassword: isPrivate && password ? true : false
    });

    // 插入房间数据
    const [result] = await db.pool.query(
      'INSERT INTO rooms (name, host_id, is_private, password, created_at) VALUES (?, ?, ?, ?, NOW())',
      [name, hostId, isPrivate ? 1 : 0, isPrivate ? password : null]
    );

    if (!result || !result.insertId) {
      console.error('房间创建失败: MySQL未返回insertId');
      return res.status(500).json({ error: '创建房间失败，数据库操作异常' });
    }

    console.log('房间创建成功:', result);
    
    // 返回成功消息和房间ID
    res.status(201).json({
      message: '房间创建成功',
      roomId: result.insertId,
      name: name,
      hostId: hostId,
      isPrivate: isPrivate ? true : false
    });
  } catch (err) {
    console.error('创建房间错误:', err);
    // 返回更详细的错误信息
    res.status(500).json({ 
      error: '创建房间失败，请稍后再试',
      details: err.message || '未知错误'
    });
  }
});

// 获取特定房间信息
router.get('/:id', async (req, res) => {
  try {
    const roomId = req.params.id;
    const [rooms] = await db.pool.query('SELECT * FROM rooms WHERE id = ?', [roomId]);
    
    if (rooms.length === 0) {
      return res.status(404).json({ error: '房间不存在' });
    }
    
    res.json(rooms[0]);
  } catch (err) {
    console.error('获取房间详情错误:', err);
    res.status(500).json({ error: '获取房间详情失败' });
  }
});

// 删除房间（关闭房间）
router.delete('/:id', async (req, res) => {
  try {
    const roomId = req.params.id;
    const userId = req.user?.id || 1; // 从JWT获取用户ID，如果没有则使用1（测试用）
    
    // 首先检查房间是否存在
    const [rooms] = await db.pool.query('SELECT * FROM rooms WHERE id = ?', [roomId]);
    
    if (rooms.length === 0) {
      return res.status(404).json({ error: '房间不存在' });
    }
    
    const room = rooms[0];
    
    // 检查当前用户是否是房主
    // 注意：在实际应用中应该验证用户身份，这里简化处理
    // if (room.host_id !== userId) {
    //   return res.status(403).json({ error: '只有房主可以关闭房间' });
    // }
    
    // 删除房间
    const [result] = await db.pool.query('DELETE FROM rooms WHERE id = ?', [roomId]);
    
    if (result.affectedRows === 0) {
      return res.status(500).json({ error: '房间删除失败' });
    }
    
    console.log('房间删除成功，房间ID:', roomId);
    
    res.json({
      message: '房间已成功关闭',
      roomId: roomId
    });
  } catch (err) {
    console.error('删除房间错误:', err);
    res.status(500).json({ error: '删除房间失败，请稍后再试' });
  }
});

// 用户加入房间
router.put('/:id/join', async (req, res) => {
  try {
    const roomId = req.params.id;
    const { nickname } = req.body;
    
    if (!nickname) {
      return res.status(400).json({ error: '缺少用户昵称参数' });
    }
    
    console.log(`用户 ${nickname} 尝试加入房间 ${roomId}`);
    
    // 检查房间是否存在
    const [rooms] = await db.pool.query('SELECT * FROM rooms WHERE id = ?', [roomId]);
    
    if (rooms.length === 0) {
      return res.status(404).json({ error: '房间不存在' });
    }
    
    // 更新房间人数逻辑
    // 获取当前房间玩家数
    const room = rooms[0];
    const currentPlayers = room.player_count || 0;
    const maxPlayers = room.max_players || 8;
    
    // 检查房间是否已满
    if (currentPlayers >= maxPlayers) {
      return res.status(400).json({ error: '房间已满' });
    }
    
    // 更新房间玩家数量
    const newPlayerCount = currentPlayers + 1;
    await db.pool.query('UPDATE rooms SET player_count = ? WHERE id = ?', [newPlayerCount, roomId]);
    
    res.json({
      message: '成功加入房间',
      roomId,
      playerCount: newPlayerCount
    });
  } catch (err) {
    console.error('加入房间错误:', err);
    res.status(500).json({ error: '加入房间失败' });
  }
});

// 用户离开房间
router.put('/:id/leave', async (req, res) => {
  try {
    const roomId = req.params.id;
    const { nickname } = req.body;
    
    if (!nickname) {
      return res.status(400).json({ error: '缺少用户昵称参数' });
    }
    
    console.log(`用户 ${nickname} 离开房间 ${roomId}`);
    
    // 检查房间是否存在
    const [rooms] = await db.pool.query('SELECT * FROM rooms WHERE id = ?', [roomId]);
    
    if (rooms.length === 0) {
      return res.status(404).json({ error: '房间不存在' });
    }
    
    // 更新房间人数逻辑
    // 获取当前房间玩家数
    const room = rooms[0];
    let currentPlayers = room.player_count || 0;
    
    // 确保不会减到负数
    if (currentPlayers > 0) {
      currentPlayers -= 1;
    }
    
    // 更新房间玩家数量
    await db.pool.query('UPDATE rooms SET player_count = ? WHERE id = ?', [currentPlayers, roomId]);
    
    res.json({
      message: '成功离开房间',
      roomId,
      playerCount: currentPlayers
    });
  } catch (err) {
    console.error('离开房间错误:', err);
    res.status(500).json({ error: '离开房间失败' });
  }
});

module.exports = router;