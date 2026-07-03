import { useEffect, useRef } from 'react';

export const useRealtimeReconnection = (connectFn: () => void) => {
  const backoffRef = useRef(1000);
  
  useEffect(() => {
    const handleDisconnect = () => {
      setTimeout(() => {
        connectFn();
        backoffRef.current = Math.min(backoffRef.current * 2, 30000);
      }, backoffRef.current);
    };
    // Simulation of disconnect listener binding
    window.addEventListener('offline', handleDisconnect);
    return () => window.removeEventListener('offline', handleDisconnect);
  }, [connectFn]);
};
