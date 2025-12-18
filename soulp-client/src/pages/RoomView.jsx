import { useParams } from 'react-router-dom';
import Room from './Room';

// 这是一个包装组件，用于确保Room组件正确加载
function RoomView() {
  const { id } = useParams();
  
  console.log('加载房间视图, ID:', id);
  
  return <Room />;
}

export default RoomView; 