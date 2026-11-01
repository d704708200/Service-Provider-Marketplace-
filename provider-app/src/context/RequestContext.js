import React, { createContext, useState, useEffect, useContext, useCallback, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useAuth } from './AuthContext';
import { bookingApi } from '../services/api';

const RequestContext = createContext({
  pendingRequestsCount: 0,
  refreshPendingRequestsCount: () => {},
  decrementPendingRequestsCount: () => {},
  setPendingRequestsCount: () => {}
});

export const RequestProvider = ({ children }) => {
  const { user } = useAuth();
  const [pendingRequestsCount, setPendingRequestsCountState] = useState(0);
  const isFetchingRef = useRef(false);

  const setPendingRequestsCount = useCallback((count) => {
    const validCount = typeof count === 'number' && count >= 0 ? count : 0;
    setPendingRequestsCountState(validCount);
  }, []);

  const decrementPendingRequestsCount = useCallback((amount = 1) => {
    setPendingRequestsCountState((prev) => Math.max(0, prev - amount));
  }, []);

  const refreshPendingRequestsCount = useCallback(async () => {
    if (!user) {
      setPendingRequestsCountState(0);
      return;
    }

    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      const res = await bookingApi.getPendingRequests();
      const list = Array.isArray(res?.data) ? res.data : [];
      setPendingRequestsCountState(list.length);
    } catch (err) {
      // Standby / offline silent catch
    } finally {
      isFetchingRef.current = false;
    }
  }, [user]);

  // 1. Initial fetch & cleanup when authenticated user changes
  useEffect(() => {
    if (user) {
      refreshPendingRequestsCount();
    } else {
      setPendingRequestsCountState(0);
    }
  }, [user, refreshPendingRequestsCount]);

  // 2. Refresh when app returns to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && user) {
        refreshPendingRequestsCount();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [user, refreshPendingRequestsCount]);

  // 3. Refresh when a push notification is received in foreground (e.g., new booking broadcast)
  useEffect(() => {
    if (Platform.OS === 'web') return;

    let notificationSub = null;
    try {
      notificationSub = Notifications.addNotificationReceivedListener(() => {
        if (user) {
          refreshPendingRequestsCount();
        }
      });
    } catch (err) {
      // Graceful fallback if native module is not ready
    }

    return () => {
      if (notificationSub && typeof notificationSub.remove === 'function') {
        notificationSub.remove();
      }
    };
  }, [user, refreshPendingRequestsCount]);

  // 4. Periodic background sync while app is active (every 30s) to guard against network drops
  useEffect(() => {
    if (!user) return;

    const intervalId = setInterval(() => {
      if (AppState.currentState === 'active') {
        refreshPendingRequestsCount();
      }
    }, 30000);

    return () => {
      clearInterval(intervalId);
    };
  }, [user, refreshPendingRequestsCount]);

  return (
    <RequestContext.Provider
      value={{
        pendingRequestsCount,
        refreshPendingRequestsCount,
        decrementPendingRequestsCount,
        setPendingRequestsCount
      }}
    >
      {children}
    </RequestContext.Provider>
  );
};

export const useRequests = () => {
  const context = useContext(RequestContext);
  if (!context) {
    throw new Error('useRequests must be used within a RequestProvider');
  }
  return context;
};

export default RequestContext;

