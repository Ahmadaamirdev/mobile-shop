import React, { useState, useEffect } from 'react';
import { getInventory, createInventoryItem, deleteInventoryItem } from '../services/api';
import { Trash2 } from 'lucide-react';

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
        setInventory(res.data.data);
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
        message: 'Item manually added to inventory.',
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
        message: 'Item removed from inventory.',
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
    <div className="section-container">
      <div className="section-toolbar">
        <h2 className="section-title">Inventory</h2>
        <div className="filter-bar">
          <input
            type="text"
            className="search-input"
            placeholder="Search by model, brand, IMEI..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="select-input"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="All">All Categories</option>
            <option value="Mobile">Mobiles</option>
            <option value="Tablet">Tablets</option>
            <option value="Accessory">Accessories</option>
          </select>
          <button
            className="btn btn-primary"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            {showAddForm ? 'Cancel' : '+ Add Manual Item'}
          </button>
        </div>
      </div>

      {showAddForm && (
        <div className="card">
          <h3 className="card-title">Manual Inventory Entry</h3>
          <form onSubmit={handleManualAdd}>
            <div className="form-grid">
              <div className="form-group">
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

              <div className="form-group">
                <label>Company / Brand</label>
                <input
                  type="text"
                  placeholder="e.g. Samsung, Apple, Faster"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Model Name *</label>
                <input
                  type="text"
                  placeholder="e.g. iPhone 13 Pro"
                  value={formData.modelName}
                  onChange={(e) => setFormData({ ...formData, modelName: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Model Number *</label>
                <input
                  type="text"
                  placeholder="e.g. A2638"
                  value={formData.modelNumber}
                  onChange={(e) => setFormData({ ...formData, modelNumber: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Quantity *</label>
                <input
                  type="number"
                  min="0"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Price (PKR) *</label>
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

            <div className="form-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowAddForm(false)}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Save to Inventory
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Mobile Card List (Screen <= 768px) */}
      <div className="mobile-only">
        {loading ? (
          <div className="empty-state">Loading inventory...</div>
        ) : inventory.length === 0 ? (
          <div className="empty-state">No inventory items found.</div>
        ) : (
          <div className="mobile-card-list">
            {inventory.map((item) => (
              <div key={item._id} className="mobile-card">
                <div className="mobile-card-header">
                  <div>
                    <div className="mobile-card-title">{item.modelName}</div>
                    <div className="mobile-card-subtitle">
                      {item.companyName || '-'} • {item.modelNumber} • {item.category}
                    </div>
                  </div>
                  <div className="mobile-card-price">
                    PKR {Number(item.price).toLocaleString()}
                  </div>
                </div>

                <div className="mobile-card-details">
                  <div className="mobile-detail-item">
                    <span className="mobile-detail-label">Stock Status</span>
                    <span
                      className="mobile-detail-value"
                      style={{
                        fontWeight: 700,
                        color: item.quantity > 0 ? 'var(--success)' : 'var(--danger)',
                      }}
                    >
                      {item.quantity > 0 ? `${item.quantity} in stock` : 'Out of Stock'}
                    </span>
                  </div>
                  <div className="mobile-detail-item">
                    <span className="mobile-detail-label">Category</span>
                    <span className="mobile-detail-value">{item.category}</span>
                  </div>
                  {item.imeis && item.imeis.length > 0 && (
                    <div className="mobile-detail-item" style={{ gridColumn: 'span 2' }}>
                      <span className="mobile-detail-label">Stock IMEIs</span>
                      <span className="mobile-detail-value mono-text">
                        {item.imeis.map((im) => (
                          <div key={im}>{im}</div>
                        ))}
                      </span>
                    </div>
                  )}
                </div>

                <div className="mobile-card-actions">
                  <button
                    className="btn btn-danger btn-block btn-sm"
                    onClick={() => handleDelete(item._id, item.modelName)}
                  >
                    <Trash2 size={15} /> Delete Item
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Desktop Responsive Table (Screen > 768px) */}
      <div className="table-container desktop-only">
        <table className="data-table">
          <thead>
            <tr>
              <th>Model Name & Category</th>
              <th>Model Number</th>
              <th>Stock Status</th>
              <th>Price</th>
              <th>Available IMEIs</th>
              <th style={{ textAlign: 'center', width: '80px' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" className="empty-state">Loading inventory...</td>
              </tr>
            ) : inventory.length === 0 ? (
              <tr>
                <td colSpan="6" className="empty-state">No inventory items found.</td>
              </tr>
            ) : (
              inventory.map((item) => (
                <tr key={item._id}>
                  <td>
                    <strong>{item.modelName}</strong>
                    <div className="hint">{item.companyName || '-'} • {item.category}</div>
                  </td>
                  <td>{item.modelNumber}</td>
                  <td>
                    <span style={{ fontWeight: 600, color: item.quantity > 0 ? 'var(--success)' : 'var(--danger)' }}>
                      {item.quantity} {item.quantity === 0 ? '(Out of Stock)' : 'units'}
                    </span>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <strong>PKR {Number(item.price).toLocaleString()}</strong>
                  </td>
                  <td className="mono-text">
                    {item.imeis && item.imeis.length > 0
                      ? item.imeis.map((im) => <div key={im}>{im}</div>)
                      : '-'}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDelete(item._id, item.modelName)}
                      title="Delete item"
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
  );
};

export default Inventory;
