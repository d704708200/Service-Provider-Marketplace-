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

  const clearError = useCallback(() => setError(null), []);

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

  const checkAuthSession = useCallback(async () => {
    setIsLoading(true);
    try {
      const storedToken = await authStorage.getToken();
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      setToken(storedToken);

      const response = await authApi.getMe();
      if (response?.success && response.data?.user) {
        if (response.data.user.role !== 'provider') {
          console.warn('Non-provider role detected in provider app.');
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
      if (err.response?.status === 401) {
        await logout();
      } else {
        const cachedUser = await authStorage.getUser();
        if (cachedUser && cachedUser.role === 'provider') {
          setUser(cachedUser);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    setOnUnauthorizedCallback(() => {
      logout();
    });
    checkAuthSession();
  }, [checkAuthSession, logout]);

  const login = async (credentialsOrEmail, maybePassword) => {
    clearError();
    let email, password;
    if (typeof credentialsOrEmail === 'object' && credentialsOrEmail !== null) {
      email = credentialsOrEmail.email;
      password = credentialsOrEmail.password;
    } else {
      email = credentialsOrEmail;
      password = maybePassword;
    }

    try {
      const response = await authApi.loginProvider({ email: (email || '').trim().toLowerCase(), password });
      if (response?.success && response.data) {
        const { token: receivedToken, user: receivedUser, profile: receivedProfile } = response.data;

        if (receivedUser.role !== 'provider') {
          const roleErr = 'Access denied: Account is not registered as a service provider.';
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
      const msg = err.userMessage || err.message || 'Login failed. Please check your credentials.';
      setError(msg);
      return { success: false, error: msg };
    }
  };

  const register = async (providerData) => {
    clearError();
    try {
      const response = await authApi.registerProvider({
        name: (providerData.name || '').trim(),
        email: (providerData.email || '').trim().toLowerCase(),
        phone: (providerData.phone || '').trim(),
        password: providerData.password,
        businessName: (providerData.businessName || '').trim(),
        bio: providerData.bio ? providerData.bio.trim() : '',
        experienceYears: Number(providerData.experienceYears) || 0
      });

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
      const msg = err.userMessage || err.message || 'Registration failed. Please verify your details.';
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
