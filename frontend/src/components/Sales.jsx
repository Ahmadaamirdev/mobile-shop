import React, { useState, useEffect } from 'react';
import { getSales, createSale, deleteSale, getInventory } from '../services/api';
import { Trash2, FileText, Search, Plus } from 'lucide-react';

const Sales = ({ onSaleSuccess, onOpenInvoice, setAlert }) => {
  const [sales, setSales] = useState([]);
  const [inventoryList, setInventoryList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
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

  // When user selects an inventory item from dropdown
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
      await createSale(formData);
      setAlert({
        type: 'success',
        message: 'Sale recorded and item automatically subtracted from inventory.',
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
    } catch (err) {
      setAlert({
        type: 'error',
        message: err.response?.data?.message || 'Failed to record sale.',
      });
    }
  };

  const handleDelete = async (id, modelName) => {
    if (!window.confirm(`Are you sure you want to delete this sale for ${modelName}? Stock will be restored to inventory.`)) return;
    try {
      await deleteSale(id);
      setAlert({
        type: 'success',
        message: 'Sale deleted and inventory stock restored.',
      });
      fetchSalesAndInventory();
      if (onSaleSuccess) onSaleSuccess();
    } catch (err) {
      setAlert({
        type: 'error',
        message: err.response?.data?.message || 'Failed to delete sale record.',
      });
    }
  };

  return (
    <div className="section-container">
      {/* Title & Subtitle */}
      <div className="page-header-row">
        <div>
          <h2 className="page-title">Sales</h2>
          <p className="page-subtitle">Process store sales, auto-deduct stock & issue invoices</p>
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
              placeholder="Search by customer, model, phone, IMEI..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            className="btn btn-primary"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            <Plus size={16} />
            {showAddForm ? 'Cancel' : 'Record Sale'}
          </button>
        </div>
      </div>

      {showAddForm && (
        <div className="card">
          <h3 className="card-title">Record Sale</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              {/* Select from Inventory Dropdown */}
              <div className="form-group">
                <label>Select From In-Stock Inventory</label>
                <select onChange={handleSelectInventoryItem} defaultValue="">
                  <option value="">-- Choose from available stock --</option>
                  {inventoryList
                    .filter((item) => item.quantity > 0)
                    .map((item) => (
                      <option key={item._id} value={item._id}>
                        {item.modelName} ({item.modelNumber}) - Stock: {item.quantity} (PKR {Number(item.price).toLocaleString()})
                      </option>
                    ))}
                </select>
                <span className="hint">Or type the model name below</span>
              </div>

              {/* Type Model Name */}
              <div className="form-group">
                <label>Model Name * (Must be in inventory)</label>
                <input
                  type="text"
                  placeholder="e.g. Galaxy S22"
                  value={formData.modelName}
                  onChange={(e) => setFormData({ ...formData, modelName: e.target.value })}
                />
                {matchedInventoryItem ? (
                  <span className="hint" style={{ color: 'var(--success)' }}>
                    In Stock: {matchedInventoryItem.quantity} units available
                  </span>
                ) : formData.modelName.trim() !== '' ? (
                  <span className="hint" style={{ color: 'var(--danger)' }}>
                    Not available in inventory
                  </span>
                ) : null}
                {formErrors.modelName && <span className="hint" style={{ color: 'var(--danger)' }}>{formErrors.modelName}</span>}
              </div>

              <div className="form-group">
                <label>Customer Name *</label>
                <input
                  type="text"
                  placeholder="Customer Full Name"
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                />
                {formErrors.customerName && <span className="hint" style={{ color: 'var(--danger)' }}>{formErrors.customerName}</span>}
              </div>

              <div className="form-group">
                <label>Customer Phone Number *</label>
                <input
                  type="tel"
                  placeholder="e.g. 03001234567"
                  value={formData.customerNumber}
                  onChange={(e) => setFormData({ ...formData, customerNumber: e.target.value })}
                />
                {formErrors.customerNumber && <span className="hint" style={{ color: 'var(--danger)' }}>{formErrors.customerNumber}</span>}
              </div>

              {/* IMEI 1 Selection / Input */}
              <div className="form-group">
                <label>
                  IMEI 1 (Optional - 15 digits)
                  {formData.imei1 && (
                    <span style={{ marginLeft: '6px', color: formData.imei1.length === 15 ? 'var(--success)' : 'var(--text-muted)' }}>
                      ({formData.imei1.length}/15)
                    </span>
                  )}
                </label>
                {matchedInventoryItem && matchedInventoryItem.imeis && matchedInventoryItem.imeis.length > 0 ? (
                  <select
                    value={formData.imei1}
                    onChange={(e) => setFormData({ ...formData, imei1: e.target.value })}
                  >
                    <option value="">-- Select from stock IMEIs or type --</option>
                    {matchedInventoryItem.imeis.map((im) => (
                      <option key={im} value={im}>
                        {im}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    maxLength={15}
                    placeholder="15 digits"
                    value={formData.imei1}
                    onChange={(e) => setFormData({ ...formData, imei1: e.target.value.replace(/\D/g, '') })}
                  />
                )}
                {formErrors.imei1 && <span className="hint" style={{ color: 'var(--danger)' }}>{formErrors.imei1}</span>}
              </div>

              {/* IMEI 2 Selection / Input */}
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
                <label>Sale Price (PKR) *</label>
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
                Record Sale & Subtract Stock
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Mobile Card List (Screen <= 768px) */}
      <div className="mobile-only">
        {loading ? (
          <div className="empty-state">Loading sales...</div>
        ) : sales.length === 0 ? (
          <div className="empty-state">No sales recorded yet.</div>
        ) : (
          <div className="mobile-card-list">
            {sales.map((sale) => (
              <div key={sale._id} className="mobile-card">
                <div className="mobile-card-header">
                  <div>
                    <div className="mobile-card-title">{sale.modelName}</div>
                    <div className="mobile-card-subtitle">
                      Model: {sale.modelNumber || '—'}
                    </div>
                  </div>
                  <div className="mobile-card-price">
                    PKR {Number(sale.price).toLocaleString()}
                  </div>
                </div>

                <div className="mobile-card-grid">
                  <div className="mobile-grid-box">
                    <span className="mobile-grid-label">Customer Name</span>
                    <span className="mobile-grid-value">{sale.customerName}</span>
                  </div>
                  <div className="mobile-grid-box">
                    <span className="mobile-grid-label">Phone</span>
                    <span className="mobile-grid-value">{sale.customerNumber}</span>
                  </div>
                  <div className="mobile-grid-box">
                    <span className="mobile-grid-label">Sale Date</span>
                    <span className="mobile-grid-value">
                      {new Date(sale.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="mobile-grid-box">
                    <span className="mobile-grid-label">Category</span>
                    <span className="mobile-grid-value">{sale.category}</span>
                  </div>
                  {(sale.imei1 || sale.imei2) && (
                    <div className="mobile-grid-box" style={{ gridColumn: 'span 2' }}>
                      <span className="mobile-grid-label">IMEIs</span>
                      <span className="mobile-grid-value" style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        {sale.imei1 && <span className="imei-badge">1: {sale.imei1}</span>}
                        {sale.imei2 && <span className="imei-badge">2: {sale.imei2}</span>}
                      </span>
                    </div>
                  )}
                </div>

                <div className="mobile-card-actions" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => onOpenInvoice(sale)}
                  >
                    <FileText size={15} /> Invoice
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDelete(sale._id, sale.modelName)}
                  >
                    <Trash2 size={15} /> Delete
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
            All Sales Records
          </span>
          <span className="table-count-badge">
            {sales.length} {sales.length === 1 ? 'Sale' : 'Sales'}
          </span>
        </div>

        <div className="table-responsive-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '95px' }}>Date</th>
                <th>Customer Name</th>
                <th>Customer Phone</th>
                <th>Model Name</th>
                <th>Model Number</th>
                <th>IMEIs</th>
                <th>Price (PKR)</th>
                <th style={{ textAlign: 'center', width: '110px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="empty-state">Loading sales...</td>
                </tr>
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan="8" className="empty-state">No sales recorded yet.</td>
                </tr>
              ) : (
                sales.map((sale) => (
                  <tr key={sale._id}>
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                      {new Date(sale.createdAt).toLocaleDateString()}
                    </td>
                    <td>
                      <div className="cell-primary">{sale.customerName}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{sale.customerNumber}</div>
                    </td>
                    <td>
                      <div className="cell-primary">{sale.modelName}</div>
                      <span className="category-tag">{sale.category}</span>
                    </td>
                    <td>
                      <span style={{ color: 'var(--text-secondary)' }}>{sale.modelNumber || '—'}</span>
                    </td>
                    <td>
                      <div className="imei-box">
                        {sale.imei1 && <span className="imei-badge">1: {sale.imei1}</span>}
                        {sale.imei2 && <span className="imei-badge">2: {sale.imei2}</span>}
                        {!sale.imei1 && !sale.imei2 && <span className="cell-secondary">—</span>}
                      </div>
                    </td>
                    <td>
                      <span className="price-display">
                        PKR {Number(sale.price).toLocaleString()}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => onOpenInvoice(sale)}
                          title="Generate Invoice"
                        >
                          <FileText size={14} />
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(sale._id, sale.modelName)}
                          title="Delete sale and restore stock"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
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

export default Sales;
