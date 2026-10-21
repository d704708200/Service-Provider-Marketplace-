import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './routes/ProtectedRoute';
import PublicRoute from './routes/PublicRoute';
import AdminLayout from './components/layout/AdminLayout';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CustomersPage from './pages/customers/CustomersPage';
import ProvidersPage from './pages/providers/ProvidersPage';
import ProviderVerificationPage from './pages/providers/ProviderVerificationPage';
import CategoriesPage from './pages/categories/CategoriesPage';
import ServicesPage from './pages/services/ServicesPage';
import BookingsPage from './pages/bookings/BookingsPage';
import RequestsPage from './pages/requests/RequestsPage';
import ReviewsPage from './pages/reviews/ReviewsPage';
import LocationsPage from './pages/locations/LocationsPage';
import ReportsPage from './pages/reports/ReportsPage';
import SettingsPage from './pages/settings/SettingsPage';
import NotFound from './pages/NotFound';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Public Authentication Route */}
          <Route element={<PublicRoute />}>
            <Route path="/login" element={<Login />} />
          </Route>

          {/* Protected Administrative Routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AdminLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/dashboard" element={<Navigate to="/" replace />} />
              <Route path="/customers" element={<CustomersPage />} />
              <Route path="/providers" element={<ProvidersPage />} />
              <Route path="/provider-verification" element={<ProviderVerificationPage />} />
              <Route path="/categories" element={<CategoriesPage />} />
              <Route path="/services" element={<ServicesPage />} />
              <Route path="/bookings" element={<BookingsPage />} />
              <Route path="/requests" element={<RequestsPage />} />
              <Route path="/reviews" element={<ReviewsPage />} />
              <Route path="/locations" element={<LocationsPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
