import React, { useState, useEffect } from 'react';
import { getSales, createSale, deleteSale, getInventory } from '../services/api';
import { Trash2, FileText, Search, Plus, Tag } from 'lucide-react';

const Sales = ({ onSaleSuccess, onOpenInvoice, setAlert }) => {
  const [sales, setSales] = useState([]);
  const [inventoryList, setInventoryList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showAddForm, setShowAddForm] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    category: 'Mobile',
    modelName: '',
    modelNumber: '',
    customerName: '',
    customerNumber: '',
    imei1: '',
    imei2: '',
    price: '',
  });

  const [formErrors, setFormErrors] = useState({});

  const fetchSalesAndInventory = async () => {
    setLoading(true);
    try {
      const [salesRes, invRes] = await Promise.all([
        getSales({ search }),
        getInventory(),
      ]);
      if (salesRes.data && salesRes.data.data) {
        setSales(salesRes.data.data);
      }
      if (invRes.data && invRes.data.data) {
        setInventoryList(invRes.data.data);
      }
    } catch (err) {
      setAlert({
        type: 'error',
        message: err.response?.data?.message || 'Error fetching sales and inventory data.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSalesAndInventory();
  }, [search]);

  const handleSelectInventoryItem = (e) => {
    const selectedId = e.target.value;
    if (!selectedId) return;

    const item = inventoryList.find((inv) => inv._id === selectedId);
    if (item) {
      setFormData((prev) => ({
        ...prev,
        category: item.category || 'Mobile',
        modelName: item.modelName,
        modelNumber: item.modelNumber,
        price: item.price || '',
        imei1: item.imeis && item.imeis.length > 0 ? item.imeis[0] : '',
        imei2: item.imeis && item.imeis.length > 1 ? item.imeis[1] : '',
      }));
    }
  };

  const matchedInventoryItem = inventoryList.find(
    (item) => item.modelName.trim().toLowerCase() === formData.modelName.trim().toLowerCase()
  );

  const validateForm = () => {
    const errors = {};
    if (!formData.modelName.trim()) {
      errors.modelName = 'Model name is required';
    } else {
      if (!matchedInventoryItem || matchedInventoryItem.quantity <= 0) {
        errors.modelName = 'Item is not available in inventory or has zero stock';
      }
    }

    if (!formData.customerName.trim()) errors.customerName = 'Customer name is required';
    if (!formData.customerNumber.trim()) errors.customerNumber = 'Customer phone number is required';

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
      const res = await createSale(formData);
      setAlert({
        type: 'success',
        message: 'Sale recorded and inventory stock deducted successfully.',
      });
      setFormData({
        category: 'Mobile',
        modelName: '',
        modelNumber: '',
        customerName: '',
        customerNumber: '',
        imei1: '',
        imei2: '',
        price: '',
      });
      setShowAddForm(false);
      fetchSalesAndInventory();
      if (onSaleSuccess) onSaleSuccess();

      // Offer immediate invoice generation
      if (res.data && res.data.data && onOpenInvoice) {
        if (window.confirm('Sale recorded! Would you like to generate and print an invoice for this sale now?')) {
          onOpenInvoice(res.data.data);
        }
      }
    } catch (err) {
      setAlert({
        type: 'error',
        message: err.response?.data?.message || 'Failed to record sale.',
      });
    }
  };

  const handleDelete = async (id, modelName) => {
    if (!window.confirm(`Are you sure you want to delete the sale for ${modelName}? Stock will be automatically restored.`)) return;
    try {
      await deleteSale(id);
      setAlert({
        type: 'success',
        message: 'Sale deleted and item stock returned to inventory.',
      });
      fetchSalesAndInventory();
      if (onSaleSuccess) onSaleSuccess();
    } catch (err) {
      setAlert({
        type: 'error',
        message: err.response?.data?.message || 'Failed to delete sale.',
      });
    }
  };

  const filteredSales = sales.filter((item) => {
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
              <Tag size={18} />
            </div>
            <div className="panel-header-text">
              <h2>Customer Sales &amp; Dispatch Registry</h2>
              <p>Record customer sales, deduct live inventory &amp; generate verified billing invoices.</p>
            </div>
          </div>
          <div>
            <button
              className="btn-primary"
              onClick={() => setShowAddForm(!showAddForm)}
            >
              <Plus size={15} />
              {showAddForm ? 'Close Form' : 'Add Sale'}
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
                placeholder="Search sales by model, customer, IMEI..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2. Collapsible Add Sale Form */}
      {showAddForm && (
        <div className="card-form">
          <div className="card-form-title">
            <span>Record New Sale</span>
          </div>

          {/* Quick Select from In-Stock Inventory */}
          <div style={{ marginBottom: '14px', background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-card)' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '5px' }}>
              Select Available Device from Live Inventory
            </label>
            <select
              style={{ width: '100%', height: '36px', padding: '0 10px', borderRadius: '7px', border: '1px solid var(--border-card)', background: '#ffffff', fontSize: '13px' }}
              onChange={handleSelectInventoryItem}
              defaultValue=""
            >
              <option value="">-- Choose an in-stock device --</option>
              {inventoryList
                .filter((inv) => inv.quantity > 0)
                .map((inv) => (
                  <option key={inv._id} value={inv._id}>
                    {inv.modelName} ({inv.modelNumber}) - Stock: {inv.quantity} - PKR {Number(inv.price).toLocaleString()}
                  </option>
                ))}
            </select>
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
              </div>

              <div className="form-field">
                <label>Customer Name *</label>
                <input
                  type="text"
                  placeholder="Customer Full Name"
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                />
                {formErrors.customerName && <span className="form-field-error">{formErrors.customerName}</span>}
              </div>

              <div className="form-field">
                <label>Customer Phone Number *</label>
                <input
                  type="tel"
                  placeholder="e.g. 03001234567"
                  value={formData.customerNumber}
                  onChange={(e) => setFormData({ ...formData, customerNumber: e.target.value })}
                />
                {formErrors.customerNumber && <span className="form-field-error">{formErrors.customerNumber}</span>}
              </div>

              <div className="form-field">
                <label>Sale Price (PKR) *</label>
                <input
                  type="number"
                  placeholder="0"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                />
                {formErrors.price && <span className="form-field-error">{formErrors.price}</span>}
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
                Record Sale &amp; Deduct Stock
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
                <th style={{ width: '23%' }}>Device Model</th>
                <th style={{ width: '20%' }}>Customer</th>
                <th style={{ width: '18%' }}>IMEI Sold</th>
                <th style={{ width: '13%' }}>Sale Price</th>
                <th style={{ width: '14%', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="empty-state">Loading sales records...</td>
                </tr>
              ) : filteredSales.length === 0 ? (
                <tr>
                  <td colSpan="6" className="empty-state">No sales recorded yet.</td>
                </tr>
              ) : (
                filteredSales.map((item) => (
                  <tr key={item._id}>
                    {/* Date */}
                    <td>
                      <span className="cell-mono">
                        {new Date(item.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    </td>

                    {/* Device */}
                    <td>
                      <span className="cell-title">{item.modelName}</span>
                      <span className="cell-sub">{item.modelNumber} • {item.category}</span>
                    </td>

                    {/* Customer */}
                    <td>
                      <span className="cell-title">{item.customerName}</span>
                      <span className="cell-sub" style={{ fontFamily: 'JetBrains Mono' }}>{item.customerNumber}</span>
                    </td>

                    {/* IMEI */}
                    <td>
                      {item.imei1 && <div className="cell-mono">1: {item.imei1}</div>}
                      {item.imei2 && <div className="cell-mono" style={{ marginTop: '1px' }}>2: {item.imei2}</div>}
                      {!item.imei1 && !item.imei2 && <span className="cell-sub">—</span>}
                    </td>

                    {/* Price */}
                    <td>
                      <span className="cell-price">
                        PKR {Number(item.price).toLocaleString()}
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                        <button
                          className="action-btn-primary"
                          onClick={() => onOpenInvoice && onOpenInvoice(item)}
                          title="Generate Invoice"
                        >
                          <FileText size={12} />
                          <span>Invoice</span>
                        </button>
                        <button
                          className="action-btn-danger"
                          onClick={() => handleDelete(item._id, item.modelName)}
                          title="Delete sale and return stock"
                        >
                          <Trash2 size={12} />
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
            <div className="empty-state">Loading sales records...</div>
          ) : filteredSales.length === 0 ? (
            <div className="empty-state">No sales recorded yet.</div>
          ) : (
            filteredSales.map((item) => (
              <div key={item._id} className="mobile-card">
                <div className="mobile-card-top">
                  <div>
                    <div className="mobile-card-title">{item.modelName}</div>
                    <div className="mobile-card-subtitle">{item.modelNumber} • {item.category}</div>
                  </div>
                  <div className="mobile-card-price">
                    PKR {Number(item.price).toLocaleString()}
                  </div>
                </div>

                <div className="mobile-card-meta-grid">
                  <div className="mobile-meta-cell">
                    <div className="mobile-meta-label">Customer</div>
                    <div className="mobile-meta-val">{item.customerName}</div>
                  </div>

                  <div className="mobile-meta-cell">
                    <div className="mobile-meta-label">Phone</div>
                    <div className="mobile-meta-val" style={{ fontFamily: 'monospace' }}>{item.customerNumber}</div>
                  </div>

                  <div className="mobile-meta-cell">
                    <div className="mobile-meta-label">Date</div>
                    <div className="mobile-meta-val">
                      {new Date(item.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                  </div>

                  {(item.imei1 || item.imei2) && (
                    <div className="mobile-meta-cell full-width">
                      <div className="mobile-meta-label">IMEIs Sold</div>
                      <div className="mobile-meta-val" style={{ fontFamily: 'monospace', fontSize: '11px' }}>
                        {item.imei1 && <div>1: {item.imei1}</div>}
                        {item.imei2 && <div>2: {item.imei2}</div>}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mobile-card-actions">
                  <button
                    className="btn-primary"
                    onClick={() => onOpenInvoice && onOpenInvoice(item)}
                  >
                    <FileText size={13} /> Generate Invoice
                  </button>
                  <button
                    className="action-btn-danger"
                    style={{ height: '36px', padding: '0 12px' }}
                    onClick={() => handleDelete(item._id, item.modelName)}
                  >
                    <Trash2 size={13} /> Delete
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

export default Sales;
