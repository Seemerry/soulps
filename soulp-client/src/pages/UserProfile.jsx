console.log('开始加载UserProfile组件...');
import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './UserProfile.css';
import api from '../services/api';

console.log('UserProfile组件: API服务导入成功', !!api);

// 尝试多个可能的API URL和端口
const API_BASE_PORTS = [5001, 5000, 3000, 8080];
const API_BASE_URLS = API_BASE_PORTS.map(port => `http://localhost:${port}/api`);

// 添加带有超时和重试的API调用函数
async function makeReliableApiCall(urlPath, options = {}) {
  const defaultOptions = {
    timeout: 5000,
    retries: 2,
    retryDelay: 1000,
    ...options
  };
  
  // 记录所有错误以便详细报告
  const errors = [];
  
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
          method: defaultOptions.method || 'GET',
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
          status: response.status,
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
    details: `尝试了${API_BASE_URLS.length}个基础URL，每个有${defaultOptions.retries + 1}次尝试。`
  };
}

// 测试服务器连接函数
async function testServerConnection() {
  try {
    console.log('测试服务器连接...');
    
    // 首先检查是否有已知可用的API基础URL
    const savedBaseUrl = localStorage.getItem('workingApiBaseUrl');
    if (savedBaseUrl) {
      console.log('使用已保存的API基础URL:', savedBaseUrl);
      try {
        // 使用导入的api对象的pingServer方法
        const result = await api.pingServer();
        console.log('服务器连接测试成功:', result);
        return { connected: true, data: result, baseUrl: savedBaseUrl };
      } catch (savedUrlErr) {
        console.warn('已保存的API基础URL不可用:', savedUrlErr);
      }
    }
    
    // 使用导入的api对象的pingServer方法
    try {
      const result = await api.pingServer();
      console.log('服务器连接测试成功:', result);
      const apiBaseUrl = 'http://localhost:5001'; // 使用默认API基础URL
      localStorage.setItem('workingApiBaseUrl', apiBaseUrl);
      return { connected: true, data: result, baseUrl: apiBaseUrl };
    } catch (apiErr) {
      console.error('使用api.pingServer测试服务器连接失败:', apiErr);
    }
    
    // 如果api.pingServer失败，尝试直接通过Axios
    for (const port of API_BASE_PORTS) {
      const url = `http://localhost:${port}/api/ping`;
      try {
        console.log(`尝试通过Axios直接ping ${url}`);
        const response = await axios.get(url, { timeout: 2000 });
        if (response.status === 200) {
          console.log(`成功连接到 ${url}:`, response.data);
          const apiBaseUrl = `http://localhost:${port}`;
          localStorage.setItem('workingApiBaseUrl', apiBaseUrl);
          return { connected: true, data: response.data, baseUrl: apiBaseUrl };
        }
      } catch (err) {
        console.warn(`无法连接到 ${url}:`, err.message);
      }
    }
    
    throw new Error('所有API连接尝试均失败');
  } catch (err) {
    console.error('服务器连接测试失败:', err);
    return { connected: false, error: err };
  }
}

