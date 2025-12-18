import { useEffect, useRef } from 'react';

export default function useWebSocket(url, callback) {
  const ws = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    ws.current = new WebSocket(`${url}?token=${token}`);

    ws.current.onmessage = (e) => {
      callback(JSON.parse(e.data));
    };

    return () => ws.current?.close();
  }, [url]);

  return ws;
}