import axios from 'axios';
import { authStorage } from '../storage/authStorage';
import { getApiBaseUrl, API_CONFIG } from '../config/env';

const BASE_URL = getApiBaseUrl();

// Safe diagnostic log on development startup (without secrets or tokens)
if (__DEV__) {
  console.log(`[Provider API Config] Active Base URL: ${BASE_URL}`);
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

// Request Interceptor: Attach Bearer token and handle FormData Content-Type
api.interceptors.request.use(
  async (config) => {
    const token = await authStorage.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // If request payload is FormData, do NOT force Content-Type: application/json or manual multipart
    // Let the browser or React Native network client generate the multipart boundary automatically
    if (config.data instanceof FormData || (config.data && typeof config.data.getParts === 'function')) {
      delete config.headers['Content-Type'];
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
      const serverMessage = data?.error?.message || data?.message;
      const message =
        serverMessage ||
        (status === 400
          ? 'Validation failed. Please check the information provided.'
          : status === 401
          ? 'Invalid email or password.'
          : status === 403
          ? 'Access denied: You lack permission for this provider action.'
          : status === 404
          ? 'The requested booking or resource was not found.'
          : status === 409
          ? 'An account with this email address or phone number already exists.'
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
        'Unable to reach backend server. Check connection or verify backend is running at ' +
        BASE_URL;
    } else {
      error.userMessage = error.message || 'Request configuration error.';
    }

    return Promise.reject(error);
  }
);

// Provider Authentication APIs
export const authApi = {
  loginProvider: async (credentials) => {
    const response = await api.post('/auth/login/provider', credentials);
    return response.data;
  },
  registerProvider: async (providerData) => {
    const response = await api.post('/auth/register/provider', providerData);
    return response.data;
  },
  getMe: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  }
};

// Provider Bookings & Requests APIs
export const bookingApi = {
  getPendingRequests: async (params = {}) => {
    const response = await api.get('/bookings/provider/requests', { params });
    return response.data;
  },
  getHistory: async (params = {}) => {
    const response = await api.get('/bookings/provider/history', { params });
    return response.data;
  },
  getBookingById: async (id) => {
    const response = await api.get(`/bookings/provider/${id}`);
    return response.data;
  },
  acceptBooking: async (id) => {
    const response = await api.patch(`/bookings/provider/${id}/accept`);
    return response.data;
  },
  rejectBooking: async (id, rejectionReason) => {
    const response = await api.patch(`/bookings/provider/${id}/reject`, { rejectionReason });
    return response.data;
  },
  startService: async (id) => {
    const response = await api.patch(`/bookings/provider/${id}/start`);
    return response.data;
  },
  completeService: async (id) => {
    const response = await api.patch(`/bookings/provider/${id}/complete`);
    return response.data;
  },
  submitSpareParts: async (id, partsData) => {
    const response = await api.post(`/bookings/provider/${id}/spare-parts`, partsData);
    return response.data;
  },
  confirmCashPayment: async (id) => {
    const response = await api.patch(`/bookings/provider/${id}/cash/confirm`);
    return response.data;
  },
  getNotifications: async (params = {}) => {
    const response = await api.get('/bookings/user/notifications', { params });
    return response.data;
  },
  markNotificationAsRead: async (id) => {
    const response = await api.patch(`/bookings/user/notifications/${id}/read`);
    return response.data;
  }
};

// Provider Profile APIs
export const providerApi = {
  getProfile: async () => {
    const response = await api.get('/providers/me');
    return response.data;
  },
  updateProfile: async (data) => {
    const response = await api.put('/providers/me', data);
    return response.data;
  },
  uploadAvatar: async (formData) => {
    // Note: Do NOT manually set 'Content-Type': 'multipart/form-data' without a boundary!
    // Axios / browser / React Native automatically attaches multipart/form-data; boundary=...
    const response = await api.post('/providers/me/avatar', formData);
    return response.data;
  },
  uploadKYCDocument: async (formData) => {
    const response = await api.post('/providers/me/kyc/upload', formData);
    return response.data;
  },
  submitKYCDocuments: async (kycData) => {
    const response = await api.post('/providers/me/kyc/submit', kycData);
    return response.data;
  }
};

// Provider Availability Schedule APIs
export const availabilityApi = {
  getAvailability: async () => {
    const response = await api.get('/providers/me/availability');
    return response.data;
  },
  updateAvailability: async (schedule) => {
    const response = await api.put('/providers/me/availability', { schedule });
    return response.data;
  }
};

// Provider Service Areas APIs
export const serviceAreaApi = {
  getServiceAreas: async () => {
    const response = await api.get('/providers/me/service-areas');
    return response.data;
  },
  addServiceArea: async (data) => {
    const response = await api.post('/providers/me/service-areas', data);
    return response.data;
  },
  updateServiceArea: async (id, data) => {
    const response = await api.put(`/providers/me/service-areas/${id}`, data);
    return response.data;
  },
  deleteServiceArea: async (id) => {
    const response = await api.delete(`/providers/me/service-areas/${id}`);
    return response.data;
  }
};

// Provider Offered Services APIs
export const providerServicesApi = {
  getServices: async () => {
    const response = await api.get('/providers/me/services');
    return response.data;
  },
  addService: async (data) => {
    const response = await api.post('/providers/me/services', data);
    return response.data;
  },
  updateService: async (id, data) => {
    const response = await api.put(`/providers/me/services/${id}`, data);
    return response.data;
  },
  deleteService: async (id) => {
    const response = await api.delete(`/providers/me/services/${id}`);
    return response.data;
  }
};

export default api;
