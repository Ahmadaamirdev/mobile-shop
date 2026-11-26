import React, { useState, useEffect } from 'react';
import { getInventory, createInventoryItem, deleteInventoryItem } from '../services/api';
import { Trash2, Search, Plus, Package, Eye, Smartphone } from 'lucide-react';
import DetailModal from './DetailModal';

const Inventory = ({ isActive, setAlert }) => {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedCondition, setSelectedCondition] = useState('All'); // 'All' | 'New' | 'Used'
  const [showAddForm, setShowAddForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [detailItem, setDetailItem] = useState(null);

  // Manual addition form state
  const [formData, setFormData] = useState({
    category: 'Mobile',
    condition: 'New',
    status: 'PTA',
    companyName: '',
    modelName: '',
    modelNumber: '',
    quantity: 1,
    price: '',
    imei1: '',
    imei2: '',
    serialNumber: '',
    customerName: '',
    customerPhone: '',
    customerIdCard: '',
    customerAddress: '',
  });

  const fetchInventory = async (force = false) => {
    setLoading(true);
    try {
      const res = await getInventory({}, force);
      if (res.data && res.data.data) {
        setInventory(res.data.data.filter((item) => item.quantity > 0));
      }
    } catch (err) {
      setAlert({
        type: 'error',
        message: err.response?.data?.message || 'Error fetching inventory.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  useEffect(() => {
    if (isActive) {
      setShowAddForm(false);
      fetchInventory();
    }
  }, [isActive]);

  const filteredInventory = inventory.filter((item) => {
    const categoryMatch = selectedCategory === 'All' || item.category?.toLowerCase() === selectedCategory.toLowerCase();
    const conditionMatch = selectedCondition === 'All' || (item.condition || 'New').toLowerCase() === selectedCondition.toLowerCase();
    if (!search.trim()) return categoryMatch && conditionMatch;
    const term = search.trim().toLowerCase();
    const searchMatch = (
      item.modelName?.toLowerCase().includes(term) ||
      item.modelNumber?.toLowerCase().includes(term) ||
      item.companyName?.toLowerCase().includes(term) ||
      item.category?.toLowerCase().includes(term) ||
      (item.condition || 'New').toLowerCase().includes(term) ||
      (item.status || 'PTA').toLowerCase().includes(term) ||
      (item.imeis && item.imeis.some((im) => im.toLowerCase().includes(term)))
    );
    return categoryMatch && conditionMatch && searchMatch;
  });

  const handleManualAdd = async (e) => {
    e.preventDefault();
    if (submitting) return;
    if (formData.category !== 'Accessory' && !formData.modelName.trim()) {
      setAlert({
        type: 'error',
        message: 'Model name is required.',
      });
      return;
    }
    if (formData.customerPhone.trim() && !/^\d{11}$/.test(formData.customerPhone.trim())) {
      setAlert({
        type: 'error',
        message: 'Supplier phone number must contain exactly 11 digits.',
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await createInventoryItem({
        ...formData,
        quantity: Number(formData.quantity) || 1,
        price: Number(formData.price) || 0,
      });
      setAlert({
        type: 'success',
        message: res.data?.message || 'Item added to inventory & recorded in purchase registry.',
      });
      setFormData({
        category: 'Mobile',
        condition: 'New',
        status: 'PTA',
        companyName: '',
        modelName: '',
        modelNumber: '',
        quantity: 1,
        price: '',
        imei1: '',
        imei2: '',
        serialNumber: '',
        customerName: '',
        customerPhone: '',
        customerIdCard: '',
        customerAddress: '',
      });
      setShowAddForm(false);
      fetchInventory(true);
    } catch (err) {
      setAlert({
        type: 'error',
        message: err.response?.data?.message || 'Failed to add item to inventory.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id, modelName) => {
    if (!window.confirm(`Are you sure you want to remove ${modelName} from inventory?`)) return;
    try {
      await deleteInventoryItem(id);
      setAlert({
        type: 'success',
        message: 'Item deleted successfully',
      });
      fetchInventory(true);
    } catch (err) {
      setAlert({
        type: 'error',
        message: err.response?.data?.message || 'Failed to delete inventory item.',
      });
    }
  };

  return (
    <div>
      {/* 1. Header Card (Reference: Al Haditha Top Card) */}
      <div className="panel-header-card">
        <div className="panel-header-row">
          <div className="panel-header-left">
            <div className="panel-icon-box">
              <Package size={18} />
            </div>
            <div className="panel-header-text">
              <h2>Inventory &amp; Stock Registry</h2>
              <p>Real-time shop inventory, stock availability, active IMEIs &amp; unit pricing.</p>
            </div>
          </div>
          <div>
            <button
              className="btn-primary"
              onClick={() => setShowAddForm(!showAddForm)}
            >
              <Plus size={15} />
              {showAddForm ? 'Close Form' : 'Add Item'}
            </button>
          </div>
        </div>

        {/* Toolbar: Category Filters on Left, Subfilter for Condition, Search on Right (Hidden when form is open) */}
        {!showAddForm && (
          <div className="panel-toolbar-row" style={{ flexWrap: 'wrap', gap: '10px' }}>
            {/* Desktop: pill buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {/* Primary Category Filter Pills */}
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

              <div className="filter-divider hide-on-mobile" />

              {/* Subfilter: Device Condition (All / New / Used) */}
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
            </div>

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

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="panel-search-box">
                <Search size={14} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search inventory by model, brand, IMEI..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. Collapsible Add Item Form */}
      {showAddForm && (
        <div className="card-form">
          <div className="card-form-title" style={{ display: 'flex', flexDirection: 'column' }}>
            <span>Manual Inventory Entry</span>
            <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 400, marginTop: '2px' }}>
              Items added here are automatically synchronized and recorded into the Purchase registry.
            </span>
          </div>
          <form onSubmit={handleManualAdd}>
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
                <label>Company / Brand</label>
                <input
                  type="text"
                  placeholder="e.g. Samsung, Apple, Faster"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                />
              </div>

              <div className="form-field">
                <label>Model Name {formData.category !== 'Accessory' ? '*' : '(Optional)'}</label>
                <input
                  type="text"
                  placeholder="e.g. iPhone 13 Pro"
                  value={formData.modelName}
                  onChange={(e) => setFormData({ ...formData, modelName: e.target.value })}
                  required={formData.category !== 'Accessory'}
                />
              </div>

              <div className="form-field">
                <label>Model Number (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. A2638"
                  value={formData.modelNumber}
                  onChange={(e) => setFormData({ ...formData, modelNumber: e.target.value })}
                />
              </div>

              <div className="form-field">
                <label>Quantity {formData.category !== 'Accessory' ? '*' : '(Optional)'}</label>
                <input
                  type="number"
                  min="1"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  required={formData.category !== 'Accessory'}
                />
              </div>

              <div className="form-field">
                <label>Unit Purchase Price (PKR) {formData.category !== 'Accessory' ? '*' : '(Optional)'}</label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  required={formData.category !== 'Accessory'}
                />
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
                <label>Supplier / Vendor Name (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Direct Stock / Official Distributor"
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                />
              </div>

              <div className="form-field">
                <label>Supplier Contact Phone (Optional - 11 digits)</label>
                <input
                  type="tel"
                  maxLength={11}
                  placeholder="e.g. 03001234567"
                  value={formData.customerPhone}
                  onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value.replace(/\D/g, '').slice(0, 11) })}
                />
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
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? 'Saving...' : 'Save to Inventory'}
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
                <th style={{ width: '11%' }}>Category</th>
                <th style={{ width: '18%' }}>Device Model</th>
                <th style={{ width: '13%' }}>Model No.</th>
                <th style={{ width: '11%' }}>Condition</th>
                <th style={{ width: '11%', textAlign: 'center' }}>Status</th>
                <th style={{ width: '13%' }}>Stock Status</th>
                <th style={{ width: '12%' }}>Unit Price</th>
                <th style={{ width: '11%', textAlign: 'center', paddingRight: '14px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="empty-state">Loading inventory...</td>
                </tr>
              ) : filteredInventory.length === 0 ? (
                <tr>
                  <td colSpan="8" className="empty-state">No items found matching the selected filters.</td>
                </tr>
              ) : (
                filteredInventory.map((item) => (
                    <tr key={item._id}>
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

                      {/* Model No. */}
                      <td>
                        <span className="cell-mono" style={{ fontSize: '12.5px', color: '#334155', fontWeight: 600 }}>
                          {item.modelNumber || '—'}
                        </span>
                      </td>

                      {/* Condition */}
                      <td>
                        <span className={`cell-badge condition-pill ${item.condition === 'Used' ? 'badge-warning' : 'badge-success'}`}>
                          {item.condition || 'New'}
                        </span>
                      </td>

                      {/* Status (PTA / JV / Non-PTA / CPID) */}
                      <td style={{ textAlign: 'center' }}>
                        <span className="cell-badge badge-gray" style={{ minWidth: '64px', justifyContent: 'center' }}>
                          {item.status || 'PTA'}
                        </span>
                      </td>

                      {/* Stock Status */}
                      <td>
                        {item.quantity > 0 ? (
                          <span className="cell-badge badge-success">
                            • {item.quantity} in stock
                          </span>
                        ) : (
                          <span className="cell-badge badge-danger">
                            • Out of stock
                          </span>
                        )}
                      </td>

                      {/* Price */}
                      <td>
                        <span className="cell-price">
                          PKR {Number(item.price).toLocaleString()}
                        </span>
                      </td>

                      {/* Actions: Spectate & Delete */}
                      <td style={{ textAlign: 'center', paddingRight: '14px' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn-details-toggle"
                            onClick={() => setDetailItem(item)}
                            title="View brand, model number & IMEIs"
                          >
                            <Eye size={13} />
                          </button>
                          <button
                            className="action-btn-danger"
                            onClick={() => handleDelete(item._id, item.modelName)}
                            title="Delete inventory item"
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
            <div className="empty-state">Loading inventory...</div>
          ) : filteredInventory.length === 0 ? (
            <div className="empty-state">No items found matching the selected filters.</div>
          ) : (
            filteredInventory.map((item) => (
              <div key={item._id} className="mobile-card">
                <div className="mobile-card-top">
                  <div>
                    <div className="mobile-card-title">{item.modelName}</div>
                    <div className="mobile-card-subtitle">{item.companyName}{item.modelNumber ? ` • ${item.modelNumber}` : ''}</div>
                  </div>
                  <div className="mobile-card-price">
                    PKR {Number(item.price).toLocaleString()}
                  </div>
                </div>

                <div className="mobile-card-meta-grid">
                  <div className="mobile-meta-cell">
                    <div className="mobile-meta-label">Category / Condition / Status</div>
                    <div className="mobile-meta-val" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span className="cell-badge badge-gray category-pill">{item.category}</span>
                      <span className={`cell-badge condition-pill ${item.condition === 'Used' ? 'badge-warning' : 'badge-success'}`}>
                        {item.condition || 'New'}
                      </span>
                      <span className="cell-badge badge-gray" style={{ minWidth: '54px', justifyContent: 'center' }}>
                        {item.status || 'PTA'}
                      </span>
                    </div>
                  </div>

                  <div className="mobile-meta-cell">
                    <div className="mobile-meta-label">Stock Status</div>
                    <div className="mobile-meta-val">
                      {item.quantity > 0 ? (
                        <span style={{ color: 'var(--success-color)' }}>{item.quantity} In Stock</span>
                      ) : (
                        <span style={{ color: 'var(--danger-color)' }}>Out of Stock</span>
                      )}
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
            ))
          )}
        </div>
      </div>
    )}

    {/* 4. Inventory Details Popup Modal */}
    <DetailModal
      isOpen={Boolean(detailItem)}
      onClose={() => setDetailItem(null)}
      icon={Package}
      title={detailItem?.modelName || 'Inventory Details'}
      subtitle={
        detailItem
          ? `${detailItem.companyName || detailItem.category} • ${detailItem.quantity} in stock • PKR ${Number(detailItem.price).toLocaleString()}`
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
              <Smartphone size={13} /> Device Specifications
            </div>
            <div className="expanded-info-row">
              <span className="expanded-info-label">Brand / Company:</span>
              <span className="expanded-info-val">{detailItem.companyName || '—'}</span>
            </div>
            <div className="expanded-info-row">
              <span className="expanded-info-label">Model Name:</span>
              <span className="expanded-info-val">{detailItem.modelName}</span>
            </div>
            <div className="expanded-info-row">
              <span className="expanded-info-label">Model Number:</span>
              <span className="expanded-info-val">{detailItem.modelNumber || '—'}</span>
            </div>
            <div className="expanded-info-row">
              <span className="expanded-info-label">Category &amp; Condition:</span>
              <span className="expanded-info-val">{detailItem.category} • {detailItem.condition || 'New'}</span>
            </div>
            <div className="expanded-info-row">
              <span className="expanded-info-label">Status:</span>
              <span className="expanded-info-val">{detailItem.status || 'PTA'}</span>
            </div>
          </div>

          <div className="expanded-detail-card">
            <div className="expanded-detail-header">
              <Package size={13} /> Active IMEIs in Stock
            </div>
            {detailItem.imeis && detailItem.imeis.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {detailItem.imeis.map((im, idx) => (
                  <div key={idx} className="expanded-info-row">
                    <span className="expanded-info-label">IMEI #{idx + 1}:</span>
                    <span className="expanded-info-val">{im}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                No IMEIs recorded for this item.
              </div>
            )}
          </div>
        </>
      )}
    </DetailModal>
  </div>
  );
};

export default Inventory;
