import React from 'react';
import { Settings, Shield, User, Server, Database, Key } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';

const SettingsPage = () => {
  const { user, profile } = useAuth();

  const permissions = profile?.permissions || ['manage_users', 'manage_providers', 'manage_categories', 'manage_services', 'manage_bookings'];
  const department = profile?.department || 'Operations';
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">System & Account Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Inspect administrator profile attributes, configured permissions, and platform service parameters.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Administrator Profile Details */}
        <Card title="Current Administrator Profile" subtitle="Authenticated session metadata">
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
              <div className="w-12 h-12 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-base">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-900">{user?.name || 'Administrator'}</h4>
                <p className="text-xs text-slate-500">{user?.email || 'N/A'}</p>
                <div className="mt-1 flex items-center gap-2">
                  <Badge variant="primary">Role: {user?.role || 'admin'}</Badge>
                  <Badge variant="success">Account: {user?.isActive ? 'Active' : 'Inactive'}</Badge>
                </div>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Department</span>
                <span className="font-medium text-slate-900">{department}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">User Account ID</span>
                <span className="font-mono text-slate-700">{user?._id || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Admin Profile ID</span>
                <span className="font-mono text-slate-700">{profile?._id || 'N/A'}</span>
              </div>
            </div>

            <div className="pt-2">
              <span className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Assigned Permissions
              </span>
              <div className="flex flex-wrap gap-1.5">
                {permissions.map((perm, idx) => (
                  <Badge key={idx} variant="default">
                    {perm}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Backend & Environment Configuration */}
        <Card title="Platform Connectivity Configuration" subtitle="Runtime environment endpoints">
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
              <div className="flex items-center gap-2 font-medium text-slate-900">
                <Server className="w-4 h-4 text-indigo-600" />
                <span>Backend API Base URL</span>
              </div>
              <code className="block p-2 bg-white border border-slate-200 rounded-md text-[11px] font-mono text-slate-800 break-all">
                {apiUrl}
              </code>
              <p className="text-[11px] text-slate-500">
                Configured via Vite environment variable <span className="font-mono">VITE_API_URL</span>.
              </p>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
              <div className="flex items-center gap-2 font-medium text-slate-900">
                <Key className="w-4 h-4 text-indigo-600" />
                <span>Authentication Protocol</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                JSON Web Token (JWT) over Bearer Authorization headers with automated 401 session expiration handling.
              </p>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
              <div className="flex items-center gap-2 font-medium text-slate-900">
                <Database className="w-4 h-4 text-indigo-600" />
                <span>Persistence Model</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Strict MongoDB multi-role relational linkage (User model with specialized Admin model profile).
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default SettingsPage;
