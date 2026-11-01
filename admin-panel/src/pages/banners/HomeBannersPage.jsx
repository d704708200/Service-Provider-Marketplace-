import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  SlidersHorizontal,
  Plus,
  RefreshCw,
  Edit2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  ArrowUp,
  ArrowDown,
  Upload,
  Image as ImageIcon,
  Calendar,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  X,
  Eye,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Link as LinkIcon
} from 'lucide-react';
import { homeBannerApi, categoryApi, serviceApi } from '../../services/api';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ConfirmationModal from '../../components/modals/ConfirmationModal';

const initialFormData = {
  title: '',
  subtitle: '',
  imageUrl: '',
  destinationType: 'none',
  destinationId: '',
  displayOrder: 0,
  isActive: true,
  startDate: '',
  endDate: ''
};

const DESTINATION_OPTIONS = [
  { value: 'none', label: 'None (Display only)' },
  { value: 'category', label: 'Category' },
  { value: 'service', label: 'Service Details' },
  { value: 'search', label: 'Search Query' },
  { value: 'offer', label: 'Offer / Promotion' },
  { value: 'screen', label: 'App Screen' },
  { value: 'url', label: 'External URL' }
];

const HomeBannersPage = () => {
  // Banners & lists state
  const [banners, setBanners] = useState([]);
  const [categories, setCategories] = useState([]);
  const [services, setServices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Preview Mode
  const [showPreview, setShowPreview] = useState(true);
  const [previewIndex, setPreviewIndex] = useState(0);
  const previewTimerRef = useRef(null);

  // Modal State (Create / Edit)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState(null);
  const [formData, setFormData] = useState(initialFormData);
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Confirmation Modal State (Delete)
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: '',
    confirmVariant: 'danger',
    onConfirm: () => {},
    isLoading: false
  });

  // Fetch all banners from Admin API
  const fetchBanners = useCallback(async () => {
    setIsLoading(true);
    setApiError(null);
    try {
      const response = await homeBannerApi.getAll();
      if (response?.success) {
        setBanners(response.data || []);
      } else {
        setApiError(response?.message || 'Failed to retrieve home banners');
      }
    } catch (err) {
      setApiError(err.userMessage || 'Failed to fetch home banners from server');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch categories and services for destination selectors
  useEffect(() => {
    const fetchDropdownData = async () => {
      try {
        const [catRes, srvRes] = await Promise.all([
          categoryApi.getAdminCategories({ limit: 100 }).catch(() => ({ success: false, data: [] })),
          serviceApi.getAdminServices({ limit: 100 }).catch(() => ({ success: false, data: [] }))
        ]);
        if (catRes?.success && Array.isArray(catRes.data)) {
          setCategories(catRes.data);
        }
        if (srvRes?.success && Array.isArray(srvRes.data)) {
          setServices(srvRes.data);
        }
      } catch (err) {
        console.error('Failed to load dropdown categories/services:', err);
      }
    };

    fetchBanners();
    fetchDropdownData();
  }, [fetchBanners]);

  // Preview Auto-sliding timer
  const activeBanners = banners.filter((b) => {
    if (!b.isActive) return false;
    const now = new Date();
    if (b.startDate && new Date(b.startDate) > now) return false;
    if (b.endDate && new Date(b.endDate) < now) return false;
    return true;
  });

  useEffect(() => {
    if (!showPreview || activeBanners.length <= 1) return;
    previewTimerRef.current = setInterval(() => {
      setPreviewIndex((prev) => (prev + 1) % activeBanners.length);
    }, 3500);

    return () => {
      if (previewTimerRef.current) clearInterval(previewTimerRef.current);
    };
  }, [showPreview, activeBanners.length]);

  // Reset preview index if out of bounds
  useEffect(() => {
    if (previewIndex >= activeBanners.length && activeBanners.length > 0) {
      setPreviewIndex(0);
    }
  }, [activeBanners.length, previewIndex]);

  // Handle Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingBanner(null);
    setFormData({
      ...initialFormData,
      displayOrder: banners.length > 0 ? Math.max(...banners.map((b) => b.displayOrder || 0)) + 1 : 0
    });
    setSelectedFile(null);
    setImagePreviewUrl('');
    setUploadProgress(0);
    setFormErrors({});
    setIsModalOpen(true);
  };

  // Handle Open Edit Modal
  const handleOpenEditModal = (banner) => {
    setEditingBanner(banner);
    setFormData({
      title: banner.title || '',
      subtitle: banner.subtitle || '',
      imageUrl: banner.imageUrl || '',
      destinationType: banner.destinationType || 'none',
      destinationId: banner.destinationId || '',
      displayOrder: banner.displayOrder ?? 0,
      isActive: banner.isActive !== false,
      startDate: banner.startDate ? new Date(banner.startDate).toISOString().slice(0, 16) : '',
      endDate: banner.endDate ? new Date(banner.endDate).toISOString().slice(0, 16) : ''
    });
    setSelectedFile(null);
    setImagePreviewUrl(banner.imageUrl || '');
    setUploadProgress(0);
    setFormErrors({});
    setIsModalOpen(true);
  };

  // Handle File Selection
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      setFormErrors((prev) => ({ ...prev, image: 'Please select a valid image file (JPG, PNG, WEBP)' }));
      return;
    }

    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setFormErrors((prev) => ({ ...prev, image: 'Image size exceeds maximum limit of 5MB' }));
      return;
    }

    setSelectedFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
    setFormErrors((prev) => {
      const copy = { ...prev };
      delete copy.image;
      return copy;
    });
  };

  // Validate Modal Form
  const validateForm = () => {
    const errors = {};
    if (!formData.title.trim()) {
      errors.title = 'Banner title is required';
    } else if (formData.title.length > 100) {
      errors.title = 'Title must be 100 characters or fewer';
    }

    if (formData.subtitle && formData.subtitle.length > 150) {
      errors.subtitle = 'Subtitle must be 150 characters or fewer';
    }

    if (!editingBanner && !selectedFile && !formData.imageUrl.trim()) {
      errors.image = 'Banner image is required (upload a file or provide a URL)';
    }

    if (formData.destinationType && formData.destinationType !== 'none') {
      if (!formData.destinationId.trim()) {
        errors.destinationId = `Target selection or value is required for ${formData.destinationType}`;
      }
    }

    if (formData.startDate && formData.endDate) {
      if (new Date(formData.startDate) >= new Date(formData.endDate)) {
        errors.endDate = 'End date must be after the start date';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle Form Submit (Create / Edit)
  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    setUploadProgress(10);
    setApiError(null);

    try {
      let payload;
      if (selectedFile) {
        // Multipart FormData for Cloudinary Upload
        const fd = new FormData();
        fd.append('title', formData.title.trim());
        if (formData.subtitle) fd.append('subtitle', formData.subtitle.trim());
        fd.append('destinationType', formData.destinationType);
        if (formData.destinationId) fd.append('destinationId', formData.destinationId.trim());
        fd.append('displayOrder', String(formData.displayOrder ?? 0));
        fd.append('isActive', String(formData.isActive));
        if (formData.startDate) fd.append('startDate', new Date(formData.startDate).toISOString());
        if (formData.endDate) fd.append('endDate', new Date(formData.endDate).toISOString());
        fd.append('image', selectedFile);
        payload = fd;
      } else {
        // Plain JSON
        payload = {
          title: formData.title.trim(),
          subtitle: formData.subtitle.trim() || undefined,
          imageUrl: formData.imageUrl.trim() || undefined,
          destinationType: formData.destinationType,
          destinationId: formData.destinationId.trim() || undefined,
          displayOrder: parseInt(formData.displayOrder, 10) || 0,
          isActive: formData.isActive,
          startDate: formData.startDate ? new Date(formData.startDate).toISOString() : null,
          endDate: formData.endDate ? new Date(formData.endDate).toISOString() : null
        };
      }

      if (editingBanner) {
        await homeBannerApi.update(editingBanner._id, payload, (progress) => {
          setUploadProgress(progress);
        });
        setSuccessMessage(`Banner "${formData.title}" updated successfully.`);
      } else {
        await homeBannerApi.create(payload, (progress) => {
          setUploadProgress(progress);
        });
        setSuccessMessage(`Banner "${formData.title}" created successfully.`);
      }

      setIsModalOpen(false);
      fetchBanners();
    } catch (err) {
      const msg = err.userMessage || err.message || 'Operation failed';
      setFormErrors((prev) => ({ ...prev, api: msg }));
    } finally {
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  };

  // Toggle Banner Status
  const handleToggleStatus = async (banner) => {
    const nextStatus = !banner.isActive;
    try {
      await homeBannerApi.toggleStatus(banner._id, nextStatus);
      setBanners((prev) =>
        prev.map((b) => (b._id === banner._id ? { ...b, isActive: nextStatus } : b))
      );
      setSuccessMessage(`Banner "${banner.title}" is now ${nextStatus ? 'active' : 'inactive'}.`);
    } catch (err) {
      setApiError(err.userMessage || 'Failed to toggle banner status');
    }
  };

  // Reorder Banners (Move Up / Down)
  const handleMoveOrder = async (index, direction) => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= banners.length) return;

    const newBanners = [...banners];
    const [movedItem] = newBanners.splice(index, 1);
    newBanners.splice(targetIndex, 0, movedItem);

    // Update display orders locally first for smooth feedback
    const orderedIds = newBanners.map((b) => b._id);
    const updatedLocally = newBanners.map((b, i) => ({ ...b, displayOrder: i }));
    setBanners(updatedLocally);

    try {
      await homeBannerApi.reorder(orderedIds);
      setSuccessMessage('Banner order updated successfully.');
    } catch (err) {
      setApiError(err.userMessage || 'Failed to reorder banners');
      fetchBanners(); // revert on failure
    }
  };

  // Delete Banner Confirmation
  const handleDeleteBanner = (banner) => {
    setConfirmModal({
      isOpen: true,
      title: `Delete Banner "${banner.title}"`,
      message: `Are you sure you want to permanently delete this banner? If it has an uploaded image stored on Cloudinary, it will also be cleaned up.`,
      confirmText: 'Delete Banner',
      confirmVariant: 'danger',
      isLoading: false,
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isLoading: true }));
        try {
          await homeBannerApi.delete(banner._id);
          setSuccessMessage(`Banner "${banner.title}" deleted successfully.`);
          setConfirmModal((prev) => ({ ...prev, isOpen: false, isLoading: false }));
          fetchBanners();
        } catch (err) {
          setConfirmModal((prev) => ({ ...prev, isOpen: false, isLoading: false }));
          setApiError(err.userMessage || 'Failed to delete banner');
        }
      }
    });
  };

  // Helper: Format destination badge
  const renderDestinationBadge = (type, id) => {
    if (!type || type === 'none') {
      return <span className="text-xs text-slate-400">None</span>;
    }
    if (type === 'category') {
      const cat = categories.find((c) => c._id === id || c.slug === id);
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
          Category: {cat ? cat.name : id}
        </span>
      );
    }
    if (type === 'service') {
      const srv = services.find((s) => s._id === id);
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
          Service: {srv ? srv.name : id}
        </span>
      );
    }
    if (type === 'search') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
          Search: "{id}"
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
        {type}: {id}
      </span>
    );
  };

  // Helper: Schedule status badge
  const renderScheduleBadge = (banner) => {
    if (!banner.isActive) {
      return <Badge variant="secondary">Inactive</Badge>;
    }
    const now = new Date();
    if (banner.startDate && new Date(banner.startDate) > now) {
      return <Badge variant="warning">Scheduled</Badge>;
    }
    if (banner.endDate && new Date(banner.endDate) < now) {
      return <Badge variant="danger">Expired</Badge>;
    }
    return <Badge variant="success">Active Live</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Home Screen Banners</h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">
              <Sparkles className="w-3 h-3 text-indigo-600" /> Dynamic Carousel
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Manage unlimited promotional slider banners displayed above the single offer card in the Customer Mobile App.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowPreview((prev) => !prev)}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
              showPreview
                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <Eye className="w-4 h-4" />
            {showPreview ? 'Hide Preview' : 'Show Preview'}
          </button>

          <button
            onClick={fetchBanners}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-3 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add New Banner
          </button>
        </div>
      </div>

      {/* Success & Error alerts */}
      {successMessage && (
        <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="text-sm font-medium">{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-600 hover:text-emerald-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {apiError && (
        <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span className="text-sm font-medium">{apiError}</span>
          </div>
          <button onClick={() => setApiError(null)} className="text-rose-600 hover:text-rose-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Customer-Facing Carousel Live Preview */}
      {showPreview && (
        <Card className="border border-slate-200 overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-md">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-indigo-400" />
              <h2 className="text-sm font-semibold tracking-wide uppercase text-indigo-300">
                Customer Mobile App Live Preview
              </h2>
            </div>
            <div className="text-xs text-slate-400">
              {activeBanners.length} Active {activeBanners.length === 1 ? 'Banner' : 'Banners'} in rotation
            </div>
          </div>

          <div className="p-6 flex flex-col items-center justify-center">
            {activeBanners.length === 0 ? (
              <div className="text-center py-8">
                <ImageIcon className="w-12 h-12 text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-400 font-medium">No active banners to preview.</p>
                <p className="text-xs text-slate-500 mt-1">
                  Active banners within their valid schedule dates will slide automatically on the customer home screen.
                </p>
              </div>
            ) : (
              <div className="w-full max-w-xl">
                {/* Mobile carousel frame */}
                <div className="relative rounded-2xl overflow-hidden shadow-2xl bg-slate-800 aspect-[16/7] border border-slate-700/60 group">
                  <img
                    src={activeBanners[previewIndex]?.imageUrl}
                    alt={activeBanners[previewIndex]?.title || 'Banner'}
                    className="w-full h-full object-cover transition-all duration-500"
                  />

                  {/* Gradient Overlay for text legibility */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent flex flex-col justify-end p-5">
                    <h3 className="text-lg md:text-xl font-bold text-white drop-shadow-md">
                      {activeBanners[previewIndex]?.title}
                    </h3>
                    {activeBanners[previewIndex]?.subtitle && (
                      <p className="text-xs md:text-sm text-slate-200 drop-shadow line-clamp-1 mt-0.5">
                        {activeBanners[previewIndex]?.subtitle}
                      </p>
                    )}
                    {activeBanners[previewIndex]?.destinationType &&
                      activeBanners[previewIndex]?.destinationType !== 'none' && (
                        <div className="mt-2">
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-indigo-600/90 text-white px-2.5 py-0.5 rounded-full backdrop-blur-xs">
                            <LinkIcon className="w-3 h-3" />
                            Opens: {activeBanners[previewIndex]?.destinationType}
                          </span>
                        </div>
                      )}
                  </div>

                  {/* Manual Carousel controls */}
                  {activeBanners.length > 1 && (
                    <>
                      <button
                        onClick={() =>
                          setPreviewIndex(
                            (prev) => (prev - 1 + activeBanners.length) % activeBanners.length
                          )
                        }
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-xs transition-colors"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() =>
                          setPreviewIndex((prev) => (prev + 1) % activeBanners.length)
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-xs transition-colors"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </>
                  )}

                  {/* Pagination dots */}
                  {activeBanners.length > 1 && (
                    <div className="absolute bottom-2.5 right-4 flex items-center gap-1.5 z-10">
                      {activeBanners.map((_, i) => (
                        <div
                          key={i}
                          onClick={() => setPreviewIndex(i)}
                          className={`cursor-pointer rounded-full transition-all duration-300 ${
                            i === previewIndex
                              ? 'w-5 h-2 bg-white'
                              : 'w-2 h-2 bg-white/40 hover:bg-white/70'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between mt-2 px-1 text-[11px] text-slate-400">
                  <span>Auto-transition: ~3.5 seconds</span>
                  <span>Infinite loop enabled</span>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Banners List Table */}
      <Card className="overflow-hidden border border-slate-200">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-slate-600" />
            <h2 className="text-base font-semibold text-slate-900">Configured Banners ({banners.length})</h2>
          </div>
          <p className="text-xs text-slate-500">
            Use the arrows to reorder banner sequence. Banners at top appear first.
          </p>
        </div>

        {isLoading ? (
          <div className="py-16 flex flex-col items-center justify-center">
            <LoadingSpinner size="lg" />
            <span className="mt-3 text-sm text-slate-500">Loading home banners...</span>
          </div>
        ) : banners.length === 0 ? (
          <div className="py-16 text-center">
            <ImageIcon className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <h3 className="text-base font-medium text-slate-900">No Banners Configured</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
              Get started by creating your first promotional banner with custom graphics, click destinations, and schedule dates.
            </p>
            <button
              onClick={handleOpenCreateModal}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add First Banner
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-center w-20">Order</th>
                  <th className="px-4 py-3 w-32">Banner</th>
                  <th className="px-4 py-3">Title & Subtitle</th>
                  <th className="px-4 py-3">Click Destination</th>
                  <th className="px-4 py-3">Schedule</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {banners.map((banner, index) => (
                  <tr key={banner._id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Order Controls */}
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span className="font-semibold text-xs text-slate-700 w-5">
                          #{index + 1}
                        </span>
                        <div className="flex flex-col gap-0.5">
                          <button
                            onClick={() => handleMoveOrder(index, 'up')}
                            disabled={index === 0}
                            title="Move Up"
                            className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-25 disabled:cursor-not-allowed rounded hover:bg-slate-200 transition-colors"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleMoveOrder(index, 'down')}
                            disabled={index === banners.length - 1}
                            title="Move Down"
                            className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-25 disabled:cursor-not-allowed rounded hover:bg-slate-200 transition-colors"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </td>

                    {/* Thumbnail */}
                    <td className="px-4 py-3">
                      <div className="w-24 h-12 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                        <img
                          src={banner.imageUrl}
                          alt={banner.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = 'https://via.placeholder.com/120x60?text=Banner';
                          }}
                        />
                      </div>
                    </td>

                    {/* Title & Subtitle */}
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{banner.title}</div>
                      {banner.subtitle && (
                        <div className="text-xs text-slate-500 line-clamp-1 mt-0.5">{banner.subtitle}</div>
                      )}
                    </td>

                    {/* Destination */}
                    <td className="px-4 py-3">
                      {renderDestinationBadge(banner.destinationType, banner.destinationId)}
                    </td>

                    {/* Schedule */}
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <div>{renderScheduleBadge(banner)}</div>
                        {(banner.startDate || banner.endDate) ? (
                          <div className="text-[11px] text-slate-500">
                            {banner.startDate && <span>From: {new Date(banner.startDate).toLocaleDateString()} </span>}
                            {banner.endDate && <span>Until: {new Date(banner.endDate).toLocaleDateString()}</span>}
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-400">Always active</div>
                        )}
                      </div>
                    </td>

                    {/* Status Toggle */}
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleToggleStatus(banner)}
                        title={banner.isActive ? 'Deactivate banner' : 'Activate banner'}
                        className="inline-flex items-center text-slate-700 hover:text-indigo-600 transition-colors"
                      >
                        {banner.isActive ? (
                          <ToggleRight className="w-7 h-7 text-emerald-600" />
                        ) : (
                          <ToggleLeft className="w-7 h-7 text-slate-400" />
                        )}
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEditModal(banner)}
                          title="Edit banner"
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteBanner(banner)}
                          title="Delete banner"
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add / Edit Banner Modal */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden my-8">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-indigo-600" />
                <h3 className="text-lg font-semibold text-slate-900">
                  {editingBanner ? 'Edit Home Screen Banner' : 'Add New Home Screen Banner'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 rounded-md p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSubmitForm} className="p-6 space-y-5">
              {formErrors.api && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{formErrors.api}</span>
                </div>
              )}

              {/* Banner Image Upload & Preview */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Banner Image <span className="text-rose-500">*</span>
                </label>

                {imagePreviewUrl ? (
                  <div className="relative rounded-lg overflow-hidden border border-slate-300 aspect-[16/7] bg-slate-100 group">
                    <img
                      src={imagePreviewUrl}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                      <label className="px-3 py-1.5 bg-white text-slate-800 text-xs font-semibold rounded-md shadow cursor-pointer hover:bg-slate-100">
                        Change Image
                        <input
                          type="file"
                          accept="image/png, image/jpeg, image/jpg, image/webp"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFile(null);
                          setImagePreviewUrl('');
                          setFormData((prev) => ({ ...prev, imageUrl: '' }));
                        }}
                        className="px-3 py-1.5 bg-rose-600 text-white text-xs font-semibold rounded-md shadow hover:bg-rose-700"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer bg-slate-50 hover:bg-indigo-50/30 transition-colors">
                    <Upload className="w-8 h-8 text-slate-400 mb-2" />
                    <span className="text-sm font-medium text-slate-700">Click to upload banner image</span>
                    <span className="text-xs text-slate-500 mt-1">PNG, JPG, or WEBP up to 5MB (Recommended: ~800x350)</span>
                    <input
                      type="file"
                      accept="image/png, image/jpeg, image/jpg, image/webp"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                )}

                {/* Or enter image URL */}
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-slate-400">Or use URL:</span>
                  <input
                    type="url"
                    value={formData.imageUrl}
                    onChange={(e) => {
                      setFormData((prev) => ({ ...prev, imageUrl: e.target.value }));
                      if (e.target.value) setImagePreviewUrl(e.target.value);
                    }}
                    placeholder="https://example.com/banner.png"
                    className="flex-1 text-xs px-2.5 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                {formErrors.image && (
                  <p className="mt-1 text-xs text-rose-600">{formErrors.image}</p>
                )}
              </div>

              {/* Upload Progress Bar */}
              {uploadProgress > 0 && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-medium text-slate-600">
                    <span>Uploading image...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-indigo-600 h-2 transition-all duration-200"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Title & Subtitle */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Banner Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g. 20% Off Deep Cleaning"
                    maxLength={100}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  {formErrors.title && (
                    <p className="mt-1 text-xs text-rose-600">{formErrors.title}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Subtitle (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.subtitle}
                    onChange={(e) => setFormData((prev) => ({ ...prev, subtitle: e.target.value }))}
                    placeholder="e.g. Book verified cleaners this weekend"
                    maxLength={150}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  {formErrors.subtitle && (
                    <p className="mt-1 text-xs text-rose-600">{formErrors.subtitle}</p>
                  )}
                </div>
              </div>

              {/* Destination Configuration */}
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                <div className="flex items-center gap-2">
                  <LinkIcon className="w-4 h-4 text-indigo-600" />
                  <label className="text-sm font-semibold text-slate-800">
                    Banner Click Destination
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Destination Type
                    </label>
                    <select
                      value={formData.destinationType}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          destinationType: e.target.value,
                          destinationId: ''
                        }))
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500"
                    >
                      {DESTINATION_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Target Target / Parameter
                    </label>

                    {formData.destinationType === 'category' ? (
                      <select
                        value={formData.destinationId}
                        onChange={(e) => setFormData((prev) => ({ ...prev, destinationId: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">-- Select Category --</option>
                        {categories.map((c) => (
                          <option key={c._id} value={c._id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    ) : formData.destinationType === 'service' ? (
                      <select
                        value={formData.destinationId}
                        onChange={(e) => setFormData((prev) => ({ ...prev, destinationId: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">-- Select Service --</option>
                        {services.map((s) => (
                          <option key={s._id} value={s._id}>
                            {s.name} ({s.category?.name || 'General'})
                          </option>
                        ))}
                      </select>
                    ) : formData.destinationType === 'search' ? (
                      <input
                        type="text"
                        value={formData.destinationId}
                        onChange={(e) => setFormData((prev) => ({ ...prev, destinationId: e.target.value }))}
                        placeholder="Search term (e.g. AC Repair)"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500"
                      />
                    ) : formData.destinationType === 'offer' ? (
                      <input
                        type="text"
                        value={formData.destinationId}
                        onChange={(e) => setFormData((prev) => ({ ...prev, destinationId: e.target.value }))}
                        placeholder="Offer code or slug"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500"
                      />
                    ) : formData.destinationType === 'screen' ? (
                      <input
                        type="text"
                        value={formData.destinationId}
                        onChange={(e) => setFormData((prev) => ({ ...prev, destinationId: e.target.value }))}
                        placeholder="App route name (e.g. CategoryServices, SearchTab)"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500"
                      />
                    ) : formData.destinationType === 'url' ? (
                      <input
                        type="url"
                        value={formData.destinationId}
                        onChange={(e) => setFormData((prev) => ({ ...prev, destinationId: e.target.value }))}
                        placeholder="https://example.com"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500"
                      />
                    ) : (
                      <input
                        type="text"
                        disabled
                        value="No destination required"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-100 text-slate-400"
                      />
                    )}

                    {formErrors.destinationId && (
                      <p className="mt-1 text-xs text-rose-600">{formErrors.destinationId}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Schedule Dates & Order */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Start Schedule (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.startDate}
                    onChange={(e) => setFormData((prev) => ({ ...prev, startDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    End Schedule (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.endDate}
                    onChange={(e) => setFormData((prev) => ({ ...prev, endDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                  {formErrors.endDate && (
                    <p className="mt-1 text-xs text-rose-600">{formErrors.endDate}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Display Order
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formData.displayOrder}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        displayOrder: parseInt(e.target.value, 10) || 0
                      }))
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Active Toggle Checkbox */}
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData((prev) => ({ ...prev, isActive: e.target.checked }))}
                  className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-slate-700 cursor-pointer">
                  Activate banner immediately (subject to schedule dates)
                </label>
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors"
                >
                  {isSubmitting && <LoadingSpinner size="sm" color="white" />}
                  {editingBanner ? 'Save Changes' : 'Create Banner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal (Delete) */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        confirmVariant={confirmModal.confirmVariant}
        isLoading={confirmModal.isLoading}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

export default HomeBannersPage;

