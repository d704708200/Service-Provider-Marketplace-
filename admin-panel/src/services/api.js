import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json'
  }
});

// Callback for handling 401 unauthenticated globally in React context
let onUnauthorizedCallback = null;

export const setOnUnauthorizedCallback = (callback) => {
  onUnauthorizedCallback = callback;
};

// Request Interceptor: Attach Bearer token if present
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('admin_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Format error and handle 401/403
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response) {
      const { status, data } = error.response;
      
      // Extract human-friendly error message from standard backend format
      const message =
        data?.error?.message ||
        data?.message ||
        (status === 401
          ? 'Authentication required or session expired. Please sign in again.'
          : status === 403
          ? 'Access denied: You lack sufficient administrative privileges.'
          : status === 404
          ? 'Requested resource not found.'
          : status >= 500
          ? 'Server error occurred. Please try again later.'
          : 'An unexpected error occurred.');

      error.userMessage = message;

      // Handle unauthenticated (401)
      if (status === 401) {
        localStorage.removeItem('admin_token');
        if (typeof onUnauthorizedCallback === 'function') {
          onUnauthorizedCallback(message);
        }
      }
    } else if (error.request) {
      error.userMessage = 'Unable to reach backend service. Verify server is running at ' + BASE_URL;
    } else {
      error.userMessage = error.message || 'Network request configuration failed.';
    }

    return Promise.reject(error);
  }
);

// Auth API Methods
export const authApi = {
  loginAdmin: async (credentials) => {
    const response = await api.post('/auth/login/admin', credentials);
    return response.data;
  },
  getMe: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },
  checkHealth: async () => {
    const response = await api.get('/health');
    return response.data;
  }
};

// Categories API Methods
export const categoryApi = {
  getAdminCategories: async (params = {}) => {
    const response = await api.get('/categories/admin', { params });
    return response.data;
  },
  getPublicCategories: async (params = {}) => {
    const response = await api.get('/categories', { params });
    return response.data;
  },
  getCategoryById: async (id) => {
    const response = await api.get(`/categories/${id}`);
    return response.data;
  },
  createCategory: async (categoryData) => {
    const response = await api.post('/categories', categoryData);
    return response.data;
  },
  updateCategory: async (id, categoryData) => {
    const response = await api.put(`/categories/${id}`, categoryData);
    return response.data;
  },
  updateCategoryStatus: async (id, isActive) => {
    const response = await api.patch(`/categories/${id}/status`, { isActive });
    return response.data;
  },
  deleteCategory: async (id) => {
    const response = await api.delete(`/categories/${id}`);
    return response.data;
  }
};

// Services Catalog API Methods
export const serviceApi = {
  getAdminServices: async (params = {}) => {
    const response = await api.get('/services/admin', { params });
    return response.data;
  },
  getPublicServices: async (params = {}) => {
    const response = await api.get('/services', { params });
    return response.data;
  },
  getServiceById: async (id) => {
    const response = await api.get(`/services/${id}`);
    return response.data;
  },
  createService: async (serviceData) => {
    const response = await api.post('/services', serviceData);
    return response.data;
  },
  updateService: async (id, serviceData) => {
    const response = await api.put(`/services/${id}`, serviceData);
    return response.data;
  },
  updateServiceStatus: async (id, isActive) => {
    const response = await api.patch(`/services/${id}/status`, { isActive });
    return response.data;
  },
  deleteService: async (id) => {
    const response = await api.delete(`/services/${id}`);
    return response.data;
  }
};

export default api;
