import React, { useState, useEffect } from 'react';
import { getSales, createSale, getInventory } from '../services/api';

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

  // Check if current modelName is in inventory and has stock
  const matchedInventoryItem = inventoryList.find(
    (item) => item.modelName.trim().toLowerCase() === formData.modelName.trim().toLowerCase()
  );

  const validateForm = () => {
    const errors = {};
    if (!formData.modelName.trim()) {
      errors.modelName = 'Model name is required';
    } else {
      // User rule: "if its not in inventory or purchase it wont allow to be entered."
      if (!matchedInventoryItem || matchedInventoryItem.quantity <= 0) {
        errors.modelName = 'Item is not available in inventory or has zero stock';
      }
    }

    if (!formData.customerName.trim()) errors.customerName = 'Customer name is required';
    if (!formData.customerNumber.trim()) errors.customerNumber = 'Customer phone number is required';

    // Optional 15 digits check
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

  return (
    <div>
      <div className="section-toolbar">
        <h2 className="section-title">Sales</h2>
        <div className="filter-bar">
          <input
            type="text"
            className="search-input"
            placeholder="Search by customer, model, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            className="btn btn-primary"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            {showAddForm ? 'Cancel' : '+ Record Sale'}
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
                  placeholder="e.g. Galaxy S23 Ultra"
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
                      {sale.customerName} • {sale.customerNumber}
                    </div>
                  </div>
                  <div className="mobile-card-price">
                    PKR {Number(sale.price).toLocaleString()}
                  </div>
                </div>

                <div className="mobile-card-details">
                  <div className="mobile-detail-item">
                    <span className="mobile-detail-label">Model No</span>
                    <span className="mobile-detail-value">{sale.modelNumber || '-'}</span>
                  </div>
                  <div className="mobile-detail-item">
                    <span className="mobile-detail-label">Sale Date</span>
                    <span className="mobile-detail-value">
                      {new Date(sale.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {(sale.imei1 || sale.imei2) && (
                    <div className="mobile-detail-item" style={{ gridColumn: 'span 2' }}>
                      <span className="mobile-detail-label">IMEIs</span>
                      <span className="mobile-detail-value mono-text">
                        {sale.imei1 && <div>1: {sale.imei1}</div>}
                        {sale.imei2 && <div>2: {sale.imei2}</div>}
                      </span>
                    </div>
                  )}
                </div>

                <div className="mobile-card-actions">
                  <button
                    className="btn btn-secondary btn-block btn-sm"
                    onClick={() => onOpenInvoice(sale)}
                  >
                    Generate Invoice
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Desktop Table (Screen > 768px) */}
      <div className="table-container desktop-only">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Customer Name</th>
              <th>Customer Number</th>
              <th>Model Name</th>
              <th>IMEI 1 & 2</th>
              <th>Sale Price</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" className="empty-state">Loading sales...</td>
              </tr>
            ) : sales.length === 0 ? (
              <tr>
                <td colSpan="7" className="empty-state">No sales recorded yet.</td>
              </tr>
            ) : (
              sales.map((sale) => (
                <tr key={sale._id}>
                  <td>{new Date(sale.createdAt).toLocaleDateString()}</td>
                  <td><strong>{sale.customerName}</strong></td>
                  <td>{sale.customerNumber}</td>
                  <td>{sale.modelName}</td>
                  <td className="mono-text">
                    {sale.imei1 && <div>1: {sale.imei1}</div>}
                    {sale.imei2 && <div>2: {sale.imei2}</div>}
                    {!sale.imei1 && !sale.imei2 && '-'}
                  </td>
                  <td><strong>PKR {Number(sale.price).toLocaleString()}</strong></td>
                  <td>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => onOpenInvoice(sale)}
                    >
                      Generate Invoice
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Sales;
