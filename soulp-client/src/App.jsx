import { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Room from './pages/Room';
import Login from './pages/Login';
import Register from './pages/Register';
import SoupLibrary from './pages/SoupLibrary';
import SoupDetail from './pages/SoupDetail';
import UserProfile from './pages/UserProfile';
import SoupCreator from './pages/SoupCreator';
import UserSoupList from './pages/UserSoupList';

// 简单的身份验证检查
const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

function App() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    }>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/" element={
          <PrivateRoute>
            <Home />
          </PrivateRoute>
        } />
        <Route path="/room/:id" element={
          <PrivateRoute>
            <Room />
          </PrivateRoute>
        } />
        <Route path="/soups" element={
          <PrivateRoute>
            <SoupLibrary />
          </PrivateRoute>
        } />
        <Route path="/soup/:id" element={
          <PrivateRoute>
            <SoupDetail />
          </PrivateRoute>
        } />
        <Route path="/creator" element={
          <PrivateRoute>
            <SoupCreator />
          </PrivateRoute>
        } />
        <Route path="/profile" element={
          <PrivateRoute>
            <UserProfile />
          </PrivateRoute>
        } />
        <Route path="/profile/soups/:userId" element={
          <PrivateRoute>
            <UserSoupList />
          </PrivateRoute>
        } />
      </Routes>
    </Suspense>
  );
}

export default App;
