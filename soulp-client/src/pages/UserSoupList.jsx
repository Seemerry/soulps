import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import './UserSoupList.css';

function UserSoupList() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [soups, setSoups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 1
  });
  const [isCurrentUser, setIsCurrentUser] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  // 检查是否为当前登录用户
  useEffect(() => {
    const currentUserId = localStorage.getItem('userId');
    setIsCurrentUser(currentUserId && parseInt(currentUserId) === parseInt(userId));
  }, [userId]);

  // 加载海龟汤列表
  useEffect(() => {
    loadSoups(pagination.page, pagination.limit);
  }, [userId, pagination.page, pagination.limit]);

  // 获取用户海龟汤列表
  const loadSoups = async (page, limit) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.getUserSoups(userId, page, limit);
      setSoups(result.soups || []);
      setPagination(result.pagination || {
        page,
        limit,
        total: result.soups?.length || 0,
        pages: Math.ceil((result.soups?.length || 0) / limit)
      });
    } catch (err) {
      console.error('获取海龟汤列表失败:', err);
      setError('获取海龟汤列表失败: ' + (err.message || '未知错误'));
      setSoups([]);
    } finally {
      setLoading(false);
    }
  };

  // 处理页码变化
  const handlePageChange = (newPage) => {
    if (newPage > 0 && newPage <= pagination.pages) {
      setPagination({
        ...pagination,
        page: newPage
      });
    }
  };

  // 格式化日期
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // 处理删除海龟汤
  const handleDelete = async (soupId) => {
    if (confirmDelete !== soupId) {
      setConfirmDelete(soupId);
      return;
    }

    try {
      setLoading(true);
      const result = await api.deleteSoup(soupId);
      console.log('删除海龟汤成功:', result);
      
      // 刷新列表
      loadSoups(pagination.page, pagination.limit);
      setConfirmDelete(null);
      
      // 显示成功提示
      const successMessage = document.createElement('div');
      successMessage.textContent = '海龟汤删除成功';
      successMessage.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#4CAF50;color:white;padding:10px 20px;border-radius:4px;z-index:9999;';
      document.body.appendChild(successMessage);
      setTimeout(() => document.body.removeChild(successMessage), 3000);
    } catch (err) {
      console.error('删除海龟汤失败:', err);
      
      // 提取详细错误信息
      let errorMessage = '删除失败';
      
      if (err.response) {
        console.error('服务器响应状态:', err.response.status);
        console.error('响应头:', err.response.headers);
        
        try {
          // 尝试提取更详细的错误信息
          const responseData = err.response.data;
          errorMessage = responseData.error || responseData.message || `服务器错误 (${err.response.status})`;
          
          if (responseData.details) {
            errorMessage += `: ${responseData.details}`;
          }
          
          console.error('错误详情:', responseData);
        } catch (e) {
          console.error('解析错误响应失败:', e);
        }
      } else if (err.request) {
        errorMessage = '服务器未响应请求';
      } else {
        errorMessage = err.message || '未知错误';
      }
      
      // 显示错误提示
      alert(`删除失败: ${errorMessage}`);
      setConfirmDelete(null);
    } finally {
      setLoading(false);
    }
  };

  // 取消删除确认
  const cancelDelete = () => {
    setConfirmDelete(null);
  };

  // 渲染海龟汤列表项
  const renderSoupItem = (soup) => {
    return (
      <div className="user-soup-item" key={soup.id}>
        <div className="user-soup-content">
          <h3 className="user-soup-title" onClick={() => navigate(`/soup/${soup.id}`)}>
            {soup.title}
          </h3>
          <div className="user-soup-meta">
            <span className="user-soup-date">创建于: {formatDate(soup.created_at)}</span>
            <span className="user-soup-rating">内容分级: {soup.content_rating || 'PG'}</span>
          </div>
          <p className="user-soup-preview">{soup.puzzle_prompt.slice(0, 100)}...</p>
        </div>
        
        {isCurrentUser && (
          <div className="user-soup-actions">
            <button 
              className="user-soup-edit-btn" 
              onClick={() => navigate(`/soup/edit/${soup.id}`)}
            >
              编辑
            </button>
            
            {confirmDelete === soup.id ? (
              <div className="delete-confirm">
                <button 
                  className="confirm-yes" 
                  onClick={() => handleDelete(soup.id)}
                >
                  确认
                </button>
                <button 
                  className="confirm-no" 
                  onClick={cancelDelete}
                >
                  取消
                </button>
              </div>
            ) : (
              <button 
                className="user-soup-delete-btn" 
                onClick={() => handleDelete(soup.id)}
              >
                删除
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  // 渲染分页控件
  const renderPagination = () => {
    if (pagination.pages <= 1) return null;

    const pageNumbers = [];
    const currentPage = pagination.page;
    const totalPages = pagination.pages;

    // 显示最多5个页码
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);

    if (endPage - startPage < 4) {
      startPage = Math.max(1, endPage - 4);
    }

    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }

    return (
      <div className="user-soup-pagination">
        <button 
          className="page-btn prev" 
          disabled={currentPage === 1}
          onClick={() => handlePageChange(currentPage - 1)}
        >
          上一页
        </button>
        
        {pageNumbers.map(num => (
          <button 
            key={num} 
            className={`page-btn ${num === currentPage ? 'active' : ''}`}
            onClick={() => handlePageChange(num)}
          >
            {num}
          </button>
        ))}
        
        <button 
          className="page-btn next" 
          disabled={currentPage === totalPages}
          onClick={() => handlePageChange(currentPage + 1)}
        >
          下一页
        </button>
      </div>
    );
  };

  // 返回个人主页
  const goBackToProfile = () => {
    navigate(`/profile`);
  };

  // 跳转到创建页面
  const goToCreateSoup = () => {
    navigate('/soup/create');
  };

  return (
    <div className="user-soup-list-container">
      <div className="user-soup-header">
        <button className="back-btn" onClick={goBackToProfile}>
          返回个人主页
        </button>
        <h2 className="user-soup-list-title">我的海龟汤作品</h2>
        {isCurrentUser && (
          <button className="create-soup-btn" onClick={goToCreateSoup}>
            创建新海龟汤
          </button>
        )}
      </div>

      {loading ? (
        <div className="user-soup-loading">正在加载...</div>
      ) : error ? (
        <div className="user-soup-error">{error}</div>
      ) : soups.length === 0 ? (
        <div className="user-soup-empty">
          <p>暂无海龟汤作品</p>
          {isCurrentUser && (
            <button className="create-soup-btn" onClick={goToCreateSoup}>
              创建第一个海龟汤
            </button>
          )}
        </div>
      ) : (
        <div className="user-soup-list">
          {soups.map(soup => renderSoupItem(soup))}
          {renderPagination()}
        </div>
      )}
    </div>
  );
}

export default UserSoupList; 