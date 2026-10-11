import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, setOnUnauthorizedCallback } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('admin_token') || null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const clearError = useCallback(() => setError(null), []);

  const logout = useCallback(() => {
    localStorage.removeItem('admin_token');
    setToken(null);
    setUser(null);
    setProfile(null);
    setError(null);
  }, []);

  // Handle automatic session termination on 401 interceptor
  useEffect(() => {
    setOnUnauthorizedCallback((reason) => {
      logout();
      setError(reason || 'Session expired. Please sign in again.');
    });
  }, [logout]);

  // Validate saved session on initial load
  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem('admin_token');
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await authApi.getMe();
        if (response?.success && response?.data?.user) {
          const currentUser = response.data.user;
          const currentProfile = response.data.profile;

          // Strict verification: user must have 'admin' role
          if (currentUser.role !== 'admin') {
            logout();
            setError('Access restricted to administrator accounts.');
          } else if (!currentUser.isActive) {
            logout();
            setError('This administrator account has been deactivated.');
          } else {
            setUser(currentUser);
            setProfile(currentProfile);
            setToken(storedToken);
          }
        } else {
          logout();
        }
      } catch (err) {
        // Token invalid, expired, or server unreachable
        logout();
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, [logout]);

  /**
   * Log in administrator with email and password
   * Calls POST /api/auth/login/admin
   */
  const login = async (email, password) => {
    setError(null);
    try {
      const response = await authApi.loginAdmin({
        email: email.trim().toLowerCase(),
        password
      });

      if (response?.success && response?.data) {
        const { token: receivedToken, user: receivedUser, profile: receivedProfile } = response.data;

        if (receivedUser?.role !== 'admin') {
          throw new Error('Access denied: Unauthorized role for administrative portal');
        }

        if (!receivedUser?.isActive) {
          throw new Error('Administrator account is deactivated. Contact support.');
        }

        // Store token in localStorage
        localStorage.setItem('admin_token', receivedToken);
        setToken(receivedToken);
        setUser(receivedUser);
        setProfile(receivedProfile);
        return { success: true, user: receivedUser };
      } else {
        throw new Error(response?.message || 'Authentication failed');
      }
    } catch (err) {
      const errorMessage = err.userMessage || err.message || 'Login failed. Please verify credentials.';
      setError(errorMessage);
      throw err;
    }
  };

  const value = {
    user,
    profile,
    token,
    isAuthenticated: Boolean(user && user.role === 'admin' && token),
    isLoading,
    error,
    clearError,
    login,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
