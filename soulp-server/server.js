const express = require('express');
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const http = require('http'); // 添加http服务器

// 唯一应用实例初始化
const app = express();

// CORS配置
app.use(cors({
  origin: true, // 允许任何来源
  credentials: true, // 允许跨域请求带上凭证
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization']
}));

// 记录请求
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  
  // 调试CORS请求
  console.log('Origin:', req.headers.origin);
  console.log('Auth头:', req.headers.authorization ? '存在' : '不存在');
  
  // 添加CORS头
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  
  // 预检请求直接返回200
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// 正确解析请求体
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 添加请求日志中间件
app.use((req, res, next) => {
  const now = new Date().toISOString();
  console.log(`[${now}] ${req.method} ${req.url}`);
  
  // 记录请求体 (但不记录敏感信息如密码)
  if (req.method === 'POST' || req.method === 'PUT') {
    const logBody = { ...req.body };
    if (logBody.password) logBody.password = '******'; // 隐藏密码
    console.log(`请求体: ${JSON.stringify(logBody)}`);
  }
  
  // 记录完成时的响应状态
  const originalEnd = res.end;
  res.end = function(...args) {
    const endTime = new Date().toISOString();
    console.log(`[${endTime}] 完成 ${req.method} ${req.url} - 状态: ${res.statusCode}`);
    originalEnd.apply(res, args);
  };
  
  next();
});

// 身份验证中间件
app.use((req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      console.log('用户已验证:', req.user);
    } catch (err) {
      console.error('Token验证失败:', err);
    }
  }
  next();
});

// 数据库和路由配置
const db = require('./db');
try {
  db.pool.query('SELECT 1').then(() => {
    console.log('数据库连接测试成功');
  }).catch(err => {
    console.error('数据库连接测试失败:', err);
  });
} catch (err) {
  console.error('数据库连接初始化错误:', err);
}

const userRoutes = require('./routes/userRoutes');
const roomRoutes = require('./routes/roomRoutes');
const soupRoutes = require('./routes/soupRoutes');

try {
  const authMiddleware = require('./middleware/auth');
  
  // 根路由
  app.get('/', (req, res) => {
    res.send('Welcome to the WebRTC Soup Server! 🚀');
  });
  
  // 注册路由
  app.use('/api/users', userRoutes);
  app.use('/api', userRoutes); // 保留旧路径，兼容性考虑
  
  // 解决问题：同时注册/api/rooms和/api/room路径，两者都指向同一个路由处理器
  app.use('/api/rooms', authMiddleware, roomRoutes);
  app.use('/api/room', authMiddleware, roomRoutes);
  
  // 海龟汤路由 - 正确顺序：主要使用/api/soup，同时保留/api/soups作为备用
  app.use('/api/soup', authMiddleware, soupRoutes);
  app.use('/api/soups', authMiddleware, soupRoutes); // 备用路径，保持兼容性
  
  // 测试端点
  app.get('/api/ping', (req, res) => {
    console.log('收到Ping请求');
    res.json({ 
      message: 'pong', 
      timestamp: new Date().toISOString(),
      status: 'API服务器正常运行'
    });
  });
  
  // 添加健康检查端点
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
  });
  
  // 全局错误处理中间件
  app.use((err, req, res, next) => {
    console.error('服务器错误:', err);
    res.status(500).json({ error: '服务器内部错误', details: err.message });
  });
} catch (err) {
  console.error('路由配置错误:', err.message);
}

// 创建HTTP服务器
const server = http.createServer(app);

// 增强错误处理
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // 验证数据库连接
  db.pool.getConnection()
    .then(conn => {
      conn.release();
      console.log('Database connection verified');
    })
    .catch(err => {
      console.error('Database connection failed:', err.message);
      server.close(() => process.exit(1));
    });
});

