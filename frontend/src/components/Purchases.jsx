import React, { useState, useEffect } from 'react';
import { getPurchases, createPurchase, deletePurchase } from '../services/api';
import { Trash2, Search, Plus, ShoppingBag } from 'lucide-react';

const Purchases = ({ onPurchaseSuccess, setAlert }) => {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState('newest');
  const [selectedCategory, setSelectedCategory] = useState('All');
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

  const filteredPurchases = purchases.filter((item) => {
    if (selectedCategory === 'All') return true;
    return item.category?.toLowerCase() === selectedCategory.toLowerCase();
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

        {/* Toolbar: Category Filters on Left, Search Input on Right */}
        <div className="panel-toolbar-row">
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="panel-search-box">
              <Search size={14} className="search-icon" />
              <input
                type="text"
                placeholder="Search model, IMEI, phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>
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
                Save &amp; Add to Stock
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 3. Table Card (Reference: Al Haditha Table) */}
      <div className="table-card">
        {/* Desktop Proportional Table */}
        <div className="hide-on-mobile desktop-table-container">
          <table className="pro-table">
            <thead>
              <tr>
                <th style={{ width: '12%' }}>Date</th>
                <th style={{ width: '22%' }}>Model Name</th>
                <th style={{ width: '13%' }}>Brand &amp; Category</th>
                <th style={{ width: '21%' }}>IMEI &amp; Serial</th>
                <th style={{ width: '16%' }}>Customer Info</th>
                <th style={{ width: '12%' }}>Price (PKR)</th>
                <th style={{ width: '4%', textAlign: 'center' }}></th>
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

                    {/* Model */}
                    <td>
                      <span className="cell-title">{item.modelName}</span>
                      <span className="cell-sub">{item.modelNumber}</span>
                    </td>

                    {/* Brand & Category */}
                    <td>
                      <span className="cell-title">{item.companyName}</span>
                      <span className="cell-sub">
                        <span className="cell-badge badge-gray">{item.category}</span>
                      </span>
                    </td>

                    {/* IMEI & Serial */}
                    <td>
                      {item.imei1 && <div className="cell-mono">IMEI 1: {item.imei1}</div>}
                      {item.imei2 && <div className="cell-mono" style={{ marginTop: '1px' }}>IMEI 2: {item.imei2}</div>}
                      {item.serialNumber && <div className="cell-sub">SN: {item.serialNumber}</div>}
                      {!item.imei1 && !item.imei2 && !item.serialNumber && <span className="cell-sub">—</span>}
                    </td>

                    {/* Customer Info */}
                    <td>
                      <span className="cell-title" style={{ fontFamily: 'JetBrains Mono', fontSize: '12px' }}>{item.customerPhone}</span>
                      <span className="cell-sub" style={{ fontFamily: 'JetBrains Mono', fontSize: '11px' }}>CNIC: {item.customerIdCard}</span>
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
                        <Trash2 size={13} />
                      </button>
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
                    <div className="mobile-meta-label">Customer Contact &amp; CNIC</div>
                    <div className="mobile-meta-val" style={{ fontFamily: 'monospace' }}>
                      {item.customerPhone} • {item.customerIdCard}
                    </div>
                  </div>

                  {(item.imei1 || item.imei2 || item.serialNumber) && (
                    <div className="mobile-meta-cell full-width">
                      <div className="mobile-meta-label">IMEIs / Serial</div>
                      <div className="mobile-meta-val" style={{ fontFamily: 'monospace', fontSize: '11px' }}>
                        {item.imei1 && <div>IMEI 1: {item.imei1}</div>}
                        {item.imei2 && <div>IMEI 2: {item.imei2}</div>}
                        {item.serialNumber && <div>SN: {item.serialNumber}</div>}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mobile-card-actions">
                  <button
                    className="action-btn-danger"
                    style={{ width: '100%', height: '36px' }}
                    onClick={() => handleDelete(item._id, item.modelName)}
                  >
                    <Trash2 size={13} /> Delete Record
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
