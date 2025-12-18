const jwt = require('jsonwebtoken');

// 身份验证中间件
const authMiddleware = (req, res, next) => {
  try {
    // 从请求头获取 token
    const authHeader = req.headers.authorization;
    console.log('认证中间件 - 收到请求头:', authHeader ? `${authHeader.substring(0, 20)}...` : '无认证头');
    console.log('认证中间件 - 请求路径:', req.path);
    console.log('认证中间件 - 请求方法:', req.method);
    
    // 对于OPTIONS请求，直接通过
    if (req.method === 'OPTIONS') {
      console.log('认证中间件 - OPTIONS预检请求，直接通过');
      return next();
    }
    
    // 对特定路径跳过认证
    const publicPaths = ['/ping', '/health', '/login', '/register'];
    if (publicPaths.some(path => req.path.endsWith(path))) {
      console.log('认证中间件 - 公开路径，跳过认证:', req.path);
      return next();
    }
    
    // 开发环境下更宽松的认证，允许从localStorage中提取用户ID
    if (process.env.NODE_ENV === 'development') {
      console.log('认证中间件 - 开发环境下使用更宽松的认证');
      
      // 尝试从请求参数中获取用户ID (可能在URL或请求体中)
      const userId = req.params.userId || req.body?.userId || req.query?.userId;
      
      if (userId) {
        console.log('认证中间件 - 开发环境从请求参数找到用户ID:', userId);
        req.user = { id: parseInt(userId, 10) };
        return next();
      }
      
      // 如果仍无法获取用户ID，则提供默认用户以便调试
      console.log('认证中间件 - 开发环境，使用默认用户ID');
      req.user = { id: 1 };
      return next();
    }
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('认证中间件 - 未找到有效的认证头');
      
      // 检查是否有cookie中的token（用于浏览器环境）
      const cookies = req.headers.cookie;
      if (cookies) {
        const tokenCookie = cookies.split(';').find(c => c.trim().startsWith('token='));
        if (tokenCookie) {
          const token = tokenCookie.split('=')[1].trim();
          console.log('认证中间件 - 从cookie找到token:', token.substring(0, 10) + '...');
          try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = decoded;
            console.log('认证中间件 - Cookie令牌验证成功，用户:', decoded.id);
            return next();
          } catch (cookieJwtErr) {
            console.error('认证中间件 - Cookie令牌验证失败:', cookieJwtErr.message);
          }
        }
      }
      
      // 如果是开发环境，可以考虑提供模拟用户
      if (process.env.NODE_ENV === 'development' && process.env.MOCK_AUTH === 'true') {
        console.log('认证中间件 - 开发环境，使用模拟用户');
        req.user = { id: 1, account: 'test@example.com' };
        return next();
      }
      
      return res.status(401).json({ error: '未授权：缺少 Token' });
    }
    
    // 提取 token
    const token = authHeader.substring(7);
    console.log('认证中间件 - 提取到Token:', token.substring(0, 15) + '...');
    
    // 记录token结构
    const tokenParts = token.split('.');
    if (tokenParts.length !== 3) {
      console.error('认证中间件 - Token格式不正确，应该有3部分而不是', tokenParts.length);
      return res.status(401).json({ error: '未授权：Token格式不正确' });
    }
    
    try {
      // 验证 token
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        console.error('认证中间件 - JWT_SECRET环境变量未设置');
        return res.status(500).json({ error: '服务器配置错误：缺少JWT密钥' });
      }
      
      console.log('认证中间件 - 使用密钥解码:', secret ? '密钥存在' : '密钥缺失');
      
      // 尝试解码
      try {
        const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
        console.log('认证中间件 - Token载荷解析:', payload);
        // 检查过期时间
        if (payload.exp && Date.now() >= payload.exp * 1000) {
          console.error('认证中间件 - Token已过期:', new Date(payload.exp * 1000));
          return res.status(401).json({ error: '未授权：Token已过期', expiredAt: new Date(payload.exp * 1000) });
        }
      } catch (parseErr) {
        console.error('认证中间件 - 解析Token载荷失败:', parseErr);
      }
      
      const decoded = jwt.verify(token, secret);
      req.user = decoded;
      console.log('认证中间件 - 令牌验证成功，用户:', decoded.id);
      
      // 为响应添加跨域头，确保客户端接收到响应
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
      
      next();
    } catch (jwtErr) {
      console.error('认证中间件 - 令牌验证失败:', jwtErr.message);
      // 记录更多错误细节
      if (jwtErr.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          error: '未授权：Token已过期', 
          details: jwtErr.message,
          expiredAt: jwtErr.expiredAt
        });
      } else if (jwtErr.name === 'JsonWebTokenError') {
        return res.status(401).json({ 
          error: '未授权：无效的Token', 
          details: jwtErr.message
        });
      }
      return res.status(401).json({ error: '未授权：Token验证失败', details: jwtErr.message });
    }
  } catch (err) {
    console.error('认证中间件 - 其他错误:', err);
    return res.status(500).json({ error: '服务器错误', details: err.message });
  }
};

module.exports = authMiddleware; 