// 获取用户资料函数
async function getUserProfile(token) {
  if (!token) {
    return { 
      success: false,
      error: '没有提供Token',
      details: '无法在没有身份验证令牌的情况下获取用户资料' 
    };
  }
  
  console.log('获取用户资料，Token:', token ? `${token.substring(0, 15)}...` : '无');
  
  // 使用导入的API服务
  try {
    console.log('使用导入的api服务获取用户详情');
    
    // 直接调用导入的api对象方法
    console.log('调用api.getUserProfile()');
    const userData = await api.getUserProfile();
    console.log('API获取用户数据成功:', userData);
    
    // 检查必要的字段
    if (!userData.created_at) {
      console.error('API返回的用户数据中缺少created_at字段');
      throw new Error('用户数据缺少注册时间信息');
    }
    
    // 记录注册时间相关信息
    console.log('用户创建时间:', userData.created_at);
    console.log('创建时间类型:', typeof userData.created_at);
    console.log('创建时间值:', userData.created_at);
    
    // 确保有海龟汤数量
    const soupCount = userData.soupCount || 0;
    
    // 计算总分
    const totalScore = ((userData.puzzle_score || 0) + 
                        (userData.hosting_score || 0) + 
                        (userData.creation_score || 0)) / 3;
    
    // 返回标准化数据
    return {
      success: true,
      data: {
        ...userData,
        soupCount: soupCount,
        totalScore: totalScore,
        hostRoomCount: userData.hostRoomCount || 0, 
        joinedRoomCount: userData.joinedRoomCount || 0
      },
      dataSource: 'api_service'
    };
  } catch (error) {
    console.error('通过导入的api服务获取用户资料失败:', error);
    
    // 不使用模拟数据，直接返回错误
    return { 
      success: false,
      error: '无法获取用户真实数据: ' + (error.message || '未知错误'),
      details: error.stack,
      requiresRealData: true  // 标记此错误需要真实数据，不能用模拟数据替代
    };
  }
}

// 格式化日期函数
function formatDate(dateStr) {
  if (!dateStr) return '未知时间';
  
  console.log('格式化日期，输入:', dateStr);
  
  try {
    // 处理不同格式的日期字符串
    let date;
    
    // 处理MySQL日期时间格式 (YYYY-MM-DD HH:MM:SS)
    if (typeof dateStr === 'string' && dateStr.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
      const [datePart, timePart] = dateStr.split(' ');
      const [year, month, day] = datePart.split('-');
      const [hour, minute, second] = timePart.split(':');
      date = new Date(year, month - 1, day, hour, minute, second);
      console.log('解析MySQL格式日期时间:', date);
    } 
    // ISO格式日期时间 (如 2023-01-01T00:00:00.000Z)
    else if (typeof dateStr === 'string') {
      date = new Date(dateStr);
      console.log('解析ISO格式日期时间:', date);
    } 
    // 时间戳
    else if (typeof dateStr === 'number') {
      date = new Date(dateStr);
      console.log('解析时间戳:', date);
    } else {
      console.error('无法识别的日期格式:', dateStr);
      return '无效日期';
    }
    
    // 检查日期是否有效
    if (isNaN(date.getTime())) {
      console.error('解析结果是无效日期');
      return '无效日期';
    }
    
    // 格式化为 YYYY-MM-DD
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    const formattedDate = `${year}-${month}-${day}`;
    console.log('格式化结果:', formattedDate);
    return formattedDate;
  } catch (error) {
    console.error('日期格式化错误:', error);
    return '日期错误';
  }
}

