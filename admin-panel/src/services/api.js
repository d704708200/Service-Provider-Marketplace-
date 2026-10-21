import axios from 'axios';

// Resolve API base URL:
// 1. Explicit environment variable import.meta.env.VITE_API_URL if configured
// 2. If running on public hosting (e.g. Netlify, Vercel), default to the live production Render backend
// 3. Fall back to local development server (localhost:5000) only when developing on localhost
const resolveBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (typeof window !== 'undefined' && window.location) {
    const isLocalhost =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname === '[::1]';
    if (!isLocalhost) {
      return 'https://service-provider-marketplace.onrender.com/api';
    }
  }
  return 'http://localhost:5000/api';
};

const BASE_URL = resolveBaseUrl();

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

      // Handle unauthenticated (401) on protected routes, not on login attempts
      if (status === 401) {
        localStorage.removeItem('admin_token');
        const isLoginRequest = error.config?.url?.includes('/auth/login');
        if (!isLoginRequest && typeof onUnauthorizedCallback === 'function') {
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

// Provider & Verification API Methods
export const providerApi = {
  getAdminProviders: async (params = {}) => {
    const response = await api.get('/providers/admin', { params });
    return response.data;
  },
  getPendingVerifications: async (params = {}) => {
    const response = await api.get('/providers/admin/pending', { params });
    return response.data;
  },
  getAdminProviderById: async (id) => {
    const response = await api.get(`/providers/admin/${id}`);
    return response.data;
  },
  reviewDocument: async (providerId, documentId, reviewData) => {
    const response = await api.patch(
      `/providers/admin/${providerId}/documents/${documentId}/status`,
      reviewData
    );
    return response.data;
  },
  reviewKYC: async (providerId, kycData) => {
    const response = await api.patch(
      `/providers/admin/${providerId}/kyc/review`,
      kycData
    );
    return response.data;
  },
  updateVerification: async (providerId, verificationData) => {
    const response = await api.patch(
      `/providers/admin/${providerId}/verification`,
      verificationData
    );
    return response.data;
  },
  updateAccountStatus: async (providerId, isActive) => {
    const response = await api.patch(
      `/providers/admin/${providerId}/account-status`,
      { isActive }
    );
    return response.data;
  },
  updateTopRatedStatus: async (providerId, topRatedData) => {
    const response = await api.patch(
      `/providers/admin/${providerId}/top-rated`,
      topRatedData
    );
    return response.data;
  },
  deleteProvider: async (providerId) => {
    const response = await api.delete(`/providers/admin/${providerId}`);
    return response.data;
  },
  getPublicProviders: async (params = {}) => {
    const response = await api.get('/providers', { params });
    return response.data;
  },
  getPublicProviderById: async (id) => {
    const response = await api.get(`/providers/${id}`);
    return response.data;
  }
};

// Customer API Methods
export const customerApi = {
  getAdminCustomers: async (params = {}) => {
    const response = await api.get('/customers/admin', { params });
    return response.data;
  },
  deleteCustomer: async (customerId) => {
    const response = await api.delete(`/customers/admin/${customerId}`);
    return response.data;
  }
};

// Bookings & Service Requests API Methods
export const bookingApi = {
  getAdminBookings: async (params = {}) => {
    const response = await api.get('/bookings/admin', { params });
    return response.data;
  },
  getAdminBookingStats: async () => {
    const response = await api.get('/bookings/admin/stats');
    return response.data;
  },
  getAdminBookingById: async (id) => {
    const response = await api.get(`/bookings/admin/${id}`);
    return response.data;
  },
  cancelBooking: async (id, cancellationReason) => {
    const response = await api.patch(`/bookings/admin/${id}/cancel`, { cancellationReason });
    return response.data;
  }
};

// Home Promotional Banner API Methods
export const bannerApi = {
  getAdminBanner: async () => {
    const response = await api.get('/banner/admin');
    return response.data;
  },
  updateAdminBanner: async (bannerData) => {
    const response = await api.put('/banner/admin', bannerData);
    return response.data;
  },
  getPublicBanner: async () => {
    const response = await api.get('/banner');
    return response.data;
  }
};

// Dashboard & Analytics API Methods
export const dashboardApi = {
  getOverviewStats: async () => {
    // Aggregates live customer count, provider count, pending verifications, catalog count, and booking stats
    const [custRes, provRes, pendingRes, svcRes, bkStatsRes] = await Promise.all([
      customerApi.getAdminCustomers({ limit: 1 }),
      providerApi.getAdminProviders({ limit: 1 }),
      providerApi.getPendingVerifications({ limit: 1 }),
      serviceApi.getAdminServices({ limit: 1 }),
      bookingApi.getAdminBookingStats().catch(() => ({ success: false, data: null }))
    ]);

    return {
      success: true,
      data: {
        customersCount: custRes?.pagination?.total ?? (custRes?.data?.length || 0),
        providersCount: provRes?.pagination?.total ?? (provRes?.data?.length || 0),
        pendingVerificationsCount: pendingRes?.pagination?.total ?? (pendingRes?.data?.length || 0),
        servicesCount: svcRes?.pagination?.total ?? (svcRes?.data?.length || 0),
        bookingStats: bkStatsRes?.data || null
      }
    };
  },
  getRecentActivity: async () => {
    // Reuses the live bookings endpoint to generate real-time activity events
    const bkRes = await bookingApi.getAdminBookings({ limit: 8 });
    return {
      success: true,
      data: bkRes?.data || []
    };
  }
};

// Reviews & Ratings Moderation API Methods
export const reviewApi = {
  getAdminReviews: async (params = {}) => {
    const response = await api.get('/reviews/admin', { params });
    return response.data;
  },
  updateReviewVisibility: async (id, isPublic) => {
    const response = await api.patch(`/reviews/admin/${id}/visibility`, { isPublic });
    return response.data;
  },
  deleteReview: async (id) => {
    const response = await api.delete(`/reviews/admin/${id}`);
    return response.data;
  }
};

// Service Areas & Locations API Methods
export const locationApi = {
  getAdminLocations: async (params = {}) => {
    const response = await api.get('/locations/admin', { params });
    return response.data;
  },
  createLocation: async (locationData) => {
    const response = await api.post('/locations/admin', locationData);
    return response.data;
  },
  updateLocation: async (id, locationData) => {
    const response = await api.put(`/locations/admin/${id}`, locationData);
    return response.data;
  },
  toggleLocationStatus: async (id, isActive) => {
    const response = await api.patch(`/locations/admin/${id}/status`, { isActive });
    return response.data;
  },
  deleteLocation: async (id) => {
    const response = await api.delete(`/locations/admin/${id}`);
    return response.data;
  }
};

// Reports & Financial Analytics API Methods
export const reportApi = {
  getPlatformReports: async (params = {}) => {
    const response = await api.get('/reports/admin', { params });
    return response.data;
  }
};

export default api;

