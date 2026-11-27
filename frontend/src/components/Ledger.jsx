import React, { useState, useEffect, useCallback } from 'react';
import {
  getLedgerParties,
  getLedgerPartyStatement,
  createLedgerParty,
  deleteLedgerParty,
  addLedgerEntry,
  deleteLedgerEntry,
} from '../services/api';
import {
  BookOpen,
  Plus,
  Search,
  ArrowLeft,
  ArrowUpRight,
  RotateCcw,
  Wallet,
  Trash2,
  Phone,
  Users,
  CheckCircle2,
  X,
} from 'lucide-react';

const formatCurrency = (val) => `PKR ${Number(val || 0).toLocaleString()}`;

const formatDateTime = (dateVal) => {
  if (!dateVal) return '—';
  return new Date(dateVal).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const getLocalTodayStr = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const Ledger = ({ isActive, setAlert }) => {
  const [suppliers, setSuppliers] = useState([]);
  const [summary, setSummary] = useState({
    totalPayable: 0,
    pendingSuppliers: 0,
    totalPaid: 0,
    totalBilled: 0,
    totalReturned: 0,
    totalSuppliers: 0,
  });
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('All');
  const [search, setSearch] = useState('');

  // Create Supplier form state
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [supplierForm, setSupplierForm] = useState({
    name: '',
    phone: '',
    address: '',
    notes: '',
  });
  const [submittingSupplier, setSubmittingSupplier] = useState(false);

  // Selected Supplier Statement state
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loadingStatement, setLoadingStatement] = useState(false);

  // Active transaction panel: null | 'PURCHASE' | 'PAYMENT' | 'RETURN'
  const [activeAction, setActiveAction] = useState(null);
  const [submittingEntry, setSubmittingEntry] = useState(false);
  const [entryForm, setEntryForm] = useState({
    category: 'Tablet',
    condition: 'New',
    status: 'PTA',
    companyName: '',
    modelName: '',
    quantity: 1,
    totalAmount: '',
    paidAmount: '',
    paymentMethod: 'Cash',
    note: '',
    occurredAt: getLocalTodayStr(),
  });

  const fetchSuppliers = useCallback(
    async (force = false) => {
      setLoading(true);
      try {
        const res = await getLedgerParties(
          {
            status: statusFilter,
            search: search.trim(),
          },
          force
        );
        if (res.data) {
          setSuppliers(res.data.data || []);
          if (res.data.summary) setSummary(res.data.summary);
        }
      } catch (err) {
        if (setAlert) {
          setAlert({
            type: 'error',
            message: err.response?.data?.message || 'Error loading supplier ledger.',
          });
        }
      } finally {
        setLoading(false);
      }
    },
    [statusFilter, search, setAlert]
  );

  const fetchStatement = useCallback(
    async (supplierId, force = false) => {
      if (!supplierId) return;
      setLoadingStatement(true);
      try {
        const res = await getLedgerPartyStatement(supplierId, force);
        if (res.data?.data) {
          setSelectedSupplier(res.data.data.party);
          setEntries(res.data.data.entries || []);
        }
      } catch (err) {
        if (setAlert) {
          setAlert({
            type: 'error',
            message: err.response?.data?.message || 'Error loading supplier statement.',
          });
        }
      } finally {
        setLoadingStatement(false);
      }
    },
    [setAlert]
  );

  useEffect(() => {
    if (isActive) {
      fetchSuppliers(false);
      if (selectedSupplier?._id) {
        fetchStatement(selectedSupplier._id, false);
      }
    }
  }, [isActive, fetchSuppliers]);

  useEffect(() => {
    const handleSync = () => {
      fetchSuppliers(true);
      if (selectedSupplier?._id) {
        fetchStatement(selectedSupplier._id, true);
      }
    };
    window.addEventListener('unity-data-updated', handleSync);
    return () => window.removeEventListener('unity-data-updated', handleSync);
  }, [fetchSuppliers, fetchStatement, selectedSupplier]);

  const handleCreateSupplier = async (e) => {
    e.preventDefault();
    if (!supplierForm.name.trim()) {
      setAlert({ type: 'error', message: 'Supplier name is required.' });
      return;
    }
    if (supplierForm.phone.trim() && !/^\d{11}$/.test(supplierForm.phone.trim())) {
      setAlert({ type: 'error', message: 'Phone number must contain 11 digits.' });
      return;
    }
    setSubmittingSupplier(true);
    try {
      const res = await createLedgerParty(supplierForm);
      setAlert({ type: 'success', message: res.data?.message || 'Supplier account created.' });
      setSupplierForm({ name: '', phone: '', address: '', notes: '' });
      setShowAddSupplier(false);
      await fetchSuppliers(true);
      if (res.data?.data?._id) {
        fetchStatement(res.data.data._id, true);
      }
    } catch (err) {
      setAlert({
        type: 'error',
        message: err.response?.data?.message || 'Failed to create supplier account.',
      });
    } finally {
      setSubmittingSupplier(false);
    }
  };

  const handleDeleteSupplier = async (supplier) => {
    if (!window.confirm(`Delete supplier "${supplier.name}" and all their ledger entries?`)) return;
    try {
      await deleteLedgerParty(supplier._id);
      setAlert({ type: 'success', message: `Deleted "${supplier.name}" from ledger.` });
      if (selectedSupplier?._id === supplier._id) {
        setSelectedSupplier(null);
        setEntries([]);
      }
      fetchSuppliers(true);
    } catch (err) {
      setAlert({
        type: 'error',
        message: err.response?.data?.message || 'Failed to delete supplier account.',
      });
    }
  };

  const openActionForm = (actionType) => {
    setActiveAction(actionType);
    setEntryForm({
      category: 'Tablet',
      condition: 'New',
      status: 'PTA',
      companyName: '',
      modelName: '',
      quantity: 1,
      totalAmount: '',
      paidAmount: '',
      paymentMethod: 'Cash',
      note: '',
      occurredAt: getLocalTodayStr(),
    });
  };

  const handleSubmitEntry = async (e) => {
    e.preventDefault();
    if (!selectedSupplier || !activeAction || submittingEntry) return;

    const total = Number(entryForm.totalAmount);
    if (isNaN(total) || total <= 0) {
      setAlert({ type: 'error', message: 'Please enter a valid amount greater than 0.' });
      return;
    }

    const paid = entryForm.paidAmount === '' ? 0 : Number(entryForm.paidAmount);
    if (activeAction === 'PURCHASE' && (isNaN(paid) || paid < 0 || paid > total)) {
      setAlert({ type: 'error', message: 'Paid amount must be between 0 and total purchase bill.' });
      return;
    }

    setSubmittingEntry(true);
    try {
      const payload = {
        entryType: activeAction,
        totalAmount: total,
        paidAmount: activeAction === 'PAYMENT' ? total : paid,
        paymentMethod: entryForm.paymentMethod,
        note: entryForm.note,
        occurredAt: entryForm.occurredAt ? new Date(`${entryForm.occurredAt}T12:00:00`).toISOString() : undefined,
      };

      if (activeAction !== 'PAYMENT') {
        if (!entryForm.modelName.trim() && entryForm.category !== 'Accessory') {
          setAlert({ type: 'error', message: 'Model / Item name is required.' });
          setSubmittingEntry(false);
          return;
        }
        payload.category = entryForm.category;
        payload.condition = entryForm.condition;
        payload.status = entryForm.status;
        payload.companyName = entryForm.companyName;
        payload.modelName = entryForm.modelName.trim() || 'Accessory';
        payload.quantity = Math.max(1, Number(entryForm.quantity) || 1);
      }

      const res = await addLedgerEntry(selectedSupplier._id, payload);
      setAlert({
        type: 'success',
        message: res.data?.message || 'Supplier ledger updated and synced.',
      });
      setActiveAction(null);
      await Promise.all([fetchStatement(selectedSupplier._id, true), fetchSuppliers(true)]);
    } catch (err) {
      setAlert({
        type: 'error',
        message: err.response?.data?.message || 'Failed to record supplier transaction.',
      });
    } finally {
      setSubmittingEntry(false);
    }
  };

  const handleDeleteEntry = async (entryId) => {
    if (!window.confirm('Delete this ledger entry? Linked stock and supplier balance will be updated.')) return;
    try {
      await deleteLedgerEntry(entryId);
      setAlert({ type: 'success', message: 'Entry removed and synced.' });
      if (selectedSupplier?._id) {
        await Promise.all([fetchStatement(selectedSupplier._id, true), fetchSuppliers(true)]);
      }
    } catch (err) {
      setAlert({
        type: 'error',
        message: err.response?.data?.message || 'Failed to delete entry.',
      });
    }
  };

  const getEntryBadge = (type) => {
    switch (type) {
      case 'PURCHASE':
        return { label: 'Purchase', cls: 'badge-warning' };
      case 'PAYMENT':
        return { label: 'Payment', cls: 'badge-success' };
      case 'RETURN':
        return { label: 'Return', cls: 'badge-danger' };
      default:
        return { label: type, cls: 'badge-gray' };
    }
  };

  // Supplier Statement View
  if (selectedSupplier) {
    const pendingBal = Number(selectedSupplier.balance) || 0;

    return (
      <div>
        <div className="panel-header-card">
          <div className="panel-header-row" style={{ flexWrap: 'wrap', gap: '12px' }}>
            <div className="panel-header-left">
              <button
                type="button"
                className="btn-secondary"
                style={{ height: '36px', padding: '0 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                onClick={() => {
                  setSelectedSupplier(null);
                  setActiveAction(null);
                }}
              >
                <ArrowLeft size={15} />
                <span>All Suppliers</span>
              </button>
              <div className="panel-header-text">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <h2>{selectedSupplier.name}</h2>
                  <span className="cell-badge badge-warning">Supplier</span>
                </div>
                <p style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {selectedSupplier.phone && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Phone size={12} /> {selectedSupplier.phone}
                    </span>
                  )}
                  {selectedSupplier.address && <span>• {selectedSupplier.address}</span>}
                </p>
              </div>
            </div>

            <div className="ledger-balance-pill">
              <span className="ledger-balance-label">
                {pendingBal > 0 ? 'Pending Payable' : 'Account Status'}
              </span>
              <span
                className="ledger-balance-value"
                style={{ color: pendingBal > 0 ? '#b45309' : '#059669' }}
              >
                {pendingBal > 0 ? formatCurrency(pendingBal) : 'Settled (PKR 0)'}
              </span>
            </div>
          </div>

          <div className="ledger-statement-summary">
            <div className="ledger-mini-stat">
              <span>Total Purchased</span>
              <strong>{formatCurrency(selectedSupplier.totalBilled)}</strong>
            </div>
            <div className="ledger-mini-stat">
              <span>Total Paid</span>
              <strong style={{ color: '#059669' }}>{formatCurrency(selectedSupplier.totalPaid)}</strong>
            </div>
            <div className="ledger-mini-stat">
              <span>Returns Deducted</span>
              <strong style={{ color: '#dc2626' }}>{formatCurrency(selectedSupplier.totalReturned)}</strong>
            </div>
            <div className="ledger-mini-stat">
              <span>Pending Balance</span>
              <strong style={{ color: pendingBal > 0 ? '#b45309' : '#0f172a' }}>
                {formatCurrency(pendingBal)}
              </strong>
            </div>
          </div>

          <div className="ledger-action-bar">
            <button
              type="button"
              className="btn-primary"
              onClick={() => openActionForm('PURCHASE')}
            >
              <Plus size={15} />
              <span>Add Purchase</span>
            </button>
            <button
              type="button"
              className="btn-secondary"
              style={{ borderColor: '#10b981', color: '#047857', background: '#ecfdf5' }}
              onClick={() => openActionForm('PAYMENT')}
            >
              <Wallet size={15} />
              <span>Pay Supplier</span>
            </button>
            <button
              type="button"
              className="btn-secondary"
              style={{ borderColor: '#f87171', color: '#b91c1c', background: '#fef2f2' }}
              onClick={() => openActionForm('RETURN')}
            >
              <RotateCcw size={15} />
              <span>Return Item</span>
            </button>
          </div>
        </div>

        {/* Inline Action Form */}
        {activeAction && (
          <div className="card-form" style={{ marginBottom: '14px' }}>
            <div className="card-form-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>
                {activeAction === 'PURCHASE' && `New Purchase from ${selectedSupplier.name} (Adds Stock & Bill)`}
                {activeAction === 'PAYMENT' && `Pay ${selectedSupplier.name} (Deducts from Pending Balance)`}
                {activeAction === 'RETURN' && `Return Items to ${selectedSupplier.name} (Deducts Stock & Cost)`}
              </span>
              <button
                type="button"
                className="detail-modal-close"
                onClick={() => setActiveAction(null)}
                aria-label="Close form"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmitEntry}>
              <div className="form-grid-3">
                {activeAction !== 'PAYMENT' && (
                  <>
                    <div className="form-field">
                      <label>Category *</label>
                      <select
                        value={entryForm.category}
                        onChange={(e) => setEntryForm({ ...entryForm, category: e.target.value })}
                      >
                        <option value="Mobile">Mobile</option>
                        <option value="Tablet">Tablet</option>
                        <option value="Accessory">Accessory</option>
                      </select>
                    </div>

                    <div className="form-field">
                      <label>Condition *</label>
                      <select
                        value={entryForm.condition}
                        onChange={(e) => setEntryForm({ ...entryForm, condition: e.target.value })}
                      >
                        <option value="New">Brand New</option>
                        <option value="Used">Used / Second Hand</option>
                      </select>
                    </div>

                    <div className="form-field">
                      <label>Status</label>
                      <select
                        value={entryForm.status}
                        onChange={(e) => setEntryForm({ ...entryForm, status: e.target.value })}
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
                        placeholder="e.g. Apple, Samsung"
                        value={entryForm.companyName}
                        onChange={(e) => setEntryForm({ ...entryForm, companyName: e.target.value })}
                      />
                    </div>

                    <div className="form-field">
                      <label>Model Name {entryForm.category !== 'Accessory' ? '*' : '(Optional)'}</label>
                      <input
                        type="text"
                        placeholder="e.g. iPad Air / Galaxy Tab"
                        value={entryForm.modelName}
                        onChange={(e) => setEntryForm({ ...entryForm, modelName: e.target.value })}
                        required={entryForm.category !== 'Accessory'}
                      />
                    </div>

                    <div className="form-field">
                      <label>Quantity *</label>
                      <input
                        type="number"
                        min="1"
                        value={entryForm.quantity}
                        onChange={(e) => setEntryForm({ ...entryForm, quantity: e.target.value })}
                        required
                      />
                    </div>
                  </>
                )}

                <div className="form-field">
                  <label>
                    {activeAction === 'PAYMENT'
                      ? 'Payment Amount (PKR) *'
                      : activeAction === 'RETURN'
                        ? 'Return Cost Deducted (PKR) *'
                        : 'Total Purchase Bill (PKR) *'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 200000"
                    value={entryForm.totalAmount}
                    onChange={(e) => setEntryForm({ ...entryForm, totalAmount: e.target.value })}
                    required
                  />
                </div>

                {activeAction === 'PURCHASE' && (
                  <div className="form-field">
                    <label>
                      Paid Now (PKR) — Pending:{' '}
                      <strong>
                        {formatCurrency(
                          Math.max(0, (Number(entryForm.totalAmount) || 0) - (Number(entryForm.paidAmount) || 0))
                        )}
                      </strong>
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="0 (if full credit)"
                      value={entryForm.paidAmount}
                      onChange={(e) => setEntryForm({ ...entryForm, paidAmount: e.target.value })}
                    />
                  </div>
                )}

                {activeAction !== 'RETURN' && (
                  <div className="form-field">
                    <label>Payment Method</label>
                    <select
                      value={entryForm.paymentMethod}
                      onChange={(e) => setEntryForm({ ...entryForm, paymentMethod: e.target.value })}
                    >
                      <option value="Cash">Cash</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Easypaisa / JazzCash">Easypaisa / JazzCash</option>
                      <option value="Cheque">Cheque</option>
                    </select>
                  </div>
                )}

                <div className="form-field">
                  <label>Date</label>
                  <input
                    type="date"
                    value={entryForm.occurredAt}
                    onChange={(e) => setEntryForm({ ...entryForm, occurredAt: e.target.value })}
                  />
                </div>

                <div className="form-field">
                  <label>Note (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. 20 tablets batch #1"
                    value={entryForm.note}
                    onChange={(e) => setEntryForm({ ...entryForm, note: e.target.value })}
                  />
                </div>
              </div>

              <div className="card-form-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setActiveAction(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submittingEntry}>
                  {submittingEntry ? 'Saving...' : 'Save & Sync'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Supplier Statement Table & Mobile Cards */}
        <div className="table-card">
          <div className="hide-on-mobile desktop-table-container">
            <table className="pro-table">
              <thead>
                <tr>
                  <th style={{ width: '13%' }}>Date</th>
                  <th style={{ width: '12%' }}>Type</th>
                  <th style={{ width: '28%' }}>Item / Details</th>
                  <th style={{ width: '14%', textAlign: 'right' }}>Bill Amount</th>
                  <th style={{ width: '15%', textAlign: 'right' }}>Paid / Deducted</th>
                  <th style={{ width: '13%', textAlign: 'right' }}>Pending Balance</th>
                  <th style={{ width: '5%', textAlign: 'center' }}></th>
                </tr>
              </thead>
              <tbody>
                {loadingStatement ? (
                  <tr>
                    <td colSpan="7" className="empty-state">Loading supplier statement...</td>
                  </tr>
                ) : entries.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="empty-state">
                      No transactions yet. Use the buttons above to record a purchase, payment, or return.
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => {
                    const badge = getEntryBadge(entry.entryType);
                    const isBill = entry.entryType === 'PURCHASE';
                    const deductedAmt =
                      entry.entryType === 'PAYMENT' || entry.entryType === 'RETURN'
                        ? entry.totalAmount
                        : entry.paidAmount || 0;
                    return (
                      <tr key={entry._id}>
                        <td>
                          <span className="cell-mono">{formatDateTime(entry.occurredAt)}</span>
                        </td>
                        <td>
                          <span className={`cell-badge ${badge.cls}`}>{badge.label}</span>
                        </td>
                        <td>
                          <div className="cell-title">
                            {isBill || entry.entryType === 'RETURN'
                              ? `${entry.quantity || 1}x ${entry.modelName || 'Item'}`
                              : entry.paymentMethod || 'Supplier Payment'}
                          </div>
                          {entry.note && <div className="cell-sub">{entry.note}</div>}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span className="cell-mono" style={{ fontWeight: 600 }}>
                            {isBill ? formatCurrency(entry.totalAmount) : '—'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span
                            className="cell-mono"
                            style={{
                              fontWeight: 700,
                              color: deductedAmt > 0 ? (entry.entryType === 'RETURN' ? '#dc2626' : '#059669') : '#94a3b8',
                            }}
                          >
                            {deductedAmt > 0 ? `- ${formatCurrency(deductedAmt)}` : '—'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span className="cell-price" style={{ color: '#b45309' }}>
                            {formatCurrency(entry.balanceAfter)}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className="action-btn-danger"
                            onClick={() => handleDeleteEntry(entry._id)}
                            title="Delete entry"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="show-on-mobile mobile-card-container">
            {loadingStatement ? (
              <div className="empty-state">Loading supplier statement...</div>
            ) : entries.length === 0 ? (
              <div className="empty-state">No transactions yet.</div>
            ) : (
              entries.map((entry) => {
                const badge = getEntryBadge(entry.entryType);
                const isBill = entry.entryType === 'PURCHASE';
                const deductedAmt =
                  entry.entryType === 'PAYMENT' || entry.entryType === 'RETURN'
                    ? entry.totalAmount
                    : entry.paidAmount || 0;

                return (
                  <div key={entry._id} className="mobile-card">
                    <div className="mobile-card-top">
                      <div>
                        <div className="mobile-card-title">
                          {isBill || entry.entryType === 'RETURN'
                            ? `${entry.quantity || 1}x ${entry.modelName || 'Item'}`
                            : entry.paymentMethod || 'Supplier Payment'}
                        </div>
                        <div className="mobile-card-subtitle">{formatDateTime(entry.occurredAt)}</div>
                      </div>
                      <span className={`cell-badge ${badge.cls}`}>{badge.label}</span>
                    </div>
                    <div className="mobile-card-meta-grid">
                      {isBill && (
                        <div className="mobile-meta-cell">
                          <div className="mobile-meta-label">Bill Amount</div>
                          <div className="mobile-meta-val" style={{ fontWeight: 700 }}>
                            {formatCurrency(entry.totalAmount)}
                          </div>
                        </div>
                      )}
                      {deductedAmt > 0 && (
                        <div className="mobile-meta-cell">
                          <div className="mobile-meta-label">
                            {entry.entryType === 'RETURN' ? 'Return Deducted' : 'Paid'}
                          </div>
                          <div
                            className="mobile-meta-val"
                            style={{ fontWeight: 700, color: entry.entryType === 'RETURN' ? '#dc2626' : '#059669' }}
                          >
                            - {formatCurrency(deductedAmt)}
                          </div>
                        </div>
                      )}
                      <div className="mobile-meta-cell">
                        <div className="mobile-meta-label">Pending Balance</div>
                        <div className="mobile-meta-val" style={{ fontWeight: 700, color: '#b45309' }}>
                          {formatCurrency(entry.balanceAfter)}
                        </div>
                      </div>
                      {entry.note && (
                        <div className="mobile-meta-cell full-width">
                          <div className="mobile-meta-label">Note</div>
                          <div className="mobile-meta-val">{entry.note}</div>
                        </div>
                      )}
                    </div>
                    <div className="mobile-card-actions">
                      <button
                        type="button"
                        className="action-btn-danger"
                        onClick={() => handleDeleteEntry(entry._id)}
                        title="Delete entry"
                        aria-label="Delete entry"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  }

  // Suppliers Directory View
  return (
    <div>
      <div className="panel-header-card">
        <div className="panel-header-row">
          <div className="panel-header-left">
            <div className="panel-icon-box">
              <BookOpen size={18} />
            </div>
            <div className="panel-header-text">
              <h2>Supplier Ledger (Khata)</h2>
              <p>Manage supplier credit purchases, partial payments, and item returns synced with Inventory.</p>
            </div>
          </div>

          <button
            type="button"
            className="btn-primary"
            onClick={() => setShowAddSupplier((prev) => !prev)}
          >
            <Plus size={15} />
            <span>{showAddSupplier ? 'Close Form' : 'New Supplier'}</span>
          </button>
        </div>

        {/* Toolbar Filters */}
        <div className="panel-toolbar-row">
          <div className="mobile-filter-row">
            <select
              className="mobile-filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">All Suppliers</option>
              <option value="pending">Pending Balance</option>
              <option value="settled">Settled</option>
            </select>
          </div>

          <div className="toolbar-desktop-grid">
            <div className="panel-filter-pills">
              {[
                { id: 'All', label: 'All Suppliers' },
                { id: 'pending', label: 'Pending Balance' },
                { id: 'settled', label: 'Settled' },
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`filter-pill ${statusFilter === s.id ? 'active' : ''}`}
                  onClick={() => setStatusFilter(s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="panel-search-box">
            <Search size={14} className="search-icon" />
            <input
              type="text"
              placeholder="Search supplier name, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Add New Supplier Form */}
      {showAddSupplier && (
        <div className="card-form" style={{ marginBottom: '14px' }}>
          <div className="card-form-title">Create New Supplier Ledger Account</div>
          <form onSubmit={handleCreateSupplier}>
            <div className="form-grid-3">
              <div className="form-field">
                <label>Supplier / Company Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Al-Madina Distributors"
                  value={supplierForm.name}
                  onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-field">
                <label>Phone Number (Optional - 11 digits)</label>
                <input
                  type="tel"
                  maxLength={11}
                  placeholder="03001234567"
                  value={supplierForm.phone}
                  onChange={(e) =>
                    setSupplierForm({ ...supplierForm, phone: e.target.value.replace(/\D/g, '').slice(0, 11) })
                  }
                />
              </div>
              <div className="form-field">
                <label>Address (Optional)</label>
                <input
                  type="text"
                  placeholder="Shop / Market / City"
                  value={supplierForm.address}
                  onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
                />
              </div>
            </div>
            <div className="card-form-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowAddSupplier(false)}
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={submittingSupplier}>
                {submittingSupplier ? 'Creating...' : 'Create Supplier'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Summary KPI Grid (Matches Dashboard KPI Cards Styling & Typography) */}
      <div className="dashboard-kpi-grid" style={{ marginBottom: '16px' }}>
        <div className="dashboard-kpi-card" style={{ cursor: 'default' }}>
          <div className="kpi-card-top">
            <span className="kpi-label">Total Pending Payables</span>
            <span className="kpi-icon-pill kpi-amber">
              <ArrowUpRight size={16} />
            </span>
          </div>
          <div className="kpi-value" style={{ color: summary.totalPayable > 0 ? '#b45309' : 'var(--text-main)' }}>
            {formatCurrency(summary.totalPayable)}
          </div>
        </div>

        <div className="dashboard-kpi-card" style={{ cursor: 'default' }}>
          <div className="kpi-card-top">
            <span className="kpi-label">Total Paid to Suppliers</span>
            <span className="kpi-icon-pill kpi-emerald">
              <Wallet size={16} />
            </span>
          </div>
          <div className="kpi-value">
            {formatCurrency(summary.totalPaid)}
          </div>
        </div>

        <div className="dashboard-kpi-card" style={{ cursor: 'default' }}>
          <div className="kpi-card-top">
            <span className="kpi-label">Active Suppliers ({summary.pendingSuppliers} Pending)</span>
            <span className="kpi-icon-pill kpi-blue">
              <Users size={16} />
            </span>
          </div>
          <div className="kpi-value">
            {summary.totalSuppliers}
          </div>
        </div>
      </div>

      {/* Suppliers Table & Mobile Cards */}
      <div className="table-card">
        <div className="hide-on-mobile desktop-table-container">
          <table className="pro-table">
            <thead>
              <tr>
                <th style={{ width: '28%' }}>Supplier Name</th>
                <th style={{ width: '16%', textAlign: 'right' }}>Total Purchased</th>
                <th style={{ width: '16%', textAlign: 'right' }}>Total Paid</th>
                <th style={{ width: '14%', textAlign: 'right' }}>Returns Deducted</th>
                <th style={{ width: '16%', textAlign: 'right' }}>Pending Balance</th>
                <th style={{ width: '10%', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="empty-state">Loading suppliers...</td>
                </tr>
              ) : suppliers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="empty-state">
                    No suppliers found. Click &quot;New Supplier&quot; to create a supplier khata.
                  </td>
                </tr>
              ) : (
                suppliers.map((s) => {
                  const bal = Number(s.balance) || 0;
                  return (
                    <tr
                      key={s._id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => fetchStatement(s._id, false)}
                    >
                      <td>
                        <div className="cell-title">{s.name}</div>
                        {(s.phone || s.address) && (
                          <div className="cell-sub">
                            {[s.phone, s.address].filter(Boolean).join(' • ')}
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span className="cell-mono">{formatCurrency(s.totalBilled)}</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span className="cell-mono" style={{ color: '#059669' }}>
                          {formatCurrency(s.totalPaid)}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span className="cell-mono" style={{ color: '#dc2626' }}>
                          {formatCurrency(s.totalReturned)}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {bal > 0 ? (
                          <span className="cell-price" style={{ color: '#b45309' }}>
                            {formatCurrency(bal)}
                          </span>
                        ) : (
                          <span className="cell-badge badge-success">
                            <CheckCircle2 size={11} /> Settled
                          </span>
                        )}
                      </td>
                      <td
                        style={{ textAlign: 'center' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="action-btn-danger"
                          onClick={() => handleDeleteSupplier(s)}
                          title="Delete supplier"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="show-on-mobile mobile-card-container">
          {loading ? (
            <div className="empty-state">Loading suppliers...</div>
          ) : suppliers.length === 0 ? (
            <div className="empty-state">No suppliers found.</div>
          ) : (
            suppliers.map((s) => {
              const bal = Number(s.balance) || 0;
              return (
                <div
                  key={s._id}
                  className="mobile-card"
                  onClick={() => fetchStatement(s._id, false)}
                >
                  <div className="mobile-card-top">
                    <div>
                      <div className="mobile-card-title">{s.name}</div>
                      <div className="mobile-card-subtitle">
                        {s.phone || s.address || 'Supplier Account'}
                      </div>
                    </div>
                    <div
                      className="mobile-card-price"
                      style={{ color: bal > 0 ? '#b45309' : '#059669', fontWeight: 700 }}
                    >
                      {bal > 0 ? formatCurrency(bal) : 'Settled'}
                    </div>
                  </div>
                  <div className="mobile-card-meta-grid">
                    <div className="mobile-meta-cell">
                      <div className="mobile-meta-label">Purchased</div>
                      <div className="mobile-meta-val" style={{ fontWeight: 700 }}>
                        {formatCurrency(s.totalBilled)}
                      </div>
                    </div>
                    <div className="mobile-meta-cell">
                      <div className="mobile-meta-label">Paid</div>
                      <div className="mobile-meta-val" style={{ fontWeight: 700, color: '#059669' }}>
                        {formatCurrency(s.totalPaid)}
                      </div>
                    </div>
                    <div className="mobile-meta-cell">
                      <div className="mobile-meta-label">Returns Deducted</div>
                      <div className="mobile-meta-val" style={{ fontWeight: 700, color: '#dc2626' }}>
                        {formatCurrency(s.totalReturned)}
                      </div>
                    </div>
                    <div className="mobile-meta-cell">
                      <div className="mobile-meta-label">Pending Balance</div>
                      <div
                        className="mobile-meta-val"
                        style={{ fontWeight: 700, color: bal > 0 ? '#b45309' : '#059669' }}
                      >
                        {formatCurrency(bal)}
                      </div>
                    </div>
                  </div>
                  <div className="mobile-card-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => fetchStatement(s._id, false)}
                    >
                      View Statement
                    </button>
                    <button
                      type="button"
                      className="action-btn-danger"
                      onClick={() => handleDeleteSupplier(s)}
                      title="Delete supplier"
                      aria-label="Delete supplier"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default Ledger;
