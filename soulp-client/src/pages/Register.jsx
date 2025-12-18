import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import axios from 'axios';

// 获取API基础URL
const getApiBaseUrl = () => {
  // 首先检查localStorage中是否已保存了可用的API URL
  const savedUrl = localStorage.getItem('workingApiBaseUrl');
  if (savedUrl) {
    return savedUrl.endsWith('/api') ? savedUrl : `${savedUrl}/api`;
  }
  
  // 否则使用默认的端口
  return 'http://localhost:5001/api';
};

const apiBaseUrl = getApiBaseUrl();

function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    nickname: '',
    account: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

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
  
  // 初始化星空背景
  useEffect(() => {
    // 创建星星背景
    createStars();
    
    // 窗口大小变化时重新创建星星
    const handleResize = () => {
      createStars();
    };
    
    window.addEventListener('resize', handleResize);
    
    // 清理函数：移除事件监听器
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // 验证输入有效性
    if (!validateInputs()) {
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      // 构建请求数据
      const userData = {
        account: formData.account,
        nickname: formData.nickname,
        password: formData.password
      };
      
      console.log('提交注册数据:', userData);
      
      // 使用API服务进行注册
      const result = await api.register(userData);
      
      console.log('注册成功，返回数据:', result);
      
      // 保存登录信息
      localStorage.setItem('token', result.token);
      localStorage.setItem('userId', result.user.id);
      localStorage.setItem('nickname', result.user.nickname);
      localStorage.setItem('account', result.user.account);
      
      // 保存注册时间
      if (result.user && result.user.created_at) {
        localStorage.setItem('registrationDate', result.user.created_at);
      }
      
      // 显示成功消息
      setSuccessMessage('注册成功！正在跳转到首页...');
      
      // 3秒后跳转到首页
      setTimeout(() => {
        navigate('/');
      }, 3000);
    } catch (error) {
      console.error('注册失败:', error);
      
      let errorMsg = '注册失败，请稍后再试';
      
      // 尝试解析错误信息
      if (error.response) {
        console.log('错误响应:', error.response);
        
        if (error.response.data && error.response.data.message) {
          errorMsg = error.response.data.message;
        } else if (error.response.data && error.response.data.error) {
          errorMsg = error.response.data.error;
        } else if (typeof error.response.data === 'string') {
          errorMsg = error.response.data;
        }
      } else if (error.message) {
        errorMsg = error.message;
      }
      
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const validateInputs = () => {
    // 表单验证
    if (formData.password !== formData.confirmPassword) {
      setError('两次输入的密码不一致');
      return false;
    }

    if (formData.password.length < 8) {
      setError('密码长度至少为8个字符');
      return false;
    }

    return true;
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
              已有账号？
              <Link to="/login" style={{ 
                color: '#00B4D8', 
                marginLeft: '0.5rem',
                fontWeight: 'bold',
                transition: 'all 0.3s ease'
              }} onMouseOver={(e) => e.target.style.color = '#0096B7'} 
                 onMouseOut={(e) => e.target.style.color = '#00B4D8'}>
                立即登录
              </Link>
            </p>
          </div>
          
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
              <label htmlFor="nickname" style={{ display: 'block', marginBottom: '0.5rem', color: '#ccc', fontSize: '0.9rem' }}>
                昵称
              </label>
              <input
                id="nickname"
                name="nickname"
                type="text"
                required
                value={formData.nickname}
                onChange={handleChange}
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
                placeholder="输入昵称..."
              />
            </div>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label htmlFor="account" style={{ display: 'block', marginBottom: '0.5rem', color: '#ccc', fontSize: '0.9rem' }}>
                账号
              </label>
              <input
                id="account"
                name="account"
                type="text"
                required
                value={formData.account}
                onChange={handleChange}
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
                value={formData.password}
                onChange={handleChange}
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

            <div style={{ marginBottom: '1.5rem' }}>
              <label htmlFor="confirmPassword" style={{ display: 'block', marginBottom: '0.5rem', color: '#ccc', fontSize: '0.9rem' }}>
                确认密码
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                value={formData.confirmPassword}
                onChange={handleChange}
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
                placeholder="再次输入密码..."
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
                    注册中...
                  </>
                ) : '注册'}
              </button>
            </div>
          </form>
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

export default Register; 