// 添加Socket.io WebRTC信令服务
try {
  const io = require('socket.io')(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  // 存储房间和用户信息
  const rooms = {};

  io.on('connection', (socket) => {
    const { roomId, userId, nickname } = socket.handshake.query;
    
    if (!roomId || !userId || !nickname) {
      console.log('连接参数不完整, 断开连接');
      socket.disconnect();
      return;
    }

    console.log(`用户 ${nickname}(${userId}) 连接到信令服务器，房间ID: ${roomId}`);
    
    // 创建房间(如果不存在)
    if (!rooms[roomId]) {
      rooms[roomId] = {
        users: {},
        micPositions: Array(8).fill().map(() => ({ userId: null, nickname: null }))
      };
    }
    
    // 检查用户是否已经在房间中
    let existingSocketId = null;
    for (const [socketId, user] of Object.entries(rooms[roomId].users)) {
      if (user.userId === userId) {
        existingSocketId = socketId;
        break;
      }
    }
    
    // 如果用户已经在房间中，清理旧连接相关资源
    if (existingSocketId) {
      console.log(`用户 ${nickname}(${userId}) 已在房间中，断开旧连接: ${existingSocketId}`);
      
      // 清理旧麦位
      const position = rooms[roomId].users[existingSocketId]?.micPosition;
      if (position >= 0) {
        rooms[roomId].micPositions[position] = { userId: null, nickname: null };
      }
      
      // 删除旧用户记录
      delete rooms[roomId].users[existingSocketId];
      
      // 通知房间其他人用户离开(旧连接)
      socket.to(roomId).emit('user-left', {
        socketId: existingSocketId,
        userId,
        nickname
      });
    }
    
    // 加入房间
    socket.join(roomId);
    
    // 记录用户信息
    rooms[roomId].users[socket.id] = {
      userId,
      nickname,
      socketId: socket.id,
      micPosition: -1, // 默认未上麦
      isMuted: true    // 默认静音
    };
    
    // 通知所有人有新用户加入
    socket.to(roomId).emit('user-joined', {
      socketId: socket.id,
      userId,
      nickname
    });
    
    // 告知新用户当前房间的所有用户
    const roomUsers = Object.values(rooms[roomId].users).filter(u => u.socketId !== socket.id);
    socket.emit('room-users', roomUsers);
    
    // 告知新用户当前麦位状态
    socket.emit('mic-positions', rooms[roomId].micPositions);
    
    // 用户上麦
    socket.on('join-mic', (data) => {
      const { micPosition } = data;
      console.log(`用户 ${nickname}(${userId}) 上${micPosition + 1}号麦`);
      
      if (micPosition >= 0 && micPosition < 8) {
        // 记录上一个麦位
        const oldPosition = rooms[roomId].users[socket.id].micPosition;
        
        // 如果已经在其他麦位上，先下掉
        if (oldPosition >= 0) {
          rooms[roomId].micPositions[oldPosition] = { userId: null, nickname: null };
        }
        
        // 更新用户当前麦位
        rooms[roomId].users[socket.id].micPosition = micPosition;
        
        // 更新麦位信息
        rooms[roomId].micPositions[micPosition] = {
          userId,
          nickname,
          socketId: socket.id
        };
        
        // 通知房间所有人麦位变化
        io.to(roomId).emit('mic-positions', rooms[roomId].micPositions);
      }
    });
    
    // 用户下麦
    socket.on('leave-mic', () => {
      console.log(`用户 ${nickname}(${userId}) 下麦`);
      const currentPosition = rooms[roomId].users[socket.id].micPosition;
      
      // 如果在麦上
      if (currentPosition >= 0) {
        rooms[roomId].micPositions[currentPosition] = { userId: null, nickname: null };
        rooms[roomId].users[socket.id].micPosition = -1;
        
        // 通知房间所有人麦位变化
        io.to(roomId).emit('mic-positions', rooms[roomId].micPositions);
      }
    });
    
    // 麦克风状态变化
    socket.on('mic-status-changed', (data) => {
      const { isMuted } = data;
      console.log(`用户 ${nickname}(${userId}) 麦克风状态变化: ${isMuted ? '静音' : '取消静音'}`);
      
      // 更新用户状态
      if (rooms[roomId] && rooms[roomId].users[socket.id]) {
        rooms[roomId].users[socket.id].isMuted = isMuted;
        
        // 通知房间所有人麦克风状态变化
        io.to(roomId).emit('mic-status-changed', {
          socketId: socket.id,
          userId,
          nickname,
          isMuted
        });
      }
    });
    
    // 说话状态变化
    socket.on('speaking-changed', (data) => {
      const { isSpeaking } = data;
      
      // 更新用户状态
      if (rooms[roomId] && rooms[roomId].users[socket.id]) {
        rooms[roomId].users[socket.id].isSpeaking = isSpeaking;
        
        // 通知房间所有人说话状态变化
        io.to(roomId).emit('speaking-changed', {
          socketId: socket.id,
          userId,
          nickname,
          isSpeaking
        });
      }
    });
    
    // WebRTC信令: offer
    socket.on('offer', (data) => {
      const { to } = data;
      console.log(`转发offer从 ${userId} 到 ${to}`);
      socket.to(to).emit('offer', data);
    });
    
    // WebRTC信令: answer
    socket.on('answer', (data) => {
      const { to } = data;
      console.log(`转发answer从 ${userId} 到 ${to}`);
      socket.to(to).emit('answer', data);
    });
    
    // WebRTC信令: ice-candidate
    socket.on('ice-candidate', (data) => {
      const { to } = data;
      socket.to(to).emit('ice-candidate', data);
    });
    
    // 断开连接
    socket.on('disconnect', () => {
      console.log(`用户 ${nickname}(${userId}) 断开连接`);
      
      if (rooms[roomId]) {
        // 清理麦位
        const position = rooms[roomId].users[socket.id]?.micPosition;
        if (position >= 0) {
          rooms[roomId].micPositions[position] = { userId: null, nickname: null };
        }
        
        // 删除用户
        delete rooms[roomId].users[socket.id];
        
        // 如果房间空了，删除房间
        if (Object.keys(rooms[roomId].users).length === 0) {
          delete rooms[roomId];
          console.log(`房间 ${roomId} 已清空并删除`);
        } else {
          // 通知房间所有人麦位变化
          io.to(roomId).emit('mic-positions', rooms[roomId].micPositions);
          
          // 通知房间所有人有用户离开
          socket.to(roomId).emit('user-left', {
            socketId: socket.id,
            userId,
            nickname
          });
        }
      }
    });
  });
  
  console.log('WebRTC信令服务已启动');
} catch (err) {
  console.error('WebRTC信令服务启动失败:', err);
}

// 处理未捕获异常
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  server.close(() => process.exit(1));
});
