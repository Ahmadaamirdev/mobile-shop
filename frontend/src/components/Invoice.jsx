import React, { useState, useEffect } from 'react';
import { getInvoices, createInvoice, deleteInvoice } from '../services/api';
import { Trash2, Printer } from 'lucide-react';

const Invoice = ({ initialSale, clearInitialSale, setAlert }) => {
  const [viewMode, setViewMode] = useState('generator'); // 'generator' | 'history'
  const [invoices, setInvoices] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState('');

  // Invoice current document data
  const [invoiceData, setInvoiceData] = useState({
    saleId: null,
    invoiceNumber: '',
    date: new Date().toISOString().split('T')[0],
    customerName: '',
    customerNumber: '',
    modelName: '',
    modelNumber: '',
    imei1: '',
    imei2: '',
    price: '',
  });

  // When initialSale is passed from Sales tab "Generate Invoice"
  useEffect(() => {
    if (initialSale) {
      setInvoiceData({
        saleId: initialSale._id || null,
        invoiceNumber: '',
        date: new Date().toISOString().split('T')[0],
        customerName: initialSale.customerName || '',
        customerNumber: initialSale.customerNumber || '',
        modelName: initialSale.modelName || '',
        modelNumber: initialSale.modelNumber || '',
        imei1: initialSale.imei1 || '',
        imei2: initialSale.imei2 || '',
        price: initialSale.price !== undefined ? initialSale.price : '',
      });
      setViewMode('generator');
    }
  }, [initialSale]);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await getInvoices({ search: historySearch });
      if (res.data && res.data.data) {
        setInvoices(res.data.data);
      }
    } catch (err) {
      setAlert({
        type: 'error',
        message: err.response?.data?.message || 'Error fetching invoice history.',
      });
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (viewMode === 'history') {
      fetchHistory();
    }
  }, [viewMode, historySearch]);

  const handleSaveInvoice = async () => {
    if (!invoiceData.customerName.trim() || !invoiceData.customerNumber.trim() || !invoiceData.modelName.trim() || invoiceData.price === '') {
      setAlert({
        type: 'error',
        message: 'Please fill in Customer Name, Phone Number, Model Name, and Price.',
      });
      return;
    }

    try {
      const res = await createInvoice(invoiceData);
      setAlert({
        type: 'success',
        message: `Invoice ${res.data.data.invoiceNumber} saved successfully to records.`,
      });
      setInvoiceData((prev) => ({
        ...prev,
        invoiceNumber: res.data.data.invoiceNumber,
      }));
    } catch (err) {
      setAlert({
        type: 'error',
        message: err.response?.data?.message || 'Failed to save invoice.',
      });
    }
  };

  const handleDeleteInvoice = async (id, invoiceNumber) => {
    if (!window.confirm(`Are you sure you want to delete invoice ${invoiceNumber}?`)) return;
    try {
      await deleteInvoice(id);
      setAlert({
        type: 'success',
        message: 'Invoice record deleted successfully.',
      });
      fetchHistory();
    } catch (err) {
      setAlert({
        type: 'error',
        message: err.response?.data?.message || 'Failed to delete invoice record.',
      });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleNewManual = () => {
    if (clearInitialSale) clearInitialSale();
    setInvoiceData({
      saleId: null,
      invoiceNumber: '',
      date: new Date().toISOString().split('T')[0],
      customerName: '',
      customerNumber: '',
      modelName: '',
      modelNumber: '',
      imei1: '',
      imei2: '',
      price: '',
    });
  };

  const handleLoadFromHistory = (item) => {
    setInvoiceData({
      saleId: item.saleId || null,
      invoiceNumber: item.invoiceNumber,
      date: item.date ? new Date(item.date).toISOString().split('T')[0] : '',
      customerName: item.customerName,
      customerNumber: item.customerNumber,
      modelName: item.modelName,
      modelNumber: item.modelNumber || '',
      imei1: item.imei1 || '',
      imei2: item.imei2 || '',
      price: item.price,
    });
    setViewMode('generator');
  };

  return (
    <div className="section-container">
      <div className="section-toolbar hide-on-print">
        <h2 className="section-title">Invoices</h2>
        <div className="filter-bar">
          <button
            className={`btn ${viewMode === 'generator' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setViewMode('generator')}
          >
            Invoice Generator
          </button>
          <button
            className={`btn ${viewMode === 'history' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setViewMode('history')}
          >
            Invoice History & Records
          </button>
        </div>
      </div>

      {viewMode === 'history' ? (
        <div className="hide-on-print">
          <div style={{ marginBottom: '14px' }}>
            <input
              type="text"
              className="search-input"
              placeholder="Search by Invoice No, Customer, Model..."
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
            />
          </div>

          {/* Mobile Card List for Invoices */}
          <div className="mobile-only">
            {loadingHistory ? (
              <div className="empty-state">Loading invoice records...</div>
            ) : invoices.length === 0 ? (
              <div className="empty-state">No invoice records found.</div>
            ) : (
              <div className="mobile-card-list">
                {invoices.map((inv) => (
                  <div key={inv._id} className="mobile-card">
                    <div className="mobile-card-header">
                      <div>
                        <div className="mobile-card-title">{inv.invoiceNumber}</div>
                        <div className="mobile-card-subtitle">
                          {inv.customerName} • {inv.customerNumber}
                        </div>
                      </div>
                      <div className="mobile-card-price">
                        PKR {Number(inv.price).toLocaleString()}
                      </div>
                    </div>

                    <div className="mobile-card-details">
                      <div className="mobile-detail-item">
                        <span className="mobile-detail-label">Model</span>
                        <span className="mobile-detail-value">{inv.modelName}</span>
                      </div>
                      <div className="mobile-detail-item">
                        <span className="mobile-detail-label">Date</span>
                        <span className="mobile-detail-value">
                          {new Date(inv.date).toLocaleDateString()}
                        </span>
                      </div>
                      {inv.imei1 && (
                        <div className="mobile-detail-item" style={{ gridColumn: 'span 2' }}>
                          <span className="mobile-detail-label">IMEI</span>
                          <span className="mobile-detail-value mono-text">{inv.imei1}</span>
                        </div>
                      )}
                    </div>

                    <div className="mobile-card-actions" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleLoadFromHistory(inv)}
                      >
                        <Printer size={15} /> View
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDeleteInvoice(inv._id, inv.invoiceNumber)}
                      >
                        <Trash2 size={15} /> Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Desktop Responsive Table for Invoices */}
          <div className="table-container desktop-only">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '110px' }}>Invoice No.</th>
                  <th style={{ width: '85px' }}>Date</th>
                  <th>Customer</th>
                  <th>Model & IMEI</th>
                  <th>Price</th>
                  <th style={{ textAlign: 'center', width: '110px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingHistory ? (
                  <tr>
                    <td colSpan="6" className="empty-state">Loading invoice records...</td>
                  </tr>
                ) : invoices.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="empty-state">No invoice records found.</td>
                  </tr>
                ) : (
                  invoices.map((inv) => (
                    <tr key={inv._id}>
                      <td><strong>{inv.invoiceNumber}</strong></td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {new Date(inv.date).toLocaleDateString()}
                      </td>
                      <td>
                        <strong>{inv.customerName}</strong>
                        <div className="hint">{inv.customerNumber}</div>
                      </td>
                      <td>
                        <strong>{inv.modelName}</strong>
                        {inv.imei1 && <div className="mono-text hint">IMEI: {inv.imei1}</div>}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <strong>PKR {Number(inv.price).toLocaleString()}</strong>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleLoadFromHistory(inv)}
                            title="View and print invoice"
                          >
                            <Printer size={14} />
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDeleteInvoice(inv._id, inv.invoiceNumber)}
                            title="Delete invoice record"
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
      ) : (
        <div>
          {/* Form to enter/edit details directly */}
          <div className="card hide-on-print">
            <h3 className="card-title">
              {initialSale ? 'Invoice Details (Auto-filled from Sale)' : 'Invoice Details (Manual Entry)'}
            </h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Date</label>
                <input
                  type="date"
                  value={invoiceData.date}
                  onChange={(e) => setInvoiceData({ ...invoiceData, date: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Customer Name *</label>
                <input
                  type="text"
                  placeholder="Customer Full Name"
                  value={invoiceData.customerName}
                  onChange={(e) => setInvoiceData({ ...invoiceData, customerName: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Customer Phone Number *</label>
                <input
                  type="tel"
                  placeholder="e.g. 03001234567"
                  value={invoiceData.customerNumber}
                  onChange={(e) => setInvoiceData({ ...invoiceData, customerNumber: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Model Name *</label>
                <input
                  type="text"
                  placeholder="Device / Item Name"
                  value={invoiceData.modelName}
                  onChange={(e) => setInvoiceData({ ...invoiceData, modelName: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Model Number</label>
                <input
                  type="text"
                  placeholder="Model Number"
                  value={invoiceData.modelNumber}
                  onChange={(e) => setInvoiceData({ ...invoiceData, modelNumber: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>IMEI 1 (Optional)</label>
                <input
                  type="text"
                  placeholder="15 digits"
                  value={invoiceData.imei1}
                  onChange={(e) => setInvoiceData({ ...invoiceData, imei1: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>IMEI 2 (Optional)</label>
                <input
                  type="text"
                  placeholder="15 digits"
                  value={invoiceData.imei2}
                  onChange={(e) => setInvoiceData({ ...invoiceData, imei2: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Price (PKR) * (Editable)</label>
                <input
                  type="number"
                  placeholder="0"
                  value={invoiceData.price}
                  onChange={(e) => setInvoiceData({ ...invoiceData, price: e.target.value })}
                />
              </div>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleNewManual}
              >
                Clear / New Entry
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleSaveInvoice}
              >
                Save Invoice Record
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handlePrint}
              >
                <Printer size={16} /> Print A4 Invoice
              </button>
            </div>
          </div>

          {/* Centered A4 Page Preview */}
          <div className="invoice-preview-wrapper">
            <div className="invoice-toolbar hide-on-print">
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                A4 Centered Layout Preview
              </span>
              <button className="btn btn-primary btn-sm" onClick={handlePrint}>
                <Printer size={14} /> Print A4
              </button>
            </div>

            <div className="a4-sheet" id="printable-invoice">
              {/* Header */}
              <div>
                <div className="invoice-header">
                  <div className="invoice-logo-box">
                    <img src="/logo.jpg" alt="Unity Mobile" className="invoice-logo-img" />
                    <div className="invoice-shop-details">
                      <h2>Unity Mobile</h2>
                      <p>Shop #14, Rehma Center, Kachery Road, Multan</p>
                    </div>
                  </div>

                  <div className="invoice-meta">
                    <h3>SALES INVOICE</h3>
                    <p><strong>Invoice No:</strong> {invoiceData.invoiceNumber || 'NEW'}</p>
                    <p><strong>Date:</strong> {invoiceData.date || new Date().toLocaleDateString()}</p>
                  </div>
                </div>

                {/* Customer Details */}
                <div className="invoice-section-row">
                  <div className="invoice-box">
                    <h4>Customer Information</h4>
                    <p><strong>Name:</strong> {invoiceData.customerName || '—'}</p>
                    <p><strong>Phone:</strong> {invoiceData.customerNumber || '—'}</p>
                  </div>
                  <div className="invoice-box desktop-only" style={{ textAlign: 'right' }}>
                    <h4>Shop Reference</h4>
                    <p><strong>Store:</strong> Unity Mobile</p>
                    <p><strong>Location:</strong> Multan</p>
                  </div>
                </div>

                {/* Items Table */}
                <table className="invoice-table">
                  <thead>
                    <tr>
                      <th style={{ width: '30px' }}>#</th>
                      <th>Item Description</th>
                      <th>Model Number</th>
                      <th>IMEI / Identifiers</th>
                      <th style={{ textAlign: 'right', width: '120px' }}>Amount (PKR)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>1</td>
                      <td>
                        <strong>{invoiceData.modelName || 'Device / Accessory'}</strong>
                      </td>
                      <td>{invoiceData.modelNumber || '—'}</td>
                      <td className="mono-text">
                        {invoiceData.imei1 && <div>IMEI 1: {invoiceData.imei1}</div>}
                        {invoiceData.imei2 && <div>IMEI 2: {invoiceData.imei2}</div>}
                        {!invoiceData.imei1 && !invoiceData.imei2 && '—'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <strong>
                          {invoiceData.price !== ''
                            ? Number(invoiceData.price).toLocaleString()
                            : '0'}
                        </strong>
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Summary / Total */}
                <div className="invoice-summary-box">
                  <div className="invoice-total-row">
                    <span>Total Amount:</span>
                    <span>
                      PKR{' '}
                      {invoiceData.price !== ''
                        ? Number(invoiceData.price).toLocaleString()
                        : '0'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Footer Signatures */}
              <div className="invoice-footer">
                <div className="invoice-footer-sign">
                  Customer Signature
                </div>
                <div className="invoice-footer-sign">
                  Authorized Sign & Stamp
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Invoice;
