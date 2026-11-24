import React, { useState, useEffect } from 'react';
import { getInvoices, createInvoice, deleteInvoice } from '../services/api';
import { Trash2, Printer, Search, FileText, Plus, Check } from 'lucide-react';

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
    <div>
      {/* 1. Page Header with Mode Switcher */}
      <div className="page-header-container hide-on-print">
        <div className="page-header-title-row">
          <div className="page-header-text">
            <h1>Invoices</h1>
            <p>Generate printable A4 sales invoices & review billing history</p>
          </div>
          <div className="page-header-actions">
            <button
              className={viewMode === 'generator' ? 'btn-secondary active' : 'btn-secondary'}
              onClick={() => setViewMode('generator')}
            >
              <FileText size={15} /> Invoice Generator
            </button>
            <button
              className={viewMode === 'history' ? 'btn-secondary active' : 'btn-secondary'}
              onClick={() => setViewMode('history')}
            >
              Past Invoices ({invoices.length})
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'history' ? (
        /* History View */
        <div className="card-data hide-on-print">
          <div className="table-toolbar">
            <div className="table-toolbar-left">
              <div className="search-input-wrapper">
                <Search size={15} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search invoices by number, customer, model, IMEI..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                />
              </div>
            </div>
            <div className="table-toolbar-right">
              <span className="record-count-badge">
                {invoices.length} {invoices.length === 1 ? 'Invoice' : 'Invoices'}
              </span>
            </div>
          </div>

          {/* Desktop Table (Zero Overflow) */}
          <div className="hide-on-mobile desktop-table-container">
            <table className="pro-table">
              <thead>
                <tr>
                  <th style={{ width: '14%' }}>Invoice No.</th>
                  <th style={{ width: '12%' }}>Date</th>
                  <th style={{ width: '18%' }}>Customer Name</th>
                  <th style={{ width: '14%' }}>Phone</th>
                  <th style={{ width: '22%' }}>Device Model</th>
                  <th style={{ width: '14%' }}>Amount (PKR)</th>
                  <th style={{ width: '6%', textAlign: 'center' }}></th>
                </tr>
              </thead>
              <tbody>
                {loadingHistory ? (
                  <tr>
                    <td colSpan="7" className="empty-state">Loading invoice history...</td>
                  </tr>
                ) : invoices.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="empty-state">No invoice records found.</td>
                  </tr>
                ) : (
                  invoices.map((item) => (
                    <tr key={item._id}>
                      {/* Invoice No */}
                      <td>
                        <span className="cell-title" style={{ color: 'var(--brand-gold-hover)', fontFamily: 'monospace' }}>
                          {item.invoiceNumber}
                        </span>
                      </td>

                      {/* Date */}
                      <td style={{ color: 'var(--text-muted)' }}>
                        {item.date ? new Date(item.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </td>

                      {/* Customer Name */}
                      <td>
                        <span className="cell-title">{item.customerName}</span>
                      </td>

                      {/* Phone */}
                      <td>
                        <span className="cell-sub">{item.customerNumber}</span>
                      </td>

                      {/* Model */}
                      <td>
                        <span className="cell-title">{item.modelName}</span>
                        {item.modelNumber && <span className="cell-sub">{item.modelNumber}</span>}
                      </td>

                      {/* Amount */}
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
                            onClick={() => handleLoadFromHistory(item)}
                            title="View / Print Invoice"
                          >
                            <Printer size={13} />
                          </button>
                          <button
                            className="action-btn-danger"
                            onClick={() => handleDeleteInvoice(item._id, item.invoiceNumber)}
                            title="Delete invoice record"
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
            {loadingHistory ? (
              <div className="empty-state">Loading invoice history...</div>
            ) : invoices.length === 0 ? (
              <div className="empty-state">No invoice records found.</div>
            ) : (
              invoices.map((item) => (
                <div key={item._id} className="mobile-card">
                  <div className="mobile-card-top">
                    <div>
                      <div className="mobile-card-title" style={{ color: 'var(--brand-gold-hover)', fontFamily: 'monospace' }}>
                        {item.invoiceNumber}
                      </div>
                      <div className="mobile-card-subtitle">{item.customerName} • {item.customerNumber}</div>
                    </div>
                    <div className="mobile-card-price">
                      PKR {Number(item.price).toLocaleString()}
                    </div>
                  </div>

                  <div className="mobile-card-meta-grid">
                    <div className="mobile-meta-cell">
                      <div className="mobile-meta-label">Date</div>
                      <div className="mobile-meta-val">
                        {item.date ? new Date(item.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </div>
                    </div>

                    <div className="mobile-meta-cell">
                      <div className="mobile-meta-label">Model</div>
                      <div className="mobile-meta-val">{item.modelName}</div>
                    </div>
                  </div>

                  <div className="mobile-card-actions">
                    <button
                      className="btn-primary"
                      onClick={() => handleLoadFromHistory(item)}
                    >
                      <Printer size={14} /> View & Print
                    </button>
                    <button
                      className="btn-secondary"
                      style={{ color: 'var(--danger-color)', borderColor: 'var(--danger-border)' }}
                      onClick={() => handleDeleteInvoice(item._id, item.invoiceNumber)}
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        /* Generator View */
        <div>
          {/* Quick Actions Bar */}
          <div className="invoice-actions-bar hide-on-print">
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn-secondary btn-sm"
                onClick={handleNewManual}
              >
                <Plus size={14} /> New Invoice
              </button>
              <button
                className="btn-secondary btn-sm"
                onClick={handleSaveInvoice}
              >
                <Check size={14} /> Save to Database
              </button>
            </div>
            <button
              className="btn-primary"
              onClick={handlePrint}
            >
              <Printer size={16} /> Print A4 Invoice
            </button>
          </div>

          {/* Editable Fields Form Card */}
          <div className="card-form hide-on-print">
            <div className="card-form-title">
              <span>Invoice Editor (Modifications reflect instantly on preview below)</span>
            </div>
            <div className="form-grid-3">
              <div className="form-field">
                <label>Customer Full Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Muhammad Ahmad"
                  value={invoiceData.customerName}
                  onChange={(e) => setInvoiceData({ ...invoiceData, customerName: e.target.value })}
                />
              </div>

              <div className="form-field">
                <label>Customer Phone Number *</label>
                <input
                  type="text"
                  placeholder="e.g. 03001234567"
                  value={invoiceData.customerNumber}
                  onChange={(e) => setInvoiceData({ ...invoiceData, customerNumber: e.target.value })}
                />
              </div>

              <div className="form-field">
                <label>Device Model Name *</label>
                <input
                  type="text"
                  placeholder="e.g. iPhone 13 Pro"
                  value={invoiceData.modelName}
                  onChange={(e) => setInvoiceData({ ...invoiceData, modelName: e.target.value })}
                />
              </div>

              <div className="form-field">
                <label>Model Number</label>
                <input
                  type="text"
                  placeholder="e.g. A2638"
                  value={invoiceData.modelNumber}
                  onChange={(e) => setInvoiceData({ ...invoiceData, modelNumber: e.target.value })}
                />
              </div>

              <div className="form-field">
                <label>Invoice Date</label>
                <input
                  type="date"
                  value={invoiceData.date}
                  onChange={(e) => setInvoiceData({ ...invoiceData, date: e.target.value })}
                />
              </div>

              <div className="form-field">
                <label>Sale Price (PKR) *</label>
                <input
                  type="number"
                  placeholder="0"
                  value={invoiceData.price}
                  onChange={(e) => setInvoiceData({ ...invoiceData, price: e.target.value })}
                />
              </div>

              <div className="form-field">
                <label>IMEI 1 (Optional)</label>
                <input
                  type="text"
                  placeholder="15 digits"
                  value={invoiceData.imei1}
                  onChange={(e) => setInvoiceData({ ...invoiceData, imei1: e.target.value })}
                />
              </div>

              <div className="form-field">
                <label>IMEI 2 (Optional)</label>
                <input
                  type="text"
                  placeholder="15 digits"
                  value={invoiceData.imei2}
                  onChange={(e) => setInvoiceData({ ...invoiceData, imei2: e.target.value })}
                />
              </div>

              <div className="form-field">
                <label>Invoice Number (Auto-assigned on Save)</label>
                <input
                  type="text"
                  placeholder="Auto-generated e.g. UM-1001"
                  value={invoiceData.invoiceNumber}
                  onChange={(e) => setInvoiceData({ ...invoiceData, invoiceNumber: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Centered A4 Printable Sheet */}
          <div className="invoice-preview-container">
            <div className="a4-sheet">
              {/* Header */}
              <div className="invoice-header">
                <div className="invoice-brand-box">
                  <img src="/logo.jpg" alt="Unity Mobile" className="invoice-brand-logo" />
                  <div className="invoice-brand-title">
                    <h2>UNITY MOBILE</h2>
                    <p>Shop #14, Rehma Center, Kachery Road, Multan</p>
                    <p>Phone: +92 300 1234567 • Email: support@unitymobile.pk</p>
                  </div>
                </div>

                <div className="invoice-meta-box">
                  <h3>INVOICE</h3>
                  <p><strong>Invoice No:</strong> {invoiceData.invoiceNumber || 'UM-XXXX (Draft)'}</p>
                  <p><strong>Date:</strong> {invoiceData.date || new Date().toISOString().split('T')[0]}</p>
                </div>
              </div>

              {/* Customer & Device Meta Information */}
              <div className="invoice-details-grid">
                <div className="invoice-col">
                  <h4>CUSTOMER DETAILS</h4>
                  <p><strong>Name:</strong> {invoiceData.customerName || '—'}</p>
                  <p><strong>Phone:</strong> {invoiceData.customerNumber || '—'}</p>
                </div>

                <div className="invoice-col">
                  <h4>DEVICE & SALE INFO</h4>
                  <p><strong>Model:</strong> {invoiceData.modelName || '—'} {invoiceData.modelNumber ? `(${invoiceData.modelNumber})` : ''}</p>
                  {invoiceData.imei1 && <p><strong>IMEI 1:</strong> {invoiceData.imei1}</p>}
                  {invoiceData.imei2 && <p><strong>IMEI 2:</strong> {invoiceData.imei2}</p>}
                </div>
              </div>

              {/* Items Table */}
              <table className="invoice-table">
                <thead>
                  <tr>
                    <th style={{ width: '10%' }}>Sr. #</th>
                    <th style={{ width: '55%' }}>Item Description</th>
                    <th style={{ width: '15%', textAlign: 'center' }}>Qty</th>
                    <th style={{ width: '20%', textAlign: 'right' }}>Total (PKR)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>1</td>
                    <td>
                      <strong>{invoiceData.modelName || 'Device Sale'}</strong>
                      {invoiceData.modelNumber && <div style={{ fontSize: '0.8rem', color: '#555' }}>Model: {invoiceData.modelNumber}</div>}
                      {invoiceData.imei1 && <div style={{ fontSize: '0.75rem', color: '#666' }}>IMEI: {invoiceData.imei1}</div>}
                      {invoiceData.imei2 && <div style={{ fontSize: '0.75rem', color: '#666' }}>IMEI 2: {invoiceData.imei2}</div>}
                    </td>
                    <td style={{ textAlign: 'center' }}>1</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                      {invoiceData.price ? Number(invoiceData.price).toLocaleString() : '0'}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Summary Total */}
              <div className="invoice-total-container">
                <div className="invoice-total-box">
                  <span>Grand Total:</span>
                  <span>PKR {invoiceData.price ? Number(invoiceData.price).toLocaleString() : '0'}</span>
                </div>
              </div>

              {/* Terms and Return Policy */}
              <div className="invoice-terms-box">
                <p><strong>Notice & Warranty Terms:</strong></p>
                <p>1. Please inspect the device carefully before leaving the store.</p>
                <p>2. Goods once sold cannot be returned or refunded without the original invoice.</p>
                <p>3. Software and physical damage are not covered under warranty.</p>
              </div>

              {/* Signatures */}
              <div className="invoice-signatures">
                <div className="invoice-sig-line">
                  Customer Signature
                </div>
                <div className="invoice-sig-line">
                  Authorized Unity Mobile Signature
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
