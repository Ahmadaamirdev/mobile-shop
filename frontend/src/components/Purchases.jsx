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

    const idDigits = formData.customerIdCard.replace(/\D/g, '');
    if (idDigits.length !== 13) {
      errors.customerIdCard = 'ID card number must contain exactly 13 digits';
    }

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
    <div>
      {/* 1. Page Header */}
      <div className="page-header-container">
        <div className="page-header-title-row">
          <div className="page-header-text">
            <h1>Purchases</h1>
            <p>Record stock purchases, customer ID checks & incoming devices</p>
          </div>
          <div className="page-header-actions">
            <button
              className="btn-primary"
              onClick={() => setShowAddForm(!showAddForm)}
            >
              <Plus size={16} />
              {showAddForm ? 'Close Form' : 'Add Purchase'}
            </button>
          </div>
        </div>
      </div>

      {/* 2. Collapsible Add Form Card */}
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
                <label>Company / Brand *</label>
                <input
                  type="text"
                  placeholder="e.g. Samsung, Apple, Xiaomi"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                />
                {formErrors.companyName && <span className="form-field-error">{formErrors.companyName}</span>}
              </div>

              <div className="form-field">
                <label>Model Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Galaxy S22"
                  value={formData.modelName}
                  onChange={(e) => setFormData({ ...formData, modelName: e.target.value })}
                />
                {formErrors.modelName && <span className="form-field-error">{formErrors.modelName}</span>}
              </div>

              <div className="form-field">
                <label>Model Number *</label>
                <input
                  type="text"
                  placeholder="e.g. SM-S901B"
                  value={formData.modelNumber}
                  onChange={(e) => setFormData({ ...formData, modelNumber: e.target.value })}
                />
                {formErrors.modelNumber && <span className="form-field-error">{formErrors.modelNumber}</span>}
              </div>

              <div className="form-field">
                <label>
                  IMEI 1 (Optional - 15 digits)
                  {formData.imei1 && (
                    <span style={{ marginLeft: '6px', color: formData.imei1.length === 15 ? 'var(--success-color)' : 'var(--text-muted)' }}>
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
                {formErrors.imei1 && <span className="form-field-error">{formErrors.imei1}</span>}
              </div>

              <div className="form-field">
                <label>
                  IMEI 2 (Optional - 15 digits)
                  {formData.imei2 && (
                    <span style={{ marginLeft: '6px', color: formData.imei2.length === 15 ? 'var(--success-color)' : 'var(--text-muted)' }}>
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
                <label>Customer Phone Number *</label>
                <input
                  type="tel"
                  placeholder="e.g. 03001234567"
                  value={formData.customerPhone}
                  onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                />
                {formErrors.customerPhone && <span className="form-field-error">{formErrors.customerPhone}</span>}
              </div>

              <div className="form-field">
                <label>
                  Customer ID Card Number * (13 digits)
                  {formData.customerIdCard && (
                    <span style={{ marginLeft: '6px', color: formData.customerIdCard.replace(/\D/g, '').length === 13 ? 'var(--success-color)' : 'var(--text-muted)' }}>
                      ({formData.customerIdCard.replace(/\D/g, '').length}/13)
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  placeholder="e.g. 36302-1234567-1"
                  value={formData.customerIdCard}
                  onChange={(e) => setFormData({ ...formData, customerIdCard: e.target.value })}
                />
                {formErrors.customerIdCard && <span className="form-field-error">{formErrors.customerIdCard}</span>}
              </div>

              <div className="form-field">
                <label>Purchase Price (PKR) *</label>
                <input
                  type="number"
                  placeholder="0"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                />
                {formErrors.price && <span className="form-field-error">{formErrors.price}</span>}
              </div>
            </div>

            <div className="card-form-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowAddForm(false)}
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                Save & Add to Stock
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 3. Main Data Card */}
      <div className="card-data">
        {/* Integrated Toolbar */}
        <div className="table-toolbar">
          <div className="table-toolbar-left">
            <div className="search-input-wrapper">
              <Search size={15} className="search-icon" />
              <input
                type="text"
                placeholder="Search by model, IMEI, phone, CNIC..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="table-toolbar-right">
            <select
              className="select-filter"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            >
              <option value="newest">Sort: Newest First</option>
              <option value="oldest">Sort: Oldest First</option>
            </select>
            <span className="record-count-badge">
              {purchases.length} {purchases.length === 1 ? 'Record' : 'Records'}
            </span>
          </div>
        </div>

        {/* Desktop Proportional Table (Zero Horizontal Overflow) */}
        <div className="hide-on-mobile desktop-table-container">
          <table className="pro-table">
            <thead>
              <tr>
                <th style={{ width: '11%' }}>Date</th>
                <th style={{ width: '23%' }}>Model</th>
                <th style={{ width: '13%' }}>Brand & Type</th>
                <th style={{ width: '21%' }}>IMEI / Serial</th>
                <th style={{ width: '17%' }}>Customer Info</th>
                <th style={{ width: '11%' }}>Price (PKR)</th>
                <th style={{ width: '4%', textAlign: 'center' }}></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="empty-state">Loading purchases...</td>
                </tr>
              ) : purchases.length === 0 ? (
                <tr>
                  <td colSpan="7" className="empty-state">No purchases recorded yet.</td>
                </tr>
              ) : (
                purchases.map((item) => (
                  <tr key={item._id}>
                    {/* Date */}
                    <td style={{ color: 'var(--text-muted)' }}>
                      {new Date(item.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>

                    {/* Model */}
                    <td>
                      <span className="cell-title">{item.modelName}</span>
                      <span className="cell-sub">{item.modelNumber}</span>
                    </td>

                    {/* Brand & Type */}
                    <td>
                      <span className="cell-title">{item.companyName}</span>
                      <span className="cell-sub">
                        <span className="cell-badge badge-gray">{item.category}</span>
                      </span>
                    </td>

                    {/* IMEI & Serial */}
                    <td>
                      {item.imei1 && <div className="cell-mono">IMEI 1: {item.imei1}</div>}
                      {item.imei2 && <div className="cell-mono" style={{ marginTop: '2px' }}>IMEI 2: {item.imei2}</div>}
                      {item.serialNumber && <div className="cell-sub">SN: {item.serialNumber}</div>}
                      {!item.imei1 && !item.imei2 && !item.serialNumber && <span className="cell-sub">—</span>}
                    </td>

                    {/* Customer Info */}
                    <td>
                      <span className="cell-title">{item.customerPhone}</span>
                      <span className="cell-sub">CNIC: {item.customerIdCard}</span>
                    </td>

                    {/* Price */}
                    <td>
                      <span className="cell-price">
                        PKR {Number(item.price).toLocaleString()}
                      </span>
                    </td>

                    {/* Action */}
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="action-btn-danger"
                        onClick={() => handleDelete(item._id, item.modelName)}
                        title="Delete purchase record"
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

        {/* Mobile View Cards (100% Fluid 2x2 Grid) */}
        <div className="show-on-mobile mobile-card-container">
          {loading ? (
            <div className="empty-state">Loading purchases...</div>
          ) : purchases.length === 0 ? (
            <div className="empty-state">No purchases recorded yet.</div>
          ) : (
            purchases.map((item) => (
              <div key={item._id} className="mobile-card">
                <div className="mobile-card-top">
                  <div>
                    <div className="mobile-card-title">{item.modelName}</div>
                    <div className="mobile-card-subtitle">{item.companyName} • {item.modelNumber}</div>
                  </div>
                  <div className="mobile-card-price">
                    PKR {Number(item.price).toLocaleString()}
                  </div>
                </div>

                <div className="mobile-card-meta-grid">
                  <div className="mobile-meta-cell">
                    <div className="mobile-meta-label">Category</div>
                    <div className="mobile-meta-val">{item.category}</div>
                  </div>

                  <div className="mobile-meta-cell">
                    <div className="mobile-meta-label">Date</div>
                    <div className="mobile-meta-val">
                      {new Date(item.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                  </div>

                  <div className="mobile-meta-cell full-width">
                    <div className="mobile-meta-label">Customer Contact & ID</div>
                    <div className="mobile-meta-val">
                      {item.customerPhone} • {item.customerIdCard}
                    </div>
                  </div>

                  {(item.imei1 || item.imei2 || item.serialNumber) && (
                    <div className="mobile-meta-cell full-width">
                      <div className="mobile-meta-label">Identifiers</div>
                      <div className="mobile-meta-val" style={{ fontFamily: 'monospace', fontSize: '0.76rem' }}>
                        {item.imei1 && <div>IMEI 1: {item.imei1}</div>}
                        {item.imei2 && <div>IMEI 2: {item.imei2}</div>}
                        {item.serialNumber && <div>SN: {item.serialNumber}</div>}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mobile-card-actions">
                  <button
                    className="btn-secondary"
                    style={{ color: 'var(--danger-color)', borderColor: 'var(--danger-border)' }}
                    onClick={() => handleDelete(item._id, item.modelName)}
                  >
                    <Trash2 size={14} /> Delete Record
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Purchases;
