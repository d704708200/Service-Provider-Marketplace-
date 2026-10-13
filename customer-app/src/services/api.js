import axios from 'axios';
import { authStorage } from '../storage/authStorage';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json'
  }
});

let onUnauthorizedCallback = null;

export const setOnUnauthorizedCallback = (callback) => {
  onUnauthorizedCallback = callback;
};

// Request Interceptor: Attach Bearer token
api.interceptors.request.use(
  async (config) => {
    const token = await authStorage.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Format error and handle 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response) {
      const { status, data } = error.response;
      const message =
        data?.error?.message ||
        data?.message ||
        (status === 401
          ? 'Session expired. Please sign in again.'
          : status === 403
          ? 'Access denied: You lack permission for this action.'
          : status === 404
          ? 'The requested resource was not found.'
          : status >= 500
          ? 'Server error occurred. Please try again later.'
          : 'An unexpected error occurred.');

      error.userMessage = message;

      if (status === 401) {
        await authStorage.clearAuth();
        if (typeof onUnauthorizedCallback === 'function') {
          onUnauthorizedCallback(message);
        }
      }
    } else if (error.request) {
      error.userMessage =
        'Unable to connect to the backend server. Please check your network connection or verify that the API server is running at ' +
        BASE_URL;
    } else {
      error.userMessage = error.message || 'Request configuration error.';
    }

    return Promise.reject(error);
  }
);

// ==========================================
// 1. Authentication APIs
// ==========================================
export const authApi = {
  registerCustomer: async (customerData) => {
    const response = await api.post('/auth/register/customer', customerData);
    return response.data;
  },
  loginCustomer: async (credentials) => {
    const response = await api.post('/auth/login/customer', credentials);
    return response.data;
  },
  getMe: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  }
};

// ==========================================
// 2. Categories Catalog APIs
// ==========================================
export const categoryApi = {
  getCategories: async (params = {}) => {
    const response = await api.get('/categories', { params });
    return response.data;
  },
  getCategoryById: async (id) => {
    const response = await api.get(`/categories/${id}`);
    return response.data;
  }
};

// ==========================================
// 3. Services Catalog APIs
// ==========================================
export const serviceApi = {
  getServices: async (params = {}) => {
    const response = await api.get('/services', { params });
    return response.data;
  },
  getServiceById: async (id) => {
    const response = await api.get(`/services/${id}`);
    return response.data;
  }
};

// ==========================================
// 4. Provider Discovery APIs
// ==========================================
export const providerApi = {
  getProviders: async (params = {}) => {
    const response = await api.get('/providers', { params });
    return response.data;
  },
  getProviderById: async (id) => {
    const response = await api.get(`/providers/${id}`);
    return response.data;
  }
};

export default api;
