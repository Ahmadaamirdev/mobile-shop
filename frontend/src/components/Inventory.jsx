import React, { useState, useEffect } from 'react';
import { getInventory, createInventoryItem, deleteInventoryItem } from '../services/api';
import { Trash2, Search, Plus, Package } from 'lucide-react';

const Inventory = ({ setAlert }) => {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showAddForm, setShowAddForm] = useState(false);

  // Manual addition form state
  const [formData, setFormData] = useState({
    category: 'Mobile',
    companyName: '',
    modelName: '',
    modelNumber: '',
    quantity: 1,
    price: '',
  });

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const res = await getInventory({
        category: selectedCategory === 'All' ? '' : selectedCategory,
        search,
      });
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
  }, [selectedCategory, search]);

  const handleManualAdd = async (e) => {
    e.preventDefault();
    if (!formData.modelName.trim() || !formData.modelNumber.trim()) {
      setAlert({
        type: 'error',
        message: 'Model name and model number are required.',
      });
      return;
    }

    try {
      await createInventoryItem({
        ...formData,
        quantity: Number(formData.quantity) || 1,
        price: Number(formData.price) || 0,
      });
      setAlert({
        type: 'success',
        message: 'Item added successfully',
      });
      setFormData({
        category: 'Mobile',
        companyName: '',
        modelName: '',
        modelNumber: '',
        quantity: 1,
        price: '',
      });
      setShowAddForm(false);
      fetchInventory();
    } catch (err) {
      setAlert({
        type: 'error',
        message: err.response?.data?.message || 'Failed to add item to inventory.',
      });
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
      fetchInventory();
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
                placeholder="Search inventory by model, brand, IMEI..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2. Collapsible Add Item Form */}
      {showAddForm && (
        <div className="card-form">
          <div className="card-form-title">
            <span>Manual Inventory Entry</span>
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
                <label>Company / Brand</label>
                <input
                  type="text"
                  placeholder="e.g. Samsung, Apple, Faster"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                />
              </div>

              <div className="form-field">
                <label>Model Name *</label>
                <input
                  type="text"
                  placeholder="e.g. iPhone 13 Pro"
                  value={formData.modelName}
                  onChange={(e) => setFormData({ ...formData, modelName: e.target.value })}
                  required
                />
              </div>

              <div className="form-field">
                <label>Model Number *</label>
                <input
                  type="text"
                  placeholder="e.g. A2638"
                  value={formData.modelNumber}
                  onChange={(e) => setFormData({ ...formData, modelNumber: e.target.value })}
                  required
                />
              </div>

              <div className="form-field">
                <label>Quantity *</label>
                <input
                  type="number"
                  min="0"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  required
                />
              </div>

              <div className="form-field">
                <label>Unit Price (PKR) *</label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  required
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
              <button type="submit" className="btn-primary">
                Save to Inventory
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
                <th style={{ width: '12%' }}>Category</th>
                <th style={{ width: '14%' }}>Brand</th>
                <th style={{ width: '25%' }}>Model Name &amp; Number</th>
                <th style={{ width: '14%' }}>Stock Status</th>
                <th style={{ width: '17%' }}>Active IMEIs</th>
                <th style={{ width: '12%' }}>Unit Price</th>
                <th style={{ width: '6%', textAlign: 'center', paddingRight: '14px' }}></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="empty-state">Loading inventory...</td>
                </tr>
              ) : inventory.length === 0 ? (
                <tr>
                  <td colSpan="7" className="empty-state">No items found in stock.</td>
                </tr>
              ) : (
                inventory.map((item) => (
                  <tr key={item._id}>
                    {/* Category */}
                    <td>
                      <span className="cell-badge badge-gray">{item.category}</span>
                    </td>

                    {/* Brand */}
                    <td>
                      <span className="cell-title">{item.companyName || '—'}</span>
                    </td>

                    {/* Model */}
                    <td>
                      <span className="cell-title">{item.modelName}</span>
                      <span className="cell-sub">{item.modelNumber}</span>
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

                    {/* Active IMEIs */}
                    <td>
                      {item.imeis && item.imeis.length > 0 ? (
                        <div className="cell-mono" style={{ fontSize: '12.5px', fontWeight: 700, color: '#090d16' }}>
                          {item.imeis.slice(0, 2).map((im, idx) => (
                            <div key={idx}>{im}</div>
                          ))}
                          {item.imeis.length > 2 && (
                            <span className="cell-sub">+{item.imeis.length - 2} more</span>
                          )}
                        </div>
                      ) : (
                        <span className="cell-sub">—</span>
                      )}
                    </td>

                    {/* Price */}
                    <td>
                      <span className="cell-price">
                        PKR {Number(item.price).toLocaleString()}
                      </span>
                    </td>

                    {/* Action */}
                    <td style={{ textAlign: 'center', paddingRight: '14px' }}>
                      <button
                        className="action-btn-danger"
                        onClick={() => handleDelete(item._id, item.modelName)}
                        title="Delete inventory item"
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
            <div className="empty-state">Loading inventory...</div>
          ) : inventory.length === 0 ? (
            <div className="empty-state">No items in inventory.</div>
          ) : (
            inventory.map((item) => (
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
                    <div className="mobile-meta-label">Stock Status</div>
                    <div className="mobile-meta-val">
                      {item.quantity > 0 ? (
                        <span style={{ color: 'var(--success-color)' }}>{item.quantity} In Stock</span>
                      ) : (
                        <span style={{ color: 'var(--danger-color)' }}>Out of Stock</span>
                      )}
                    </div>
                  </div>

                  {item.imeis && item.imeis.length > 0 && (
                    <div className="mobile-meta-cell full-width">
                      <div className="mobile-meta-label">Active IMEIs</div>
                      <div className="mobile-meta-val" style={{ fontFamily: 'monospace', fontSize: '11px' }}>
                        {item.imeis.join(', ')}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mobile-card-actions">
                  <button
                    className="action-btn-danger"
                    style={{ width: '100%', minHeight: '44px' }}
                    onClick={() => handleDelete(item._id, item.modelName)}
                  >
                    <Trash2 size={13} /> Delete from Inventory
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

export default Inventory;
