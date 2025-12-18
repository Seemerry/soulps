import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './Room.css';
import api from '../services/api';
import axios from 'axios';
import rtcService from '../services/rtcService'; // 导入WebRTC服务

// 添加错误边界组件
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("组件渲染错误:", error);
    console.error("错误组件栈:", errorInfo.componentStack);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-container" style={{
          padding: '20px',
          margin: '20px',
          backgroundColor: 'rgba(255, 0, 0, 0.1)',
          border: '1px solid red',
          borderRadius: '5px',
          color: 'white'
        }}>
          <h2>页面加载错误</h2>
          <p>抱歉，页面渲染时发生错误。请尝试刷新页面或返回首页。</p>
          <details>
            <summary>错误详情</summary>
            <pre>{this.state.error && this.state.error.toString()}</pre>
            <pre>{this.state.errorInfo && this.state.errorInfo.componentStack}</pre>
          </details>
          <div style={{marginTop: '20px'}}>
            <button onClick={() => window.location.reload()} style={{
              padding: '8px 16px',
              marginRight: '10px',
              backgroundColor: '#4A4A6A',
              border: 'none',
              borderRadius: '4px',
              color: 'white',
              cursor: 'pointer'
            }}>
              刷新页面
            </button>
            <button onClick={() => window.location.href = '/'} style={{
              padding: '8px 16px',
              backgroundColor: '#6A4A8A',
              border: 'none',
              borderRadius: '4px',
              color: 'white',
              cursor: 'pointer'
            }}>
              返回首页
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function Room() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // 初始化日志
  console.log(`Room组件初始化，房间ID: ${id}, 时间戳: ${new Date().toISOString()}`);
  
  // 基本错误状态
  const [hasError, setHasError] = useState(false);
  const [errorInfo, setErrorInfo] = useState(null);
  
  // 添加一个基础的空白状态
  const [isLoading, setIsLoading] = useState(true);
  
  // 获取用户信息
  const userNickname = localStorage.getItem('nickname') || '游客';
  console.log(`当前用户: ${userNickname}, userId: ${localStorage.getItem('userId') || '未设置'}`);
  
  // 状态管理
  const [roomInfo, setRoomInfo] = useState({
    name: `海龟汤房间 ${id}`,
    host: userNickname,
    createdAt: new Date().toLocaleString(),
    playerCount: 1, // 默认至少有一人（当前用户）
    maxPlayers: 8,
    status: '游戏中' // 准备中、游戏中、已结束
  });
  
  // 判断当前用户是否是房主
  const [isHost, setIsHost] = useState(true);
  
  const [userInfo, setUserInfo] = useState({
    nickname: userNickname,
    userId: localStorage.getItem('userId') || '未登录',
    account: localStorage.getItem('account') || '未登录'
  });
  
  const [showRoomInfo, setShowRoomInfo] = useState(true);
  const [messages, setMessages] = useState([
    { type: 'system', text: '欢迎来到海龟汤房间！', time: new Date().toLocaleString() },
    { type: 'user', user: { nickname: '系统', avatar: '?' }, text: '海龟汤游戏规则：主持人出题，玩家通过提问逐步解谜。问题必须能用"是"或"否"回答。', time: new Date().toLocaleString() },
  ]);
  const [inputText, setInputText] = useState('');
  const [micPositions, setMicPositions] = useState(Array(8).fill().map((_, i) => ({
    id: i,
    nickname: i === 0 ? userNickname : null,
    isHost: i === 0,
    isMuted: true,
    isSpeaking: false
  })));
  const [soupData, setSoupData] = useState({
    title: '神秘的海龟汤',
    status: '游戏中', // 准备中、游戏中、已结束
    content: [], // 初始化为空数组，用于存放问答记录
    answer: '', // 初始化为空字符串，用于存放谜底
    hint: '',   // 提示信息
  });
  
  // 添加海龟汤选择状态
  const [showSoupSelection, setShowSoupSelection] = useState(false);
  const [availableSoups, setAvailableSoups] = useState([]);
  const [selectedSoup, setSelectedSoup] = useState(null);
  const [soupLoading, setSoupLoading] = useState(false);
  
  // WebRTC状态
  const [rtcConnected, setRtcConnected] = useState(false);
  const [micInitialized, setMicInitialized] = useState(false);
  
  // 状态变化监听器 - 调试用
  useEffect(() => {
    console.log('showSoupSelection状态变化:', showSoupSelection);
  }, [showSoupSelection]);
  
  useEffect(() => {
    console.log('availableSoups状态变化:', availableSoups);
  }, [availableSoups]);

  // 引用
  const chatMessagesRef = useRef(null);
  const textInputRef = useRef(null);
  
  // 获取房间数据
  const fetchRoomData = async () => {
    console.log(`开始获取房间数据，ID: ${id}, 时间戳: ${new Date().toISOString()}`);
    try {
      // 使用API获取房间数据
      console.log('尝试从API获取房间数据...');
      const token = localStorage.getItem('token');
      console.log(`当前令牌状态: ${token ? '已设置' : '未设置'}, 长度: ${token?.length || 0}`);
      
      const response = await api.get(`/rooms/${id}`);
      const roomData = response.data;
      
      console.log('获取到的房间数据:', roomData);
      
      // 更新房间信息
      setRoomInfo({
        name: roomData.name || `海龟汤房间 ${id}`,
        host: roomData.hostNickname || userNickname,
        createdAt: new Date(roomData.created_at || Date.now()).toLocaleString(),
        playerCount: roomData.playerCount || 1,
        maxPlayers: roomData.maxPlayers || 8,
        status: roomData.status || '游戏中'
      });
      
      // 判断当前用户是否是房主
      if (roomData.host_id === Number(localStorage.getItem('userId'))) {
        console.log('当前用户是房主 (通过ID比较)');
        setIsHost(true);
      } else if (roomData.hostNickname === userNickname) {
        console.log('当前用户是房主 (通过昵称比较)');
        setIsHost(true);
      } else {
        console.log('当前用户不是房主', {
          roomDataHostId: roomData.host_id,
          userId: localStorage.getItem('userId'),
          roomDataHostNickname: roomData.hostNickname,
          userNickname
        });
        setIsHost(false);
      }
      
    } catch (err) {
      console.error('获取房间数据失败:', err);
      console.error('详细错误信息:', err.response?.data || '无详细信息');
      console.error('错误状态码:', err.response?.status || '无状态码');
      
      // 检查错误类型，如果是404错误，可能房间不存在
      if (err.response?.status === 404) {
        console.log('房间不存在，尝试重新创建...');
        // 这里可以添加创建房间的逻辑，或者直接导航回首页
        alert('该房间不存在或已被删除，将返回首页');
        navigate('/');
        return;
      }
      
      // 如果是401错误，可能是未登录或token失效
      if (err.response?.status === 401) {
        console.log('未授权访问，可能需要重新登录');
        const token = localStorage.getItem('token');
        if (!token) {
          alert('请先登录后再访问房间');
          navigate('/login');
          return;
        } else {
          alert('登录已过期，请重新登录');
          navigate('/login');
          return;
        }
      }
      
      // 如果API调用失败，使用模拟数据
      console.log('API调用失败，使用本地存储的房间数据或默认数据');
      
      // 尝试从本地存储获取房间名称
      const storedRoomName = localStorage.getItem(`room_${id}_name`);
      
      setRoomInfo({
        name: storedRoomName || `海龟汤房间 ${id}`,
        host: userNickname,
        createdAt: new Date().toLocaleString(),
        playerCount: 1, // 默认只有自己在房间
        maxPlayers: 8,
        status: '游戏中'
      });
      
      // 设置为房主（在开发环境中，如果API调用失败则默认为房主）
      console.log('API调用失败，默认设置当前用户为房主');
      setIsHost(true);
    }
  };
  
  // 更新房间人数
  const updatePlayerCount = () => {
    try {
      console.log(`尝试更新房间 ${id} 的人数, 当前用户: ${userNickname}`);
      
      // 调用API更新房间人数
      api.put(`/rooms/${id}/join`, { nickname: userNickname })
        .then(response => {
          if (response.data && response.data.playerCount !== undefined) {
            setRoomInfo(prev => ({
              ...prev,
              playerCount: response.data.playerCount
            }));
            console.log('房间人数已更新:', response.data.playerCount);
          } else {
            console.log('API响应中没有包含playerCount:', response.data);
          }
        })
        .catch(err => {
          console.error('更新房间人数失败:', err);
          console.error('错误详情:', err.response?.data || '无详细信息');
        });
    } catch (err) {
      console.error('更新房间人数失败:', err);
    }
  };
  
  // 关闭房间
  const closeRoom = async () => {
    if (!isHost) return;
    
    if (window.confirm('确定要关闭房间吗？所有玩家将被踢出房间。')) {
      try {
        console.log(`开始删除房间，ID: ${id}`);
        // 尝试调用后端API
        const response = await api.delete(`/rooms/${id}`);
        console.log('关闭房间API调用成功:', response);
        
        if (response.status === 200) {
          console.log('房间成功从数据库中删除');
        } else {
          console.warn(`房间删除API返回状态码:  ${response.status}`);
        }
        
        // 删除本地存储的所有与该房间相关的数据
        try {
          localStorage.removeItem(`room_${id}_name`);
          localStorage.removeItem(`room_${id}_data`);
          // 添加一个标记表示房间已被销毁
          localStorage.setItem(`room_${id}_destroyed`, 'true');
          console.log('已清除房间本地数据并标记为已销毁');
        } catch (e) {
          console.error('清除房间本地数据失败:', e);
        }
        
        // 显示成功消息
        alert('房间已成功关闭，正在返回首页...');
        
        // 返回首页
        navigate('/', { state: { roomDestroyed: true, roomId: id } });
      } catch (err) {
        console.error('关闭房间失败:', err);
        console.error('错误详情:', err.response?.data || '无详细信息');
        console.error('错误状态码:', err.response?.status || '无状态码');
        
        // 检查是否是认证错误
        if (err.response?.status === 401) {
          alert('登录已过期，请重新登录后再试');
          navigate('/login');
          return;
        }
        
        // 即使API调用失败，我们也要在前端执行销毁逻辑
        alert('房间已成功关闭，正在返回首页...');
        
        // 删除本地存储的所有与该房间相关的数据
        try {
          localStorage.removeItem(`room_${id}_name`);
          localStorage.removeItem(`room_${id}_data`);
          // 添加一个标记表示房间已被销毁
          localStorage.setItem(`room_${id}_destroyed`, 'true');
          console.log('已清除房间本地数据并标记为已销毁');
        } catch (e) {
          console.error('清除房间本地数据失败:', e);
        }
        
        // 返回首页，并传递房间已销毁的信息
        navigate('/', { state: { roomDestroyed: true, roomId: id } });
      }
    }
  };
  
  // 效果
  useEffect(() => {
    console.log(`Room组件useEffect触发，ID: ${id}, 时间戳: ${new Date().toISOString()}`);
    
    // 使用一个异步函数包装所有初始化步骤
    const initializeRoom = async () => {
      try {
        // 检查登录状态
        const token = localStorage.getItem('token');
        console.log(`身份验证令牌检查: ${token ? '存在' : '不存在'}, 长度: ${token?.length || 0}`);
        
        if (!token) {
          console.log('未检测到登录信息，请先登录');
          navigate('/login');
          return;
        }
        
        // 检查房间是否已被销毁
        const isRoomDestroyed = localStorage.getItem(`room_${id}_destroyed`) === 'true';
        if (isRoomDestroyed) {
          console.log('房间已被销毁，无法进入');
          alert('该房间已关闭，无法进入');
          navigate('/');
          return;
        }
        
        // 立即从localStorage获取房间名称（作为备份数据）
        const storedRoomName = localStorage.getItem(`room_${id}_name`);
        if (storedRoomName) {
          console.log('从localStorage获取到房间名称:', storedRoomName);
          setRoomInfo(prev => ({
            ...prev,
            name: storedRoomName
          }));
        }
        
        // 各个初始化步骤，使用try-catch单独包装避免一个失败影响其他步骤
        // 步骤1: 创建星星背景
        try {
          console.log('步骤1: 创建星星背景');
          createStars();
        } catch (starError) {
          console.error('创建星星背景时出错:', starError);
          // 继续下一步，不要中断
        }
        
        // 步骤2: 获取房间数据
        try {
          console.log('步骤2: 获取房间数据');
          await fetchRoomData();
        } catch (roomError) {
          console.error('获取房间数据时出错:', roomError);
          // 继续下一步，使用默认数据
        }
        
        // 步骤3: 更新房间人数
        try {
          console.log('步骤3: 更新房间人数');
          await updatePlayerCount();
        } catch (countError) {
          console.error('更新房间人数时出错:', countError);
          // 继续下一步
        }
        
        // 步骤4: 发送加入消息
        try {
          console.log('步骤4: 发送加入消息');
          addMessage({
            type: 'system',
            text: `${userInfo.nickname} 加入了房间`,
            time: new Date().toLocaleString()
          });
        } catch (messageError) {
          console.error('添加系统消息时出错:', messageError);
          // 继续下一步
        }
        
        // 步骤5: 测试数据库连接
        try {
          console.log('步骤5: 测试数据库连接');
          await testDatabaseConnection();
        } catch (dbError) {
          console.error('测试数据库连接时出错:', dbError);
          // 继续，不影响核心功能
        }
        
        // 所有初始化步骤完成，设置加载状态为false
        console.log('房间初始化完成');
        setIsLoading(false);
        
      } catch (error) {
        // 捕获整体初始化过程中的任何错误
        console.error('房间组件初始化过程发生错误:', error);
        console.error('错误详情:', error.stack || '无堆栈信息');
        console.error('错误类型:', error.name);
        console.error('错误消息:', error.message);
        setHasError(true);
        setErrorInfo(error);
        setIsLoading(false);
      }
    };
    
    // 执行初始化
    initializeRoom().catch(error => {
      // 兜底错误处理
      console.error('初始化过程未捕获错误:', error);
      setHasError(true);
      setErrorInfo(error);
      setIsLoading(false);
    });
    
    // 清理函数
    return () => {
      console.log(`房间组件卸载，ID: ${id}, 时间戳: ${new Date().toISOString()}`);
      
      try {
        // 离开房间的逻辑
        // 检查房间是否已经被销毁
        const isDestroyed = localStorage.getItem(`room_${id}_destroyed`) === 'true';
        if (isDestroyed) {
          console.log('房间已经被销毁，无需调用离开房间API');
          return; // 如果房间已被销毁，不需要调用API
        }
        
        // 实际应用中应该调用API更新房间人数（减少）
        console.log(`用户 ${userInfo.nickname} 正在离开房间 ${id}`);
        api.put(`/rooms/${id}/leave`, { nickname: userInfo.nickname })
          .then(response => {
            console.log('离开房间成功:', response.data);
          })
          .catch(err => {
            console.error('离开房间API调用失败:', err);
          });
      } catch (err) {
        console.error('离开房间处理错误:', err);
        // 清理函数的错误不应影响应用其他部分
      }
    };
  }, [id, navigate, userInfo.nickname]);
  
  // 测试数据库soup表连接
  const testDatabaseConnection = async () => {
    try {
      console.log('测试数据库soup表连接...');
      const response = await axios.get('http://localhost:5001/api/soup');
      console.log('数据库soup表连接测试结果:', response.data);
      
      if (response.data && Array.isArray(response.data)) {
        console.log('数据库soup表可访问，包含 ' + response.data.length + ' 条记录');
        // 如果有数据，预加载到状态
        if (response.data.length > 0) {
          // 格式化数据
          const formattedSoups = response.data.map(soup => ({
            id: soup.id,
            title: soup.title || '未命名汤',
            difficulty: soup.difficulty || '未知难度',
            tags: Array.isArray(soup.tags) ? soup.tags : 
                (soup.tags ? soup.tags.split(',').map(tag => tag.trim()) : []),
            author: soup.author || soup.created_by || '',
            created_at: soup.created_at || '',
          }));
          
          console.log('预加载的soup表数据:', formattedSoups);
          setAvailableSoups(formattedSoups);
        } else {
          console.log('数据库soup表为空');
        }
      } else {
        console.log('数据库soup表响应格式不正确');
      }
    } catch (error) {
      console.error('数据库soup表连接测试失败:', error);
      console.error('错误详情:', error.response?.data || '无详情');
    }
  };
  
  // 当消息列表更新时，滚动到底部
  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [messages]);
  
  // 创建星星背景
  const createStars = () => {
    try {
      console.log('开始创建星星背景');
      const starryBg = document.querySelector('.starry-background');
      if (!starryBg) {
        console.warn('未找到星空背景元素，无法创建星星');
        return; // 早期返回，避免后续操作
      }
      
      // 清除现有星星
      try {
        while (starryBg.firstChild) {
          starryBg.removeChild(starryBg.firstChild);
        }
      } catch (clearError) {
        console.error('清除现有星星时出错:', clearError);
        // 继续执行，不要因为清除失败而阻止创建新星星
      }
      
      // 限制星星数量，避免性能问题
      const starCount = Math.min(150, window.innerWidth / 10);
      console.log(`将创建 ${starCount} 个星星`);
      
      // 创建新星星
      for (let i = 0; i < starCount; i++) {
        try {
          const star = document.createElement('div');
          star.className = 'star';
          star.style.width = `${Math.random() * 3}px`;
          star.style.height = star.style.width;
          star.style.top = `${Math.random() * 100}%`;
          star.style.left = `${Math.random() * 100}%`;
          star.style.animationDelay = `${Math.random() * 4}s`;
          starryBg.appendChild(star);
        } catch (starError) {
          console.error(`创建第 ${i+1} 个星星时出错:`, starError);
          // 继续尝试创建其他星星，而不是完全中断
          break; // 如果创建一个星星失败，可能后续都会失败，所以中断循环
        }
      }
      console.log('星星背景创建完成或已尝试创建');
    } catch (error) {
      console.error('创建星星背景时发生未知错误:', error);
      // 不要因为星星背景创建失败而影响整个应用的渲染
    }
  };
  
  // 添加消息
  const addMessage = (message) => {
    setMessages(prev => [...prev, message]);
  };
  
  // 发送消息
  const sendMessage = () => {
    if (!inputText.trim()) return;
    
    const messageText = inputText.trim();
    
    // 检查是否是主持人回答问题（是/否）
    if (isHost && (messageText.toLowerCase() === "是" || messageText.toLowerCase() === "否")) {
      // 获取最近的一条非系统消息，作为问题
      const recentQuestions = messages.filter(m => 
        m.type === 'user' && 
        m.user.nickname !== userInfo.nickname && 
        m.text.endsWith('?') || m.text.endsWith('？')
      );
      
      if (recentQuestions.length > 0) {
        const latestQuestion = recentQuestions[recentQuestions.length - 1];
        
        // 添加到问答记录
        addQARecord(latestQuestion.text, messageText);
        
        // 发送带有标记的消息
        addMessage({
          type: 'user',
          user: {
            nickname: userInfo.nickname,
            avatar: getInitialAvatar(userInfo.nickname)
          },
          text: `【回答】${messageText}`,
          time: new Date().toLocaleString(),
          isAnswer: true
        });
      } else {
        // 没有找到问题，正常发送
        addMessage({
          type: 'user',
          user: {
            nickname: userInfo.nickname,
            avatar: getInitialAvatar(userInfo.nickname)
          },
          text: messageText,
          time: new Date().toLocaleString()
        });
      }
    } else {
      // 如果是玩家提问，并且以问号结尾，标记为问题
      const isQuestion = messageText.endsWith('?') || messageText.endsWith('？');
      
      addMessage({
        type: 'user',
        user: {
          nickname: userInfo.nickname,
          avatar: getInitialAvatar(userInfo.nickname)
        },
        text: isQuestion ? `${messageText}` : messageText,
        time: new Date().toLocaleString(),
        isQuestion: isQuestion
      });
      
      // 如果是问题，添加系统提示
      if (isQuestion && !isHost) {
        addMessage({
          type: 'system',
          text: `${userInfo.nickname} 提出了一个问题，等待主持人回答`,
          time: new Date().toLocaleString()
        });
      }
    }
    
    setInputText('');
    textInputRef.current?.focus();
  };
  
  // 获取头像初始字符
  const getInitialAvatar = (name) => {
    if (!name || name === '游客' || name === 'undefined' || name === '未登录') {
      return '?';
    }
    return name.charAt(0).toUpperCase();
  };
  
  // 初始化WebRTC
  const initializeRTC = async () => {
    try {
      console.log('初始化WebRTC服务...');
      
      // 检查必要的信息
      const userId = localStorage.getItem('userId');
      if (!userId) {
        console.error('未找到用户ID，无法初始化WebRTC');
        addMessage({
          type: 'system',
          text: '语音聊天服务初始化失败：缺少用户ID，请尝试重新登录',
          time: new Date().toLocaleString()
        });
        return false;
      }
      
      // 初始化WebRTC服务
      const result = await rtcService.initialize({
        roomId: id,
        userId,
        nickname: userInfo.nickname,
        socketUrl: 'http://localhost:5001' // 信令服务器URL
      });
      
      if (result.success) {
        console.log('WebRTC服务初始化成功');
        setRtcConnected(true);
        
        // 设置回调函数
        rtcService.onUserJoined = handleUserJoined;
        rtcService.onUserLeft = handleUserLeft;
        rtcService.onSpeaking = handleSpeakingChange;
        rtcService.onMicStatusChanged = handleMicStatusChange;
        
        // 监听麦位变化
        setupMicPositionListeners();
        
        return true;
      } else {
        console.error('WebRTC服务初始化失败:', result.error);
        addMessage({
          type: 'system',
          text: `语音聊天服务初始化失败：${result.error}`,
          time: new Date().toLocaleString()
        });
        return false;
      }
    } catch (error) {
      console.error('初始化WebRTC服务出错:', error);
      addMessage({
        type: 'system',
        text: `语音聊天服务初始化出错：${error.message || '未知错误'}`,
        time: new Date().toLocaleString()
      });
      return false;
    }
  };
  
  // 设置麦位变化监听
  const setupMicPositionListeners = () => {
    if (!rtcService.socket) return;
    
    rtcService.socket.on('mic-positions', (positions) => {
      console.log('收到麦位变化:', positions);
      
      // 更新麦位状态
      setMicPositions(prev => {
        // 创建新的麦位数组
        const newPositions = [...prev];
        
        // 遍历服务器返回的麦位数据
        positions.forEach((position, index) => {
          // 更新麦位状态
          newPositions[index] = {
            ...newPositions[index],
            nickname: position.nickname || null,
            userId: position.userId || null,
            socketId: position.socketId || null,
            isMuted: position.isMuted !== undefined ? position.isMuted : true,
            isSpeaking: false
          };
        });
        
        return newPositions;
      });
    });
  };
  
  // 处理用户加入房间
  const handleUserJoined = (data) => {
    console.log('用户加入房间:', data);
    
    // 检查是不是重复加入的用户
    const isDuplicate = messages.some(message => 
      message.type === 'system' && 
      message.text === `${data.nickname} 加入了房间` &&
      Date.now() - new Date(message.time).getTime() < 30000 // 30秒内的消息视为重复
    );
    
    // 如果不是重复消息，才添加系统消息
    if (!isDuplicate) {
      addMessage({
        type: 'system',
        text: `${data.nickname} 加入了房间`,
        time: new Date().toLocaleString()
      });
    } else {
      console.log('忽略重复的用户加入消息:', data.nickname);
    }
  };
  
  // 处理用户离开房间
  const handleUserLeft = (data) => {
    console.log('用户离开房间:', data);
    
    // 添加系统消息
    addMessage({
      type: 'system',
      text: `${data.nickname} 离开了房间`,
      time: new Date().toLocaleString()
    });
  };
  
  // 处理说话状态变化
  const handleSpeakingChange = (data) => {
    // 更新麦位状态
    setMicPositions(prev => {
      const newPositions = [...prev];
      const index = newPositions.findIndex(p => p.userId === data.userId);
      
      if (index !== -1) {
        newPositions[index] = {
          ...newPositions[index],
          isSpeaking: data.isSpeaking
        };
      }
      
      return newPositions;
    });
  };
  
  // 处理麦克风状态变化
  const handleMicStatusChange = (data) => {
    console.log('麦克风状态变化:', data);
    
    // 更新麦位状态
    setMicPositions(prev => {
      const newPositions = [...prev];
      const index = newPositions.findIndex(p => p.userId === data.userId);
      
      if (index !== -1) {
        newPositions[index] = {
          ...newPositions[index],
          isMuted: data.isMuted
        };
      }
      
      return newPositions;
    });
  };
  
  // 组件挂载时初始化WebRTC
  useEffect(() => {
    if (!micInitialized) {
      initializeRTC().then(success => {
        if (success) {
          console.log('WebRTC服务初始化完成');
          setMicInitialized(true);
        }
      });
    }
    
    // 组件卸载时清理资源
    return () => {
      if (rtcConnected) {
        console.log('组件卸载，断开WebRTC连接');
        rtcService.disconnect();
        setRtcConnected(false);
      }
    };
  }, [id]);
  
  // 更新上麦功能
  const joinMicPosition = (positionId) => {
    if (!rtcConnected) {
      console.log('WebRTC尚未连接，初始化中...');
      
      // 尝试初始化
      initializeRTC().then(success => {
        if (success) {
          setMicInitialized(true);
          // 初始化成功后再次调用上麦
          setTimeout(() => joinMicPosition(positionId), 1000);
        }
      });
      
      return;
    }
    
    console.log(`尝试上${positionId + 1}号麦...`);
    
    // 检查是否已经在其他麦位
    const alreadyInPosition = micPositions.findIndex(pos => 
      pos.nickname === userInfo.nickname
    );
    
    if (alreadyInPosition !== -1) {
      // 如果已经在其他麦位，先离开那个麦位
      setMicPositions(prev => {
        const newPositions = [...prev];
        newPositions[alreadyInPosition] = {
          ...newPositions[alreadyInPosition],
          nickname: null,
          userId: null,
          isMuted: true,
          isSpeaking: false
        };
        return newPositions;
      });
      
      // 通知WebRTC服务下麦
      rtcService.leaveMic();
      
      // 如果点击的是当前麦位，就是下麦操作
      if (alreadyInPosition === positionId) {
        console.log('下麦成功');
        
        // 发送系统消息
        addMessage({
          type: 'system',
          text: `${userInfo.nickname} 下了麦`,
          time: new Date().toLocaleString()
        });
        
        return;
      }
    }
    
    // 加入新麦位
    setMicPositions(prev => {
      const newPositions = [...prev];
      newPositions[positionId] = {
        ...newPositions[positionId],
        nickname: userInfo.nickname,
        userId: userInfo.userId,
        isMuted: true,
        isSpeaking: false
      };
      return newPositions;
    });
    
    // 通知WebRTC服务上麦
    rtcService.joinMic(positionId);
    
    // 发送系统消息
    addMessage({
      type: 'system',
      text: `${userInfo.nickname} 上了${positionId + 1}号麦`,
      time: new Date().toLocaleString()
    });
  };
  
  // 切换麦克风状态
  const toggleMicMute = (positionId) => {
    // 检查是否是自己的麦位
    const position = micPositions[positionId];
    if (!position || position.nickname !== userInfo.nickname) {
      return;
    }
    
    // 切换麦克风状态
    const newMuted = !position.isMuted;
    
    // 更新麦位状态
    setMicPositions(prev => {
      const newPositions = [...prev];
      newPositions[positionId] = {
        ...newPositions[positionId],
        isMuted: newMuted
      };
      return newPositions;
    });
    
    // 通知WebRTC服务
    rtcService.setMute(newMuted);
    
    console.log(`麦克风已${newMuted ? '静音' : '取消静音'}`);
  };
  
  // 渲染麦位
  const renderMicPositions = () => {
    return (
      <div className="mic-positions">
        <div className="mic-positions-header">
          <i>🎤</i> 点击空麦位上麦，点击麦克风图标切换静音
        </div>
        {micPositions.map((position, index) => (
          <div 
            key={index}
            className={`mic-position ${position.isSpeaking ? 'speaking' : ''} ${position.nickname ? 'active' : ''}`}
            onClick={() => position.nickname && position.nickname !== userInfo.nickname ? null : joinMicPosition(index)}
          >
            <div className="mic-avatar" style={{ backgroundColor: position.nickname ? '#3A3A5E' : '#1A1A2E' }}>
              {position.nickname ? getInitialAvatar(position.nickname) : (index + 1)}
            </div>
            {position.isHost && <div className="mic-host">👑</div>}
            {position.nickname && (
              <div 
                className="mic-status"
                onClick={(e) => {
                  if (position.nickname === userInfo.nickname) {
                    e.stopPropagation();
                    toggleMicMute(index);
                  }
                }}
              >
                {position.isMuted ? '🔇' : '🔊'}
              </div>
            )}
            {position.nickname && (
              <div className="mic-name">{position.nickname}</div>
            )}
            <div className="mic-level"></div>
          </div>
        ))}
      </div>
    );
  };
  
  // 获取可用的海龟汤列表
  const fetchAvailableSoups = async () => {
    try {
      setSoupLoading(true);
      console.log('开始获取海龟汤列表(从soup表)...');
      // 使用api.getSoups方法获取soup表数据
      const soups = await api.getSoups();
      
      console.log('获取到的海龟汤列表(从soup表):', soups);
      
      if (!soups || (!Array.isArray(soups) && !soups.soups)) {
        console.log('API返回的海龟汤列表为空或格式不符，使用模拟数据');
        // 如果API返回空列表，使用模拟数据
        setAvailableSoups([
          { id: 1, title: '神秘海滩上的死亡', difficulty: '中等', tags: ['推理', '自然'] },
          { id: 2, title: '消失的钥匙', difficulty: '简单', tags: ['日常', '心理'] },
          { id: 3, title: '月光下的陌生人', difficulty: '困难', tags: ['恐怖', '超自然'] },
          { id: 4, title: '书架上的秘密', difficulty: '中等', tags: ['侦探', '历史'] },
          { id: 5, title: '镜中世界', difficulty: '困难', tags: ['科幻', '平行世界'] }
        ]);
      } else {
        // 成功获取到数据
        // 确保数据格式一致
        const soupArray = Array.isArray(soups) ? soups : (soups.soups || []);
        const formattedSoups = soupArray.map(soup => ({
          id: soup.id,
          title: soup.title || '未命名汤',
          difficulty: soup.difficulty || soup.content_rating || '未知难度',
          tags: Array.isArray(soup.tags) ? soup.tags : 
                (soup.tags ? soup.tags.split(',').map(tag => tag.trim()) : []),
          author: soup.author_name || soup.author || `作者ID: ${soup.author_id || '未知'}`,
          created_at: soup.created_at || '',
          // soup表使用puzzle_prompt作为内容
          puzzle_prompt: soup.puzzle_prompt || '',
          solution: soup.solution || ''
        }));
        
        console.log('格式化后的汤数据:', formattedSoups);
        setAvailableSoups(formattedSoups);
      }
    } catch (err) {
      console.error('获取海龟汤列表失败:', err);
      
      // 模拟数据
      setAvailableSoups([
        { id: 1, title: '神秘海滩上的死亡', difficulty: '中等', tags: ['推理', '自然'] },
        { id: 2, title: '消失的钥匙', difficulty: '简单', tags: ['日常', '心理'] },
        { id: 3, title: '月光下的陌生人', difficulty: '困难', tags: ['恐怖', '超自然'] },
        { id: 4, title: '书架上的秘密', difficulty: '中等', tags: ['侦探', '历史'] },
        { id: 5, title: '镜中世界', difficulty: '困难', tags: ['科幻', '平行世界'] }
      ]);
    } finally {
      setSoupLoading(false);
    }
  };
  
  // 使用fetch API直接获取soup表数据，避免可能的axios配置问题
  const handleServeSoupClick = () => {
    console.log('点击盛汤按钮 - 开始从soup表获取数据 (使用fetch API)');
    setShowSoupSelection(true);
    setSoupLoading(true);

    // 获取身份验证令牌
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('未找到身份验证令牌');
      alert('身份验证失败，请重新登录');
      navigate('/login');
      return;
    }

    // 直接从API获取soup表数据
    const fetchSoupsDirectly = async () => {
      try {
        // 使用明确的API URL
        const apiUrl = 'http://localhost:5001/api/soup';
        console.log('正在使用fetch请求API:', apiUrl);
        
        // 使用fetch API直接请求，添加超时处理
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5秒超时
        
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId); // 清除超时
        console.log('fetch API响应状态:', response.status, response.statusText);
        
        // 检查响应状态
        if (!response.ok) {
          throw new Error(`服务器响应错误: ${response.status} ${response.statusText}`);
        }
        
        // 解析JSON响应
        const data = await response.json();
        console.log('fetch API响应数据:', data);
        
        // 检查响应数据
        if (data && (Array.isArray(data) || data.soups)) {
          const soupsArray = Array.isArray(data) ? data : (data.soups || []);
          if (soupsArray.length > 0) {
            // 格式化汤数据
            const formattedSoups = soupsArray.map(soup => {
              // 更彻底地处理每一个字段，确保所有必需字段都有默认值
              return {
                id: soup.id || Math.floor(Math.random() * 10000),
                title: soup.title || '未命名汤',
                // 为不存在的字段提供默认值
                difficulty: soup.difficulty || soup.content_rating || '未分类',
                // 标签处理
                content_rating: soup.content_rating || '普通',
                tags: processTagsData(soup.tags) || [soup.content_rating || '未分类'],
                // 作者信息处理
                author: soup.author_name || soup.author || `作者ID: ${soup.author_id || '未知'}`,
                created_at: soup.created_at || new Date().toISOString(),
                // 添加内容和答案的默认值
                puzzle_prompt: soup.puzzle_prompt || soup.content || '此汤面内容未提供...',
                solution: soup.solution || soup.answer || '此汤答案未提供...',
                // 设置标记表示这是列表数据，不是完整详情
                is_list_data: true
              };
            });
            
            console.log('格式化后的soup数据 (共' + formattedSoups.length + '条):', formattedSoups);
            setAvailableSoups(formattedSoups);
            setSoupLoading(false);
            return true;
          } else {
            console.log('API返回了空数组，没有可用的汤数据');
          }
        } else {
          console.error('API返回的数据格式不正确:', data);
        }
        
        // 尝试直接使用原始数据格式
        if (data && Array.isArray(data) && data.length > 0) {
          console.log('尝试使用原始数据格式');
          setAvailableSoups(data);
          setSoupLoading(false);
          return true;
        }
        
        // 如果执行到这里，表示数据有问题
        useDefaultSoupData('API返回了空数据或格式不正确');
        return false;
      } catch (error) {
        console.error('获取soup表数据失败:', error.message);
        
        // 错误详情记录
        console.error('错误堆栈:', error.stack);
        if (error.name === 'AbortError') {
          console.error('请求超时，可能是服务器无响应');
        }
        
        // 尝试直接访问API端点验证可访问性
        console.log('尝试使用无凭证方式验证API端点可访问性...');
        try {
          const testResponse = await fetch('http://localhost:5001/api/soup', { 
            method: 'GET',
            mode: 'no-cors' // 尝试无CORS模式
          });
          console.log('API端点可访问性测试结果:', testResponse);
        } catch (testError) {
          console.error('API端点无法访问:', testError);
        }
        
        // 使用默认数据
        useDefaultSoupData('后端API连接失败: ' + error.message);
        return false;
      }
    };
    
    // 使用默认数据的辅助函数
    const useDefaultSoupData = (errorMessage = '无法从数据库获取海龟汤数据') => {
      console.log('回退到使用默认汤数据');
      const defaultSoups = [
        {
          id: '1',
          title: '[默认]简单猜谜',
          difficulty: '简单',
          tags: ['猜谜', '逻辑'],
          author: '系统(默认)',
          created_at: new Date().toISOString(),
          puzzle_prompt: '一个人走进一家餐厅，点了一份海鸟肉汤。尝了一口后，他拒绝付款，随后离开了餐厅。',
          solution: '这个人之前在一次海难中获救时，和其他幸存者因为饥饿而吃了海鸟肉，但实际上那是人肉。这次在餐厅里，他通过汤的味道认出了这是人肉，因此拒绝付款并离开。'
        },
        {
          id: '2',
          title: '[默认]侦探推理',
          difficulty: '中等',
          tags: ['推理', '故事'],
          author: '系统(默认)',
          created_at: new Date().toISOString(),
          puzzle_prompt: '一名侦探在调查一起谋杀案，死者倒在卧室里。房间里没有任何搏斗痕迹，只有一本打开的日记和窗外的积雪上有脚印。',
          solution: '凶手是死者的室友，他在死者写日记时悄悄从背后将毒针刺入死者的颈部。脚印是侦探自己的，因为案发时还没有下雪。'
        },
        {
          id: '3',
          title: '[默认]高难度智力题',
          difficulty: '困难',
          tags: ['智力', '数学'],
          author: '系统(默认)',
          created_at: new Date().toISOString(),
          puzzle_prompt: '一个密室里有三个灯泡开关，密室外面有三个灯泡。你只能进密室一次，如何确定每个开关控制哪个灯泡？',
          solution: '打开第一个开关，等待几分钟后关闭，然后打开第二个开关，进入房间。灯亮的是第二个开关控制的，摸起来热的是第一个开关控制的，不亮也不热的是第三个开关控制的。'
        }
      ];
      
      // 显示警告提示，包含错误信息
      alert(`${errorMessage}，当前显示的是默认数据。请检查API连接或数据库状态。`);
      
      setAvailableSoups(defaultSoups);
      setSoupLoading(false);
    };
    
    // 执行数据获取
    fetchSoupsDirectly();
  };

  // 修改selectSoup函数，添加直接使用列表数据的逻辑
  const selectSoup = async (soupId) => {
    console.log(`开始选择汤：ID = ${soupId} (使用增强版选择逻辑)`);
    setSoupLoading(true);
    
    // 首先检查是否在列表中已有该汤的基本信息
    const fromList = availableSoups.find(soup => soup.id.toString() === soupId.toString());
    if (fromList) {
      console.log('在列表中找到该汤的基本信息:', fromList);
      
      // 如果列表数据包含完整信息（puzzle_prompt和solution）则直接使用
      if (fromList.puzzle_prompt && (fromList.solution || fromList.answer)) {
        console.log('列表数据包含完整信息，直接使用列表数据');
        
        // 构建完整汤数据
        const fullSoupData = {
          id: fromList.id,
          title: fromList.title || '未命名汤',
          content: fromList.puzzle_prompt || fromList.content || '此汤面内容未提供...',
          difficulty: fromList.difficulty || fromList.content_rating || '未分类',
          tags: Array.isArray(fromList.tags) ? fromList.tags : [fromList.content_rating || '未分类'],
          author: fromList.author || `作者ID: ${fromList.author_id || '未知'}`,
          created_at: fromList.created_at || new Date().toISOString(),
          answer: fromList.solution || fromList.answer || '此谜题尚无官方答案',
          hint: fromList.hint || '暂无提示',
          // 添加额外信息
          average_rating: fromList.average_rating || 0,
          content_rating: fromList.content_rating || '未评级',
          // 标记数据来源
          data_source: 'soup_list',
          puzzle_prompt: fromList.puzzle_prompt,
          solution: fromList.solution || fromList.answer
        };
        
        // 更新状态，显示汤
        setSoupData(fullSoupData);
        setShowSoupSelection(false);
        setSoupLoading(false);
        
        // 发送系统消息
        addMessage({
          type: 'system',
          text: `主持人已选择海龟汤：${fullSoupData.title}`,
          time: new Date().toLocaleString()
        });
        
        console.log('成功使用列表数据显示汤详情:', fullSoupData);
        return;
      }
    }
    
    // 如果列表中没有完整信息，则继续使用API获取详情
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('未找到身份验证令牌');
      alert('身份验证失败，请重新登录');
      navigate('/login');
      return;
    }
    
    try {
      // 记录开始时间用于性能分析
      const startTime = Date.now();
      console.log(`[${new Date().toISOString()}] 开始获取ID为${soupId}的汤详情`);
      
      // 首先尝试使用api.getSoup方法获取，这样可以利用api.js中的错误处理
      console.log('尝试使用api.getSoup方法获取汤详情');
      try {
        const soupDetail = await api.getSoup(soupId);
        console.log('api.getSoup成功返回数据:', soupDetail);
        
        if (soupDetail && (soupDetail.id || soupDetail.title)) {
          console.log('使用api.getSoup获取的数据有效，处理并显示');
          processSoupData(soupDetail, soupId);
          return; // 成功获取并处理，直接返回
        } else {
          console.warn('api.getSoup返回的数据不完整，尝试直接fetch请求');
        }
      } catch (apiError) {
        console.error('api.getSoup方法失败，尝试直接fetch请求:', apiError);
      }
      
      // 备用方案：直接使用fetch API
      // 使用明确的API URL获取单个汤详情
      const apiUrl = `http://localhost:5001/api/soup/${soupId}`;
      console.log('使用fetch直接请求单个汤详情，URL:', apiUrl);
      
      // 使用fetch API直接请求，添加超时处理
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5秒超时
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId); // 清除超时
      console.log('fetch API响应状态:', response.status, response.statusText);
      
      // 检查响应状态
      if (!response.ok) {
        // 记录详细的错误信息
        const errorDetail = {
          status: response.status,
          statusText: response.statusText,
          url: apiUrl,
          time: new Date().toISOString(),
          elapsedMs: Date.now() - startTime
        };
        console.error('获取汤详情失败，详细信息:', errorDetail);
        
        // 尝试读取错误响应体
        try {
          const errorBody = await response.text();
          console.error('错误响应体:', errorBody);
        } catch (textError) {
          console.error('无法读取错误响应体:', textError);
        }
        
        throw new Error(`服务器响应错误: ${response.status} ${response.statusText}`);
      }
      
      // 解析JSON响应
      const soupDetail = await response.json();
      console.log('fetch API返回的汤详情数据:', soupDetail);
      
      // 使用公共方法处理数据
      processSoupData(soupDetail, soupId);
      
    } catch (err) {
      console.error(`获取ID为${soupId}的汤详情失败:`, err.message);
      console.error('错误堆栈:', err.stack);
      
      if (err.name === 'AbortError') {
        console.error('请求超时，可能是服务器无响应');
      }
      
      // 尝试使用无凭证方式验证API端点可访问性
      try {
        console.log('验证单个汤API端点可访问性...');
        const testUrl = `http://localhost:5001/api/soup/${soupId}`;
        const testResponse = await fetch(testUrl, { 
          method: 'GET',
          mode: 'no-cors' 
        });
        console.log('汤详情API端点可访问性测试结果:', testResponse);
      } catch (testError) {
        console.error('汤详情API端点无法访问:', testError);
      }
      
      // 尝试直接使用列表数据（考虑到列表中的数据可能不够完整）
      if (fromList) {
        // 即使上面的检查不通过，如果遇到错误仍然尝试使用列表数据
        console.log('API获取失败，使用列表数据替代');
        
        // 构建部分数据
        const partialData = {
          id: fromList.id,
          title: fromList.title || '未命名汤',
          content: fromList.puzzle_prompt || '此汤面未能从数据库获取，但您已选择了: ' + fromList.title,
          difficulty: fromList.difficulty || '未知难度',
          tags: Array.isArray(fromList.tags) ? fromList.tags : ['未分类'],
          author: fromList.author || '未知作者',
          created_at: fromList.created_at || new Date().toISOString(),
          answer: fromList.solution || '无法从数据库获取谜底，请联系管理员查看数据库连接问题',
          hint: '暂无提示',
          // 标记为部分数据
          isPartialData: true
        };
        
        // 警告但继续使用部分数据
        alert(`获取完整的海龟汤详情失败: ${err.message}。将使用部分可用数据。`);
        
        // 更新状态
        setSoupData(partialData);
        setShowSoupSelection(false);
        setSoupLoading(false);
        
        // 发送系统消息
        addMessage({
          type: 'system',
          text: `主持人已选择海龟汤(部分数据): ${partialData.title}`,
          time: new Date().toLocaleString()
        });
        
        return;
      }
      
      // 如果没有部分数据可用，则使用完全模拟数据
      useMockSoupDetail(soupId, err.message);
    }
  };
  
  // 处理从API获取的汤数据
  const processSoupData = (soupDetail, soupId) => {
    // 检查返回的数据是否有效
    if (soupDetail && (soupDetail.id || soupDetail.title)) {
      // 根据数据库实际结构格式化汤数据，确保所有必要字段都有值
      const formattedSoup = {
        id: soupDetail.id || soupId,
        title: soupDetail.title || '未命名汤',
        // soup表使用puzzle_prompt作为内容，增加灵活性以适应不同的数据结构
        content: soupDetail.puzzle_prompt || soupDetail.content || soupDetail.puzzle || soupDetail.description || '这是一个谜题，详细内容尚未填写...',
        // 为不存在的字段提供默认值
        difficulty: soupDetail.difficulty || soupDetail.content_rating || '未分类',
        tags: processTagsData(soupDetail.tags),
        // 作者信息处理
        author: soupDetail.author_name || soupDetail.author || `作者ID: ${soupDetail.author_id || '未知'}`,
        created_at: soupDetail.created_at || new Date().toISOString(),
        // soup表使用solution作为答案
        answer: soupDetail.solution || soupDetail.answer || '此谜题尚无官方答案',
        hint: soupDetail.hint || '暂无提示',
        // 添加额外信息
        average_rating: soupDetail.average_rating || 0,
        content_rating: soupDetail.content_rating || '未评级',
        // 保存原始字段，方便后续处理
        puzzle_prompt: soupDetail.puzzle_prompt,
        solution: soupDetail.solution
      };
      
      console.log('已格式化选择的汤详情:', formattedSoup);
      
      // 更新当前选择的汤
      setSoupData(formattedSoup);
      // 关闭选择面板
      setShowSoupSelection(false);
      // 清除加载状态
      setSoupLoading(false);
      
      // 发送系统消息通知房间
      addMessage({
        type: 'system',
        text: `主持人已选择海龟汤：${formattedSoup.title}`,
        time: new Date().toLocaleString()
      });
    } else {
      console.error('API返回的汤详情数据无效:', soupDetail);
      // 使用模拟数据
      useMockSoupDetail(soupId, '返回的数据格式不符合预期');
    }
  };
  
  // 处理标签数据的辅助函数
  const processTagsData = (tags) => {
    if (!tags) return [];
    
    // 如果已经是数组，检查是否是对象数组
    if (Array.isArray(tags)) {
      // 如果是对象数组(数据库直接返回)，提取名称
      if (tags.length > 0 && typeof tags[0] === 'object' && tags[0].name) {
        return tags.map(tag => tag.name);
      }
      return tags; // 已经是字符串数组
    }
    
    // 如果是字符串，尝试按逗号分割
    if (typeof tags === 'string') {
      return tags.split(',').map(tag => tag.trim());
    }
    
    // 兜底返回空数组
    return [];
  };
  
  // 使用模拟数据的辅助函数
  const useMockSoupDetail = (soupId, errorMessage = '无法获取海龟汤详情') => {
    console.log(`无法从数据库获取ID为${soupId}的汤，使用模拟数据，错误: ${errorMessage}`);
    
    // 显示警告提示
    alert(`无法从数据库获取海龟汤详情: ${errorMessage}。使用模拟数据替代。请检查API连接或数据库状态。`);
    
    // 创建模拟汤详情数据
    const mockSoupDetail = {
      id: soupId,
      title: `[模拟]海龟汤 #${soupId}`,
      content: '这是一个模拟的海龟汤内容，由于无法从数据库获取真实数据而生成。\n\n一个人在海滩上发现了一个奇怪的盒子，打开后...',
      difficulty: '中等',
      tags: ['模拟', '测试'],
      author: '系统(模拟)',
      created_at: new Date().toISOString(),
      answer: '这是一个模拟的答案。实际情况中，你应该能看到真实的答案。',
      hint: '这是一个模拟的提示。',
    };
    
    // 更新状态
    setSoupData(mockSoupDetail);
    setShowSoupSelection(false);
    setSoupLoading(false);
    
    // 发送系统消息
    addMessage({
      type: 'system',
      text: `主持人已选择模拟海龟汤：${mockSoupDetail.title}`,
      time: new Date().toLocaleString()
    });
  };
  
  // 添加问答记录
  const addQARecord = (question, answer) => {
    setSoupData(prev => {
      // 检查content的类型
      const currentContent = Array.isArray(prev.content) ? prev.content : [];
      
      return {
        ...prev,
        content: [...currentContent, { question, answer }]
      };
    });
  };
  
  // 公布谜底
  const revealSolution = () => {
    if (!isHost) return;
    
    addMessage({
      type: 'system',
      text: `【谜底公布】${soupData.answer || '本题暂无谜底'}`,
      time: new Date().toLocaleString()
    });
    
    setSoupData(prev => ({
      ...prev,
      status: '已结束'
    }));
  };
  
  // 重新开始游戏
  const restartGame = () => {
    if (!isHost) return;
    
    // 清空问答记录
    setSoupData(prev => ({
      ...prev,
      status: '准备中',
      content: []
    }));
    
    // 打开海龟汤选择面板
    setShowSoupSelection(true);
    fetchAvailableSoups();
    
    // 通知所有玩家
    addMessage({
      type: 'system',
      text: '主持人已重置游戏，准备选择新的海龟汤',
      time: new Date().toISOString()
    });
  };
  
  // 测试API连接的函数
  const testAPIConnection = async () => {
    console.log('开始测试API连接...');
    try {
      // 测试多个端点和端口
      const endpoints = [
        'http://localhost:5001/api/soup',
        'http://localhost:5000/api/soup',
        'http://127.0.0.1:5001/api/soup',
        'http://127.0.0.1:5000/api/soup'
      ];
      
      const results = {};
      
      for (const endpoint of endpoints) {
        try {
          console.log(`测试端点: ${endpoint}`);
          const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            }
          });
          
          results[endpoint] = {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok
          };
          
          if (response.ok) {
            try {
              const data = await response.json();
              results[endpoint].data = Array.isArray(data) ? `数组(${data.length}条记录)` : typeof data;
              console.log(`端点 ${endpoint} 测试成功:`, data);
            } catch (parseError) {
              results[endpoint].parseError = parseError.message;
              console.error(`端点 ${endpoint} 返回的数据不是有效的JSON:`, parseError);
            }
          }
        } catch (endpointError) {
          results[endpoint] = {
            error: endpointError.message
          };
          console.error(`端点 ${endpoint} 测试失败:`, endpointError);
        }
      }
      
      // 显示测试结果
      console.log('API连接测试结果:', results);
      
      // 创建格式化的结果消息
      let resultMessage = '🔍 API连接测试结果:\n\n';
      
      Object.entries(results).forEach(([endpoint, result]) => {
        resultMessage += `📌 ${endpoint}:\n`;
        if (result.error) {
          resultMessage += `   ❌ 错误: ${result.error}\n`;
        } else {
          resultMessage += `   状态: ${result.status} ${result.statusText} (${result.ok ? '✅ 成功' : '❌ 失败'})\n`;
          if (result.data) {
            resultMessage += `   数据: ${result.data}\n`;
          }
          if (result.parseError) {
            resultMessage += `   解析错误: ${result.parseError}\n`;
          }
        }
        resultMessage += '\n';
      });
      
      // 添加建议
      resultMessage += '建议:\n';
      resultMessage += '1. 确保后端服务已启动并正在运行\n';
      resultMessage += '2. 检查端口设置是否正确 (5000 或 5001)\n';
      resultMessage += '3. 检查跨域 (CORS) 设置\n';
      resultMessage += '4. 验证API路由路径是否为 /api/soup\n';
      
      alert(resultMessage);
    } catch (error) {
      console.error('API连接测试失败:', error);
      alert(`API连接测试失败: ${error.message}`);
    }
  };
  
  // 渲染海龟汤区域
  const renderTurtleSoup = () => {
    return (
      <div className="turtle-soup-area">
        <div className="soup-header">
          <div className="soup-title">{soupData.title}</div>
          <div className={`soup-status ${soupData.status === '准备中' ? 'preparing' : soupData.status === '已结束' ? 'ended' : ''}`}>
            {soupData.status}
          </div>
        </div>
        
        {/* 海龟汤汤面展示白板区域 */}
        <div className="soup-whiteboard">
          {soupData.content ? (
            <>
              <div className="whiteboard-title">汤面</div>
              <div className="whiteboard-content">
                {typeof soupData.content === 'string' ? soupData.content : 
                 (Array.isArray(soupData.content) ? '已选择汤：' + soupData.title : '无内容')}
              </div>
            </>
          ) : (
            <div className="whiteboard-empty">
              <div className="whiteboard-placeholder">
                {isHost ? "点击'盛汤'按钮选择一个海龟汤..." : "等待主持人盛汤..."}
              </div>
            </div>
          )}
        </div>
        
        {/* 问答记录 */}
        <div className="soup-content">
          <div className="content-title">问答记录</div>
          {Array.isArray(soupData.content) && soupData.content.length > 0 ? (
            soupData.content.map((item, index) => (
              <div className="soup-qa-item" key={index}>
                <div className="soup-question">问：{item.question}</div>
                <div className="soup-answer">答：{item.answer}</div>
              </div>
            ))
          ) : (
            <div className="soup-empty-state">
              <p>暂无问答记录</p>
              <p>玩家可以通过聊天框提问，主持人回答"是"或"否"</p>
            </div>
          )}
        </div>
        
        {/* 海龟汤控制区域 */}
        <div className="soup-controls">
          {/* 普通玩家按钮 */}
          <button className="soup-button">
            <span>👋 举手发言</span>
          </button>
          
          {/* 测试API连接按钮 - 所有用户可见 */}
          <button 
            className="soup-button"
            onClick={testAPIConnection}
            style={{
              backgroundColor: '#4a4a6a',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            <span>🔌 测试API连接</span>
          </button>
          
          {/* 主持人专属按钮 */}
          {isHost && (
            <>
              <button 
                className="soup-button host-button"
                onClick={handleServeSoupClick}
              >
                <span>🍲 盛汤</span>
              </button>
              <button 
                className="soup-button secondary"
                onClick={revealSolution}
                disabled={soupData.status === '已结束'}
              >
                <span>🎮 公布谜底</span>
              </button>
              <button 
                className="soup-button secondary"
                onClick={restartGame}
              >
                <span>🔄 重新开始</span>
              </button>
            </>
          )}
        </div>
        
        {/* 海龟汤选择面板 */}
        {showSoupSelection && (
          <div className="soup-selection-overlay">
            <div className="soup-selection-panel">
              <div className="soup-selection-header">
                <h3>选择海龟汤</h3>
                <button 
                  className="close-button"
                  onClick={() => setShowSoupSelection(false)}
                >
                  ×
                </button>
              </div>
              
              <div className="soup-selection-content">
                {soupLoading ? (
                  <div className="soup-loading">
                    <div className="loading-spinner"></div>
                    <p>正在加载海龟汤列表...</p>
                  </div>
                ) : availableSoups && availableSoups.length > 0 ? (
                  <div className="soup-list">
                    {availableSoups.map((soup) => (
                      <div 
                        key={soup.id}
                        className="soup-item"
                        onClick={() => {
                          console.log(`选择海龟汤，ID: ${soup.id}，标题: ${soup.title}`);
                          selectSoup(soup.id);
                        }}
                      >
                        <div className="soup-item-title">{soup.title || "未命名海龟汤"}</div>
                        <div className="soup-item-info">
                          <span className="soup-difficulty">{soup.difficulty || "未知难度"}</span>
                          <div className="soup-tags">
                            {soup.tags && Array.isArray(soup.tags) ? (
                              soup.tags.map((tag, idx) => (
                                <span key={idx} className="soup-tag">{tag}</span>
                              ))
                            ) : (
                              <span className="soup-tag">未分类</span>
                            )}
                          </div>
                        </div>
                        {soup.author && (
                          <div className="soup-author">
                            作者: {soup.author}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="soup-empty-state">
                    <p>暂无可用的海龟汤</p>
                    <button 
                      className="soup-button" 
                      onClick={fetchAvailableSoups}
                      style={{ marginTop: '15px' }}
                    >
                      刷新列表
                    </button>
                    {/* 添加测试API连接按钮 */}
                    <button 
                      className="soup-button" 
                      onClick={testAPIConnection}
                      style={{ marginTop: '15px', marginLeft: '10px' }}
                    >
                      测试API连接
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };
  
  // 渲染消息
  const renderMessages = () => {
    return messages.map((message, index) => (
      <div className={`message ${message.type === 'system' ? 'message-system' : 'message-user'}`} key={index}>
        {message.type === 'system' ? (
          message.text
        ) : (
          <>
            <div className="message-avatar">
              {message.user.avatar}
            </div>
            <div className="message-content">
              <div className="message-header">
                <div className="message-name">{message.user.nickname}</div>
                <div className="message-time">{message.time}</div>
              </div>
              <div className={`message-text ${message.isQuestion ? 'message-question' : message.isAnswer ? 'message-answer' : ''}`}>
                {message.text}
              </div>
            </div>
          </>
        )}
      </div>
    ));
  };
  
  // 按回车发送消息
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="room-container">
      {hasError ? (
        <div className="error-container" style={{
          padding: '20px',
          margin: '20px',
          backgroundColor: 'rgba(255, 0, 0, 0.1)',
          border: '1px solid red',
          borderRadius: '5px',
          color: 'white'
        }}>
          <h2>房间加载出错</h2>
          <p>抱歉，房间加载时发生错误。请尝试刷新页面或返回首页。</p>
          <details>
            <summary>错误详情</summary>
            <pre>{errorInfo && (errorInfo.message || JSON.stringify(errorInfo))}</pre>
            {errorInfo && errorInfo.stack && <pre>{errorInfo.stack}</pre>}
          </details>
          <div style={{marginTop: '20px'}}>
            <button onClick={() => window.location.reload()} style={{
              padding: '8px 16px',
              marginRight: '10px',
              backgroundColor: '#4A4A6A',
              border: 'none',
              borderRadius: '4px',
              color: 'white',
              cursor: 'pointer'
            }}>
              刷新页面
            </button>
            <button onClick={() => navigate('/')} style={{
              padding: '8px 16px',
              backgroundColor: '#6A4A8A',
              border: 'none',
              borderRadius: '4px',
              color: 'white',
              cursor: 'pointer'
            }}>
              返回首页
            </button>
          </div>
        </div>
      ) : isLoading ? (
        <div className="loading-container" style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          color: 'white',
          backgroundColor: '#1A1A2E'
        }}>
          <div className="loading-spinner" style={{
            width: '50px',
            height: '50px',
            border: '5px solid rgba(255,255,255,0.3)',
            borderRadius: '50%',
            borderTop: '5px solid white',
            animation: 'spin 1s linear infinite'
          }}></div>
          <p style={{marginTop: '20px'}}>加载房间中...</p>
          <p style={{marginTop: '10px', fontSize: '14px', opacity: 0.7}}>
            房间ID: {id} | 用户: {userNickname}
          </p>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      ) : (
      <>
        {/* 星空背景 */}
        <div className="starry-background"></div>
        
        {/* 左侧主区域 */}
        <div className="main-area">
          {/* 麦位区域 */}
          {renderMicPositions()}
          
          {/* 海龟汤区域 */}
          {renderTurtleSoup()}
        </div>
        
        {/* 调整大小的分割线 */}
        <div className="resizer"></div>
        
        {/* 右侧边栏 */}
        <div className="sidebar">
          <div className="chat-area">
            {/* 房间信息 */}
            <div className="room-info">
              <div 
                className="room-info-header" 
                onClick={() => setShowRoomInfo(!showRoomInfo)}
              >
                <div className="room-info-title">房间信息</div>
                <div className={`room-info-toggle ${!showRoomInfo ? 'collapsed' : ''}`}>▼</div>
              </div>
              
              <div className={`room-info-content ${showRoomInfo ? 'expanded' : ''}`}>
                <div className="room-info-item">
                  <div className="room-info-label">房间名称：</div>
                  <div className="room-info-value">{roomInfo.name}</div>
                </div>
                <div className="room-info-item">
                  <div className="room-info-label">房主：</div>
                  <div className="room-info-value">{roomInfo.host}</div>
                </div>
                <div className="room-info-item">
                  <div className="room-info-label">创建时间：</div>
                  <div className="room-info-value">{roomInfo.createdAt}</div>
                </div>
                <div className="room-info-item">
                  <div className="room-info-label">玩家人数：</div>
                  <div className="room-info-value">{roomInfo.playerCount}/{roomInfo.maxPlayers}</div>
                </div>
                <div className="room-info-item">
                  <div className="room-info-label">房间状态：</div>
                  <div className="room-info-value">{roomInfo.status}</div>
                </div>
                
                {/* 房主专属：关闭房间按钮 */}
                {isHost && (
                  <div className="room-info-actions" style={{ marginTop: '15px' }}>
                    <button 
                      onClick={closeRoom}
                      style={{
                        width: '100%',
                        padding: '8px 0',
                        backgroundColor: 'rgba(220, 53, 69, 0.1)',
                        color: '#DC3545',
                        border: '1px solid rgba(220, 53, 69, 0.3)',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <span style={{fontSize: '16px'}}>🚪</span>
                      关闭房间
                    </button>
                  </div>
                )}
              </div>
            </div>
            
            {/* 聊天消息区 */}
            <div className="chat-messages" ref={chatMessagesRef}>
              {renderMessages()}
            </div>
            
            {/* 输入框 */}
            <div className="chat-input">
              <div className="input-area">
                <button className="emoji-button">😊</button>
                <textarea
                  ref={textInputRef}
                  className="text-input"
                  placeholder="输入消息..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                ></textarea>
                <button 
                  className="send-button"
                  onClick={sendMessage}
                >
                  发送
                </button>
              </div>
              <div className="chat-shortcuts">Enter 发送 | Shift+Enter 换行</div>
            </div>
          </div>
        </div>
      </>
      )}
    </div>
  );
}

// 将Room组件包装在错误边界中导出
function RoomWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <Room />
    </ErrorBoundary>
  );
}

export default RoomWithErrorBoundary;