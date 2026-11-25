import React, { useState, useEffect } from 'react';
import { getInvoices, createInvoice, updateInvoice, deleteInvoice } from '../services/api';
import { Trash2, Printer, Search, FileText, Download, Edit3, Plus, Check } from 'lucide-react';

const Invoice = ({ initialSale, clearInitialSale, setAlert }) => {
  const [viewMode, setViewMode] = useState('generator'); // 'generator' | 'history'
  const [invoices, setInvoices] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState('');

  const initialFormState = {
    _id: null,
    saleId: null,
    invoiceNumber: '',
    date: new Date().toISOString().split('T')[0],
    customerName: '',
    customerNumber: '',
    modelName: '',
    modelNumber: '',
    condition: 'New',
    imei1: '',
    imei2: '',
    price: '',
  };

  // Invoice current document data
  const [invoiceData, setInvoiceData] = useState(initialFormState);

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
        condition: initialSale.condition || 'New',
        imei1: initialSale.imei1 || '',
        imei2: initialSale.imei2 || '',
        price: initialSale.price !== undefined ? initialSale.price : '',
      });
      setViewMode('generator');
    }
  }, [initialSale]);

  const fetchHistory = async (force = false) => {
    setLoadingHistory(true);
    try {
      const res = await getInvoices({}, force);
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
    fetchHistory();
  }, [viewMode]);

  const filteredInvoices = invoices.filter((item) => {
    if (!historySearch.trim()) return true;
    const term = historySearch.trim().toLowerCase();
    return (
      item.invoiceNumber?.toLowerCase().includes(term) ||
      item.customerName?.toLowerCase().includes(term) ||
      item.customerNumber?.toLowerCase().includes(term) ||
      item.modelName?.toLowerCase().includes(term) ||
      item.modelNumber?.toLowerCase().includes(term) ||
      item.condition?.toLowerCase().includes(term) ||
      item.imei1?.toLowerCase().includes(term) ||
      item.imei2?.toLowerCase().includes(term)
    );
  });

  const handleDeleteInvoice = async (id, invoiceNumber) => {
    if (!window.confirm(`Are you sure you want to delete invoice ${invoiceNumber}?`)) return;
    try {
      await deleteInvoice(id);
      setAlert({
        type: 'success',
        message: 'Invoice deleted successfully',
      });
      fetchHistory(true);
    } catch (err) {
      setAlert({
        type: 'error',
        message: err.response?.data?.message || 'Failed to delete invoice record.',
      });
    }
  };

  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Automatically save or update invoice in records
  const saveInvoiceRecord = async () => {
    if (
      !invoiceData.customerName?.trim() ||
      !invoiceData.customerNumber?.trim() ||
      !invoiceData.modelName?.trim() ||
      invoiceData.price === '' ||
      invoiceData.price === undefined
    ) {
      setAlert({
        type: 'error',
        message: 'Please fill in Customer Name, Phone, Model Name, and Sale Price.',
      });
      return null;
    }

    setIsSaving(true);
    try {
      let saved;
      if (invoiceData._id) {
        // Update existing invoice record in database
        const res = await updateInvoice(invoiceData._id, invoiceData);
        saved = res.data?.data;
        if (saved) {
          setInvoiceData((prev) => ({
            ...prev,
            ...saved,
            date: saved.date ? new Date(saved.date).toISOString().split('T')[0] : prev.date,
          }));
        }
        setAlert({
          type: 'success',
          message: 'Invoice updated successfully',
        });
      } else {
        // Generate and save new invoice record in database
        const res = await createInvoice(invoiceData);
        saved = res.data?.data;
        if (saved) {
          setInvoiceData((prev) => ({
            ...prev,
            _id: saved._id,
            invoiceNumber: saved.invoiceNumber,
            date: saved.date ? new Date(saved.date).toISOString().split('T')[0] : prev.date,
          }));
        }
        // Requirement: "pop up should be on top left invoice generated successfully."
        setAlert({
          type: 'success',
          message: 'Invoice generated successfully',
        });
      }
      fetchHistory(true);
      return saved || invoiceData;
    } catch (err) {
      console.error('Save invoice error:', err);
      setAlert({
        type: 'error',
        message: err.response?.data?.message || 'Failed to save invoice record.',
      });
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadPDF = async () => {
    const saved = await saveInvoiceRecord();
    if (!saved) return;

    const element = document.querySelector('.a4-sheet');
    if (!element) return;

    setIsGeneratingPDF(true);
    try {
      const html2pdfModule = await import('html2pdf.js');
      const html2pdf = html2pdfModule.default || html2pdfModule;

      const currentInvoiceNum = saved.invoiceNumber || invoiceData.invoiceNumber || 'Draft';
      const safeCustomer = invoiceData.customerName
        ? invoiceData.customerName.replace(/[^a-zA-Z0-9]/g, '_')
        : 'Customer';
      const filename = `Invoice_${currentInvoiceNum}_${safeCustomer}.pdf`;

      const opt = {
        margin: [6, 6, 6, 6],
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      };

      await html2pdf().set(opt).from(element).save();
    } catch (error) {
      console.error('PDF Generation Error:', error);
      setAlert({
        type: 'error',
        message: 'Could not generate PDF directly. You can also use Print A4 Invoice -> Save as PDF.',
      });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handlePrint = async () => {
    const saved = await saveInvoiceRecord();
    if (!saved) return;
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handleStartNewInvoice = () => {
    setInvoiceData(initialFormState);
    if (clearInitialSale) clearInitialSale();
    setAlert({
      type: 'success',
      message: 'New invoice initialized',
    });
  };

  const handleEditFromHistory = (item) => {
    setInvoiceData({
      _id: item._id,
      saleId: item.saleId || null,
      invoiceNumber: item.invoiceNumber,
      date: item.date ? new Date(item.date).toISOString().split('T')[0] : '',
      customerName: item.customerName || '',
      customerNumber: item.customerNumber || '',
      modelName: item.modelName || '',
      modelNumber: item.modelNumber || '',
      condition: item.condition || 'New',
      imei1: item.imei1 || '',
      imei2: item.imei2 || '',
      price: item.price !== undefined ? item.price : '',
    });
    setViewMode('generator');
    setAlert({
      type: 'success',
      message: `Editing invoice ${item.invoiceNumber}`,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLoadFromHistory = (item) => {
    setInvoiceData({
      _id: item._id,
      saleId: item.saleId || null,
      invoiceNumber: item.invoiceNumber,
      date: item.date ? new Date(item.date).toISOString().split('T')[0] : '',
      customerName: item.customerName,
      customerNumber: item.customerNumber,
      modelName: item.modelName,
      modelNumber: item.modelNumber || '',
      condition: item.condition || 'New',
      imei1: item.imei1 || '',
      imei2: item.imei2 || '',
      price: item.price,
    });
    setViewMode('generator');
  };

  return (
    <div>
      {/* 1. Header Card (Reference: Al Haditha Top Card) */}
      <div className="panel-header-card hide-on-print">
        <div className="panel-header-row">
          <div className="panel-header-left">
            <div className="panel-icon-box">
              <FileText size={18} />
            </div>
            <div className="panel-header-text">
              <h2>Billing &amp; Invoice Registry</h2>
              <p>Generate verified A4 print sales invoices &amp; review historical customer bills.</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className={`filter-pill ${viewMode === 'generator' ? 'active' : 'inactive'}`}
              onClick={() => setViewMode('generator')}
            >
              <FileText size={14} style={{ display: 'inline', marginRight: '5px' }} />
              Invoice Generator
            </button>
            <button
              className={`filter-pill ${viewMode === 'history' ? 'active' : 'inactive'}`}
              onClick={() => setViewMode('history')}
            >
              Past Invoices ({invoices.length})
            </button>
          </div>
        </div>

        {viewMode === 'history' && (
          <div className="panel-toolbar-row">
            <div style={{ fontSize: '13px', fontWeight: 500, color: '#64748b' }}>
              Showing {filteredInvoices.length} billing history record{filteredInvoices.length === 1 ? '' : 's'}
            </div>
            <div className="panel-search-box">
              <Search size={14} className="search-icon" />
              <input
                type="text"
                placeholder="Search invoice #, customer, model..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      {viewMode === 'history' ? (
        /* History View Table Card */
        <div className="table-card hide-on-print">
          <div className="hide-on-mobile desktop-table-container">
            <table className="pro-table">
              <thead>
                <tr>
                  <th style={{ width: '14%' }}>Invoice No.</th>
                  <th style={{ width: '11%' }}>Date</th>
                  <th style={{ width: '18%' }}>Customer Name</th>
                  <th style={{ width: '15%' }}>Customer Phone</th>
                  <th style={{ width: '22%' }}>Device Model</th>
                  <th style={{ width: '13%' }}>Amount (PKR)</th>
                  <th style={{ width: '7%', textAlign: 'center', paddingRight: '14px' }}></th>
                </tr>
              </thead>
              <tbody>
                {loadingHistory ? (
                  <tr>
                    <td colSpan="7" className="empty-state">Loading invoice history...</td>
                  </tr>
                ) : filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="empty-state">No invoice records found.</td>
                  </tr>
                ) : (
                  filteredInvoices.map((item) => (
                    <tr key={item._id}>
                      {/* Invoice No */}
                      <td>
                        <span className="cell-mono" style={{ color: 'var(--brand-gold-hover)', fontWeight: 600 }}>
                          {item.invoiceNumber}
                        </span>
                      </td>

                      {/* Date */}
                      <td>
                        <span className="cell-mono">
                          {item.date ? new Date(item.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                        </span>
                      </td>

                      {/* Customer Name */}
                      <td>
                        <span className="cell-title">{item.customerName}</span>
                      </td>

                      {/* Phone */}
                      <td>
                        <span className="cell-mono" style={{ fontWeight: 700, color: '#090d16', fontSize: '13px' }}>{item.customerNumber}</span>
                      </td>

                      {/* Model */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className="cell-title">{item.modelName}</span>
                          <span className={`status-badge ${item.condition === 'Used' ? 'badge-warning' : 'badge-success'}`} style={{ fontSize: '10px', padding: '1px 6px' }}>
                            {item.condition || 'New'}
                          </span>
                        </div>
                        {item.modelNumber && <span className="cell-sub">{item.modelNumber}</span>}
                      </td>

                      {/* Amount */}
                      <td>
                        <span className="cell-price">
                          PKR {Number(item.price).toLocaleString()}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'center', paddingRight: '14px' }}>
                        <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                          <button
                            className="action-btn-primary"
                            onClick={() => handleLoadFromHistory(item)}
                            title="View & Print Invoice"
                          >
                            <Printer size={12} />
                          </button>
                          <button
                            className="action-btn-primary"
                            style={{ background: '#f1f5f9', color: '#1e293b', border: '1px solid var(--border-card)' }}
                            onClick={() => handleEditFromHistory(item)}
                            title="Edit Invoice"
                          >
                            <Edit3 size={12} />
                          </button>
                          <button
                            className="action-btn-danger"
                            onClick={() => handleDeleteInvoice(item._id, item.invoiceNumber)}
                            title="Delete invoice record"
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
            {loadingHistory ? (
              <div className="empty-state">Loading invoice history...</div>
            ) : filteredInvoices.length === 0 ? (
              <div className="empty-state">No invoice records found.</div>
            ) : (
              filteredInvoices.map((item) => (
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
                      <div className="mobile-meta-val" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>{item.modelName}</span>
                        <span className={`status-badge ${item.condition === 'Used' ? 'badge-warning' : 'badge-success'}`} style={{ fontSize: '9px', padding: '1px 5px' }}>
                          {item.condition || 'New'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mobile-card-actions">
                    <button
                      className="btn-primary"
                      onClick={() => handleLoadFromHistory(item)}
                    >
                      <Printer size={13} /> View
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={() => handleEditFromHistory(item)}
                    >
                      <Edit3 size={13} /> Edit
                    </button>
                    <button
                      className="action-btn-danger"
                      style={{ padding: '0 12px' }}
                      onClick={() => handleDeleteInvoice(item._id, item.invoiceNumber)}
                    >
                      <Trash2 size={13} /> Delete
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
          {/* Editable Fields Form Card */}
          <div className="card-form hide-on-print">
            <div className="card-form-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <span>
                {invoiceData._id
                  ? `Editing Invoice: ${invoiceData.invoiceNumber || 'Saved Record'}`
                  : 'Invoice Editor (Modifications reflect instantly on preview below)'}
              </span>
              {invoiceData._id && (
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ height: '30px', fontSize: '12px', padding: '0 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  onClick={handleStartNewInvoice}
                  title="Clear form and create a new invoice"
                >
                  <Plus size={13} /> Create New Instead
                </button>
              )}
            </div>

            {/* Editing Notice Banner */}
            {invoiceData._id && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '8px', padding: '10px 14px', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: '#92400e' }}>
                  <Edit3 size={15} />
                  <span>Editing Mode: Invoice #{invoiceData.invoiceNumber}</span>
                </div>
                <span style={{ fontSize: '12px', color: '#b45309', fontWeight: 500 }}>
                  Clicking Print or Download PDF will automatically update this record.
                </span>
              </div>
            )}
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
                <label>Device Condition *</label>
                <select
                  value={invoiceData.condition || 'New'}
                  onChange={(e) => setInvoiceData({ ...invoiceData, condition: e.target.value })}
                >
                  <option value="New">Brand New</option>
                  <option value="Used">Used / Pre-Owned</option>
                </select>
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
                    <p>Shop Number 14, Rehma Center, Kachery Road, Multan</p>
                    <p>Phone: 03326421749</p>
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
                  <h4>DEVICE &amp; SALE INFO</h4>
                  <p><strong>Model:</strong> {invoiceData.modelName || '—'} {invoiceData.modelNumber ? `(${invoiceData.modelNumber})` : ''} {invoiceData.condition ? `[${invoiceData.condition}]` : ''}</p>
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
                      <strong>{invoiceData.modelName || 'Device Sale'} {invoiceData.condition ? `(${invoiceData.condition})` : ''}</strong>
                      {invoiceData.modelNumber && <div style={{ fontSize: '12px', color: '#555' }}>Model: {invoiceData.modelNumber}</div>}
                      {invoiceData.imei1 && <div style={{ fontSize: '11px', color: '#666', fontFamily: 'JetBrains Mono' }}>IMEI: {invoiceData.imei1}</div>}
                      {invoiceData.imei2 && <div style={{ fontSize: '11px', color: '#666', fontFamily: 'JetBrains Mono' }}>IMEI 2: {invoiceData.imei2}</div>}
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
                <p><strong>Notice &amp; Warranty Terms:</strong></p>
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

          {/* Action Buttons Firmly Below Invoice Preview */}
          <div className="invoice-bottom-actions hide-on-print">
            <button
              type="button"
              className="btn-primary action-btn-lg"
              style={{ background: '#16a34a', borderColor: '#15803d' }}
              onClick={saveInvoiceRecord}
              disabled={isSaving}
              title={invoiceData._id ? 'Save modifications to database' : 'Save invoice to database'}
            >
              <Check size={16} />
              <span>{isSaving ? 'Saving...' : invoiceData._id ? 'Save Updates' : 'Save Record'}</span>
            </button>
            <button
              type="button"
              className="btn-secondary action-btn-lg"
              onClick={handleDownloadPDF}
              disabled={isGeneratingPDF || isSaving}
              title="Download Invoice as PDF document"
            >
              <Download size={16} />
              <span>{isGeneratingPDF ? 'Generating...' : 'Download PDF'}</span>
            </button>
            <button
              type="button"
              className="btn-primary action-btn-lg"
              onClick={handlePrint}
              disabled={isSaving}
              title="Print A4 Invoice"
            >
              <Printer size={16} />
              <span>Print A4 Invoice</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Invoice;
