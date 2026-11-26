import React, { useState, useEffect } from 'react';
import { getSales, createSale, deleteSale, getInventory } from '../services/api';
import { Trash2, Search, Plus, Tag, Eye, Smartphone, User, Phone } from 'lucide-react';
import SmartDropdown from './SmartDropdown';
import DetailModal from './DetailModal';

const emptySaleDevice = {
  category: 'Mobile',
  condition: 'New',
  status: 'PTA',
  modelName: '',
  modelNumber: '',
  imei1: '',
  imei2: '',
  price: '',
};

const Sales = ({ isActive, onSaleSuccess, setAlert }) => {
  const [sales, setSales] = useState([]);
  const [inventoryList, setInventoryList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState('newest');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedCondition, setSelectedCondition] = useState('All');
  const [showAddForm, setShowAddForm] = useState(false);
  const [detailItem, setDetailItem] = useState(null);

  // Multi-device Form state
  const [formData, setFormData] = useState({
    customerName: '',
    customerNumber: '',
    items: [{ ...emptySaleDevice }],
  });

  const [formErrors, setFormErrors] = useState({});

  const fetchSalesAndInventory = async (force = false) => {
    setLoading(true);
    try {
      const [salesRes, invRes] = await Promise.all([
        getSales({}, force),
        getInventory({}, force),
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
  }, []);

  useEffect(() => {
    if (isActive) {
      setShowAddForm(false);
      fetchSalesAndInventory();
    }
  }, [isActive]);

  const handleAddDeviceRow = () => {
    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, { ...emptySaleDevice }],
    }));
  };

  const handleRemoveDeviceRow = (index) => {
    if (formData.items.length <= 1) return;
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const handleDeviceChange = (index, field, value) => {
    setFormData((prev) => {
      const updated = [...prev.items];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, items: updated };
    });
  };

  const handleSelectInventoryItem = (index, selectedId) => {
    if (!selectedId) return;
    const item = inventoryList.find((inv) => inv._id === selectedId);
    if (!item) return;

    setFormData((prev) => {
      const updated = [...prev.items];
      updated[index] = {
        ...updated[index],
        category: item.category || 'Mobile',
        condition: item.condition || 'New',
        status: item.status || 'PTA',
        modelName: item.modelName,
        modelNumber: item.modelNumber || '',
        price: item.price || '',
        imei1: item.imeis && item.imeis.length > 0 ? item.imeis[0] : '',
        imei2: item.imeis && item.imeis.length > 1 ? item.imeis[1] : '',
      };
      return { ...prev, items: updated };
    });
  };

  const findMatchingInventory = (device) =>
    inventoryList.find((item) => {
      const nameMatch = item.modelName.trim().toLowerCase() === (device.modelName || '').trim().toLowerCase();
      if (!nameMatch) return false;
      if (device.condition && item.condition && item.condition !== device.condition) {
        return false;
      }
      if (device.modelNumber && device.modelNumber.trim() && item.modelNumber) {
        return item.modelNumber.trim().toLowerCase() === device.modelNumber.trim().toLowerCase();
      }
      return true;
    });

  const calculateSaleTotal = () =>
    formData.items.reduce((sum, it) => sum + (Number(it.price) || 0), 0);

  const validateForm = () => {
    const errors = {};
    if (!formData.customerName.trim()) errors.customerName = 'Customer name is required';
    if (!/^\d{11}$/.test(formData.customerNumber.trim())) {
      errors.customerNumber = 'Customer phone number must contain exactly 11 digits';
    }

    formData.items.forEach((dev, idx) => {
      if (!dev.modelName.trim()) {
        errors[`modelName_${idx}`] = 'Model name is required';
      } else {
        const matched = findMatchingInventory(dev);
        if (!matched || matched.quantity <= 0) {
          errors[`modelName_${idx}`] = 'Item is not available in inventory or has zero stock';
        }
      }

      if (dev.imei1 && !/^\d{15}$/.test(dev.imei1.trim())) {
        errors[`imei1_${idx}`] = 'IMEI 1 must be exactly 15 digits';
      }
      if (dev.imei2 && !/^\d{15}$/.test(dev.imei2.trim())) {
        errors[`imei2_${idx}`] = 'IMEI 2 must be exactly 15 digits';
      }

      if (dev.price === '' || isNaN(dev.price) || Number(dev.price) < 0) {
        errors[`price_${idx}`] = 'Valid price is required';
      }
    });

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      await createSale({
        customerName: formData.customerName,
        customerNumber: formData.customerNumber,
        items: formData.items.map((it) => ({
          ...it,
          inventoryId: it.selectedInventoryId || undefined,
          price: Number(it.price) || 0,
          quantity: 1,
        })),
      });
      setAlert({
        type: 'success',
        message: 'Sale recorded successfully',
      });
      setFormData({
        customerName: '',
        customerNumber: '',
        items: [{ ...emptySaleDevice }],
      });
      setFormErrors({});
      setShowAddForm(false);
      fetchSalesAndInventory(true);
      if (onSaleSuccess) onSaleSuccess();
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
        message: 'Sale deleted successfully',
      });
      fetchSalesAndInventory(true);
      if (onSaleSuccess) onSaleSuccess();
    } catch (err) {
      setAlert({
        type: 'error',
        message: err.response?.data?.message || 'Failed to delete sale.',
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

  const filteredSales = sales
    .filter((item) => {
      const itemList = Array.isArray(item.items) && item.items.length > 0 ? item.items : [item];
      const categoryMatch =
        selectedCategory === 'All' ||
        itemList.some((d) => d.category?.toLowerCase() === selectedCategory.toLowerCase());
      const conditionMatch =
        selectedCondition === 'All' ||
        itemList.some((d) => (d.condition || 'New').toLowerCase() === selectedCondition.toLowerCase());
      const dateMatch = matchesDateRange(item.createdAt);
      if (!search.trim()) return categoryMatch && conditionMatch && dateMatch;
      const term = search.trim().toLowerCase();
      const searchMatch =
        item.modelName?.toLowerCase().includes(term) ||
        item.modelNumber?.toLowerCase().includes(term) ||
        item.category?.toLowerCase().includes(term) ||
        item.customerName?.toLowerCase().includes(term) ||
        item.customerNumber?.toLowerCase().includes(term) ||
        item.imei1?.toLowerCase().includes(term) ||
        item.imei2?.toLowerCase().includes(term) ||
        (item.condition || 'New').toLowerCase().includes(term) ||
        itemList.some(
          (d) =>
            d.modelName?.toLowerCase().includes(term) ||
            d.modelNumber?.toLowerCase().includes(term) ||
            d.imei1?.toLowerCase().includes(term) ||
            d.imei2?.toLowerCase().includes(term)
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
      {/* 1. Header Card */}
      <div className="panel-header-card">
        <div className="panel-header-row">
          <div className="panel-header-left">
            <div className="panel-icon-box">
              <Tag size={18} />
            </div>
            <div className="panel-header-text">
              <h2>Customer Sales &amp; Dispatch Registry</h2>
              <p>Record single or multi-device customer sales &amp; automatically deduct live inventory.</p>
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
                  placeholder="Search sales by model, customer, IMEI..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="date-filter-controls">
                <select
                  className="date-sort-select"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  aria-label="Sort sales"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                </select>
                <div className="date-range-inputs">
                  <div className="date-input-wrap">
                    <span className="date-input-label">From</span>
                    <input
                      type="date"
                      className="date-filter-input"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      aria-label="From date"
                    />
                  </div>
                  <div className="date-input-wrap">
                    <span className="date-input-label">To</span>
                    <input
                      type="date"
                      className="date-filter-input"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      aria-label="To date"
                    />
                  </div>
                  {(startDate || endDate) && (
                    <button
                      type="button"
                      className="date-clear-btn"
                      onClick={() => { setStartDate(''); setEndDate(''); }}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. Collapsible Multi-Device Add Sale Form */}
      {showAddForm && (
        <div className="card-form">
          <div className="card-form-title">
            <span>Record New Sale</span>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Customer Fields */}
            <div className="form-grid-3" style={{ marginBottom: '16px' }}>
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
                <label>
                  Customer Phone Number * (11 digits)
                  {formData.customerNumber && (
                    <span style={{ marginLeft: '6px', color: formData.customerNumber.length === 11 ? 'var(--success-color)' : 'var(--text-muted)' }}>
                      ({formData.customerNumber.length}/11)
                    </span>
                  )}
                </label>
                <input
                  type="tel"
                  maxLength={11}
                  placeholder="e.g. 03001234567"
                  value={formData.customerNumber}
                  onChange={(e) => setFormData({ ...formData, customerNumber: e.target.value.replace(/\D/g, '').slice(0, 11) })}
                />
                {formErrors.customerNumber && <span className="form-field-error">{formErrors.customerNumber}</span>}
              </div>

              <div className="form-field">
                <label>Total Sale Amount (PKR)</label>
                <input
                  type="text"
                  readOnly
                  value={`PKR ${calculateSaleTotal().toLocaleString()}`}
                  style={{ background: '#f8fafc', fontWeight: 700, color: '#059669' }}
                />
              </div>
            </div>

            {/* Multiple Devices Section */}
            <div className="invoice-devices-section">
              <div className="invoice-devices-section-header">
                <span className="invoice-devices-section-title">
                  <Smartphone size={16} /> Devices in Sale
                  <span className="invoice-devices-count-pill">
                    {formData.items.length} {formData.items.length === 1 ? 'Device' : 'Devices'}
                  </span>
                </span>
              </div>

              {formData.items.map((dev, index) => (
                <div key={index} className="invoice-device-card">
                  <div className="invoice-device-header">
                    <div className="invoice-device-title">
                      <span className="invoice-device-badge">#{index + 1}</span>
                      <span>{dev.modelName ? dev.modelName : `Device #${index + 1}`}</span>
                      {dev.price !== '' && !isNaN(dev.price) && (
                        <span style={{ color: '#059669', fontSize: '12px', fontWeight: 700 }}>
                          — PKR {Number(dev.price).toLocaleString()}
                        </span>
                      )}
                    </div>
                    {formData.items.length > 1 && (
                      <button
                        type="button"
                        className="action-btn-danger"
                        onClick={() => handleRemoveDeviceRow(index)}
                        title="Remove device"
                        style={{ padding: '4px 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Trash2 size={12} /> Remove
                      </button>
                    )}
                  </div>

                  {/* Quick Select from In-Stock Inventory for this row */}
                  <div style={{ marginBottom: '12px', background: '#ffffff', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-card)' }}>
                    <SmartDropdown
                      compact
                      label="Quick Select Available Device from Live Inventory"
                      placeholder="Choose an in-stock device — or type details below"
                      searchPlaceholder="Search inventory by model, brand, condition, IMEI..."
                      value={dev.selectedInventoryId || ''}
                      onChange={(selectedId) => {
                        handleDeviceChange(index, 'selectedInventoryId', selectedId);
                        handleSelectInventoryItem(index, selectedId);
                      }}
                      emptyText="No in-stock devices match your search."
                      options={inventoryList
                        .filter((inv) => inv.quantity > 0)
                        .map((inv) => ({
                          value: inv._id,
                          label: inv.modelName,
                          searchText: `${inv.modelName} ${inv.modelNumber || ''} ${inv.companyName || ''} ${inv.category || ''} ${inv.condition || 'New'} ${inv.status || ''} ${inv.price || ''} ${(inv.imeis || []).join(' ')}`,
                          inv,
                        }))}
                      renderSelected={(opt) => (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', width: '100%', flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 700, color: '#090d16', fontSize: '13px', whiteSpace: 'nowrap' }}>
                              {opt.inv.modelName}
                            </span>
                            {opt.inv.modelNumber && (
                              <span style={{ color: '#64748b', fontSize: '12px', whiteSpace: 'nowrap' }}>
                                ({opt.inv.modelNumber})
                              </span>
                            )}
                            <span className={`cell-badge condition-pill ${opt.inv.condition === 'Used' ? 'badge-warning' : 'badge-success'}`} style={{ fontSize: '10px', padding: '1px 6px' }}>
                              {opt.inv.condition || 'New'}
                            </span>
                          </div>
                          <span style={{ fontWeight: 700, color: '#059669', fontSize: '12.5px', flexShrink: 0 }}>
                            PKR {Number(opt.inv.price).toLocaleString()}
                          </span>
                        </div>
                      )}
                      renderOption={(opt) => (
                        <div className="smart-dropdown-grid-sales">
                          <span style={{ fontWeight: 700, fontSize: '13px', color: '#090d16', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {opt.inv.modelName}
                          </span>
                          <span className={`cell-badge condition-pill ${opt.inv.condition === 'Used' ? 'badge-warning' : 'badge-success'}`} style={{ fontSize: '10px', padding: '2px 6px' }}>
                            {opt.inv.condition || 'New'}
                          </span>
                          <span className="smart-dropdown-col-hide-mobile" style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {opt.inv.companyName || opt.inv.category}
                            {opt.inv.status ? ` • ${opt.inv.status}` : ''}
                          </span>
                          <span className="cell-badge badge-success smart-dropdown-col-hide-mobile" style={{ fontSize: '10px', padding: '2px 7px', justifyContent: 'center' }}>
                            • {opt.inv.quantity} in stock
                          </span>
                          <span style={{ fontWeight: 700, fontSize: '12.5px', color: '#059669', whiteSpace: 'nowrap', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            PKR {Number(opt.inv.price).toLocaleString()}
                          </span>
                        </div>
                      )}
                    />
                  </div>

                  <div className="form-grid-3">
                    <div className="form-field">
                      <label>Category *</label>
                      <select
                        value={dev.category}
                        onChange={(e) => handleDeviceChange(index, 'category', e.target.value)}
                      >
                        <option value="Mobile">Mobile</option>
                        <option value="Tablet">Tablet</option>
                        <option value="Accessory">Accessory</option>
                      </select>
                    </div>

                    <div className="form-field">
                      <label>Condition *</label>
                      <select
                        value={dev.condition}
                        onChange={(e) => handleDeviceChange(index, 'condition', e.target.value)}
                      >
                        <option value="New">Brand New</option>
                        <option value="Used">Used / Pre-Owned</option>
                      </select>
                    </div>

                    <div className="form-field">
                      <label>Status *</label>
                      <select
                        value={dev.status || 'PTA'}
                        onChange={(e) => handleDeviceChange(index, 'status', e.target.value)}
                      >
                        <option value="PTA">PTA</option>
                        <option value="JV">JV</option>
                        <option value="Non-PTA">Non-PTA</option>
                        <option value="CPID">CPID</option>
                      </select>
                    </div>

                    <div className="form-field">
                      <label>Model Name *</label>
                      <input
                        type="text"
                        placeholder="e.g. Galaxy S22"
                        value={dev.modelName}
                        onChange={(e) => handleDeviceChange(index, 'modelName', e.target.value)}
                      />
                      {formErrors[`modelName_${index}`] && (
                        <span className="form-field-error">{formErrors[`modelName_${index}`]}</span>
                      )}
                    </div>

                    <div className="form-field">
                      <label>Model Number (Optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. SM-S901B"
                        value={dev.modelNumber}
                        onChange={(e) => handleDeviceChange(index, 'modelNumber', e.target.value)}
                      />
                    </div>

                    <div className="form-field">
                      <label>Sale Price (PKR) *</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={dev.price}
                        onChange={(e) => handleDeviceChange(index, 'price', e.target.value)}
                      />
                      {formErrors[`price_${index}`] && (
                        <span className="form-field-error">{formErrors[`price_${index}`]}</span>
                      )}
                    </div>

                    <div className="form-field">
                      <label>
                        IMEI 1 (Optional - 15 digits)
                        {dev.imei1 && (
                          <span style={{ marginLeft: '6px', color: dev.imei1.length === 15 ? 'var(--success-color)' : 'var(--text-muted)' }}>
                            ({dev.imei1.length}/15)
                          </span>
                        )}
                      </label>
                      <input
                        type="text"
                        maxLength={15}
                        placeholder="15 digits"
                        value={dev.imei1}
                        onChange={(e) => handleDeviceChange(index, 'imei1', e.target.value.replace(/\D/g, ''))}
                      />
                      {formErrors[`imei1_${index}`] && (
                        <span className="form-field-error">{formErrors[`imei1_${index}`]}</span>
                      )}
                    </div>

                    <div className="form-field">
                      <label>
                        IMEI 2 (Optional - 15 digits)
                        {dev.imei2 && (
                          <span style={{ marginLeft: '6px', color: dev.imei2.length === 15 ? 'var(--success-color)' : 'var(--text-muted)' }}>
                            ({dev.imei2.length}/15)
                          </span>
                        )}
                      </label>
                      <input
                        type="text"
                        maxLength={15}
                        placeholder="15 digits"
                        value={dev.imei2}
                        onChange={(e) => handleDeviceChange(index, 'imei2', e.target.value.replace(/\D/g, ''))}
                      />
                      {formErrors[`imei2_${index}`] && (
                        <span className="form-field-error">{formErrors[`imei2_${index}`]}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              <button
                type="button"
                className="btn-add-device"
                onClick={handleAddDeviceRow}
              >
                <Plus size={15} /> Add Another Device
              </button>
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
                  <th style={{ width: '14%' }}>Sale Price</th>
                  <th style={{ width: '11%', textAlign: 'center', paddingRight: '14px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" className="empty-state">Loading sales records...</td>
                  </tr>
                ) : filteredSales.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="empty-state">No sales recorded yet.</td>
                  </tr>
                ) : (
                  filteredSales.map((item) => {
                    const saleDevices =
                      Array.isArray(item.items) && item.items.length > 0 ? item.items : [item];
                    return (
                        <tr key={item._id}>
                          {/* Date */}
                          <td>
                            <span className="cell-mono">
                              {new Date(item.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                          </td>

                          {/* Category */}
                          <td>
                            {saleDevices.length > 1 ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                                {saleDevices.map((d, idx) => (
                                  <span key={idx} className="cell-badge badge-gray category-pill">
                                    {d.category || item.category}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="cell-badge badge-gray category-pill">
                                {saleDevices[0].category || item.category}
                              </span>
                            )}
                          </td>

                          {/* Device(s) */}
                          <td>
                            {saleDevices.length > 1 ? (
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '3px' }}>
                                  <span className="cell-badge badge-gray" style={{ fontWeight: 700 }}>
                                    {saleDevices.length} Devices
                                  </span>
                                </div>
                                <div style={{ fontSize: '12px', color: '#334155', lineHeight: 1.4 }}>
                                  {saleDevices.map((d, idx) => (
                                    <div key={idx}>• {d.modelName}</div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div>
                                <span className="cell-title">{saleDevices[0].modelName}</span>
                                {saleDevices[0].modelNumber && (
                                  <span className="cell-sub">{saleDevices[0].modelNumber}</span>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Condition */}
                          <td>
                            {saleDevices.length > 1 ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                                {saleDevices.map((d, idx) => (
                                  <span
                                    key={idx}
                                    className={`cell-badge condition-pill ${(d.condition || 'New') === 'Used' ? 'badge-warning' : 'badge-success'}`}
                                  >
                                    {d.condition || 'New'}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className={`cell-badge condition-pill ${(saleDevices[0].condition || 'New') === 'Used' ? 'badge-warning' : 'badge-success'}`}>
                                {saleDevices[0].condition || 'New'}
                              </span>
                            )}
                          </td>

                          {/* Customer */}
                          <td>
                            <span className="cell-title">{item.customerName}</span>
                          </td>

                          {/* Price */}
                          <td>
                            <span className="cell-price">
                              PKR {Number(item.price).toLocaleString()}
                            </span>
                          </td>

                          {/* Actions: Spectate Icon & Delete */}
                          <td style={{ textAlign: 'center', paddingRight: '14px' }}>
                            <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                              <button
                                type="button"
                                className="btn-details-toggle"
                                onClick={() => setDetailItem(item)}
                                title="View IMEI & customer details"
                              >
                                <Eye size={13} />
                              </button>
                              <button
                                className="action-btn-danger"
                                onClick={() => handleDelete(item._id, item.modelName)}
                                title="Delete sale and return stock"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                    );
                  })
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
              filteredSales.map((item) => {
                const saleDevices =
                  Array.isArray(item.items) && item.items.length > 0 ? item.items : [item];
                return (
                  <div key={item._id} className="mobile-card">
                    <div className="mobile-card-top">
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div className="mobile-card-title">
                            {saleDevices.length > 1 ? `${saleDevices.length} Devices` : saleDevices[0].modelName}
                          </div>
                          {saleDevices.length === 1 && (
                            <span className={`cell-badge condition-pill ${(saleDevices[0].condition || 'New') === 'Used' ? 'badge-warning' : 'badge-success'}`}>
                              {saleDevices[0].condition || 'New'}
                            </span>
                          )}
                        </div>
                        <div className="mobile-card-subtitle">
                          {saleDevices.length > 1
                            ? saleDevices.map((d) => d.modelName).join(', ')
                            : `${saleDevices[0].modelNumber ? `${saleDevices[0].modelNumber} • ` : ''}${saleDevices[0].category || item.category}`}
                        </div>
                      </div>
                      <div className="mobile-card-price">
                        PKR {Number(item.price).toLocaleString()}
                      </div>
                    </div>

                    <div className="mobile-card-meta-grid">
                      <div className="mobile-meta-cell">
                        <div className="mobile-meta-label">Customer</div>
                        <div className="mobile-meta-val">
                          <strong>{item.customerName}</strong>
                        </div>
                      </div>

                      <div className="mobile-meta-cell">
                        <div className="mobile-meta-label">Date</div>
                        <div className="mobile-meta-val">
                          {new Date(item.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </div>
                      </div>
                    </div>

                    <div className="mobile-card-actions">
                      <button
                        type="button"
                        className="btn-details-toggle"
                        style={{ flex: 1, minHeight: '38px', justifyContent: 'center' }}
                        onClick={() => setDetailItem(item)}
                        title="View details"
                      >
                        <Eye size={14} /><span className="view-label"> View Details</span>
                      </button>
                      <button
                        className="action-btn-danger"
                        style={{ minHeight: '38px' }}
                        onClick={() => handleDelete(item._id, item.modelName)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 4. Sale Details Popup Modal */}
      <DetailModal
        isOpen={Boolean(detailItem)}
        onClose={() => setDetailItem(null)}
        icon={Tag}
        title={
          detailItem
            ? Array.isArray(detailItem.items) && detailItem.items.length > 1
              ? `${detailItem.items.length} Devices Sold`
              : detailItem.modelName
            : 'Sale Details'
        }
        subtitle={
          detailItem
            ? `${new Date(detailItem.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} • Total: PKR ${Number(detailItem.price).toLocaleString()}`
            : ''
        }
      >
        {detailItem && (() => {
          const modalDevices =
            Array.isArray(detailItem.items) && detailItem.items.length > 0
              ? detailItem.items
              : [detailItem];
          return (
            <>
              <div className="expanded-detail-card">
                <div className="expanded-detail-header">
                  <Smartphone size={13} /> Device &amp; Identifiers
                </div>
                {modalDevices.map((d, dIdx) => (
                  <div
                    key={dIdx}
                    style={
                      modalDevices.length > 1
                        ? { borderBottom: dIdx < modalDevices.length - 1 ? '1px dashed #e2e8f0' : 'none', paddingBottom: '8px', marginBottom: '8px' }
                        : {}
                    }
                  >
                    <div className="expanded-info-row">
                      <span className="expanded-info-label">
                        {modalDevices.length > 1 ? `Device #${dIdx + 1}:` : 'Model Name:'}
                      </span>
                      <span className="expanded-info-val">{d.modelName}</span>
                    </div>
                    <div className="expanded-info-row">
                      <span className="expanded-info-label">Model Number:</span>
                      <span className="expanded-info-val">{d.modelNumber || '—'}</span>
                    </div>
                    <div className="expanded-info-row">
                      <span className="expanded-info-label">Category / Cond:</span>
                      <span className="expanded-info-val">{d.category || detailItem.category} • {d.condition || 'New'}</span>
                    </div>
                    <div className="expanded-info-row">
                      <span className="expanded-info-label">Status:</span>
                      <span className="expanded-info-val">{d.status || detailItem.status || 'PTA'}</span>
                    </div>
                    <div className="expanded-info-row">
                      <span className="expanded-info-label">IMEI 1:</span>
                      <span className="expanded-info-val">{d.imei1 || '—'}</span>
                    </div>
                    <div className="expanded-info-row">
                      <span className="expanded-info-label">IMEI 2:</span>
                      <span className="expanded-info-val">{d.imei2 || '—'}</span>
                    </div>
                    {modalDevices.length > 1 && (
                      <div className="expanded-info-row">
                        <span className="expanded-info-label">Price:</span>
                        <span className="expanded-info-val">PKR {Number(d.price).toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="expanded-detail-card">
                <div className="expanded-detail-header">
                  <User size={13} /> Customer Identity
                </div>
                <div className="expanded-info-row">
                  <span className="expanded-info-label">Full Name:</span>
                  <span className="expanded-info-val">{detailItem.customerName}</span>
                </div>
                <div className="expanded-info-row">
                  <span className="expanded-info-label">Phone Number:</span>
                  <span className="expanded-info-val" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Phone size={11} style={{ color: '#64748b', flexShrink: 0 }} />
                    {detailItem.customerNumber}
                  </span>
                </div>
              </div>
            </>
          );
        })()}
      </DetailModal>
    </div>
  );
};

export default Sales;
