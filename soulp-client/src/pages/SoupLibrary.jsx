import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';
import './SoupLibrary.css';

function SoupLibrary() {
  const navigate = useNavigate();
  const location = useLocation();
  const searchRef = useRef(null);
  
  // 状态管理
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [soups, setSoups] = useState([]);
  const [tags, setTags] = useState([]);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 12,
    pages: 1
  });
  
  // 过滤和搜索状态
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    tag: '',
    rating: '',
    sortBy: 'created_at',
    orderBy: 'desc'
  });
  
  // 用户信息
  const userInfo = {
    nickname: localStorage.getItem('nickname') || '游客',
    userId: localStorage.getItem('userId') || '未登录',
    account: localStorage.getItem('account') || '未设置'
  };
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  // 检查用户登录状态
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      console.log('未检测到登录信息，重定向到登录页面');
      navigate('/login');
      return;
    }
    
    // 获取标签列表
    fetchTags();
    
    // 获取汤列表
    fetchSoups();
    
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

  // 当过滤器或分页改变时，重新获取数据
  useEffect(() => {
    if (!isLoading || error) {
      fetchSoups();
    }
  }, [filters, pagination.page]);

  // 获取标签列表
  const fetchTags = async () => {
    try {
      const data = await api.getTags();
      setTags(data || []);
    } catch (err) {
      console.error('获取标签失败:', err);
      setTags([]); // 失败时使用空数组
    }
  };

  // 获取汤列表
  const fetchSoups = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // 准备查询参数
      const params = {
        query: searchQuery,
        tag: filters.tag,
        rating: filters.rating,
        sortBy: filters.sortBy,
        orderBy: filters.orderBy,
        page: pagination.page,
        limit: pagination.limit
      };
      
      const data = await api.getSoups(params);
      
      // 更新状态
      const soupsList = data.soups || [];
      setSoups(soupsList);
      setPagination(data.pagination || {
        total: 0,
        page: 1,
        limit: 12,
        pages: 1
      });
      
      // 将海龟汤列表数据保存到localStorage
      if (soupsList.length > 0) {
        try {
          // 先获取已有数据，避免覆盖之前的数据
          const existingData = localStorage.getItem('availableSoups');
          let combinedSoups = [];
          
          if (existingData) {
            const existingSoups = JSON.parse(existingData);
            // 合并已有数据和新数据，去重
            const existingIds = new Set(existingSoups.map(soup => soup.id));
            const newSoups = soupsList.filter(soup => !existingIds.has(soup.id));
            combinedSoups = [...existingSoups, ...newSoups];
          } else {
            combinedSoups = soupsList;
          }
          
          // 限制存储数量，避免localStorage超出大小限制
          if (combinedSoups.length > 100) {
            combinedSoups = combinedSoups.slice(-100);
          }
          
          localStorage.setItem('availableSoups', JSON.stringify(combinedSoups));
          console.log('海龟汤列表数据已保存到localStorage', combinedSoups.length);
        } catch (storageError) {
          console.error('保存海龟汤列表到localStorage失败:', storageError);
        }
      }
      
      setIsLoading(false);
    } catch (err) {
      console.error('获取汤列表失败:', err);
      
      // 使用模拟数据（在开发环境中）
      if (process.env.NODE_ENV === 'development') {
        const mockSoups = [
          {
            id: 1,
            title: '奇怪的鱼',
            puzzle_prompt: '一条鱼躺在岸上，旁边有一把刀，没有明显伤口。',
            solution: '鱼被一阵大浪冲上岸，然后渔夫看到后准备用刀处理这条鱼。',
            average_rating: 4.5,
            content_rating: 'G',
            author_name: '汤姆',
            created_at: new Date().toISOString(),
            tags: ['推理', '自然']
          },
          {
            id: 2,
            title: '密室逃生',
            puzzle_prompt: '一个密闭的房间里，地上有一个人和一滩水。',
            solution: '这个人是冰雕，随着室温升高融化了。',
            average_rating: 4.8,
            content_rating: 'PG',
            author_name: '杰瑞',
            created_at: new Date(Date.now() - 3600000).toISOString(),
            tags: ['推理', '密室']
          },
          {
            id: 3,
            title: '神秘的死亡',
            puzzle_prompt: '房间里发现一个死者，周围只有一些水和打碎的玻璃。',
            solution: '死者是一条金鱼，它的鱼缸不小心被打碎了。',
            average_rating: 4.2,
            content_rating: 'PG13',
            author_name: '汤姆',
            created_at: new Date(Date.now() - 7200000).toISOString(),
            tags: ['推理', '动物']
          }
        ];
        
        setSoups(mockSoups);
        setPagination({
          total: 3,
          page: 1,
          limit: 12,
          pages: 1
        });
        
        // 保存模拟数据到localStorage
        try {
          localStorage.setItem('availableSoups', JSON.stringify(mockSoups));
          console.log('模拟海龟汤列表数据已保存到localStorage', mockSoups.length);
        } catch (storageError) {
          console.error('保存模拟数据到localStorage失败:', storageError);
        }
        
        setIsLoading(false);
        setError(null);
      } else {
        setIsLoading(false);
        setError('获取海龟汤列表失败，请稍后再试');
      }
    }
  };

  // 处理搜索提交
  const handleSearch = (e) => {
    e.preventDefault();
    // 重置到第一页并保持其他过滤器不变
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchSoups();
  };

  // 应用过滤器
  const applyFilters = () => {
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchSoups();
  };

  // 重置过滤器
  const resetFilters = () => {
    setSearchQuery('');
    setFilters({
      tag: '',
      rating: '',
      sortBy: 'created_at',
      orderBy: 'desc'
    });
    setPagination(prev => ({ ...prev, page: 1 }));
    
    // 清空搜索框
    if (searchRef.current) {
      searchRef.current.value = '';
    }
    
    // 延迟一下，确保状态更新后再重新获取数据
    setTimeout(() => {
      fetchSoups();
    }, 10);
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

  // 处理分页
  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > pagination.pages) return;
    
    setPagination(prev => ({ ...prev, page: newPage }));
    // 自动滚动到页面顶部
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 首字母头像
  const getInitialAvatar = (name) => {
    if (!name || name === '游客' || name === 'undefined' || name === '未登录') {
      return '?';
    }
    return name.charAt(0).toUpperCase();
  };

  // 渲染分页控件
  const renderPagination = () => {
    if (soups.length === 0 || pagination.pages <= 1) return null;
    
    const pages = [];
    const currentPage = pagination.page;
    const totalPages = pagination.pages;
    
    // 添加"上一页"按钮
    pages.push(
      <button
        key="prev"
        className={`pagination-button ${currentPage === 1 ? 'disabled' : ''}`}
        onClick={() => handlePageChange(currentPage - 1)}
        disabled={currentPage === 1}
      >
        ←
      </button>
    );
    
    // 最多显示5个页码按钮，当前页在中间
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    
    if (endPage - startPage < 4) {
      startPage = Math.max(1, endPage - 4);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <button
          key={i}
          className={`pagination-button ${i === currentPage ? 'active' : ''}`}
          onClick={() => handlePageChange(i)}
        >
          {i}
        </button>
      );
    }
    
    // 添加"下一页"按钮
    pages.push(
      <button
        key="next"
        className={`pagination-button ${currentPage === totalPages ? 'disabled' : ''}`}
        onClick={() => handlePageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        →
      </button>
    );
    
    return <div className="pagination">{pages}</div>;
  };

  // 渲染汤列表
  const renderSoups = () => {
    if (isLoading) {
      return (
        <div className="loading-container">
          <div className="loading-spinner"></div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="no-results">
          <div className="no-results-icon">⚠️</div>
          <h3 className="no-results-title">加载出错</h3>
          <p className="no-results-message">{error}</p>
          <button
            onClick={fetchSoups}
            className="filter-button"
          >
            重试
          </button>
        </div>
      );
    }

    if (soups.length === 0) {
      return (
        <div className="no-results">
          <div className="no-results-icon">🔍</div>
          <h3 className="no-results-title">未找到海龟汤</h3>
          <p className="no-results-message">尝试更改搜索条件或清除过滤器</p>
          <button
            onClick={resetFilters}
            className="filter-button"
          >
            清除筛选条件
          </button>
        </div>
      );
    }

    return (
      <>
        <div className="soups-grid">
          {soups.map(soup => (
            <Link to={`/soup/${soup.id}`} key={soup.id} className="soup-card">
              <div className="soup-card-header">
                <h3 className="soup-title">{soup.title}</h3>
                <div className="soup-rating">
                  <span className="soup-rating-star">★</span>
                  {soup.average_rating ? soup.average_rating.toFixed(1) : '暂无评分'} 
                  {soup.content_rating && (
                    <span style={{ marginLeft: '10px' }}>
                      分级: {soup.content_rating}
                    </span>
                  )}
                </div>
              </div>
              <div className="soup-prompt">
                {soup.puzzle_prompt}
              </div>
              <div className="soup-footer">
                <div>作者: {soup.author_name || '未知'}</div>
                <div>
                  {new Date(soup.created_at).toLocaleDateString()}
                </div>
              </div>
            </Link>
          ))}
        </div>
        
        {renderPagination()}
      </>
    );
  };

  return (
    <div className="library-container">
      {/* 导航栏 */}
      <nav className="library-navbar">
        <div className="navbar-content">
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginRight: '20px' }}>Soulp</h1>
            <div style={{ display: 'flex', gap: '20px' }}>
              <Link to="/" style={{ color: 'white', textDecoration: 'none' }}>首页</Link>
              <span style={{ color: '#E67E22', fontWeight: '500' }}>海龟汤题库</span>
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
      <div className="library-main-content">
        <div className="content-container">
          <div className="search-filter-container">
            <form onSubmit={handleSearch} className="search-box">
              <div className="search-icon">🔍</div>
              <input
                ref={searchRef}
                type="text"
                placeholder="搜索海龟汤标题或内容..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button 
                type="submit" 
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#E67E22',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                搜索
              </button>
            </form>
            
            <div className="filters">
              <div className="filter-group">
                <label className="filter-label">标签</label>
                <select 
                  className="filter-select"
                  value={filters.tag}
                  onChange={(e) => setFilters({ ...filters, tag: e.target.value })}
                >
                  <option value="">所有标签</option>
                  {tags.map(tag => (
                    <option key={tag.id} value={tag.name}>{tag.name}</option>
                  ))}
                </select>
              </div>
              
              <div className="filter-group">
                <label className="filter-label">内容分级</label>
                <select 
                  className="filter-select"
                  value={filters.rating}
                  onChange={(e) => setFilters({ ...filters, rating: e.target.value })}
                >
                  <option value="">所有分级</option>
                  <option value="G">G (全年龄)</option>
                  <option value="PG">PG (辅导级)</option>
                  <option value="PG13">PG-13 (13岁以上)</option>
                  <option value="R">R (限制级)</option>
                </select>
              </div>
              
              <div className="filter-group">
                <label className="filter-label">排序方式</label>
                <select 
                  className="filter-select"
                  value={filters.sortBy}
                  onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}
                >
                  <option value="created_at">创建时间</option>
                  <option value="average_rating">评分</option>
                  <option value="title">标题</option>
                </select>
              </div>
              
              <div className="filter-group">
                <label className="filter-label">排序方向</label>
                <select 
                  className="filter-select"
                  value={filters.orderBy}
                  onChange={(e) => setFilters({ ...filters, orderBy: e.target.value })}
                >
                  <option value="desc">降序</option>
                  <option value="asc">升序</option>
                </select>
              </div>
              
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                <button
                  type="button"
                  className="filter-button"
                  onClick={applyFilters}
                >
                  应用筛选
                </button>
                
                <button
                  type="button"
                  className="filter-button reset"
                  onClick={resetFilters}
                >
                  重置
                </button>
              </div>
            </div>
          </div>
          
          {/* 海龟汤列表 */}
          {renderSoups()}
        </div>
      </div>
    </div>
  );
}

export default SoupLibrary; 