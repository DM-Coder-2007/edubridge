'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

const LoadingContext = createContext({
  isLoading: false,
  loadingMessage: '',
  startLoading: () => {},
  stopLoading: () => {}
});

export function LoadingProvider({ children }) {
  const [loadingCount, setLoadingCount] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('');

  const startLoading = useCallback((msg = 'Loading...') => {
    setLoadingMessage(msg);
    setLoadingCount((prev) => prev + 1);
  }, []);

  const stopLoading = useCallback(() => {
    setLoadingCount((prev) => Math.max(0, prev - 1));
  }, []);

  const isLoading = loadingCount > 0;

  return (
    <LoadingContext.Provider value={{ isLoading, loadingMessage, startLoading, stopLoading }}>
      {children}
    </LoadingContext.Provider>
  );
}

export function useLoading() {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
}

export default LoadingContext;
