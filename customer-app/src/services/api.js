import axios from 'axios';
import { authStorage } from '../storage/authStorage';
import { getApiBaseUrl, API_CONFIG } from '../config/env';

const BASE_URL = getApiBaseUrl();

// Safe diagnostic log on development startup (without secrets)
if (__DEV__) {
  console.log(`[API Config] Active Base URL: ${BASE_URL}`);
}

const api = axios.create({
  baseURL: BASE_URL,
  timeout: API_CONFIG.TIMEOUT_MS,
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
          : status === 409
          ? 'Conflict: State conflict or already accepted by another user.'
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
  getAll: async (params = {}) => {
    const response = await api.get('/categories', { params });
    return response.data;
  },
  getCategories: async (params = {}) => {
    const response = await api.get('/categories', { params });
    return response.data;
  },
  getById: async (id) => {
    const response = await api.get(`/categories/${id}`);
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
  getAll: async (params = {}) => {
    const response = await api.get('/services', { params });
    return response.data;
  },
  getServices: async (params = {}) => {
    const response = await api.get('/services', { params });
    return response.data;
  },
  getById: async (id) => {
    const response = await api.get(`/services/${id}`);
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
  getAll: async (params = {}) => {
    const response = await api.get('/providers', { params });
    return response.data;
  },
  getProviders: async (params = {}) => {
    const response = await api.get('/providers', { params });
    return response.data;
  },
  getById: async (id) => {
    const response = await api.get(`/providers/${id}`);
    return response.data;
  },
  getProviderById: async (id) => {
    const response = await api.get(`/providers/${id}`);
    return response.data;
  }
};

// ==========================================
// 5. Booking & Scheduling APIs
// ==========================================
export const bookingApi = {
  createBooking: async (bookingData) => {
    const response = await api.post('/bookings', bookingData);
    return response.data;
  },
  getMyBookings: async (params = {}) => {
    const response = await api.get('/bookings/customer', { params });
    return response.data;
  },
  getBookingById: async (id) => {
    const response = await api.get(`/bookings/customer/${id}`);
    return response.data;
  },
  cancelBooking: async (id, cancellationReason) => {
    const response = await api.patch(`/bookings/customer/${id}/cancel`, { cancellationReason });
    return response.data;
  },
  createPaymentOrder: async (id) => {
    const response = await api.post(`/bookings/customer/${id}/payment/order`);
    return response.data;
  },
  verifyPayment: async (id, paymentData) => {
    const response = await api.post(`/bookings/customer/${id}/payment/verify`, paymentData);
    return response.data;
  },
  recordPaymentFailure: async (id, reason) => {
    const response = await api.post(`/bookings/customer/${id}/payment/failure`, { reason });
    return response.data;
  },
  reviewSpareParts: async (id, reviewData) => {
    const response = await api.patch(`/bookings/customer/${id}/spare-parts/review`, reviewData);
    return response.data;
  },
  createSparePartsPaymentOrder: async (id) => {
    const response = await api.post(`/bookings/customer/${id}/spare-parts/payment/order`);
    return response.data;
  },
  verifySparePartsPayment: async (id, paymentData) => {
    const response = await api.post(`/bookings/customer/${id}/spare-parts/payment/verify`, paymentData);
    return response.data;
  }
};

// ==========================================
// 6. Customer Profile & Address APIs
// ==========================================
export const customerApi = {
  getProfile: async () => {
    const response = await api.get('/customers/me');
    return response.data;
  },
  updateProfile: async (data) => {
    const response = await api.put('/customers/me', data);
    return response.data;
  },
  getAddresses: async () => {
    const response = await api.get('/customers/me/addresses');
    return response.data;
  },
  addAddress: async (data) => {
    const response = await api.post('/customers/me/addresses', data);
    return response.data;
  },
  updateAddress: async (addressId, data) => {
    const response = await api.put(`/customers/me/addresses/${addressId}`, data);
    return response.data;
  },
  deleteAddress: async (addressId) => {
    const response = await api.delete(`/customers/me/addresses/${addressId}`);
    return response.data;
  },
  setDefaultAddress: async (addressId) => {
    const response = await api.patch(`/customers/me/addresses/${addressId}/default`);
    return response.data;
  }
};

// ==========================================
// 7. Home Promotional Banner API
// ==========================================
export const bannerApi = {
  getBanner: async () => {
    const response = await api.get('/banner');
    return response.data;
  }
};

export default api;
