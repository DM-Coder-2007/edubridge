'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import apiClient from '../lib/apiClient';
import { API_ENDPOINTS } from '../config/api';

const AuthContext = createContext({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => {},
  signup: async () => {},
  logout: async () => {},
  updatePreferences: async () => {},
  refreshUser: async () => {}
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize cached user from localStorage immediately on client mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const storedUser = localStorage.getItem('edubridge_user');
        const storedToken = localStorage.getItem('edubridge_token');
        if (storedUser && storedToken) {
          setUser(JSON.parse(storedUser));
          setIsLoading(false);
        }
      } catch (e) {
        console.warn('Failed to parse cached user from storage:', e);
      }
    }
  }, []);

  // Fetch current user from /api/auth/me to keep session in sync
  const refreshUser = useCallback(async () => {
    const token = apiClient.getToken();
    if (!token) {
      setUser(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('edubridge_user');
      }
      setIsLoading(false);
      return;
    }

    try {
      const data = await apiClient.get(API_ENDPOINTS.AUTH_ME);
      if (data && data.user) {
        setUser(data.user);
        if (typeof window !== 'undefined') {
          localStorage.setItem('edubridge_user', JSON.stringify(data.user));
        }
      } else {
        setUser(null);
        apiClient.setToken(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('edubridge_user');
        }
      }
    } catch (err) {
      // Only wipe session if server explicitly rejects with 401 Unauthorized
      if (err?.status === 401) {
        setUser(null);
        apiClient.setToken(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('edubridge_user');
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  // Handle unauthorized session expiration broadcast from apiClient
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleUnauthorized = () => {
      apiClient.setToken(null);
      setUser(null);
      localStorage.removeItem('edubridge_user');
      apiClient.clearCache();
    };

    window.addEventListener('edubridge:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('edubridge:unauthorized', handleUnauthorized);
    };
  }, []);

  const login = async ({ email, password }) => {
    setIsLoading(true);
    try {
      const data = await apiClient.post(API_ENDPOINTS.AUTH_LOGIN, { email, password });
      if (data && data.token) {
        apiClient.setToken(data.token);
      }
      if (data && data.user) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('edubridge_user', JSON.stringify(data.user));
        }
        setUser(data.user);
      }
      return data;
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (payload) => {
    setIsLoading(true);
    try {
      const data = await apiClient.post(API_ENDPOINTS.AUTH_SIGNUP, payload);
      if (data && data.token) {
        apiClient.setToken(data.token);
      }
      if (data && data.user) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('edubridge_user', JSON.stringify(data.user));
        }
        setUser(data.user);
      }
      return data;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await apiClient.post(API_ENDPOINTS.AUTH_LOGOUT);
    } catch (err) {
      console.warn('Logout API error:', err);
    } finally {
      apiClient.setToken(null);
      setUser(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('edubridge_user');
      }
      apiClient.clearCache();
    }
  };

  const updatePreferences = async (preferences) => {
    try {
      const data = await apiClient.put(API_ENDPOINTS.AUTH_PREFERENCES, { preferences });
      if (data && data.user) {
        setUser(data.user);
      } else if (data && data.preferences) {
        setUser((prev) => prev ? { ...prev, accessibilityPreferences: data.preferences } : null);
      }
      return data;
    } catch (err) {
      console.error('Failed to update accessibility preferences:', err);
      throw err;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        authenticated: Boolean(user),
        isAuthenticated: Boolean(user),
        loading: isLoading,
        isLoading,
        login,
        signup,
        logout,
        updatePreferences,
        refreshUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
