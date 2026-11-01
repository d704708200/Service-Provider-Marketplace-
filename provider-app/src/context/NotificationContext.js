import React, { createContext, useState, useEffect, useContext, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import { useAuth } from './AuthContext';
import { notificationApi } from '../services/api';
import { initNotificationListeners } from '../services/notificationService';

const NotificationContext = createContext({
  unreadCount: 0,
  refreshUnreadCount: () => {},
  decrementUnreadCount: () => {},
  clearUnreadCount: () => {}
});

export const NotificationProvider = ({ children, navigationRef }) => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const isFetchingRef = useRef(false);

  const refreshUnreadCount = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const res = await notificationApi.getUnreadCount();
      const count =
        typeof res?.data?.unreadCount === 'number'
          ? res.data.unreadCount
          : typeof res?.unreadCount === 'number'
          ? res.unreadCount
          : 0;
      setUnreadCount(count);
    } catch (err) {
      // Standby / offline silent catch
    } finally {
      isFetchingRef.current = false;
    }
  }, [user]);

  const decrementUnreadCount = useCallback((amount = 1) => {
    setUnreadCount((prev) => Math.max(0, prev - amount));
  }, []);

  const clearUnreadCount = useCallback(() => {
    setUnreadCount(0);
  }, []);

  // 1. Refresh when authenticated user changes
  useEffect(() => {
    if (user) {
      refreshUnreadCount();
    } else {
      setUnreadCount(0);
    }
  }, [user, refreshUnreadCount]);

  // 2. Refresh when app returns to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && user) {
        refreshUnreadCount();
      }
    });
    return () => {
      subscription.remove();
    };
  }, [user, refreshUnreadCount]);

  // 3. Refresh when a push notification is received in foreground
  useEffect(() => {
    const cleanup = initNotificationListeners(navigationRef, () => {
      refreshUnreadCount();
    });
    return () => {
      if (typeof cleanup === 'function') cleanup();
    };
  }, [navigationRef, refreshUnreadCount]);

  // 4. Periodic background sync while active (every 30s)
  useEffect(() => {
    if (!user) return;
    const intervalId = setInterval(() => {
      if (AppState.currentState === 'active') {
        refreshUnreadCount();
      }
    }, 30000);
    return () => {
      clearInterval(intervalId);
    };
  }, [user, refreshUnreadCount]);

  return (
    <NotificationContext.Provider
      value={{
        unreadCount,
        refreshUnreadCount,
        decrementUnreadCount,
        clearUnreadCount
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export default NotificationContext;
