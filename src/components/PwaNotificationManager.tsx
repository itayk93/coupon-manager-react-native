import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function PwaNotificationManager() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handleMessage = (event: MessageEvent) => {
      const url = event.data?.url;
      if (typeof url === 'string' && url) {
        navigate(url);
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
  }, [navigate]);

  return null;
}
