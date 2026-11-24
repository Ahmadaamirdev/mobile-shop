import React, { useState, useEffect } from 'react';
import { getPurchases, createPurchase, deletePurchase } from '../services/api';
import { Trash2, Search, Plus } from 'lucide-react';

const Purchases = ({ onPurchaseSuccess, setAlert }) => {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState('newest');
  const [showAddForm, setShowAddForm] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    category: 'Mobile',
    companyName: '',
    modelName: '',
    modelNumber: '',
    imei1: '',
    imei2: '',
    serialNumber: '',
    customerPhone: '',
    customerIdCard: '',
    price: '',
  });

  const [formErrors, setFormErrors] = useState({});

  const fetchPurchases = async () => {
    setLoading(true);
    try {
      const res = await getPurchases({ sort: sortOrder, search });
      if (res.data && res.data.data) {
        setPurchases(res.data.data);
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
  }, [sortOrder, search]);

  const validateForm = () => {
    const errors = {};
    if (!formData.companyName.trim()) errors.companyName = 'Company name is required';
    if (!formData.modelName.trim()) errors.modelName = 'Model name is required';
    if (!formData.modelNumber.trim()) errors.modelNumber = 'Model number is required';
    if (!formData.customerPhone.trim()) errors.customerPhone = 'Phone number is required';
    
    // 13 digits check for ID Card
    const idDigits = formData.customerIdCard.replace(/\D/g, '');
    if (idDigits.length !== 13) {
      errors.customerIdCard = 'ID card number must contain exactly 13 digits';
    }

    // Optional 15 digits check for IMEI 1 & IMEI 2
    if (formData.imei1 && !/^\d{15}$/.test(formData.imei1.trim())) {
      errors.imei1 = 'IMEI 1 must be exactly 15 digits';
    }
    if (formData.imei2 && !/^\d{15}$/.test(formData.imei2.trim())) {
      errors.imei2 = 'IMEI 2 must be exactly 15 digits';
    }

    if (formData.price === '' || isNaN(formData.price) || Number(formData.price) < 0) {
      errors.price = 'Valid price is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      await createPurchase(formData);
      setAlert({
        type: 'success',
        message: 'Purchase recorded and automatically added to inventory.',
      });
      // Reset form
      setFormData({
        category: 'Mobile',
        companyName: '',
        modelName: '',
        modelNumber: '',
        imei1: '',
        imei2: '',
        serialNumber: '',
        customerPhone: '',
        customerIdCard: '',
        price: '',
      });
      setShowAddForm(false);
      fetchPurchases();
      if (onPurchaseSuccess) onPurchaseSuccess();
    } catch (err) {
      setAlert({
        type: 'error',
        message: err.response?.data?.message || 'Failed to save purchase record.',
      });
    }
  };

  const handleDelete = async (id, modelName) => {
    if (!window.confirm(`Are you sure you want to delete purchase record for ${modelName}?`)) return;
    try {
      await deletePurchase(id);
      setAlert({
        type: 'success',
        message: 'Purchase record deleted successfully.',
      });
      fetchPurchases();
    } catch (err) {
      setAlert({
        type: 'error',
        message: err.response?.data?.message || 'Failed to delete purchase record.',
      });
    }
  };

  return (
    <div className="section-container">
      {/* Title & Stats */}
      <div className="page-header-row">
        <div>
          <h2 className="page-title">Purchases</h2>
          <p className="page-subtitle">Track incoming devices, customer verification & purchase costs</p>
        </div>
      </div>

      {/* Toolbar / Search / Action */}
      <div className="section-toolbar">
        <div className="filter-bar">
          <div className="search-input-wrapper">
            <Search size={16} className="search-icon-inside" />
            <input
              type="text"
              className="search-input"
              placeholder="Search by model, IMEI, phone, CNIC..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="select-input"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
          >
            <option value="newest">Sort: Newest First</option>
            <option value="oldest">Sort: Oldest First</option>
          </select>
          <button
            className="btn btn-primary"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            <Plus size={16} />
            {showAddForm ? 'Cancel' : 'Add Purchase'}
          </button>
        </div>
      </div>

      {/* Add Purchase Form */}
      {showAddForm && (
        <div className="card">
          <h3 className="card-title">Record New Device Purchase</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label>Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                >
                  <option value="Mobile">Mobile</option>
                  <option value="Tablet">Tablet</option>
                  <option value="Accessory">Accessory</option>
                </select>
              </div>

              <div className="form-group">
                <label>Company / Brand *</label>
                <input
                  type="text"
                  placeholder="e.g. Samsung, Apple, Xiaomi"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                />
                {formErrors.companyName && <span className="hint" style={{ color: 'var(--danger)' }}>{formErrors.companyName}</span>}
              </div>

              <div className="form-group">
                <label>Model Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Galaxy S22"
                  value={formData.modelName}
                  onChange={(e) => setFormData({ ...formData, modelName: e.target.value })}
                />
                {formErrors.modelName && <span className="hint" style={{ color: 'var(--danger)' }}>{formErrors.modelName}</span>}
              </div>

              <div className="form-group">
                <label>Model Number *</label>
                <input
                  type="text"
                  placeholder="e.g. SM-S901B"
                  value={formData.modelNumber}
                  onChange={(e) => setFormData({ ...formData, modelNumber: e.target.value })}
                />
                {formErrors.modelNumber && <span className="hint" style={{ color: 'var(--danger)' }}>{formErrors.modelNumber}</span>}
              </div>

              <div className="form-group">
                <label>
                  IMEI 1 (Optional - 15 digits)
                  {formData.imei1 && (
                    <span style={{ marginLeft: '6px', color: formData.imei1.length === 15 ? 'var(--success)' : 'var(--text-muted)' }}>
                      ({formData.imei1.length}/15)
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  maxLength={15}
                  placeholder="15 digits"
                  value={formData.imei1}
                  onChange={(e) => setFormData({ ...formData, imei1: e.target.value.replace(/\D/g, '') })}
                />
                {formErrors.imei1 && <span className="hint" style={{ color: 'var(--danger)' }}>{formErrors.imei1}</span>}
              </div>

              <div className="form-group">
                <label>
                  IMEI 2 (Optional - 15 digits)
                  {formData.imei2 && (
                    <span style={{ marginLeft: '6px', color: formData.imei2.length === 15 ? 'var(--success)' : 'var(--text-muted)' }}>
                      ({formData.imei2.length}/15)
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  maxLength={15}
                  placeholder="15 digits"
                  value={formData.imei2}
                  onChange={(e) => setFormData({ ...formData, imei2: e.target.value.replace(/\D/g, '') })}
                />
                {formErrors.imei2 && <span className="hint" style={{ color: 'var(--danger)' }}>{formErrors.imei2}</span>}
              </div>

              <div className="form-group">
                <label>Serial Number (Optional)</label>
                <input
                  type="text"
                  placeholder="Device Serial Number"
                  value={formData.serialNumber}
                  onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Customer Phone Number *</label>
                <input
                  type="tel"
                  placeholder="e.g. 03001234567"
                  value={formData.customerPhone}
                  onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                />
                {formErrors.customerPhone && <span className="hint" style={{ color: 'var(--danger)' }}>{formErrors.customerPhone}</span>}
              </div>

              <div className="form-group">
                <label>
                  Customer ID Card Number * (13 digits)
                  {formData.customerIdCard && (
                    <span style={{ marginLeft: '6px', color: formData.customerIdCard.replace(/\D/g, '').length === 13 ? 'var(--success)' : 'var(--text-muted)' }}>
                      ({formData.customerIdCard.replace(/\D/g, '').length}/13 digits)
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  placeholder="e.g. 36302-1234567-1"
                  value={formData.customerIdCard}
                  onChange={(e) => setFormData({ ...formData, customerIdCard: e.target.value })}
                />
                {formErrors.customerIdCard && <span className="hint" style={{ color: 'var(--danger)' }}>{formErrors.customerIdCard}</span>}
              </div>

              <div className="form-group">
                <label>Purchase Price (PKR) *</label>
                <input
                  type="number"
                  placeholder="0"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                />
                {formErrors.price && <span className="hint" style={{ color: 'var(--danger)' }}>{formErrors.price}</span>}
              </div>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowAddForm(false)}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Save & Stock in Inventory
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Mobile Card List (Screen <= 768px) */}
      <div className="mobile-only">
        {loading ? (
          <div className="empty-state">Loading purchases...</div>
        ) : purchases.length === 0 ? (
          <div className="empty-state">No purchases recorded yet.</div>
        ) : (
          <div className="mobile-card-list">
            {purchases.map((item) => (
              <div key={item._id} className="mobile-card">
                <div className="mobile-card-header">
                  <div>
                    <div className="mobile-card-title">{item.modelName}</div>
                    <div className="mobile-card-subtitle">
                      {item.companyName} • {item.modelNumber}
                    </div>
                  </div>
                  <div className="mobile-card-price">
                    PKR {Number(item.price).toLocaleString()}
                  </div>
                </div>

                <div className="mobile-card-grid">
                  <div className="mobile-grid-box">
                    <span className="mobile-grid-label">Category</span>
                    <span className="mobile-grid-value">{item.category}</span>
                  </div>
                  <div className="mobile-grid-box">
                    <span className="mobile-grid-label">Date</span>
                    <span className="mobile-grid-value">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="mobile-grid-box">
                    <span className="mobile-grid-label">Customer Phone</span>
                    <span className="mobile-grid-value">{item.customerPhone}</span>
                  </div>
                  <div className="mobile-grid-box">
                    <span className="mobile-grid-label">Customer CNIC</span>
                    <span className="mobile-grid-value">{item.customerIdCard}</span>
                  </div>
                  {(item.imei1 || item.imei2) && (
                    <div className="mobile-grid-box" style={{ gridColumn: 'span 2' }}>
                      <span className="mobile-grid-label">IMEI Numbers</span>
                      <span className="mobile-grid-value" style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        {item.imei1 && <span className="imei-badge">1: {item.imei1}</span>}
                        {item.imei2 && <span className="imei-badge">2: {item.imei2}</span>}
                      </span>
                    </div>
                  )}
                  {item.serialNumber && (
                    <div className="mobile-grid-box" style={{ gridColumn: 'span 2' }}>
                      <span className="mobile-grid-label">Serial Number</span>
                      <span className="mobile-grid-value">{item.serialNumber}</span>
                    </div>
                  )}
                </div>

                <div className="mobile-card-actions">
                  <button
                    className="btn btn-danger btn-block btn-sm"
                    onClick={() => handleDelete(item._id, item.modelName)}
                  >
                    <Trash2 size={15} /> Delete Record
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Desktop Responsive Table Card (Screen > 768px) */}
      <div className="table-card desktop-only">
        <div className="table-card-header">
          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>
            All Purchases
          </span>
          <span className="table-count-badge">
            {purchases.length} {purchases.length === 1 ? 'Record' : 'Records'}
          </span>
        </div>

        <div className="table-responsive-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '95px' }}>Date</th>
                <th>Model</th>
                <th>Brand & Type</th>
                <th>IMEI & Serial</th>
                <th>Customer Contact</th>
                <th>Customer CNIC</th>
                <th>Price (PKR)</th>
                <th style={{ textAlign: 'center', width: '70px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="empty-state">Loading purchases...</td>
                </tr>
              ) : purchases.length === 0 ? (
                <tr>
                  <td colSpan="8" className="empty-state">No purchases recorded yet.</td>
                </tr>
              ) : (
                purchases.map((item) => (
                  <tr key={item._id}>
                    {/* 1. Date */}
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                      {new Date(item.createdAt).toLocaleDateString()}
                    </td>

                    {/* 2. Model */}
                    <td>
                      <div className="cell-primary">{item.modelName}</div>
                      <div className="cell-secondary">Model: {item.modelNumber}</div>
                    </td>

                    {/* 3. Brand & Type */}
                    <td>
                      <div style={{ fontWeight: 600 }}>{item.companyName}</div>
                      <span className="category-tag">{item.category}</span>
                    </td>

                    {/* 4. IMEIs & Serial */}
                    <td>
                      <div className="imei-box">
                        {item.imei1 && <span className="imei-badge">1: {item.imei1}</span>}
                        {item.imei2 && <span className="imei-badge">2: {item.imei2}</span>}
                        {item.serialNumber && <div className="cell-secondary">SN: {item.serialNumber}</div>}
                        {!item.imei1 && !item.imei2 && !item.serialNumber && <span className="cell-secondary">—</span>}
                      </div>
                    </td>

                    {/* 5. Customer Contact */}
                    <td>
                      <div style={{ fontWeight: 600 }}>{item.customerPhone}</div>
                    </td>

                    {/* 6. Customer CNIC */}
                    <td>
                      <span className="imei-badge">{item.customerIdCard}</span>
                    </td>

                    {/* 7. Price */}
                    <td>
                      <span className="price-display">
                        PKR {Number(item.price).toLocaleString()}
                      </span>
                    </td>

                    {/* 8. Action */}
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(item._id, item.modelName)}
                        title="Delete purchase"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Purchases;
