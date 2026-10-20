import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { authStorage } from '../storage/authStorage';
import { authApi, setOnUnauthorizedCallback } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Logout / clear session
  const logout = useCallback(async () => {
    try {
      await authStorage.clearAuth();
    } catch (e) {
      console.error('Logout error:', e);
    } finally {
      setToken(null);
      setUser(null);
      setProfile(null);
      setError(null);
    }
  }, []);

  // Restore and validate session on launch
  const checkAuthSession = useCallback(async () => {
    setIsLoading(true);
    try {
      const storedToken = await authStorage.getToken();
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      setToken(storedToken);

      // Validate session against /api/auth/me
      const response = await authApi.getMe();
      if (response?.success && response.data?.user) {
        // Enforce customer role boundary
        if (response.data.user.role !== 'customer') {
          console.warn('Non-customer role detected in customer app. Logging out.');
          await logout();
          return;
        }

        setUser(response.data.user);
        setProfile(response.data.profile || null);
        await authStorage.setUser(response.data.user);
      } else {
        await logout();
      }
    } catch (err) {
      console.warn('Session restoration check:', err.userMessage || err.message);
      // If 401 or invalid session, clear session; if network offline, fallback to cached user only if token still exists
      if (err.response?.status === 401) {
        await logout();
      } else {
        const currentToken = await authStorage.getToken();
        if (currentToken) {
          const cachedUser = await authStorage.getUser();
          if (cachedUser && cachedUser.role === 'customer') {
            setUser(cachedUser);
          } else {
            await logout();
          }
        } else {
          await logout();
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    // Setup 401 auto logout handler
    setOnUnauthorizedCallback(() => {
      logout();
    });

    checkAuthSession();
  }, [checkAuthSession, logout]);

  // Customer Login
  const login = async (credentialsOrEmail, maybePassword) => {
    clearError();
    let email, password;
    if (typeof credentialsOrEmail === 'object' && credentialsOrEmail !== null) {
      email = credentialsOrEmail.email || credentialsOrEmail.identifier;
      password = credentialsOrEmail.password;
    } else {
      email = credentialsOrEmail;
      password = maybePassword;
    }

    try {
      const response = await authApi.loginCustomer({ email: (email || '').trim().toLowerCase(), password });
      if (response?.success && response.data) {
        const { token: receivedToken, user: receivedUser, profile: receivedProfile } = response.data;

        if (receivedUser.role !== 'customer') {
          const roleErr = 'Access denied: Account is not registered as a customer.';
          setError(roleErr);
          return { success: false, error: roleErr };
        }

        await authStorage.setToken(receivedToken);
        await authStorage.setUser(receivedUser);

        setToken(receivedToken);
        setUser(receivedUser);
        setProfile(receivedProfile || null);
        return { success: true, data: response.data };
      }
      const genericErr = 'Login failed: Invalid server response.';
      setError(genericErr);
      return { success: false, error: genericErr };
    } catch (err) {
      const msg = err.userMessage || err.message || 'Login failed. Please verify your credentials.';
      setError(msg);
      return { success: false, error: msg };
    }
  };

  // Customer Registration
  const register = async (customerData) => {
    clearError();
    try {
      const response = await authApi.registerCustomer(customerData);
      if (response?.success && response.data) {
        const { token: receivedToken, user: receivedUser, profile: receivedProfile } = response.data;

        await authStorage.setToken(receivedToken);
        await authStorage.setUser(receivedUser);

        setToken(receivedToken);
        setUser(receivedUser);
        setProfile(receivedProfile || null);
        return { success: true, data: response.data };
      }
      const genericErr = 'Registration failed: Invalid server response.';
      setError(genericErr);
      return { success: false, error: genericErr };
    } catch (err) {
      const msg = err.userMessage || err.message || 'Registration failed. Please try again.';
      setError(msg);
      return { success: false, error: msg };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        token,
        isLoading,
        isAuthenticated: Boolean(token && user),
        error,
        clearError,
        login,
        register,
        logout,
        checkAuthSession
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
