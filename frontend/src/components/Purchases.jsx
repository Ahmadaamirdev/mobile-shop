import React, { useState, useEffect, useRef } from 'react';
import { getPurchases, createPurchase, deletePurchase, getLedgerParties } from '../services/api';
import {
  Trash2,
  Search,
  Plus,
  ShoppingBag,
  Camera,
  Upload,
  X,
  Check,
  RotateCcw,
  Eye,
  MapPin,
  Image as ImageIcon,
  User,
  Smartphone,
  Phone,
} from 'lucide-react';
import DetailModal from './DetailModal';
import DateRangeFilter from './DateRangeFilter';

/**
 * Client-side Canvas Image Compression
 * Shrinks camera photos (often 5-10MB) down to ~50-90KB at 1200px max dimension & 0.65 JPEG quality.
 */
const compressImage = (fileOrDataUrl, maxWidth = 1200, quality = 0.65) => {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxWidth || height > maxWidth) {
        if (width > height) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxWidth) / height);
          height = maxWidth;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = (err) => reject(err);

    if (typeof fileOrDataUrl === 'string') {
      img.src = fileOrDataUrl;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target.result;
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(fileOrDataUrl);
    }
  });
};

/**
 * ID Card Capture Slot Component
 * Supports Live Camera capture, File upload, Preview, Save (Accept) & Reject (Retake)
 */
const IdCardCaptureSlot = ({ title, side, image, onSave, onReject, setAlert, onView }) => {
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [pendingImage, setPendingImage] = useState(null);
  const [processing, setProcessing] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  // Stop camera tracks helper
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
  };

  // Cleanup camera stream when component unmounts
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Open camera
  const startCamera = async () => {
    setPendingImage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
        },
      });
      streamRef.current = stream;
      setIsCameraOpen(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }, 100);
    } catch (err) {
      console.error('Camera access error:', err);
      setAlert({
        type: 'error',
        message: 'Could not access camera. Please allow camera permissions or upload an image file.',
      });
      setIsCameraOpen(false);
    }
  };

  // Capture frame from active video stream
  const captureFrame = async () => {
    if (!videoRef.current) return;
    setProcessing(true);
    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const rawDataUrl = canvas.toDataURL('image/jpeg', 0.9);
      stopCamera();

      // Compress client-side
      const compressed = await compressImage(rawDataUrl, 1200, 0.65);
      setPendingImage(compressed);
    } catch (err) {
      console.error('Capture error:', err);
      setAlert({ type: 'error', message: 'Failed to capture photo from camera.' });
    } finally {
      setProcessing(false);
    }
  };

  // Handle file picker selection
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProcessing(true);
    try {
      stopCamera();
      const compressed = await compressImage(file, 1200, 0.65);
      setPendingImage(compressed);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      console.error('Upload compression error:', err);
      setAlert({ type: 'error', message: 'Failed to process selected image file.' });
    } finally {
      setProcessing(false);
    }
  };

  // User accepts / saves the pending photo
  const handleSavePending = () => {
    if (pendingImage) {
      onSave(pendingImage);
      setPendingImage(null);
    }
  };

  // User rejects / cancels the pending photo
  const handleRejectPending = () => {
    setPendingImage(null);
  };

  return (
    <div className={`id-card-slot ${image ? 'has-image' : ''} ${isCameraOpen ? 'active-camera' : ''}`}>
      <div className="id-slot-label">
        <ImageIcon size={14} />
        <span>{title}</span>
        {image && <span className="id-status-badge"><Check size={11} /> Saved</span>}
      </div>

      {/* Mode 1: Live Camera Stream */}
      {isCameraOpen ? (
        <div className="id-camera-container">
          <video ref={videoRef} autoPlay playsInline muted className="id-video-preview" />
          <div className="id-camera-guide">
            <span>Align ID Card within frame</span>
          </div>
          <div className="id-camera-controls">
            <button
              type="button"
              className="id-slot-btn primary"
              onClick={captureFrame}
              disabled={processing}
            >
              <Camera size={13} /> {processing ? 'Capturing...' : 'Capture Photo'}
            </button>
            <button
              type="button"
              className="id-slot-btn"
              onClick={stopCamera}
            >
              <X size={13} /> Cancel
            </button>
          </div>
        </div>
      ) : pendingImage ? (
        /* Mode 2: Captured/Uploaded photo pending user review (Save vs Reject) */
        <div className="id-preview-box">
          <img src={pendingImage} alt={`${title} Preview`} className="id-preview-img" />
          <div style={{ fontSize: '11px', color: '#64748b' }}>
            Compressed &amp; ready to save
          </div>
          <div className="id-preview-actions">
            <button
              type="button"
              className="btn-accept"
              onClick={handleSavePending}
            >
              <Check size={13} /> Save Photo
            </button>
            <button
              type="button"
              className="btn-reject"
              onClick={handleRejectPending}
            >
              <RotateCcw size={13} /> Reject / Retake
            </button>
          </div>
        </div>
      ) : image ? (
        /* Mode 3: Image is already accepted and saved */
        <div className="id-preview-box">
          <img src={image} alt={title} className="id-preview-img" />
          <div className="id-preview-actions">
            <button
              type="button"
              className="id-slot-btn"
              onClick={() => onView && onView(image, title)}
            >
              <Eye size={12} /> View Full
            </button>
            <button
              type="button"
              className="btn-reject"
              onClick={onReject}
            >
              <Trash2 size={12} /> Reject / Remove
            </button>
          </div>
        </div>
      ) : (
        /* Mode 4: Initial empty state with Camera & Upload options */
        <div className="id-slot-buttons">
          <button
            type="button"
            className="id-slot-btn primary"
            onClick={startCamera}
            disabled={processing}
          >
            <Camera size={13} /> Open Camera
          </button>

          <label className="id-slot-btn" style={{ margin: 0, cursor: 'pointer' }}>
            <Upload size={13} /> Upload Picture
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
          </label>
        </div>
      )}
    </div>
  );
};

