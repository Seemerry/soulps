import { useState, useEffect, useRef } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import './SoupDetail.css';

function SoupDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // 状态管理
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [soup, setSoup] = useState(null);
  const [showSolution, setShowSolution] = useState(false);
  const [relatedSoups, setRelatedSoups] = useState([]);
  
  // 用户菜单状态
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);
  
  // 用户信息
  const userInfo = {
    nickname: localStorage.getItem('nickname') || '游客',
    userId: localStorage.getItem('userId') || '未登录',
    account: localStorage.getItem('account') || '未设置'
  };

  // 获取海龟汤详情
  useEffect(() => {
    const fetchSoupDetail = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // 先使用localStorage检查是否有从列表页传递过来的数据
        const storedSoupsList = localStorage.getItem('availableSoups');
        const availableSoups = storedSoupsList ? JSON.parse(storedSoupsList) : [];
        const soupFromList = availableSoups.find(soup => soup.id.toString() === id.toString());
        
        if (soupFromList && soupFromList.puzzle_prompt) {
          console.log('从本地存储中找到完整的汤数据，直接使用:', soupFromList);
          // 如果本地存储有完整数据，直接使用
          const formattedSoup = {
            ...soupFromList,
            tags: soupFromList.tags ? (Array.isArray(soupFromList.tags) ? soupFromList.tags : soupFromList.tags.split(',').map(tag => ({id: Math.random(), name: tag.trim()}))) : [],
            average_rating: soupFromList.average_rating || 4.5,
            author_name: soupFromList.author || soupFromList.author_name || '海龟汤大师',
            solution: soupFromList.solution || '此谜题尚无官方答案'
          };
          setSoup(formattedSoup);
          fetchRelatedSoups();
          setIsLoading(false);
          return;
        }
        
        console.log('尝试从API获取汤详情，ID:', id);
        
        // 记录开始时间用于性能分析
        const startTime = Date.now();
        
        try {
          // 使用api.getSoup获取详情
          const data = await api.getSoup(id);
          console.log('API成功返回汤详情:', data);
          
          if (data && (data.id || data.title)) {
            // 处理并使用API返回的数据
            const formattedData = {
              ...data,
              tags: Array.isArray(data.tags) ? data.tags : 
                    (typeof data.tags === 'string' ? data.tags.split(',').map(tag => ({id: Math.random(), name: tag.trim()})) : []),
              puzzle_prompt: data.puzzle_prompt || data.content || '此汤面没有提供内容',
              solution: data.solution || data.answer || '此谜题尚无官方答案',
              author_name: data.author_name || data.author || '未知作者',
              content_rating: data.content_rating || data.difficulty || 'PG'
            };
            
            setSoup(formattedData);
            fetchRelatedSoups();
            setIsLoading(false);
            return;
          }
        } catch (apiError) {
          console.error('api.getSoup获取失败，尝试直接fetch请求:', apiError);
        }
        
        // 备用方案：直接使用fetch API获取单个汤详情
        const token = localStorage.getItem('token');
        const apiUrl = `http://localhost:5001/api/soup/${id}`;
        console.log('使用fetch直接请求单个汤详情，URL:', apiUrl);
        
        // 添加超时处理
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
        
        clearTimeout(timeoutId);
        console.log('fetch API响应状态:', response.status, response.statusText);
        
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
          let errorText = '';
          try {
            errorText = await response.text();
            console.error('错误响应体:', errorText);
          } catch (textError) {
            console.error('无法读取错误响应体:', textError);
          }
          
          throw new Error(`服务器响应错误 ${response.status} ${response.statusText}${errorText ? ': ' + errorText : ''}`);
        }
        
        const soupDetail = await response.json();
        console.log('fetch API返回的汤详情数据:', soupDetail);
        
        if (soupDetail && (soupDetail.id || soupDetail.title)) {
          // 处理并使用fetch返回的数据
          const formattedData = {
            ...soupDetail,
            tags: Array.isArray(soupDetail.tags) ? soupDetail.tags : 
                  (typeof soupDetail.tags === 'string' ? soupDetail.tags.split(',').map(tag => ({id: Math.random(), name: tag.trim()})) : []),
            puzzle_prompt: soupDetail.puzzle_prompt || soupDetail.content || '此汤面没有提供内容',
            solution: soupDetail.solution || soupDetail.answer || '此谜题尚无官方答案',
            author_name: soupDetail.author_name || soupDetail.author || '未知作者',
            content_rating: soupDetail.content_rating || soupDetail.difficulty || 'PG'
          };
          
          setSoup(formattedData);
          fetchRelatedSoups();
          setIsLoading(false);
          return;
        }
        
        // 如果从API获取的数据无效，但有部分列表数据
        if (soupFromList) {
          console.log('API返回无效，使用列表中的部分数据:', soupFromList);
          // 使用列表中的部分数据
          const partialData = {
            id: soupFromList.id,
            title: soupFromList.title || '未命名汤',
            puzzle_prompt: soupFromList.puzzle_prompt || `此汤面内容未能从数据库获取，但您选择了: ${soupFromList.title}`,
            solution: soupFromList.solution || '无法从数据库获取谜底，请联系管理员',
            author_name: soupFromList.author || soupFromList.author_name || '未知作者',
            created_at: soupFromList.created_at || new Date().toISOString(),
            tags: Array.isArray(soupFromList.tags) ? soupFromList.tags.map(tag => typeof tag === 'string' ? {id: Math.random(), name: tag} : tag) : [],
            average_rating: 4.0,
            content_rating: soupFromList.difficulty || soupFromList.content_rating || 'PG'
          };
          
          setSoup(partialData);
          fetchRelatedSoups();
          setIsLoading(false);
          return;
        }
        
        // 如果所有方式都失败，则使用默认示例数据
        console.warn('所有API获取方式失败，使用示例数据');
        
        const mockSoup = {
          id: id,
          title: `海龟汤 #${id}`,
          puzzle_prompt: `一个人在森林里发现了一具尸体，他看了一眼后转身就跑，没有报警。为什么？
          
提示：此内容为示例数据，因为无法从数据库获取ID为${id}的海龟汤详情。`,
          solution: `这个人其实是一只鸟，鸟类看到尸体后会自然逃离，不会有报警的概念。
          
注意：这是示例解答，而非真实数据。请检查API连接和数据库状态。`,
          average_rating: 4.5,
          content_rating: 'PG',
          author_id: 1,
          author_name: '海龟汤大师 (示例数据)',
          created_at: new Date().toISOString(),
          tags: [
            { id: 1, name: '推理' },
            { id: 2, name: '经典' },
            { id: 3, name: '示例数据' }
          ],
          isExampleData: true
        };
        
        setSoup(mockSoup);
        
        // 模拟相关汤
        const mockRelatedSoups = [
          {
            id: 101,
            title: '奇怪的鱼',
            puzzle_prompt: '一条鱼躺在岸上，旁边有一把刀，没有明显伤口...'
          },
          {
            id: 102,
            title: '密室逃生',
            puzzle_prompt: '一个密闭的房间里，地上有一个人和一滩水...'
          },
          {
            id: 103,
            title: '神秘的死亡',
            puzzle_prompt: '房间里发现一个死者，周围只有一些水和打碎的玻璃...'
          }
        ];
        
        setRelatedSoups(mockRelatedSoups);
        setIsLoading(false);
        
      } catch (err) {
        console.error('获取海龟汤详情失败:', err);
        
        // 即使出错也尝试提取部分数据
        const storedSoupsList = localStorage.getItem('availableSoups');
        const availableSoups = storedSoupsList ? JSON.parse(storedSoupsList) : [];
        const soupFromList = availableSoups.find(soup => soup.id.toString() === id.toString());
        
        if (soupFromList) {
          console.log('发生错误，但从列表中找到了部分数据:', soupFromList);
          // 使用列表中的部分数据
          const partialData = {
            id: soupFromList.id,
            title: soupFromList.title || '未命名汤',
            puzzle_prompt: soupFromList.puzzle_prompt || `获取海龟汤详情失败，但您选择了: ${soupFromList.title}（错误: ${err.message}）`,
            solution: soupFromList.solution || `无法获取谜底（错误: ${err.message}）`,
            author_name: soupFromList.author || soupFromList.author_name || '未知作者',
            created_at: soupFromList.created_at || new Date().toISOString(),
            tags: Array.isArray(soupFromList.tags) ? soupFromList.tags.map(tag => typeof tag === 'string' ? {id: Math.random(), name: tag} : tag) : [],
            average_rating: 4.0,
            content_rating: soupFromList.difficulty || soupFromList.content_rating || 'PG',
            isPartialData: true
          };
          
          setSoup(partialData);
          fetchRelatedSoups();
          setIsLoading(false);
          return;
        }
        
        // 如果没有可用的列表数据，使用模拟数据并显示错误信息
        if (process.env.NODE_ENV === 'development') {
          const errorNote = err.message || '未知错误';
          
          const mockSoup = {
            id: id,
            title: `获取失败的海龟汤 #${id}`,
            puzzle_prompt: `无法获取此海龟汤的详细内容。

错误信息: ${errorNote}

请检查API连接和数据库状态。`,
            solution: `由于获取数据失败，无法显示解答。

错误信息: ${errorNote}`,
            average_rating: 0,
            content_rating: 'PG',
            author_id: 0,
            author_name: '系统 (错误数据)',
            created_at: new Date().toISOString(),
            tags: [
              { id: 999, name: '数据获取失败' }
            ],
            isErrorData: true
          };
          
          setSoup(mockSoup);
          setRelatedSoups([]);
          setIsLoading(false);
          setError(`获取海龟汤详情失败: ${err.message}`);
        } else {
          setIsLoading(false);
          setError(err.message || '获取海龟汤详情失败，请稍后再试');
        }
      }
    };
    
    // 验证用户登录状态
    const token = localStorage.getItem('token');
    if (!token) {
      console.log('未检测到登录信息，重定向到登录页面');
      navigate('/login');
      return;
    }
    
    fetchSoupDetail();
    
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
  }, [id, navigate]);
  
  // 获取相关汤
  const fetchRelatedSoups = async () => {
    try {
      // 这里应该调用API获取相关汤，目前使用模拟数据
      // 实际实现时，可以基于当前汤的标签或作者来获取相关内容
      
      // 示例请求：
      // const response = await api.get('/soups', { 
      //   params: { tag: 'someTag', limit: 3 } 
      // });
      // setRelatedSoups(response.data.soups);
      
      // 目前使用模拟数据
      const mockRelatedSoups = [
        {
          id: 101,
          title: '奇怪的鱼',
          puzzle_prompt: '一条鱼躺在岸上，旁边有一把刀，没有明显伤口...'
        },
        {
          id: 102,
          title: '密室逃生',
          puzzle_prompt: '一个密闭的房间里，地上有一个人和一滩水...'
        },
        {
          id: 103,
          title: '神秘的死亡',
          puzzle_prompt: '房间里发现一个死者，周围只有一些水和打碎的玻璃...'
        }
      ];
      
      setRelatedSoups(mockRelatedSoups);
    } catch (err) {
      console.error('获取相关汤失败:', err);
      // 失败时使用空数组
      setRelatedSoups([]);
    }
  };
  
  // 首字母头像
  const getInitialAvatar = (name) => {
    if (!name || name === '游客' || name === 'undefined' || name === '未登录') {
      return '?';
    }
    return name.charAt(0).toUpperCase();
  };
  
  // 渲染分级标签
  const renderContentRating = (rating) => {
    let label = '未分级';
    let className = '';
    
    switch(rating) {
      case 'G':
        label = 'G (全年龄)';
        className = 'rating-G';
        break;
      case 'PG':
        label = 'PG (辅导级)';
        className = 'rating-PG';
        break;
      case 'PG13':
        label = 'PG-13 (13岁以上)';
        className = 'rating-PG13';
        break;
      case 'R':
        label = 'R (限制级)';
        className = 'rating-R';
        break;
      default:
        label = '未分级';
        className = '';
    }
    
    return (
      <span className={`soup-content-rating ${className}`}>
        {label}
      </span>
    );
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
  
  // 渲染加载状态
  const renderLoading = () => {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
      </div>
    );
  };
  
  // 渲染错误状态
  const renderError = () => {
    return (
      <div className="error-container">
        <div className="error-icon">⚠️</div>
        <h3 className="error-title">加载失败</h3>
        <p className="error-message">{error}</p>
        <button 
          className="error-button"
          onClick={() => window.location.reload()}
        >
          重试
        </button>
      </div>
    );
  };
  
  // 渲染海龟汤详情
  const renderSoupDetail = () => {
    if (!soup) return null;
    
    return (
      <div className="content-container">
        {/* 详情头部 */}
        <div className="soup-detail-header">
          <h1 className="soup-title">{soup.title}</h1>
          
          <div className="soup-meta">
            <div className="soup-meta-item">
              <span className="soup-meta-icon">👤</span>
              <span>{soup.author_name || '未知作者'}</span>
            </div>
            
            <div className="soup-meta-item">
              <span className="soup-meta-icon">📅</span>
              <span>{new Date(soup.created_at).toLocaleDateString()}</span>
            </div>
            
            <div className="soup-meta-item">
              <span className="soup-rating">
                <span className="soup-rating-star">★</span>
                <span>{soup.average_rating ? soup.average_rating.toFixed(1) : '暂无评分'}</span>
              </span>
            </div>
            
            <div className="soup-meta-item">
              {renderContentRating(soup.content_rating)}
            </div>
          </div>
          
          {soup.tags && soup.tags.length > 0 && (
            <div className="soup-tags">
              {soup.tags.map(tag => (
                <span key={tag.id} className="soup-tag">
                  {tag.name}
                </span>
              ))}
            </div>
          )}
        </div>
        
        {/* 详情主体 */}
        <div className="soup-detail-body">
          <div className="soup-section">
            <h2 className="soup-section-title">
              <div className="soup-section-icon">🤔</div>
              谜题
            </h2>
            <div className="soup-prompt">
              {soup.puzzle_prompt}
            </div>
          </div>
          
          <div className="soup-section">
            <h2 className="soup-section-title">
              <div className="soup-section-icon">💡</div>
              解答
            </h2>
            <div className={`soup-solution ${!showSolution ? 'solution-hidden' : ''}`}>
              {soup.solution}
              
              {!showSolution && (
                <div className="solution-overlay">
                  <button 
                    className="show-solution-button"
                    onClick={() => setShowSolution(true)}
                  >
                    点击查看解答
                  </button>
                </div>
              )}
            </div>
          </div>
          
          <div className="soup-actions">
            <Link to="/soups" className="soup-button soup-button-secondary">
              <span>←</span>
              <span>返回列表</span>
            </Link>
            
            <button 
              className="soup-button soup-button-primary"
              onClick={() => navigate(`/room/create?soup=${soup.id}`)}
            >
              <span>🎲</span>
              <span>开始游戏</span>
            </button>
          </div>
        </div>
      </div>
    );
  };
  
  // 渲染相关汤
  const renderRelatedSoups = () => {
    if (!relatedSoups || relatedSoups.length === 0) return null;
    
    return (
      <div className="related-soups">
        <h3 className="related-soups-title">相关推荐</h3>
        
        <div className="related-soups-grid">
          {relatedSoups.map(relatedSoup => (
            <Link 
              to={`/soup/${relatedSoup.id}`} 
              key={relatedSoup.id}
              className="related-soup-card"
            >
              <div className="related-soup-title">
                {relatedSoup.title}
              </div>
              <div className="related-soup-body">
                {relatedSoup.puzzle_prompt}
              </div>
            </Link>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="soup-detail-container">
      {/* 导航栏 */}
      <nav className="soup-detail-navbar">
        <div className="navbar-content">
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginRight: '20px' }}>Soulp</h1>
            <div style={{ display: 'flex', gap: '20px' }}>
              <Link to="/" style={{ color: 'white', textDecoration: 'none' }}>首页</Link>
              <Link to="/soups" style={{ color: 'white', textDecoration: 'none' }}>海龟汤题库</Link>
              <Link to="/creator" style={{ color: 'white', textDecoration: 'none' }}>创作中心</Link>
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
                {getInitialAvatar(userInfo.nickname)}
              </div>
              <span>{userInfo.nickname}</span>
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
                  <p style={{ fontWeight: '600', marginBottom: '5px' }}>{userInfo.nickname}</p>
                  <p style={{ fontSize: '13px', color: '#666', marginBottom: '3px' }}>
                    用户ID: {userInfo.userId}
                  </p>
                  <p style={{ fontSize: '13px', color: '#666' }}>
                    账号: {userInfo.account}
                  </p>
                </div>
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
            )}
          </div>
        </div>
      </nav>
      
      {/* 主内容区域 */}
      <div className="soup-detail-content">
        {isLoading ? renderLoading() : (
          error ? renderError() : (
            <>
              {renderSoupDetail()}
              {renderRelatedSoups()}
            </>
          )
        )}
      </div>
    </div>
  );
}

export default SoupDetail; 