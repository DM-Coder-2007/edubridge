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

  // Fetch current user from /api/auth/me on mount
  const refreshUser = useCallback(async () => {
    try {
      const data = await apiClient.get(API_ENDPOINTS.AUTH_ME);
      if (data && data.user) {
        setUser(data.user);
      } else {
        setUser(null);
        apiClient.setToken(null);
      }
    } catch {
      // Not logged in or expired session
      setUser(null);
      apiClient.setToken(null);
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
