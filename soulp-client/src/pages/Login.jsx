import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios'; // 直接使用axios，避免api封装的拦截器干扰

// 尝试多个可能的API URL和端口
const API_BASE_PORTS = [5001, 5000, 3000, 8080];
const API_BASE_URLS = API_BASE_PORTS.map(port => `http://localhost:${port}/api`);

// 添加可靠的API调用函数
async function makeReliableApiCall(urlPath, options = {}) {
  const defaultOptions = {
    timeout: 5000,
    retries: 1,
    retryDelay: 1000,
    method: 'GET',
    ...options
  };
  
  // 记录所有错误以便详细报告
  const errors = [];
  
  // 首先尝试使用已保存的工作URL（如果有）
  const savedBaseUrl = localStorage.getItem('workingApiBaseUrl');
  if (savedBaseUrl) {
    console.log(`使用已保存的API地址: ${savedBaseUrl}${urlPath}`);
    try {
      const response = await axios({
        url: `${savedBaseUrl}${urlPath}`,
        method: defaultOptions.method,
        headers: defaultOptions.headers || {},
        data: defaultOptions.data,
        timeout: defaultOptions.timeout
      });
      
      console.log(`API调用成功(已保存URL): ${savedBaseUrl}${urlPath}`);
      return { success: true, data: response.data, workingBaseUrl: savedBaseUrl };
    } catch (err) {
      console.warn(`已保存的API地址调用失败: ${savedBaseUrl}${urlPath}`, err.message);
    }
  }
  
  // 尝试所有可能的API地址
  for (const baseUrl of API_BASE_URLS) {
    const fullUrl = `${baseUrl}${urlPath}`;
    console.log(`尝试连接API: ${fullUrl}`);
    
    // 尝试多次
    for (let attempt = 0; attempt <= defaultOptions.retries; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`重试 #${attempt} - ${fullUrl}`);
          // 重试前延迟
          await new Promise(r => setTimeout(r, defaultOptions.retryDelay));
        }
        
        const response = await axios({
          url: fullUrl,
          method: defaultOptions.method,
          headers: defaultOptions.headers || {},
          data: defaultOptions.data,
          timeout: defaultOptions.timeout
        });
        
        console.log(`API调用成功: ${fullUrl}`, response.status);
        // 成功，保存工作的API基础URL到本地存储
        localStorage.setItem('workingApiBaseUrl', baseUrl);
        return { 
          success: true, 
          data: response.data, 
          workingBaseUrl: baseUrl
        };
      } catch (err) {
        const errorInfo = {
          url: fullUrl,
          attempt,
          message: err.message,
          status: err.response?.status,
          statusText: err.response?.statusText,
          data: err.response?.data
        };
        console.error(`API调用失败: ${fullUrl}`, errorInfo);
        errors.push(errorInfo);
      }
    }
  }
  
  // 所有尝试都失败了
  console.error('所有API尝试均已失败:', errors);
  return { 
    success: false, 
    errors,
    error: '所有API连接尝试均失败',
    message: errors.length > 0 ? errors[0].message : '未知错误'
  };
}

