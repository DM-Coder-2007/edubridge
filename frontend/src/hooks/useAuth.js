'use client';

import { useAuth } from '../context/AuthContext';

/**
 * Hook for consuming authentication context.
 * Returns:
 * - user: User profile or null
 * - loading: boolean
 * - authenticated: boolean
 * - login: async ({ email, password }) => data
 * - signup: async ({ email, password, fullName, role, ... }) => data
 * - logout: async () => void
 * - refreshUser: async () => void
 */
export { useAuth };
export default useAuth;