const Purchases = ({ isActive, onPurchaseSuccess, setAlert }) => {
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState('newest');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedCondition, setSelectedCondition] = useState('All');
  const [showAddForm, setShowAddForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [detailItem, setDetailItem] = useState(null);

  // Full-Screen Image Lightbox Modal State
  const [viewingImage, setViewingImage] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    category: 'Mobile',
    condition: 'New',
    status: 'PTA',
    companyName: '',
    modelName: '',
    quantity: 1,
    imei1: '',
    imei2: '',
    serialNumber: '',
    customerName: '',
    customerPhone: '',
    customerIdCard: '',
    customerAddress: '',
    idCardFront: '',
    idCardBack: '',
    price: '',
    paymentType: 'cash',
    ledgerPartyId: '',
    paidAmount: '',
    paymentMethod: 'Cash',
  });

  const [formErrors, setFormErrors] = useState({});

  const fetchPurchases = async (force = false) => {
    setLoading(true);
    try {
      const [res, supRes] = await Promise.all([
        getPurchases({ sort: sortOrder }, force),
        getLedgerParties({}, force).catch(() => null),
      ]);
      if (res.data && res.data.data) {
        setPurchases(res.data.data);
      }
      if (supRes?.data?.data) {
        setSuppliers(supRes.data.data);
      }
    } catch (err) {
      setAlert({
        type: 'error',
        message: err.response?.data?.message || 'Error fetching purchase records.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchases();
  }, [sortOrder]);

  useEffect(() => {
    if (isActive) {
      setShowAddForm(false);
      fetchPurchases();
    }
  }, [isActive]);

  const validateForm = () => {
    const errors = {};
    const isAccessory = formData.category === 'Accessory';

    if (!isAccessory) {
      if (!formData.companyName.trim()) errors.companyName = 'Company name is required';
      if (!formData.modelName.trim()) errors.modelName = 'Model name is required';
      if (!formData.customerName.trim()) errors.customerName = 'Customer name is required';
      if (!/^\d{11}$/.test(formData.customerPhone.trim())) {
        errors.customerPhone = 'Phone number must contain exactly 11 digits';
      }

      const idDigits = formData.customerIdCard.replace(/\D/g, '');
      if (idDigits.length !== 13) {
        errors.customerIdCard = 'ID card number must contain exactly 13 digits';
      }

      if (formData.price === '' || isNaN(formData.price) || Number(formData.price) < 0) {
        errors.price = 'Valid price is required';
      }
      if (!formData.quantity || isNaN(formData.quantity) || Number(formData.quantity) < 1) {
        errors.quantity = 'Quantity must be at least 1';
      }
    } else {
      if (formData.customerPhone.trim() && !/^\d{11}$/.test(formData.customerPhone.trim())) {
        errors.customerPhone = 'Phone number must contain exactly 11 digits';
      }
      const idDigits = formData.customerIdCard.replace(/\D/g, '');
      if (idDigits.length > 0 && idDigits.length !== 13) {
        errors.customerIdCard = 'ID card number must contain exactly 13 digits';
      }
      if (formData.price !== '' && (isNaN(formData.price) || Number(formData.price) < 0)) {
        errors.price = 'Valid price is required';
      }
      if (formData.quantity !== '' && (isNaN(formData.quantity) || Number(formData.quantity) < 1)) {
        errors.quantity = 'Quantity must be at least 1';
      }
    }

    if (formData.imei1 && !/^\d{15}$/.test(formData.imei1.trim())) {
      errors.imei1 = 'IMEI 1 must be exactly 15 digits';
    }
    if (formData.imei2 && !/^\d{15}$/.test(formData.imei2.trim())) {
      errors.imei2 = 'IMEI 2 must be exactly 15 digits';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      await createPurchase({
        ...formData,
        price: formData.price !== '' ? Number(formData.price) : 0,
        quantity: Math.max(1, Number(formData.quantity) || 1),
        paidAmount: formData.paymentType === 'ledger' ? (Number(formData.paidAmount) || 0) : undefined,
      });
      setAlert({
        type: 'success',
        message: 'Purchase recorded and stock updated successfully.',
      });
      setFormData({
        category: 'Mobile',
        condition: 'New',
        status: 'PTA',
        companyName: '',
        modelName: '',
        quantity: 1,
        imei1: '',
        imei2: '',
        serialNumber: '',
        customerName: '',
        customerPhone: '',
        customerIdCard: '',
        customerAddress: '',
        idCardFront: '',
        idCardBack: '',
        price: '',
        paymentType: 'cash',
        ledgerPartyId: '',
        paidAmount: '',
        paymentMethod: 'Cash',
      });
      setShowAddForm(false);
      fetchPurchases(true);
      if (onPurchaseSuccess) onPurchaseSuccess();
    } catch (err) {
      setAlert({
        type: 'error',
        message: err.response?.data?.message || 'Failed to save purchase record.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id, modelName) => {
    if (!window.confirm(`Are you sure you want to delete purchase record for ${modelName}?`)) return;
    try {
      await deletePurchase(id);
      setAlert({
        type: 'success',
        message: 'Purchase deleted successfully',
      });
      fetchPurchases(true);
    } catch (err) {
      setAlert({
        type: 'error',
        message: err.response?.data?.message || 'Failed to delete purchase record.',
      });
    }
  };

  const matchesDateRange = (dateVal) => {
    if (!startDate && !endDate) return true;
    if (!dateVal) return false;
    const itemTime = new Date(dateVal).getTime();
    if (Number.isNaN(itemTime)) return false;
    if (startDate) {
      const [y, m, d] = startDate.split('-').map(Number);
      const start = new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
      if (itemTime < start) return false;
    }
    if (endDate) {
      const [y, m, d] = endDate.split('-').map(Number);
      const end = new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
      if (itemTime > end) return false;
    }
    return true;
  };

  const filteredPurchases = purchases
    .filter((item) => {
      const categoryMatch = selectedCategory === 'All' || item.category?.toLowerCase() === selectedCategory.toLowerCase();
      const conditionMatch = selectedCondition === 'All' || (item.condition || 'New').toLowerCase() === selectedCondition.toLowerCase();
      const dateMatch = matchesDateRange(item.createdAt);
      if (!search.trim()) return categoryMatch && conditionMatch && dateMatch;
      const term = search.trim().toLowerCase();
      const searchMatch = (
        item.modelName?.toLowerCase().includes(term) ||
        item.companyName?.toLowerCase().includes(term) ||
        item.customerName?.toLowerCase().includes(term) ||
        item.customerPhone?.toLowerCase().includes(term) ||
        item.customerIdCard?.toLowerCase().includes(term) ||
        item.customerAddress?.toLowerCase().includes(term) ||
        item.imei1?.toLowerCase().includes(term) ||
        item.imei2?.toLowerCase().includes(term) ||
        item.serialNumber?.toLowerCase().includes(term) ||
        (item.condition || 'New').toLowerCase().includes(term) ||
        (item.status || 'PTA').toLowerCase().includes(term)
      );
      return categoryMatch && conditionMatch && dateMatch && searchMatch;
    })
    .sort((a, b) => {
      const timeA = new Date(a.createdAt || 0).getTime();
      const timeB = new Date(b.createdAt || 0).getTime();
      return sortOrder === 'oldest' ? timeA - timeB : timeB - timeA;
    });

  return (
    <div>
      {/* 1. Header Card (Reference: Al Haditha Top Card) */}
      <div className="panel-header-card">
        <div className="panel-header-row">
          <div className="panel-header-left">
            <div className="panel-icon-box">
              <ShoppingBag size={18} />
            </div>
            <div className="panel-header-text">
              <h2>Device Purchases &amp; Inward Registry</h2>
              <p>Record stock purchases, verify customer ID credentials &amp; track intake costs.</p>
            </div>
          </div>
          <div>
            <button
              className="btn-primary"
              onClick={() => setShowAddForm(!showAddForm)}
            >
              <Plus size={15} />
              {showAddForm ? 'Close Form' : 'Add Purchase'}
            </button>
          </div>
        </div>

        {/* Toolbar: Category Filters, Condition Subfilter, Search & Date Controls (Hidden when form is open) */}
        {!showAddForm && (
          <div className="panel-toolbar-row">
            {/* Mobile: compact select dropdowns */}
            <div className="mobile-filter-row">
              <select
                className="mobile-filter-select"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="All">All Categories</option>
                <option value="Mobile">Mobiles</option>
                <option value="Tablet">Tablets</option>
                <option value="Accessory">Accessories</option>
              </select>
              <select
                className="mobile-filter-select"
                value={selectedCondition}
                onChange={(e) => setSelectedCondition(e.target.value)}
              >
                <option value="All">All Condition</option>
                <option value="New">New</option>
                <option value="Used">Used</option>
              </select>
            </div>

            <div className="toolbar-desktop-grid">
              <div className="panel-filter-pills">
                {['All', 'Mobile', 'Tablet', 'Accessory'].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className={`filter-pill ${selectedCategory === cat ? 'active' : 'inactive'}`}
                    onClick={() => setSelectedCategory(cat)}
                  >
                    {cat === 'All' ? 'All Categories' : cat === 'Accessory' ? 'Accessories' : `${cat}s`}
                  </button>
                ))}
              </div>

              <div className="subfilter-group panel-filter-pills">
                {[
                  { id: 'All', label: 'All Condition' },
                  { id: 'New', label: 'New', pillClass: 'pill-new' },
                  { id: 'Used', label: 'Used', pillClass: 'pill-used' },
                ].map((cond) => (
                  <button
                    key={cond.id}
                    type="button"
                    className={`filter-pill ${cond.pillClass || ''} ${selectedCondition === cond.id ? 'active' : 'inactive'}`}
                    onClick={() => setSelectedCondition(cond.id)}
                  >
                    {cond.label}
                  </button>
                ))}
              </div>

              <div className="panel-search-box">
                <Search size={14} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search model, IMEI, address, phone..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="date-filter-controls">
                <DateRangeFilter
                  startDate={startDate}
                  endDate={endDate}
                  onChangeStart={setStartDate}
                  onChangeEnd={setEndDate}
                  onClear={() => { setStartDate(''); setEndDate(''); }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. Collapsible Add Purchase Form */}
      {showAddForm && (
        <div className="card-form">
          <div className="card-form-title">
            <span>Record New Purchase</span>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="form-grid-3">
              <div className="form-field">
                <label>Category *</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                >
                  <option value="Mobile">Mobile</option>
                  <option value="Tablet">Tablet</option>
                  <option value="Accessory">Accessory</option>
                </select>
              </div>

              <div className="form-field">
                <label>Device Condition {formData.category !== 'Accessory' ? '*' : '(Optional)'}</label>
                <select
                  value={formData.condition}
                  onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                >
                  <option value="New">Brand New</option>
                  <option value="Used">Used / Second Hand</option>
                </select>
              </div>

              <div className="form-field">
                <label>Status {formData.category !== 'Accessory' ? '*' : '(Optional)'}</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <option value="PTA">PTA</option>
                  <option value="JV">JV</option>
                  <option value="Non-PTA">Non-PTA</option>
                  <option value="CPID">CPID</option>
                </select>
              </div>

              <div className="form-field">
                <label>Company / Brand {formData.category !== 'Accessory' ? '*' : '(Optional)'}</label>
                <input
                  type="text"
                  placeholder="e.g. Samsung, Apple, Xiaomi"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                />
                {formErrors.companyName && <span className="form-field-error">{formErrors.companyName}</span>}
              </div>

              <div className="form-field">
                <label>Model Name {formData.category !== 'Accessory' ? '*' : '(Optional)'}</label>
                <input
                  type="text"
                  placeholder="e.g. Galaxy S22"
                  value={formData.modelName}
                  onChange={(e) => setFormData({ ...formData, modelName: e.target.value })}
                />
                {formErrors.modelName && <span className="form-field-error">{formErrors.modelName}</span>}
              </div>

              <div className="form-field">
                <label>IMEI 1 (Optional - 15 digits)</label>
                <input
                  type="text"
                  maxLength={15}
                  placeholder="15 digits"
                  value={formData.imei1}
                  onChange={(e) => setFormData({ ...formData, imei1: e.target.value.replace(/\D/g, '') })}
                />
                {formErrors.imei1 && <span className="form-field-error">{formErrors.imei1}</span>}
              </div>

              <div className="form-field">
                <label>IMEI 2 (Optional - 15 digits)</label>
                <input
                  type="text"
                  maxLength={15}
                  placeholder="15 digits"
                  value={formData.imei2}
                  onChange={(e) => setFormData({ ...formData, imei2: e.target.value.replace(/\D/g, '') })}
                />
                {formErrors.imei2 && <span className="form-field-error">{formErrors.imei2}</span>}
              </div>

              <div className="form-field">
                <label>Serial Number (Optional)</label>
                <input
                  type="text"
                  placeholder="Device Serial Number"
                  value={formData.serialNumber}
                  onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                />
              </div>

              <div className="form-field">
                <label>Customer Name {formData.category !== 'Accessory' ? '*' : '(Optional)'}</label>
                <input
                  type="text"
                  placeholder="e.g. Muhammad Ahmad"
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                />
                {formErrors.customerName && <span className="form-field-error">{formErrors.customerName}</span>}
              </div>

              <div className="form-field">
                <label>
                  Customer Phone Number {formData.category !== 'Accessory' ? '* (11 digits)' : '(Optional)'}
                </label>
                <input
                  type="tel"
                  maxLength={11}
                  placeholder="e.g. 03001234567"
                  value={formData.customerPhone}
                  onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value.replace(/\D/g, '').slice(0, 11) })}
                />
                {formErrors.customerPhone && <span className="form-field-error">{formErrors.customerPhone}</span>}
              </div>

              <div className="form-field">
                <label>
                  Customer ID Card Number {formData.category !== 'Accessory' ? '* (13 digits)' : '(Optional)'}
                </label>
                <input
                  type="text"
                  maxLength={13}
                  placeholder="13 digits without dashes"
                  value={formData.customerIdCard}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 13);
                    setFormData({ ...formData, customerIdCard: digits });
                    if (digits.length === 13 && formErrors.customerIdCard) {
                      setFormErrors((prev) => ({ ...prev, customerIdCard: '' }));
                    }
                  }}
                />
                {formErrors.customerIdCard && <span className="form-field-error">{formErrors.customerIdCard}</span>}
              </div>

              <div className="form-field">
                <label>Customer Address (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Shop #4, Main Bazar, Lahore"
                  value={formData.customerAddress}
                  onChange={(e) => setFormData({ ...formData, customerAddress: e.target.value })}
                />
              </div>

              <div className="form-field">
                <label>Purchase Price (PKR) {formData.category !== 'Accessory' ? '*' : '(Optional)'}</label>
                <input
                  type="number"
                  placeholder="0"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                />
                {formErrors.price && <span className="form-field-error">{formErrors.price}</span>}
              </div>

              <div className="form-field">
                <label>Quantity {formData.category !== 'Accessory' ? '*' : '(Optional)'}</label>
                <input
                  type="number"
                  min="1"
                  placeholder="1"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                />
                {formErrors.quantity && <span className="form-field-error">{formErrors.quantity}</span>}
              </div>

              <div className="form-field">
                <label>Payment Mode</label>
                <select
                  value={formData.paymentType}
                  onChange={(e) => setFormData({ ...formData, paymentType: e.target.value })}
                >
                  <option value="cash">Paid (Cash / Instant)</option>
                  <option value="ledger">Ledger / Credit (Partial or Pending)</option>
                </select>
              </div>

              {formData.paymentType === 'ledger' && (
                <>
                  <div className="form-field">
                    <label>Link Supplier Ledger</label>
                    <select
                      value={formData.ledgerPartyId}
                      onChange={(e) => {
                        const supId = e.target.value;
                        const sup = suppliers.find((s) => s._id === supId);
                        setFormData((prev) => ({
                          ...prev,
                          ledgerPartyId: supId,
                          customerName: sup ? sup.name : prev.customerName,
                          customerPhone: sup && sup.phone ? sup.phone : prev.customerPhone,
                          customerAddress: sup && sup.address ? sup.address : prev.customerAddress,
                        }));
                      }}
                    >
                      <option value="">Auto-match or create from Seller Name below</option>
                      {suppliers.map((s) => (
                        <option key={s._id} value={s._id}>
                          {s.name} {s.balance > 0 ? `(Pending: PKR ${Number(s.balance).toLocaleString()})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-field">
                    <label>
                      Paid Now (PKR) — Pending:{' '}
                      <strong>
                        PKR {Math.max(0, (Number(formData.price) || 0) - (Number(formData.paidAmount) || 0)).toLocaleString()}
                      </strong>
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="0 (if full credit)"
                      value={formData.paidAmount}
                      onChange={(e) => setFormData({ ...formData, paidAmount: e.target.value })}
                    />
                  </div>
                  <div className="form-field">
                    <label>Payment Method</label>
                    <select
                      value={formData.paymentMethod}
                      onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                    >
                      <option value="Cash">Cash</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Easypaisa / JazzCash">Easypaisa / JazzCash</option>
                      <option value="Cheque">Cheque</option>
                    </select>
                  </div>
                </>
              )}

              {/* ID Card Pictures (Front & Back) with Camera & Upload Options */}
              <div className="id-card-section">
                <div className="id-card-header">
                  <span className="id-card-title">Customer ID Card Pictures (Front &amp; Back)</span>
                  <span className="id-card-subtitle">
                    Take photo using camera or upload from device. Auto-compressed for minimal storage &amp; synced with Cloudinary.
                  </span>
                </div>
                <div className="id-card-grid">
                  <IdCardCaptureSlot
                    title="ID Card (Front)"
                    side="front"
                    image={formData.idCardFront}
                    onSave={(dataUrl) => setFormData((prev) => ({ ...prev, idCardFront: dataUrl }))}
                    onReject={() => setFormData((prev) => ({ ...prev, idCardFront: '' }))}
                    setAlert={setAlert}
                    onView={(url, title) => setViewingImage({ url, title })}
                  />
                  <IdCardCaptureSlot
                    title="ID Card (Back)"
                    side="back"
                    image={formData.idCardBack}
                    onSave={(dataUrl) => setFormData((prev) => ({ ...prev, idCardBack: dataUrl }))}
                    onReject={() => setFormData((prev) => ({ ...prev, idCardBack: '' }))}
                    setAlert={setAlert}
                    onView={(url, title) => setViewingImage({ url, title })}
                  />
                </div>
              </div>
            </div>

            <div className="card-form-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowAddForm(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? 'Saving & Uploading...' : 'Save & Add to Stock'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 3. Table Card (Hidden when form is open) */}
      {!showAddForm && (
        <div className="table-card">
          {/* Desktop Proportional Table */}
          <div className="hide-on-mobile desktop-table-container">
            <table className="pro-table">
              <thead>
                <tr>
                  <th style={{ width: '12%' }}>Date</th>
                  <th style={{ width: '11%' }}>Category</th>
                  <th style={{ width: '21%' }}>Device Model</th>
                  <th style={{ width: '11%' }}>Condition</th>
                  <th style={{ width: '20%' }}>Customer</th>
                  <th style={{ width: '14%' }}>Price (PKR)</th>
                  <th style={{ width: '11%', textAlign: 'center', paddingRight: '14px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" className="empty-state">Loading purchase records...</td>
                  </tr>
                ) : filteredPurchases.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="empty-state">No purchases recorded yet.</td>
                  </tr>
                ) : (
                  filteredPurchases.map((item) => (
                    <tr key={item._id}>
                      {/* Date */}
                      <td>
                        <span className="cell-mono">
                          {new Date(item.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      </td>

                      {/* Category */}
                      <td>
                        <span className="cell-badge badge-gray category-pill">{item.category}</span>
                      </td>

                      {/* Device Model */}
                      <td>
                        <span className="cell-title">{item.modelName}</span>
                        {item.companyName && (
                          <span className="cell-sub">{item.companyName}</span>
                        )}
                      </td>

                      {/* Condition */}
                      <td>
                        <span className={`cell-badge condition-pill ${item.condition === 'Used' ? 'badge-warning' : 'badge-success'}`}>
                          {item.condition || 'New'}
                        </span>
                      </td>

                      {/* Customer */}
                      <td>
                        <span className="cell-title">{item.customerName || '—'}</span>
                      </td>

                      {/* Price */}
                      <td>
                        <span className="cell-price">
                          PKR {Number(item.price).toLocaleString()}
                        </span>
                      </td>

                      {/* Actions: Details & Delete */}
                      <td style={{ textAlign: 'center', paddingRight: '14px' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn-details-toggle"
                            onClick={() => setDetailItem(item)}
                            title="View hardware, ID & address details"
                          >
                            <Eye size={13} />
                          </button>
                          <button
                            className="action-btn-danger"
                            onClick={() => handleDelete(item._id, item.modelName)}
                            title="Delete purchase record"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile View Cards */}
          <div className="show-on-mobile mobile-card-container">
            {loading ? (
              <div className="empty-state">Loading purchases...</div>
            ) : filteredPurchases.length === 0 ? (
              <div className="empty-state">No purchases recorded yet.</div>
            ) : (
              filteredPurchases.map((item) => (
                  <div key={item._id} className="mobile-card">
                    <div className="mobile-card-top">
                      <div>
                        <div className="mobile-card-title">{item.modelName}</div>
                        <div className="mobile-card-subtitle">{item.companyName}</div>
                      </div>
                      <div className="mobile-card-price">
                        PKR {Number(item.price).toLocaleString()}
                      </div>
                    </div>

                    <div className="mobile-card-meta-grid">
                      <div className="mobile-meta-cell">
                        <div className="mobile-meta-label">Category / Condition</div>
                        <div className="mobile-meta-val" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className="cell-badge badge-gray category-pill">{item.category}</span>
                          <span className={`cell-badge condition-pill ${item.condition === 'Used' ? 'badge-warning' : 'badge-success'}`}>
                            {item.condition || 'New'}
                          </span>
                        </div>
                      </div>

                      <div className="mobile-meta-cell">
                        <div className="mobile-meta-label">Date</div>
                        <div className="mobile-meta-val">
                          {new Date(item.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </div>
                      </div>

                      <div className="mobile-meta-cell full-width">
                        <div className="mobile-meta-label">Customer</div>
                        <div className="mobile-meta-val">
                          <strong>{item.customerName || '—'}</strong>
                        </div>
                      </div>
                    </div>

                    <div className="mobile-card-actions">
                      <button
                        type="button"
                        className="btn-details-toggle"
                        style={{ flex: 1, minHeight: '40px', justifyContent: 'center' }}
                        onClick={() => setDetailItem(item)}
                      >
                        <Eye size={14} /><span className="view-label"> View Details</span>
                      </button>
                      <button
                        className="action-btn-danger"
                        style={{ minHeight: '40px' }}
                        onClick={() => handleDelete(item._id, item.modelName)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 4. Purchase Details Popup Modal */}
      <DetailModal
        isOpen={Boolean(detailItem)}
        onClose={() => setDetailItem(null)}
        icon={ShoppingBag}
        title={detailItem?.modelName || 'Purchase Details'}
        subtitle={
          detailItem
            ? `${detailItem.companyName || detailItem.category} • ${new Date(detailItem.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} • PKR ${Number(detailItem.price).toLocaleString()}`
            : ''
        }
        badge={
          detailItem && (
            <span className={`cell-badge condition-pill ${detailItem.condition === 'Used' ? 'badge-warning' : 'badge-success'}`}>
              {detailItem.condition || 'New'}
            </span>
          )
        }
      >
        {detailItem && (
          <>
            <div className="expanded-detail-card">
              <div className="expanded-detail-header">
                <Smartphone size={13} /> Hardware &amp; Identifiers
              </div>
              <div className="expanded-info-row">
                <span className="expanded-info-label">Category:</span>
                <span className="expanded-info-val">{detailItem.category}</span>
              </div>
              <div className="expanded-info-row">
                <span className="expanded-info-label">Status:</span>
                <span className="expanded-info-val">{detailItem.status || 'PTA'}</span>
              </div>
              <div className="expanded-info-row">
                <span className="expanded-info-label">Quantity:</span>
                <span className="expanded-info-val">{detailItem.quantity || 1}</span>
              </div>
              <div className="expanded-info-row">
                <span className="expanded-info-label">IMEI 1:</span>
                <span className="expanded-info-val">{detailItem.imei1 || '—'}</span>
              </div>
              <div className="expanded-info-row">
                <span className="expanded-info-label">IMEI 2:</span>
                <span className="expanded-info-val">{detailItem.imei2 || '—'}</span>
              </div>
              <div className="expanded-info-row">
                <span className="expanded-info-label">Serial Number:</span>
                <span className="expanded-info-val">{detailItem.serialNumber || '—'}</span>
              </div>
            </div>

            <div className="expanded-detail-card">
              <div className="expanded-detail-header">
                <User size={13} /> Customer Identity &amp; Address
              </div>
              <div className="expanded-info-row">
                <span className="expanded-info-label">Full Name:</span>
                <span className="expanded-info-val">{detailItem.customerName || '—'}</span>
              </div>
              <div className="expanded-info-row">
                <span className="expanded-info-label">Phone Number:</span>
                <span className="expanded-info-val" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  {detailItem.customerPhone ? (
                    <>
                      <Phone size={11} style={{ color: '#64748b', flexShrink: 0 }} />
                      {detailItem.customerPhone}
                    </>
                  ) : (
                    '—'
                  )}
                </span>
              </div>
              <div className="expanded-info-row">
                <span className="expanded-info-label">CNIC (13 digits):</span>
                <span className="expanded-info-val">{detailItem.customerIdCard || '—'}</span>
              </div>
              <div className="expanded-info-row">
                <span className="expanded-info-label">Address:</span>
                <span className="expanded-info-val">{detailItem.customerAddress || 'Not provided'}</span>
              </div>
            </div>

            <div className="expanded-detail-card" style={{ gridColumn: '1 / -1' }}>
              <div className="expanded-detail-header">
                <ImageIcon size={13} /> Customer ID Card Documents
              </div>
              {detailItem.idCardFront || detailItem.idCardBack ? (
                <div style={{ display: 'flex', gap: '14px', marginTop: '6px', flexWrap: 'wrap' }}>
                  {detailItem.idCardFront && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                      <img
                        src={detailItem.idCardFront}
                        alt="ID Front"
                        style={{ width: '110px', height: '70px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #cbd5e1', cursor: 'pointer' }}
                        onClick={() => setViewingImage({ url: detailItem.idCardFront, title: `ID Front - ${detailItem.customerName || 'Customer'}` })}
                      />
                      <button
                        type="button"
                        className="id-view-btn"
                        onClick={() => setViewingImage({ url: detailItem.idCardFront, title: `ID Front - ${detailItem.customerName || 'Customer'}` })}
                      >
                        <Eye size={10} /> Front ID
                      </button>
                    </div>
                  )}
                  {detailItem.idCardBack && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                      <img
                        src={detailItem.idCardBack}
                        alt="ID Back"
                        style={{ width: '110px', height: '70px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #cbd5e1', cursor: 'pointer' }}
                        onClick={() => setViewingImage({ url: detailItem.idCardBack, title: `ID Back - ${detailItem.customerName || 'Customer'}` })}
                      />
                      <button
                        type="button"
                        className="id-view-btn"
                        onClick={() => setViewingImage({ url: detailItem.idCardBack, title: `ID Back - ${detailItem.customerName || 'Customer'}` })}
                      >
                        <Eye size={10} /> Back ID
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic', padding: '8px 0' }}>
                  No ID card photos attached.
                </div>
              )}
            </div>
          </>
        )}
      </DetailModal>

      {/* 5. Full-Size ID Card Lightbox Modal */}
      {viewingImage && (
        <div className="image-lightbox-overlay" style={{ zIndex: 1100 }} onClick={() => setViewingImage(null)}>
          <div className="image-lightbox-modal" onClick={(e) => e.stopPropagation()}>
            <div className="image-lightbox-header">
              <span className="image-lightbox-title">{viewingImage.title || 'Customer ID Card Preview'}</span>
              <button
                type="button"
                className="image-lightbox-close"
                onClick={() => setViewingImage(null)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="image-lightbox-body">
              <img src={viewingImage.url} alt={viewingImage.title || 'ID Card'} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Purchases;