function UserProfile() {
  const navigate = useNavigate();
  console.log('UserProfile组件加载，navigate函数可用:', !!navigate);
  
  // 测试navigate函数
  const testNavigate = (path) => {
    console.log('尝试导航到路径:', path);
    navigate(path);
  };
  
  // 状态管理
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [offlineMode, setOfflineMode] = useState(false);
  const [serverStatus, setServerStatus] = useState({ checked: false, online: false, baseUrl: null });
  
  // 用户菜单状态
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);
  
  // 获取用户信息
  useEffect(() => {
    async function loadUserProfile() {
      setIsLoading(true);
      setError(null);
      
      try {
        console.log('=== 开始加载用户资料 ===');
        console.log('LocalStorage信息:', {
          token: localStorage.getItem('token') ? '存在' : '不存在',
          userId: localStorage.getItem('userId'),
          nickname: localStorage.getItem('nickname'),
          account: localStorage.getItem('account'),
          registrationDate: localStorage.getItem('registrationDate')
        });
        
        // 检查服务器是否在线
        const serverTest = await testServerConnection();
        setServerStatus({ 
          checked: true, 
          online: serverTest.connected, 
          baseUrl: serverTest.baseUrl 
        });
        
        console.log('服务器连接测试结果:', serverTest);
        
        if (!serverTest.connected) {
          throw new Error('服务器连接失败，请确保API服务器已启动在端口5001或5000');
        }
        
        // 验证用户登录状态
        const token = localStorage.getItem('token');
        console.log('检查本地Token:', token ? '存在' : '不存在');
        
        if (!token) {
          console.error('未检测到登录信息，重定向到登录页面');
          navigate('/login');
          return;
        }
        
        // 直接使用导入的api对象
        console.log('使用导入的api对象获取用户资料...');
        
        try {
          // 直接调用api服务方法
          const userData = await api.getUserProfile();
          console.log('成功获取用户资料:', userData);
          
          if (!userData) {
            throw new Error('API返回了空的用户数据');
          }
          
          // 记录用户资料详情
          console.log('用户资料关键字段:');
          ['id', 'nickname', 'account', 'created_at', 'puzzle_score', 'hosting_score', 'creation_score'].forEach(key => {
            console.log(`- ${key}: ${userData[key]}`);
          });
          
          // 检查created_at字段
          if (!userData.created_at) {
            console.warn('用户资料中缺少created_at字段，使用localStorage中的值');
            userData.created_at = localStorage.getItem('registrationDate') || new Date().toISOString();
          }
          
          console.log('用户注册时间:', userData.created_at);
          
          // 获取用户创建的汤数量
          let soupCount = 0;
          try {
            const userId = parseInt(userData.id);
            const soups = await api.getSoups();
            if (Array.isArray(soups)) {
              soupCount = soups.filter(soup => parseInt(soup.author_id) === userId).length;
              console.log(`用户创建的海龟汤数量: ${soupCount}`);
            }
          } catch (soupError) {
            console.error('获取海龟汤数量失败:', soupError);
          }
          
          // 计算总分
          const totalScore = ((userData.puzzle_score || 0) + 
                             (userData.hosting_score || 0) + 
                             (userData.creation_score || 0)) / 3;
          
          // 设置用户资料并更新UI
          setUserProfile({
            ...userData,
            totalScore,
            soupCount: soupCount,
            hostRoomCount: userData.hostRoomCount || 0,
            joinedRoomCount: userData.joinedRoomCount || 0
          });
          
          setOfflineMode(false);
          console.log('用户资料加载完成');
        } catch (apiError) {
          console.error('通过导入的api对象获取用户资料失败:', apiError);
          throw new Error('API调用失败: ' + apiError.message);
        }
        
      } catch (err) {
        console.error('加载用户资料失败:', err);
        
        const errorMessage = err.message || '未知错误';
        setError(`获取用户资料失败: ${errorMessage}`);
        
        // 尝试从localStorage读取备份信息以显示基本资料
        try {
          const storedUserData = localStorage.getItem('userProfileData');
          if (storedUserData) {
            const parsedData = JSON.parse(storedUserData);
            console.log('从localStorage加载备份用户资料:', parsedData);
            setUserProfile({
              ...parsedData,
              _source: 'localStorage_backup',
              isOfflineData: true
            });
            setOfflineMode(true);
          } else {
            setUserProfile(null);
          }
        } catch (backupErr) {
          console.error('读取备份用户资料失败:', backupErr);
          setUserProfile(null);
        }
      } finally {
        setIsLoading(false);
      }
    }
    
    loadUserProfile();
    
    // 点击外部关闭用户菜单
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setIsUserMenuOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [navigate]);
  
  // 强制刷新用户资料
  const forceRefresh = async () => {
    setIsLoading(true);
    setError(null);
    setOfflineMode(false);
    
    try {
      // 检查服务器状态
      const serverTest = await testServerConnection();
      setServerStatus({ 
        checked: true, 
        online: serverTest.connected, 
        baseUrl: serverTest.baseUrl 
      });
      
      if (!serverTest.connected) {
        throw new Error('服务器连接失败，请检查网络或服务器状态');
      }
      
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('未找到登录信息，请重新登录');
      }
      
      // 使用导入的api对象直接获取用户资料
      console.log('强制刷新: 使用导入的api获取用户资料');
      const userData = await api.getUserProfile();
      
      if (!userData) {
        throw new Error('API返回了空的用户数据');
      }
      
      // 获取用户创建的汤数量
      let soupCount = 0;
      try {
        const userId = parseInt(userData.id);
        const soups = await api.getSoups();
        if (Array.isArray(soups)) {
          soupCount = soups.filter(soup => parseInt(soup.author_id) === userId).length;
          console.log(`用户创建的海龟汤数量: ${soupCount}`);
        }
      } catch (soupError) {
        console.error('获取海龟汤数量失败:', soupError);
      }
      
      // 计算总分
      const totalScore = ((userData.puzzle_score || 0) + 
                         (userData.hosting_score || 0) + 
                         (userData.creation_score || 0)) / 3;
      
      // 设置用户资料
      setUserProfile({
        ...userData,
        totalScore,
        soupCount: soupCount,
        hostRoomCount: userData.hostRoomCount || 0, 
        joinedRoomCount: userData.joinedRoomCount || 0
      });
      
      // 显示刷新成功提示
      const messageElem = document.createElement('div');
      messageElem.textContent = '数据刷新成功';
      messageElem.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#4CAF50;color:white;padding:10px 20px;border-radius:4px;z-index:9999;';
      document.body.appendChild(messageElem);
      setTimeout(() => document.body.removeChild(messageElem), 3000);
      
    } catch (err) {
      console.error('强制刷新失败:', err);
      setError(err.message || '刷新失败');
      
      // 如果失败，尝试从localStorage获取备份数据
      try {
        const storedUserData = localStorage.getItem('userProfileData');
        if (storedUserData) {
          const parsedData = JSON.parse(storedUserData);
          console.log('使用localStorage备份数据:', parsedData);
          setUserProfile({
            ...parsedData,
            _source: 'localStorage_backup',
            isOfflineData: true
          });
          setOfflineMode(true);
        } else {
          setUserProfile(null);
        }
      } catch (backupErr) {
        console.error('读取备份用户资料失败:', backupErr);
        setUserProfile(null);
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  // 首字母头像
  const getInitialAvatar = (name) => {
    if (!name || name === '游客' || name === 'undefined' || name === '未登录') {
      return '?';
    }
    return name.charAt(0).toUpperCase();
  };
  
  // 切换用户菜单
  const toggleUserMenu = () => {
    setIsUserMenuOpen(!isUserMenuOpen);
  };
  
  // 登出
  const handleLogout = () => {
    if (window.confirm('确定要退出登录吗？')) {
      localStorage.removeItem('token');
      localStorage.removeItem('userId');
      localStorage.removeItem('nickname');
      localStorage.removeItem('account');
      navigate('/login');
    }
  };
  
  // 重新登录
  const handleRelogin = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('nickname');
    localStorage.removeItem('account');
    navigate('/login');
  };
  
  // 渲染加载状态
  const renderLoading = () => {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p className="loading-text">正在加载用户资料...</p>
      </div>
    );
  };
  
  // 渲染错误状态 - 添加API测试面板
  const renderError = () => {
    // 创建测试API连接的函数
    const testApiConnection = async () => {
      setError('正在测试API连接...');
      
      const testResults = [];
      for (const port of [5001, 5000, 3000, 8080]) {
        try {
          const start = Date.now();
          const response = await fetch(`http://localhost:${port}/api/ping`, {
            signal: AbortSignal.timeout(2000)
          });
          const elapsed = Date.now() - start;
          
          if (response.ok) {
            const data = await response.json();
            testResults.push({
              port, 
              status: 'success', 
              time: elapsed,
              data
            });
          } else {
            testResults.push({
              port,
              status: 'error',
              time: elapsed,
              error: `HTTP状态 ${response.status}`
            });
          }
        } catch (err) {
          testResults.push({
            port,
            status: 'error',
            error: err.message
          });
        }
      }
      
      // 更新错误信息，显示连接测试结果
      const successfulPort = testResults.find(r => r.status === 'success');
      if (successfulPort) {
        setError(`API连接测试完成。成功连接到端口 ${successfulPort.port}，但用户数据获取失败。请检查用户ID和令牌是否正确。`);
        localStorage.setItem('workingApiBaseUrl', `http://localhost:${successfulPort.port}`);
      } else {
        setError(`API连接测试完成。无法连接到任何API端点。请确保后端服务器正在运行。`);
      }
      
      // 返回测试结果，用于UI显示
      return testResults;
    };
    
    return (
      <div className="error-container">
        <div className="error-icon">⚠️</div>
        <h3 className="error-title">加载失败</h3>
        <p className="error-message">{error}</p>
        
        {/* 错误调试信息 */}
        <div style={{ margin: '15px 0', padding: '10px', background: '#f8f9fa', borderRadius: '4px', fontSize: '14px' }}>
          <p>服务器状态: {serverStatus.checked ? (serverStatus.online ? '在线' : '离线') : '未检查'}</p>
          {serverStatus.baseUrl && <p>成功的API地址: {serverStatus.baseUrl}</p>}
          <p>当前模式: {offlineMode ? '离线' : '在线'}</p>
          <p>Token状态: {localStorage.getItem('token') ? '已存储' : '未存储'}</p>
          <p>用户ID: {localStorage.getItem('userId') || '未找到'}</p>
          <p>API基础URL: {localStorage.getItem('workingApiBaseUrl') || '未设置'}</p>
        </div>
        
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button 
            className="error-button"
            onClick={() => window.location.reload()}
          >
            重新加载页面
          </button>
          <button 
            className="error-button"
            onClick={forceRefresh}
            style={{ background: '#4299e1' }}
          >
            重试获取数据
          </button>
          <button 
            className="error-button"
            onClick={testApiConnection}
            style={{ background: '#38A169' }}
          >
            测试API连接
          </button>
          <button 
            className="error-button"
            onClick={handleRelogin}
            style={{ background: '#f56565' }}
          >
            重新登录
          </button>
        </div>
        
        {/* 网络问题解决建议 */}
        <div style={{ marginTop: '20px', padding: '15px', background: '#EDF2F7', borderRadius: '8px', fontSize: '14px' }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#2D3748' }}>网络问题解决建议</h4>
          <ul style={{ margin: '0', paddingLeft: '20px', color: '#4A5568' }}>
            <li>确保后端服务器已启动并运行在端口5001或5000</li>
            <li>检查控制台是否有API连接错误</li>
            <li>检查网络连接是否稳定</li>
            <li>尝试清除浏览器缓存并重新登录</li>
            <li>检查token是否有效</li>
          </ul>
        </div>
      </div>
    );
  };
  
  // 渲染个人信息
  const renderUserProfile = () => {
    if (!userProfile) return null;
    
    // 计算加入天数
    const joinDate = new Date(userProfile.created_at);
    const currentDate = new Date();
    const diffTime = Math.abs(currentDate - joinDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // 最大分数为计算进度条
    const maxScore = 100;
    
    return (
      <div className="profile-layout">
        {/* 左侧边栏 */}
        <div className="profile-sidebar">
          {/* 个人信息卡片 */}
          <div className="profile-card">
            <div className="profile-header">
              <div className="profile-avatar">
                {getInitialAvatar(userProfile.nickname)}
              </div>
              <h1 className="profile-title">{userProfile.nickname}</h1>
              <p className="profile-subtitle">用户ID: {userProfile.id}</p>
            </div>
            
            <div className="profile-info">
              <div className="info-group">
                <div className="info-label">账号</div>
                <div className="info-value">{userProfile.account}</div>
              </div>
              
              <div className="info-group">
                <div className="info-label">总评分</div>
                <div className="info-value">{userProfile.totalScore?.toFixed(1) || '0.0'}</div>
              </div>
              
              <div className="info-group">
                <div className="info-label">注册时间</div>
                <div className="info-value">
                  {userProfile?.created_at ? formatDate(userProfile.created_at) : '未知'}
                  {process.env.NODE_ENV === 'development' && userProfile?.created_at && (
                    <div className="debug-info" style={{ fontSize: '10px', color: '#666' }}>
                      原始值: {userProfile.created_at}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* 统计卡片 - 上移到个人信息卡片下方 */}
          <div className="stats-card">
            <h2 className="stats-title">活动统计</h2>
            
            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-value">{userProfile.hostRoomCount || 0}</div>
                <div className="stat-label">创建的房间</div>
              </div>
              
              <div className="stat-item">
                <div className="stat-value">{userProfile.joinedRoomCount || 0}</div>
                <div className="stat-label">参与的房间</div>
              </div>
              
              <div className="stat-item">
                <div className="stat-value">{userProfile.soupCount || 0}</div>
                <div className="stat-label">创建的海龟汤</div>
              </div>
              
              <div className="stat-item">
                <div className="stat-value">{diffDays}</div>
                <div className="stat-label">加入天数</div>
              </div>
            </div>
            
            {/* 添加刷新按钮 - 移到这里 */}
            <div style={{ textAlign: 'center', marginTop: '15px' }}>
              <button
                onClick={forceRefresh}
                style={{
                  background: '#4299e1',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '8px 15px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                刷新数据
              </button>
            </div>
          </div>
        </div>
        
        {/* 右侧主要内容 */}
        <div className="profile-main">
          {/* 评分卡片 */}
          <div className="scores-card">
            <h2 className="scores-title">能力评分</h2>
            
            <div className="score-bars">
              <div className="score-bar">
                <div className="score-header">
                  <div className="score-label">解谜能力</div>
                  <div className="score-value">{(userProfile.puzzle_score || 0).toFixed(1)}</div>
                </div>
                <div className="score-progress">
                  <div 
                    className="score-fill" 
                    style={{ width: `${((userProfile.puzzle_score || 0) / maxScore) * 100}%` }}
                  ></div>
                </div>
              </div>
              
              <div className="score-bar">
                <div className="score-header">
                  <div className="score-label">主持能力</div>
                  <div className="score-value">{(userProfile.hosting_score || 0).toFixed(1)}</div>
                </div>
                <div className="score-progress">
                  <div 
                    className="score-fill" 
                    style={{ width: `${((userProfile.hosting_score || 0) / maxScore) * 100}%` }}
                  ></div>
                </div>
              </div>
              
              <div className="score-bar">
                <div className="score-header">
                  <div className="score-label">创作能力</div>
                  <div className="score-value">{(userProfile.creation_score || 0).toFixed(1)}</div>
                </div>
                <div className="score-progress">
                  <div 
                    className="score-fill" 
                    style={{ width: `${((userProfile.creation_score || 0) / maxScore) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
            
            <p className="join-date">
              您已经加入 Soulp {diffDays} 天
            </p>
          </div>
          
          {/* 最近活动 */}
          <div className="activities-card">
            <h2 className="activities-title">最近活动</h2>
            
            {/* 近期活动列表 */}
            {userProfile.joinedRoomCount > 0 || userProfile.hostRoomCount > 0 || userProfile.soupCount > 0 ? (
              <div>
                {userProfile.hostRoomCount > 0 && (
                  <div className="activity-item">
                    <div className="activity-icon">🎮</div>
                    <div className="activity-content">
                      <div className="activity-title">您创建了 {userProfile.hostRoomCount} 个房间</div>
                      <div className="activity-time">最近活动</div>
                    </div>
                  </div>
                )}
                
                {userProfile.joinedRoomCount > 0 && (
                  <div className="activity-item">
                    <div className="activity-icon">🏠</div>
                    <div className="activity-content">
                      <div className="activity-title">您参与了 {userProfile.joinedRoomCount} 个房间</div>
                      <div className="activity-time">最近活动</div>
                    </div>
                  </div>
                )}
                
                {userProfile.soupCount > 0 && (
                  <div 
                    className="activity-item activity-item-clickable" 
                    onClick={() => {
                      console.log('点击海龟汤活动项，用户ID:', userProfile.id);
                      navigate(`/profile/soups/${userProfile.id}`); // 导航到UserSoupList页面
                    }}
                    style={{
                      cursor: 'pointer',
                      position: 'relative'
                    }}
                  >
                    <div className="activity-icon">🍲</div>
                    <div className="activity-content">
                      <div className="activity-title">您创建了 {userProfile.soupCount} 个海龟汤</div>
                      <div className="activity-time">最近活动</div>
                    </div>
                    <button 
                      className="view-details-btn"
                      style={{
                        position: 'absolute',
                        right: '10px',
                        bottom: '10px',
                        padding: '4px 8px',
                        background: '#E67E22',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        console.log('点击查看详情按钮，导航到UserSoupList页面');
                        navigate(`/profile/soups/${userProfile.id}`); // 导航到UserSoupList页面
                      }}
                    >
                      查看详情
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#666' }}>
                <p>暂无活动记录</p>
                <p style={{ marginTop: '10px', fontSize: '14px' }}>创建房间或海龟汤，开始您的探索之旅吧！</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="profile-container">
      {/* 添加测试导航按钮 */}
      <div style={{ 
        position: 'fixed', 
        top: '70px', 
        right: '20px', 
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}>
        <button 
          onClick={() => testNavigate(`/profile/soups/${userProfile?.id || localStorage.getItem('userId')}`)}
          style={{
            padding: '8px 16px',
            background: '#2ecc71',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          测试导航到用户汤列表
        </button>
      </div>
      
      {/* 导航栏 */}
      <nav className="profile-navbar">
        <div className="navbar-content">
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginRight: '20px' }}>Soulp</h1>
            <div style={{ display: 'flex', gap: '20px' }}>
              <Link to="/" style={{ color: 'white', textDecoration: 'none' }}>首页</Link>
              <Link to="/soups" style={{ color: 'white', textDecoration: 'none' }}>海龟汤题库</Link>
            </div>
          </div>
          
          <div style={{ position: 'relative' }} ref={userMenuRef}>
            <button
              style={{
                display: 'flex',
                alignItems: 'center',
                background: 'none',
                border: 'none',
                color: 'white',
                cursor: 'pointer'
              }}
              onClick={toggleUserMenu}
            >
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: '#E67E22',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '8px',
                fontWeight: 'bold'
              }}>
                {getInitialAvatar(userProfile?.nickname || localStorage.getItem('nickname'))}
              </div>
              <span>{userProfile?.nickname || localStorage.getItem('nickname') || '用户'}</span>
              <svg style={{ marginLeft: '8px', width: '16px', height: '16px' }} viewBox="0 0 24 24">
                <path fill="none" stroke="currentColor" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {isUserMenuOpen && (
              <div className="user-menu" style={{
                position: 'absolute',
                top: '50px',
                right: '0',
                width: '200px',
                background: 'white',
                borderRadius: '8px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                zIndex: 100
              }}>
                <div style={{ padding: '15px', borderBottom: '1px solid #eee' }}>
                  <p style={{ fontWeight: '600', marginBottom: '5px' }}>
                    {userProfile?.nickname || localStorage.getItem('nickname') || '用户'}
                  </p>
                  <p style={{ fontSize: '13px', color: '#666', marginBottom: '3px' }}>
                    用户ID: {userProfile?.id || localStorage.getItem('userId')}
                  </p>
                  <p style={{ fontSize: '13px', color: '#666' }}>
                    账号: {userProfile?.account || localStorage.getItem('account') || '未知'}
                  </p>
                </div>
                
                <div style={{ padding: '10px 0' }}>
                  <Link 
                    to="/"
                    style={{
                      display: 'block',
                      padding: '12px 15px',
                      textDecoration: 'none',
                      color: '#333',
                      fontSize: '14px'
                    }}
                  >
                    返回首页
                  </Link>
                  
                  <button
                    onClick={handleLogout}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '12px 15px',
                      background: 'none',
                      border: 'none',
                      color: '#DC2626',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    退出登录
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>
      
      {/* 主内容区域 */}
      <div className="profile-content">
        {isLoading ? renderLoading() : renderUserProfile()}
      </div>
    </div>
  );
}

export default UserProfile; 