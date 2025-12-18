import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';
import './Home.css'; // 导入Home样式

function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const [rooms, setRooms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // 用户信息状态
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);
  const userInfo = {
    nickname: localStorage.getItem('nickname') || '游客',
    userId: localStorage.getItem('userId') || '未登录',
    account: localStorage.getItem('account') || '未设置'
  };
  
  // 创建房间表单状态
  const [isCreateRoomModalOpen, setIsCreateRoomModalOpen] = useState(false);
  const [roomForm, setRoomForm] = useState({
    roomName: '',
    isPrivate: false,
    password: ''
  });
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 检查用户登录状态
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      console.log('未检测到登录信息，重定向到登录页面');
      navigate('/login');
    }
    
    // 检查是否有房间被销毁的状态
    if (location.state && location.state.roomDestroyed) {
      console.log(`房间 ${location.state.roomId} 已被销毁，从列表中移除`);
      // 清除导航状态，防止刷新页面时重复处理
      window.history.replaceState({}, document.title);
    }
  }, [navigate, location]);

  // 获取房间列表
    const fetchRooms = async () => {
      try {
        const { data } = await api.get('/rooms');
      
      // 确保每个房间都有必要的字段
      let processedData = Array.isArray(data) ? data.map(room => ({
        ...room,
        name: room.name || `海龟汤房间 ${room.id}`,
        hostNickname: room.hostNickname || userInfo.nickname || '未知主持人'
      })) : [];
      
      // 过滤已销毁的房间
      processedData = processedData.filter(room => {
        // 检查localStorage中是否有标记表示该房间已被销毁
        const isDestroyed = localStorage.getItem(`room_${room.id}_destroyed`) === 'true';
        if (isDestroyed) {
          console.log(`过滤掉已销毁的房间: ${room.id}`);
          return false;
        }
        return true;
      });
      
      // 如果有传入的已销毁房间ID，确保从列表中过滤掉
      if (location.state && location.state.roomDestroyed) {
        processedData = processedData.filter(room => room.id !== location.state.roomId);
      }
      
      setRooms(processedData);
      setIsLoading(false);
      setError(null); // 清除可能存在的错误
      } catch (err) {
      console.error('获取房间列表失败:', err);
      
      // 使用模拟数据（在开发阶段）
      let mockRooms = [
        {
          id: 1,
          name: '海龟汤初级房',
          created_at: new Date().toISOString(),
          hostNickname: userInfo.nickname,
          playerCount: 3
        },
        {
          id: 2,
          name: '海龟汤高级房',
          created_at: new Date(Date.now() - 3600000).toISOString(),
          hostNickname: userInfo.nickname,
          playerCount: 5
        }
      ];
      
      // 过滤掉已销毁的房间
      mockRooms = mockRooms.filter(room => {
        const isDestroyed = localStorage.getItem(`room_${room.id}_destroyed`) === 'true';
        if (isDestroyed) {
          console.log(`过滤掉已销毁的房间: ${room.id}`);
          return false;
        }
        return true;
      });
      
      // 如果有传入的已销毁房间ID，确保从列表中过滤掉
      if (location.state && location.state.roomDestroyed) {
        mockRooms = mockRooms.filter(room => room.id !== location.state.roomId);
      }
      
      setRooms(mockRooms);
        setIsLoading(false);
      // 在开发环境可以不显示错误，使用模拟数据
      setError(null);
    }
  };

  useEffect(() => {
    fetchRooms();
    
    // 清理localStorage中的过期房间数据
    const cleanupLocalStorage = () => {
      try {
        // 获取所有localStorage的键
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          // 检查是否是与房间相关的键，并且标记为已销毁
          if (key && key.startsWith('room_') && key.includes('_destroyed') && localStorage.getItem(key) === 'true') {
            const roomId = key.split('_')[1]; // 提取房间ID
            
            // 移除所有与该房间相关的localStorage数据
            localStorage.removeItem(`room_${roomId}_name`);
            localStorage.removeItem(`room_${roomId}_data`);
            
            // 保留destroyed标记24小时，然后自动清除
            setTimeout(() => {
              localStorage.removeItem(`room_${roomId}_destroyed`);
              console.log(`已清理房间 ${roomId} 的销毁标记`);
            }, 24 * 60 * 60 * 1000);
          }
        }
      } catch (e) {
        console.error('清理localStorage失败:', e);
      }
    };
    
    // 执行清理
    cleanupLocalStorage();
    
    // 设置定时刷新 (每10秒)
    const intervalId = setInterval(fetchRooms, 10000);
    
    // 点击外部关闭用户菜单
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setIsUserMenuOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      clearInterval(intervalId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [location.state]); // 添加location.state作为依赖，当从房间返回时重新获取房间列表

  // 处理房间表单变化
  const handleRoomFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setRoomForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };
  
  // 创建房间
  const handleCreateRoom = async (e) => {
    e.preventDefault();
    setFormError('');
    
    // 表单验证
    if (!roomForm.roomName.trim()) {
      setFormError('房间名称不能为空');
      return;
    }
    
    if (roomForm.roomName.length > 20) {
      setFormError('房间名称不能超过20个字符');
      return;
    }
    
    if (roomForm.isPrivate && !roomForm.password) {
      setFormError('私密房间需要设置密码');
      return;
    }
    
    setIsSubmitting(true);
    
    // 获取是否是开发模式
    const isDevelopment = process.env.NODE_ENV === 'development';
    console.log('当前环境:', isDevelopment ? '开发环境' : '生产环境');
    
    try {
      console.log('开始创建房间:', roomForm.roomName);
      
      // 准备请求数据 - 修改字段名称与后端一致
      const roomData = {
        name: roomForm.roomName,           // 改为name以匹配后端期望的字段名
        isPrivate: roomForm.isPrivate,
        password: roomForm.password,
        hostNickname: userInfo.nickname
      };
      
      console.log('发送的房间数据:', roomData);
      
      // 发送API请求
      const response = await api.post('/rooms', roomData);
      console.log('创建房间API响应:', response);
      
      if (response.status === 201 || response.status === 200) {
        console.log('房间创建成功, 接收到的数据:', response.data);
        
        // 获取房间ID
        const roomId = response.data.roomId;
        
        if (!roomId) {
          throw new Error('API返回成功但没有提供房间ID');
        }
        
        // 保存房间名称到localStorage
        localStorage.setItem(`room_${roomId}_name`, roomForm.roomName);
        // 确保房间没有被标记为已销毁
        localStorage.removeItem(`room_${roomId}_destroyed`);
        
        // 手动添加到房间列表
        setRooms(prev => [
          {
            id: roomId,
            name: roomForm.roomName,
            created_at: new Date().toISOString(),
            hostNickname: userInfo.nickname,
            playerCount: 1,
            maxPlayers: 8
          },
          ...prev
        ]);
        
        // 关闭模态框并重置表单
        setIsCreateRoomModalOpen(false);
        setRoomForm({
          roomName: '',
          isPrivate: false,
          password: ''
        });
        
        // 跳转到新创建的房间
        navigate(`/room/${roomId}`);
      } else {
        throw new Error(`API返回非成功状态码: ${response.status}`);
      }
    } catch (err) {
      console.error('创建房间失败:', err);
      console.error('错误详情:', err.response?.data || err.message || '未知错误');
      
      if (isDevelopment) {
        // 在开发环境中使用模拟数据，但提示用户
        console.log('开发环境下使用模拟房间数据');
        
        const mockRoomId = Date.now();
        
        // 保存房间名称到localStorage
        localStorage.setItem(`room_${mockRoomId}_name`, roomForm.roomName);
        // 确保房间没有被标记为已销毁
        localStorage.removeItem(`room_${mockRoomId}_destroyed`);
        
        // 手动添加到房间列表
        setRooms(prev => [
          {
            id: mockRoomId,
            name: roomForm.roomName,
            created_at: new Date().toISOString(),
            hostNickname: userInfo.nickname,
            playerCount: 1,
            maxPlayers: 8
          },
          ...prev
        ]);
        
        // 关闭模态框并重置表单
        setIsCreateRoomModalOpen(false);
        setRoomForm({
          roomName: '',
          isPrivate: false,
          password: ''
        });
        
        // 显示警告
        alert(`注意：后端API调用失败，使用前端模拟数据创建房间。\n错误信息: ${err.message || '未知错误'}`);
        
        // 跳转到新创建的房间
        navigate(`/room/${mockRoomId}`);
      } else {
        // 生产环境下显示错误
        setFormError(err.response?.data?.error || '创建房间失败，请稍后再试');
      }
    } finally {
      setIsSubmitting(false);
    }
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

  // 首字母头像
  const getInitial = (name) => {
    if (!name || name === '游客' || name === 'undefined' || name === '未登录') {
      return '?';
    }
    return name.charAt(0).toUpperCase();
  };

  // 渲染房间内容
  const renderRoomsContent = () => {
    if (isLoading) {
      return (
        <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px 0'}}>
          <div style={{textAlign: 'center'}}>
            <div className="loading-spinner"></div>
            <p style={{marginTop: '20px', color: '#666'}}>加载中...</p>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div style={{
          maxWidth: '600px',
          margin: '0 auto',
          padding: '30px',
          background: '#FEE2E2',
          borderRadius: '10px',
          textAlign: 'center',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
        }}>
          <div style={{fontSize: '30px', marginBottom: '20px', color: '#DC2626'}}>⚠️</div>
          <p style={{fontSize: '16px', fontWeight: '500', marginBottom: '20px', color: '#B91C1C'}}>{error}</p>
          <button
            onClick={() => fetchRooms()}
            style={{
              background: '#FEE2E2',
              color: '#B91C1C',
              border: '1px solid #B91C1C',
              padding: '10px 20px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            重试
          </button>
        </div>
      );
    }

    if (rooms.length === 0) {
      return (
        <div style={{
          maxWidth: '600px',
          margin: '0 auto',
          padding: '40px',
          background: 'white',
          borderRadius: '10px',
          textAlign: 'center',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
        }}>
          <div style={{fontSize: '80px', marginBottom: '20px', color: '#ccc'}}>📦</div>
          <h3 style={{fontSize: '24px', fontWeight: '500', marginBottom: '15px'}}>暂无活跃房间</h3>
          <p style={{fontSize: '16px', marginBottom: '25px', color: '#666'}}>成为第一个创建房间的人吧！</p>
          <button
            onClick={() => setIsCreateRoomModalOpen(true)}
            style={{
              background: '#E67E22',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '16px'
            }}
          >
            创建第一个房间
          </button>
        </div>
      );
    }

    // 房间列表
    return (
      <div className="rooms-grid">
        {rooms.map(room => (
          <Link 
            key={room.id}
            to={`/room/${room.id}`}
            className="room-card"
            onClick={async (e) => {
              e.preventDefault(); // 阻止默认导航，自己控制导航流程
              
              // 检查房间是否已被销毁
              const isDestroyed = localStorage.getItem(`room_${room.id}_destroyed`) === 'true';
              if (isDestroyed) {
                alert('该房间已关闭，无法进入');
                
                // 刷新房间列表，移除已销毁的房间
                fetchRooms();
                return;
              }
              
              // 验证房间是否存在
              try {
                const { exists, error } = await api.checkRoomExists(room.id);
                
                if (!exists) {
                  alert(`无法进入房间: ${error}`);
                  // 标记房间为已销毁，从列表中移除
                  localStorage.setItem(`room_${room.id}_destroyed`, 'true');
                  fetchRooms();
                  return;
                }
                
                // 房间存在，可以进入
                console.log(`房间 ${room.id} 存在，正在进入...`);
                
                // 保存房间名称到localStorage
                localStorage.setItem(`room_${room.id}_name`, room.name || `海龟汤房间 ${room.id}`);
                console.log(`正在进入房间: ${room.id}, 名称: ${room.name}`);
                
                // 导航到房间
                navigate(`/room/${room.id}`);
              } catch (err) {
                console.error('检查房间状态失败:', err);
                
                // 即使检查失败，也允许用户进入（开发环境）
                localStorage.setItem(`room_${room.id}_name`, room.name || `海龟汤房间 ${room.id}`);
                navigate(`/room/${room.id}`);
              }
            }}
          >
            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '15px'}}>
              <h3 style={{
                fontSize: '18px',
                fontWeight: '600',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: 'calc(100% - 80px)'
              }}>
                {room.name || `海龟汤房间 ${room.id}`}
              </h3>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '3px 10px',
                background: '#EDE9FE',
                color: '#6D28D9',
                borderRadius: '20px',
                fontSize: '14px',
                fontWeight: '500',
                whiteSpace: 'nowrap'
              }}>
                👥 {room.playerCount || 0}人
              </span>
            </div>
            
            <div style={{margin: '15px 0', fontSize: '14px', color: '#666'}}>
              <p>创建于 {new Date(room.created_at).toLocaleString()}</p>
            </div>
            
            <div style={{
              display: 'flex',
              alignItems: 'center',
              paddingTop: '10px',
              borderTop: '1px solid #eee',
              fontSize: '14px',
              color: '#444'
            }}>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: '#2C3E50',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '10px',
                fontWeight: '500',
                flexShrink: 0
              }}>
                {getInitial(room.hostNickname || '主持人')}
              </div>
              <span style={{
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                主持人：{room.hostNickname || '未知'}
              </span>
            </div>
          </Link>
        ))}
      </div>
    );
  };

  // 渲染用户信息区域
  const renderUserInfo = () => {
    return (
      <div className="user-info" ref={userMenuRef}>
        <div 
          className="user-info-button"
          onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
          onDoubleClick={() => navigate('/profile')}
        >
          <div className="user-avatar">
            {getInitial(userInfo.nickname || '用户')}
          </div>
          <span>{userInfo.nickname || '用户'}</span>
          <svg style={{ marginLeft: '8px', width: '16px', height: '16px' }} viewBox="0 0 24 24">
            <path fill="none" stroke="currentColor" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        {/* 用户菜单 */}
        {isUserMenuOpen && (
          <div className="user-menu">
            <div className="user-menu-header">
              <div className="user-menu-name">
                {userInfo.nickname || '用户'}
              </div>
              <div className="user-menu-id">
                用户ID: {userInfo.userId || '未知'}
              </div>
              <div className="user-menu-account">
                账号: {userInfo.account || '未知'}
              </div>
            </div>
            
            <div>
              <div
                className="user-menu-item"
                onClick={() => navigate('/profile')}
              >
                个人中心
              </div>
              <div
                className="user-menu-item user-menu-logout"
                onClick={handleLogout}
              >
                退出登录
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // 创建房间框
  const renderCreateRoomModal = () => {
    // ... existing code ...
  };

  // 测试API连接
  const testApiConnection = async () => {
    try {
      const result = await api.pingServer();
      alert(`API连接成功: ${JSON.stringify(result)}`);
    } catch (error) {
      alert(`API连接失败: ${error.message || '未知错误'}`);
      console.error('API连接测试失败:', error);
    }
  };

  return (
    <div className="home-container">
      {/* 导航栏 */}
      <nav style={{
        backgroundColor: '#1A1A2E',
        color: 'white',
        padding: '12px 24px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          maxWidth: '1200px',
          margin: '0 auto'
        }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginRight: '20px' }}>Soulp</h1>
            <div style={{ display: 'flex', gap: '20px' }}>
              <span style={{ color: '#E67E22', fontWeight: '500' }}>首页</span>
              <Link to="/soups" style={{ color: 'white', textDecoration: 'none' }}>海龟汤题库</Link>
              <Link to="/creator" style={{ color: 'white', textDecoration: 'none' }}>创作中心</Link>
              <button 
                onClick={testApiConnection}
                style={{
                  background: 'none',
                  border: '1px solid #E67E22',
                  color: '#E67E22',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                测试API连接
              </button>
            </div>
          </div>
          
          {renderUserInfo()}
        </div>
      </nav>
      
      {/* 主内容区域 */}
      <div className="main-content">
        <div className="content-container">
          <div className="title-bar">
            <h2 style={{fontSize: '22px', fontWeight: 'bold', color: '#333'}}>当前活跃房间</h2>
            <button
              onClick={() => setIsCreateRoomModalOpen(true)}
              className="create-room-btn"
            >
              <svg style={{width: '20px', height: '20px', marginRight: '8px'}} viewBox="0 0 24 24">
                <path fill="none" stroke="currentColor" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              创建房间
            </button>
          </div>
          
          {/* 房间列表内容 */}
          {renderRoomsContent()}
        </div>
      </div>
      
      {/* 创建房间模态框 */}
      {isCreateRoomModalOpen && (
        <div className="modal-overlay">
          <div
            className="modal-container"
            onClick={e => e.stopPropagation()}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px'
            }}>
              <h3 style={{fontSize: '22px', fontWeight: 'bold'}}>创建新房间</h3>
              <button
                onClick={() => setIsCreateRoomModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#666',
                  display: 'flex'
                }}
              >
                ×
              </button>
            </div>
            
            {formError && (
              <div style={{
                padding: '15px',
                background: '#FEE2E2',
                borderRadius: '8px',
                marginBottom: '20px',
                color: '#B91C1C',
                border: '1px solid #FCA5A5'
              }}>
                <p style={{fontWeight: '500'}}>{formError}</p>
              </div>
            )}
            
            <form onSubmit={handleCreateRoom}>
              <div style={{marginBottom: '20px'}}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  marginBottom: '8px',
                  color: '#444'
                }}>
                  房间名称
                </label>
                <input
                  type="text"
                  name="roomName"
                  value={roomForm.roomName}
                  onChange={handleRoomFormChange}
                  style={{
                    width: '100%',
                    padding: '12px 15px',
                    borderRadius: '8px',
                    border: '1px solid #ddd',
                    fontSize: '16px'
                  }}
                  placeholder="给你的房间起个名字(最多20字符)"
                  maxLength={20}
                />
                <p style={{
                  textAlign: 'right',
                  fontSize: '12px',
                  color: '#666',
                  marginTop: '8px'
                }}>
                  {roomForm.roomName.length}/20
                </p>
              </div>
              
              <div style={{marginBottom: '20px'}}>
                <label style={{display: 'flex', alignItems: 'center', cursor: 'pointer'}}>
                  <input
                    type="checkbox"
                    name="isPrivate"
                    checked={roomForm.isPrivate}
                    onChange={handleRoomFormChange}
                    style={{marginRight: '10px', width: '18px', height: '18px'}}
                  />
                  <span style={{fontSize: '14px', fontWeight: '500', color: '#444'}}>设为私密房间</span>
                </label>
              </div>
              
              {roomForm.isPrivate && (
                <div style={{marginBottom: '20px'}}>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '500',
                    marginBottom: '8px',
                    color: '#444'
                  }}>
                    房间密码
                  </label>
                  <input
                    type="password"
                    name="password"
                    value={roomForm.password}
                    onChange={handleRoomFormChange}
                    style={{
                      width: '100%',
                      padding: '12px 15px',
                      borderRadius: '8px',
                      border: '1px solid #ddd',
                      fontSize: '16px'
                    }}
                    placeholder="设置房间密码"
                  />
                </div>
              )}
              
              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '15px',
                marginTop: '25px'
              }}>
                <button
                  type="button"
                  onClick={() => setIsCreateRoomModalOpen(false)}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    border: '1px solid #ddd',
                    background: 'white',
                    color: '#444',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    background: isSubmitting ? 'rgba(230, 126, 34, 0.7)' : '#E67E22',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
                  }}
                >
                  {isSubmitting ? '创建中...' : '创建房间'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;