function Login() {
  const navigate = useNavigate();
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiStatus, setApiStatus] = useState({ checked: false, online: false });
  
  // 创建星星背景
  const createStars = () => {
    try {
      console.log('开始创建星星背景');
      const starryBg = document.querySelector('.starry-background');
      if (!starryBg) {
        console.warn('未找到星空背景元素，无法创建星星');
        return;
      }
      
      // 清除已有的星星
      const existingStars = starryBg.querySelectorAll('.star');
      existingStars.forEach(star => star.remove());
      
      // 创建新星星
      const starCount = Math.floor(window.innerWidth * window.innerHeight / 1000);
      console.log(`将创建 ${starCount} 个星星`);
      
      for (let i = 0; i < starCount; i++) {
        const star = document.createElement('div');
        star.classList.add('star');
        
        // 随机位置
        const x = Math.random() * 100;
        const y = Math.random() * 100;
        
        // 随机大小
        const size = Math.random() * 3;
        
        // 随机动画延迟
        const delay = Math.random() * 4;
        
        star.style.left = `${x}%`;
        star.style.top = `${y}%`;
        star.style.width = `${size}px`;
        star.style.height = `${size}px`;
        star.style.animationDelay = `${delay}s`;
        
        starryBg.appendChild(star);
      }
      
      console.log('星星背景创建完成');
    } catch (err) {
      console.error('创建星星背景时出错:', err);
    }
  };
  
  // 清除可能存在的旧Token
  useEffect(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('nickname');
    localStorage.removeItem('account');
    console.log('已清除旧的登录信息');
    
    // 创建星星背景
    createStars();
    
    // 窗口大小变化时重新创建星星
    const handleResize = () => {
      createStars();
    };
    
    window.addEventListener('resize', handleResize);
    
    // 检查API可用性
    async function checkApiAvailability() {
      try {
        const pingResult = await makeReliableApiCall('/ping');
        setApiStatus({
          checked: true,
          online: pingResult.success,
          baseUrl: pingResult.workingBaseUrl
        });
        
        if (pingResult.success) {
          console.log('找到可用的API服务器:', pingResult.workingBaseUrl);
        } else {
          console.error('未找到可用的API服务器，请确保服务器已启动');
        }
      } catch (err) {
        console.error('API可用性检查出错:', err);
        setApiStatus({ checked: true, online: false });
      }
    }
    
    checkApiAvailability();
    
    // 清理函数：移除事件监听器
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    console.log('开始登录流程，账号:', account);

    try {
      // 使用可靠的API调用函数进行登录
      const loginResult = await makeReliableApiCall('/login', {
        method: 'POST',
        data: { account, password },
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!loginResult.success) {
        throw new Error(loginResult.error || '登录失败，无法连接到服务器');
      }
      
      const response = loginResult.data;
      console.log('登录响应:', response);
      
      if (response && response.token) {
        console.log('登录成功，获取到token');
        
        // 存储JWT和用户信息
        localStorage.setItem('token', response.token);
        
        // 存储其他用户信息
        if (response.userInfo) {
          localStorage.setItem('userId', response.userInfo.id);
          localStorage.setItem('nickname', response.userInfo.nickname);
          localStorage.setItem('account', response.userInfo.account);
          // 保存注册日期用于离线显示
          localStorage.setItem('registrationDate', new Date().toISOString());
          
          console.log('用户信息已保存:', response.userInfo);
        }
        
        // 测试存储的token
        const storedToken = localStorage.getItem('token');
        console.log('存储的token:', storedToken ? `${storedToken.substring(0, 20)}...` : '无');
        
        // 直接导航到个人页面以检验token
        alert('登录成功！正在跳转到首页...');
        navigate('/');
      } else {
        console.error('登录响应没有包含token:', response);
        throw new Error('登录响应中缺少token');
      }
    } catch (err) {
      console.error('登录请求失败:', err);
      
      // 获取错误详情
      if (err.errors && err.errors.length > 0) {
        // 处理多API尝试的错误
        const lastError = err.errors[err.errors.length - 1];
        if (lastError.status === 401) {
          setError('用户名或密码不正确');
        } else {
          setError(`登录失败: ${err.message || '服务器连接失败'}`);
        }
      } else if (err.response) {
        // 标准axios错误
        console.error('错误响应数据:', err.response.data);
        console.error('错误状态码:', err.response.status);
        if (err.response.status === 401) {
          setError('用户名或密码不正确');
        } else {
          setError(err.response.data?.error || `服务器错误 (${err.response.status})`);
        }
      } else if (err.request) {
        console.error('请求已发送但没有收到响应');
        setError('服务器未响应，请检查网络连接或服务器状态');
      } else {
        console.error('请求错误:', err.message);
        setError(err.message || '登录请求失败');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      background: 'radial-gradient(ellipse at bottom, #1B2735 0%, #090A0F 100%)',
      minHeight: '100vh',
      width: '100%',
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      {/* 星空背景 */}
      <div className="starry-background"></div>
      
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3rem 1rem',
        position: 'relative',
        zIndex: 10,
        width: '100%'
      }}>
        <div style={{ 
          maxWidth: '450px',
          width: '100%',
          backgroundColor: 'rgba(26, 26, 46, 0.8)', 
          borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          padding: '2rem',
          border: '1px solid #2A2A3E'
        }}>
          <div>
            <h2 style={{ 
              fontSize: '2.5rem', 
              fontWeight: 'bold', 
              color: '#fff',
              textAlign: 'center',
              marginBottom: '1rem',
              letterSpacing: '2px'
            }}>SOULP</h2>
            <p style={{ 
              textAlign: 'center', 
              fontSize: '0.9rem', 
              color: '#ccc',
              marginBottom: '1.5rem'
            }}>
              还没有账号？
              <Link to="/register" style={{ 
                color: '#00B4D8', 
                marginLeft: '0.5rem',
                fontWeight: 'bold',
                transition: 'all 0.3s ease'
              }} onMouseOver={(e) => e.target.style.color = '#0096B7'} 
                 onMouseOut={(e) => e.target.style.color = '#00B4D8'}>
                立即注册
              </Link>
            </p>
          </div>
          
          {!apiStatus.online && apiStatus.checked && (
            <div style={{
              backgroundColor: 'rgba(255, 193, 7, 0.2)',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1rem',
              border: '1px solid rgba(255, 193, 7, 0.3)',
              color: '#FFC107'
            }}>
              <strong>警告:</strong> 无法连接到API服务器。请确保服务器已启动，或联系管理员。
              <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>已尝试连接: {API_BASE_PORTS.join(', ')} 等端口</p>
            </div>
          )}
          
          {error && (
            <div style={{
              backgroundColor: 'rgba(220, 53, 69, 0.2)',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1rem',
              border: '1px solid rgba(220, 53, 69, 0.3)',
              color: '#DC3545'
            }}>
              {error}
            </div>
          )}

          <form style={{ marginTop: '1.5rem' }} onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1.5rem' }}>
              <label htmlFor="account" style={{ display: 'block', marginBottom: '0.5rem', color: '#ccc', fontSize: '0.9rem' }}>
                账号
              </label>
              <input
                id="account"
                name="account"
                type="text"
                required
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  backgroundColor: 'rgba(42, 42, 62, 0.7)',
                  border: '1px solid #2A2A3E',
                  borderRadius: '8px',
                  color: '#fff',
                  transition: 'all 0.3s ease',
                  outline: 'none'
                }}
                onFocus={(e) => e.target.style.borderColor = '#00B4D8'}
                onBlur={(e) => e.target.style.borderColor = '#2A2A3E'}
                placeholder="输入账号..."
              />
            </div>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label htmlFor="password" style={{ display: 'block', marginBottom: '0.5rem', color: '#ccc', fontSize: '0.9rem' }}>
                密码
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  backgroundColor: 'rgba(42, 42, 62, 0.7)',
                  border: '1px solid #2A2A3E',
                  borderRadius: '8px',
                  color: '#fff',
                  transition: 'all 0.3s ease',
                  outline: 'none'
                }}
                onFocus={(e) => e.target.style.borderColor = '#00B4D8'}
                onBlur={(e) => e.target.style.borderColor = '#2A2A3E'}
                placeholder="输入密码..."
              />
            </div>

            <div style={{ marginTop: '2rem' }}>
              <button
                type="submit"
                disabled={isLoading}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: '#00B4D8',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: isLoading ? 0.7 : 1
                }}
                onMouseOver={(e) => !isLoading && (e.target.style.backgroundColor = '#0096B7')}
                onMouseOut={(e) => !isLoading && (e.target.style.backgroundColor = '#00B4D8')}
              >
                {isLoading ? (
                  <>
                    <span style={{ 
                      display: 'inline-block',
                      width: '1rem',
                      height: '1rem',
                      border: '2px solid rgba(255, 255, 255, 0.3)',
                      borderRadius: '50%',
                      borderTopColor: 'white',
                      animation: 'spin 1s linear infinite',
                      marginRight: '0.5rem'
                    }}></span>
                    登录中...
                  </>
                ) : '登录'}
              </button>
            </div>
          </form>
          
          <div style={{ borderTop: '1px solid #2A2A3E', paddingTop: '1rem', marginTop: '2rem' }}>
            <p style={{ color: '#ccc', fontSize: '0.8rem', marginBottom: '0.5rem' }}>测试账号: test / password123</p>
            <p style={{ color: '#ccc', fontSize: '0.8rem' }}>API服务器: {apiStatus.baseUrl || 'http://localhost:5001/api'}</p>
          </div>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .starry-background {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: 0;
        }
        
        .star {
          position: absolute;
          background-color: #ffffff;
          border-radius: 50%;
          animation: twinkle 4s infinite ease-in-out;
        }
        
        @keyframes twinkle {
          0% { opacity: 0.3; }
          50% { opacity: 1; }
          100% { opacity: 0.3; }
        }
      `}}></style>
    </div>
  );
}

export default Login;