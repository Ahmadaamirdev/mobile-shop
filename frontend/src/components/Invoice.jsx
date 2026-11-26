import React, { useState, useEffect } from 'react';
import { getInvoices, createInvoice, updateInvoice, deleteInvoice, getSales } from '../services/api';
import { Trash2, Printer, Search, FileText, Download, Edit3, Plus, Check, Smartphone, Phone } from 'lucide-react';
import SmartDropdown from './SmartDropdown';

const emptyDevice = {
  modelName: '',
  modelNumber: '',
  condition: 'New',
  imei1: '',
  imei2: '',
  price: '',
  quantity: 1,
};

const Invoice = ({ isActive, initialSale, clearInitialSale, setAlert }) => {
  const [viewMode, setViewMode] = useState('history'); // 'history' | 'generator'
  const [invoices, setInvoices] = useState([]);
  const [recordedSales, setRecordedSales] = useState([]);
  const [selectedSaleId, setSelectedSaleId] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState('');

  const initialFormState = {
    _id: null,
    saleId: null,
    invoiceNumber: '',
    date: new Date().toISOString().split('T')[0],
    customerName: '',
    customerNumber: '',
    paymentMode: 'Cash / Instant',
    items: [{ ...emptyDevice }],
  };

  // Invoice current document data
  const [invoiceData, setInvoiceData] = useState(initialFormState);

  // When initialSale is passed from Sales tab "Generate Invoice"
  useEffect(() => {
    if (initialSale) {
      setInvoiceData({
        _id: null,
        saleId: initialSale._id || null,
        invoiceNumber: '',
        date: new Date().toISOString().split('T')[0],
        customerName: initialSale.customerName || '',
        customerNumber: initialSale.customerNumber || '',
        paymentMode: 'Cash / Instant',
        items: [
          {
            modelName: initialSale.modelName || '',
            modelNumber: initialSale.modelNumber || '',
            condition: initialSale.condition || 'New',
            imei1: initialSale.imei1 || '',
            imei2: initialSale.imei2 || '',
            price: initialSale.price !== undefined ? initialSale.price : '',
            quantity: 1,
          },
        ],
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

  const fetchRecordedSales = async (force = false) => {
    try {
      const res = await getSales({}, force);
      if (res.data && res.data.data) {
        setRecordedSales(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching recorded sales for invoice:', err);
    }
  };

  useEffect(() => {
    if (viewMode === 'history') {
      fetchHistory(true);
      fetchRecordedSales(true);
    }
  }, [viewMode]);

  useEffect(() => {
    if (isActive) {
      if (!initialSale) {
        setViewMode('history');
        setSelectedSaleId('');
        setInvoiceData(initialFormState);
      }
      fetchHistory();
      fetchRecordedSales();
    }
  }, [isActive]);

  // Multiple Devices Management Handlers
  const handleAddItem = () => {
    setInvoiceData((prev) => ({
      ...prev,
      items: [...prev.items, { ...emptyDevice }],
    }));
  };

  const handleRemoveItem = (index) => {
    if (invoiceData.items.length <= 1) return;
    setInvoiceData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const handleItemChange = (index, field, value) => {
    setInvoiceData((prev) => {
      const updated = [...prev.items];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, items: updated };
    });
  };

  // Calculate live grand total across all device items
  const calculateTotal = (items = invoiceData.items) => {
    if (!items || !items.length) return 0;
    return items.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1), 0);
  };

  const filteredInvoices = invoices.filter((item) => {
    if (!historySearch.trim()) return true;
    const term = historySearch.trim().toLowerCase();
    const inItems = (item.items || []).some(
      (it) =>
        it.modelName?.toLowerCase().includes(term) ||
        it.modelNumber?.toLowerCase().includes(term) ||
        it.imei1?.toLowerCase().includes(term) ||
        it.imei2?.toLowerCase().includes(term)
    );
    return (
      item.invoiceNumber?.toLowerCase().includes(term) ||
      item.customerName?.toLowerCase().includes(term) ||
      item.customerNumber?.toLowerCase().includes(term) ||
      item.modelName?.toLowerCase().includes(term) ||
      item.modelNumber?.toLowerCase().includes(term) ||
      item.condition?.toLowerCase().includes(term) ||
      item.imei1?.toLowerCase().includes(term) ||
      item.imei2?.toLowerCase().includes(term) ||
      inItems
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
      fetchRecordedSales(true);
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
  const saveInvoiceRecord = async ({ switchToHistory = true } = {}) => {
    if (!invoiceData.customerName?.trim() || !invoiceData.customerNumber?.trim()) {
      setAlert({
        type: 'error',
        message: 'Please fill in Customer Full Name and Customer Phone Number.',
      });
      return null;
    }
    if (!/^\d{11}$/.test(invoiceData.customerNumber.trim())) {
      setAlert({
        type: 'error',
        message: 'Customer phone number must contain exactly 11 digits.',
      });
      return null;
    }

    if (!invoiceData.items || invoiceData.items.length === 0) {
      setAlert({
        type: 'error',
        message: 'Please add at least one device to the invoice.',
      });
      return null;
    }

    // Validate each device item
    for (let i = 0; i < invoiceData.items.length; i++) {
      const it = invoiceData.items[i];
      if (!it.modelName?.trim()) {
        setAlert({
          type: 'error',
          message: `Device #${i + 1} model name is required.`,
        });
        return null;
      }
      if (it.price === '' || isNaN(it.price) || Number(it.price) < 0) {
        setAlert({
          type: 'error',
          message: `Device #${i + 1} (${it.modelName}) must have a valid price.`,
        });
        return null;
      }
    }

    setIsSaving(true);
    try {
      let saved;
      const payload = {
        ...invoiceData,
        price: calculateTotal(),
      };

      if (invoiceData._id) {
        // Update existing invoice record in database
        const res = await updateInvoice(invoiceData._id, payload);
        saved = res.data?.data;
        if (saved) {
          setInvoiceData((prev) => ({
            ...prev,
            ...saved,
            items: saved.items && saved.items.length ? saved.items : prev.items,
            date: saved.date ? new Date(saved.date).toISOString().split('T')[0] : prev.date,
          }));
        }
        setAlert({
          type: 'success',
          message: 'Invoice updated successfully',
        });
      } else {
        // Generate and save new invoice record in database
        const res = await createInvoice(payload);
        saved = res.data?.data;
        if (saved) {
          setInvoiceData((prev) => ({
            ...prev,
            _id: saved._id,
            invoiceNumber: saved.invoiceNumber,
            items: saved.items && saved.items.length ? saved.items : prev.items,
            date: saved.date ? new Date(saved.date).toISOString().split('T')[0] : prev.date,
          }));
        }
        if (res.data?.isDuplicate) {
          setAlert({
            type: 'info',
            message: res.data.message || `Invoice already exists as ${saved?.invoiceNumber || ''}. Loaded existing record.`,
          });
        } else {
          setAlert({
            type: 'success',
            message: 'Invoice generated successfully',
          });
        }
      }
      if (saved && saved._id) {
        setInvoices((prev) => {
          const exists = prev.some((inv) => inv._id === saved._id);
          return exists
            ? prev.map((inv) => (inv._id === saved._id ? saved : inv))
            : [saved, ...prev];
        });
      }
      await fetchHistory(true);
      fetchRecordedSales(true);
      setSelectedSaleId('');
      if (switchToHistory) {
        setInvoiceData(initialFormState);
        if (clearInitialSale) clearInitialSale();
        setViewMode('history');
      }
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
    const saved = viewMode === 'preview'
      ? invoiceData
      : await saveInvoiceRecord({ switchToHistory: false });
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
      setInvoiceData(initialFormState);
      if (clearInitialSale) clearInitialSale();
      setViewMode('history');
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
    const saved = viewMode === 'preview'
      ? invoiceData
      : await saveInvoiceRecord({ switchToHistory: false });
    if (!saved) return;
    setTimeout(() => {
      window.print();
      setInvoiceData(initialFormState);
      if (clearInitialSale) clearInitialSale();
      setViewMode('history');
    }, 150);
  };

  const handleStartNewInvoice = () => {
    setSelectedSaleId('');
    setInvoiceData(initialFormState);
    if (clearInitialSale) clearInitialSale();
    setAlert({
      type: 'success',
      message: 'New invoice initialized (Manual Entry)',
    });
  };

  const handleSelectRecordedSale = (chosenId) => {
    setSelectedSaleId(chosenId);

    if (!chosenId) {
      // Switch back to manual entry
      setInvoiceData(initialFormState);
      if (clearInitialSale) clearInitialSale();
      return;
    }

    const sale = recordedSales.find((s) => s._id === chosenId);
    if (!sale) return;

    const saleItems =
      Array.isArray(sale.items) && sale.items.length > 0
        ? sale.items.map((it) => ({
          modelName: it.modelName || '',
          modelNumber: it.modelNumber || '',
          condition: it.condition || 'New',
          imei1: it.imei1 || '',
          imei2: it.imei2 || '',
          price: it.price !== undefined ? it.price : '',
          quantity: it.quantity || 1,
        }))
        : [
          {
            modelName: sale.modelName || '',
            modelNumber: sale.modelNumber || '',
            condition: sale.condition || 'New',
            imei1: sale.imei1 || '',
            imei2: sale.imei2 || '',
            price: sale.price !== undefined ? sale.price : '',
            quantity: 1,
          },
        ];

    setInvoiceData({
      _id: null,
      saleId: sale._id,
      invoiceNumber: '',
      date: sale.createdAt ? new Date(sale.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      customerName: sale.customerName || '',
      customerNumber: sale.customerNumber || '',
      paymentMode: 'Cash / Instant',
      items: saleItems,
    });
  };

  const handleEditFromHistory = (item) => {
    if (clearInitialSale) clearInitialSale();
    const loadedItems = item.items && item.items.length > 0
      ? item.items.map((it) => ({
        modelName: it.modelName || '',
        modelNumber: it.modelNumber || '',
        condition: it.condition || 'New',
        imei1: it.imei1 || '',
        imei2: it.imei2 || '',
        price: it.price !== undefined ? it.price : '',
        quantity: it.quantity || 1,
      }))
      : [
        {
          modelName: item.modelName || '',
          modelNumber: item.modelNumber || '',
          condition: item.condition || 'New',
          imei1: item.imei1 || '',
          imei2: item.imei2 || '',
          price: item.price !== undefined ? item.price : '',
          quantity: 1,
        },
      ];

    setInvoiceData({
      _id: item._id,
      saleId: item.saleId || null,
      invoiceNumber: item.invoiceNumber,
      date: item.date ? new Date(item.date).toISOString().split('T')[0] : '',
      customerName: item.customerName || '',
      customerNumber: item.customerNumber || '',
      paymentMode: item.paymentMode || 'Cash / Instant',
      items: loadedItems,
    });
    setViewMode('generator');
    setAlert({
      type: 'success',
      message: `Editing invoice ${item.invoiceNumber}`,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLoadFromHistory = (item) => {
    if (clearInitialSale) clearInitialSale();
    const loadedItems = item.items && item.items.length > 0
      ? item.items.map((it) => ({
        modelName: it.modelName || '',
        modelNumber: it.modelNumber || '',
        condition: it.condition || 'New',
        imei1: it.imei1 || '',
        imei2: it.imei2 || '',
        price: it.price !== undefined ? it.price : '',
        quantity: it.quantity || 1,
      }))
      : [
        {
          modelName: item.modelName || '',
          modelNumber: item.modelNumber || '',
          condition: item.condition || 'New',
          imei1: item.imei1 || '',
          imei2: item.imei2 || '',
          price: item.price !== undefined ? item.price : '',
          quantity: 1,
        },
      ];

    setInvoiceData({
      _id: item._id,
      saleId: item.saleId || null,
      invoiceNumber: item.invoiceNumber,
      date: item.date ? new Date(item.date).toISOString().split('T')[0] : '',
      customerName: item.customerName || '',
      customerNumber: item.customerNumber || '',
      paymentMode: item.paymentMode || 'Cash / Instant',
      items: loadedItems,
    });
    setViewMode('preview');
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

          <div>
            <button
              className="btn-primary"
              onClick={() => {
                if (viewMode === 'generator' || viewMode === 'preview') {
                  setSelectedSaleId('');
                  setInvoiceData(initialFormState);
                  if (clearInitialSale) clearInitialSale();
                  setViewMode('history');
                } else {
                  setSelectedSaleId('');
                  setInvoiceData(initialFormState);
                  if (clearInitialSale) clearInitialSale();
                  setViewMode('generator');
                }
              }}
            >
              <Plus size={15} />
              {viewMode === 'generator'
                ? 'Close Form'
                : viewMode === 'preview'
                  ? 'Close Preview'
                  : 'Generate Invoice'}
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
                  <th style={{ width: '14%' }}>Date</th>
                  <th style={{ width: '22%' }}>Device Model</th>
                  <th style={{ width: '20%' }}>Customer</th>
                  <th style={{ width: '15%' }}>Total (PKR)</th>
                  <th style={{ width: '15%', textAlign: 'center', paddingRight: '14px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingHistory ? (
                  <tr>
                    <td colSpan="6" className="empty-state">Loading invoice history...</td>
                  </tr>
                ) : filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="empty-state">No invoice records found.</td>
                  </tr>
                ) : (
                  filteredInvoices.map((item) => {
                    const invDevices =
                      item.items && item.items.length > 0
                        ? item.items
                        : [
                          {
                            modelName: item.modelName || 'Device Sale',
                            modelNumber: item.modelNumber || '',
                            condition: item.condition || 'New',
                          },
                        ];
                    return (
                      <tr key={item._id}>
                        {/* Invoice No */}
                        <td>
                          <span className="cell-mono" style={{ color: 'var(--brand-gold-hover)', fontWeight: 700 }}>
                            {item.invoiceNumber}
                          </span>
                        </td>

                        {/* Date */}
                        <td>
                          <span className="cell-mono">
                            {item.date ? new Date(item.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                          </span>
                        </td>

                        {/* Device Model */}
                        <td>
                          {invDevices.length > 1 ? (
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '3px' }}>
                                <span className="cell-badge badge-gray" style={{ fontWeight: 700 }}>
                                  {invDevices.length} Devices
                                </span>
                              </div>
                              <div style={{ fontSize: '12px', color: '#334155', lineHeight: 1.4 }}>
                                {invDevices.map((it, idx) => (
                                  <div key={idx}>• {it.modelName}</div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div>
                              <span className="cell-title">{invDevices[0].modelName}</span>
                              {invDevices[0].modelNumber && (
                                <span className="cell-sub">{invDevices[0].modelNumber}</span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Customer (Name & Phone combined like Sales & Purchases) */}
                        <td>
                          <span className="cell-title">{item.customerName}</span>
                          <span className="cell-sub" style={{ color: '#090d16', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Phone size={11} style={{ color: '#64748b', flexShrink: 0 }} />
                            {item.customerNumber}
                          </span>
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
                              style={{ padding: '0 8px' }}
                              onClick={() => handleLoadFromHistory(item)}
                              title="View & Print Invoice"
                            >
                              <Printer size={13} />
                            </button>
                            <button
                              className="btn-details-toggle"
                              onClick={() => handleEditFromHistory(item)}
                              title="Edit Invoice"
                            >
                              <Edit3 size={13} />
                            </button>
                            <button
                              className="action-btn-danger"
                              onClick={() => handleDeleteInvoice(item._id, item.invoiceNumber)}
                              title="Delete Invoice"
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

          {/* Mobile Invoices List */}
          <div className="show-on-mobile mobile-card-container">
            {loadingHistory ? (
              <div className="empty-state">Loading invoices...</div>
            ) : filteredInvoices.length === 0 ? (
              <div className="empty-state">No invoice records found.</div>
            ) : (
              filteredInvoices.map((item) => (
                <div key={item._id} className="mobile-card">
                  <div className="mobile-card-top">
                    <div>
                      <div className="mobile-card-title" style={{ color: 'var(--brand-gold-hover)' }}>
                        {item.invoiceNumber}
                      </div>
                      <div className="mobile-card-subtitle" style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                        <span>{item.customerName}</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          • <Phone size={11} style={{ color: '#64748b' }} /> {item.customerNumber}
                        </span>
                      </div>
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

                    <div className={`mobile-meta-cell ${item.items && item.items.length > 1 ? 'full-width' : ''}`}>
                      <div className="mobile-meta-label">Devices Included</div>
                      <div className="mobile-meta-val">
                        {item.items && item.items.length > 1
                          ? `${item.items.length} Devices (${item.items.map((i) => i.modelName).join(', ')})`
                          : item.items?.[0]?.modelName || item.modelName || 'Device Sale'}
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
                      onClick={() => handleDeleteInvoice(item._id, item.invoiceNumber)}
                      title="Delete Invoice"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        /* Generator / Preview View */
        <div>
          {/* Editable Fields Form Card (Hidden in preview-only mode) */}
          {viewMode === 'generator' && (
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

              {/* Quick Auto-Fill from Recorded Sales Dropdown (or Manual Entry) */}
              {!invoiceData._id && (
                <div style={{ marginBottom: '16px', background: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--border-card)' }}>
                  <SmartDropdown
                    label="Create Invoice from Recorded Sale (Optional — or enter manually below)"
                    placeholder="Manual Entry (Type Details Manually) — or click to pick a recorded sale"
                    searchPlaceholder="Search recorded sales by customer, phone, model..."
                    value={selectedSaleId}
                    onChange={handleSelectRecordedSale}
                    manualOption={{
                      label: 'Manual Entry',
                      description: 'Clear selection and type customer & device details manually',
                    }}
                    emptyText="No un-invoiced sales found."
                    options={recordedSales
                      .filter((sale) => !sale.hasInvoice)
                      .map((sale) => {
                        const deviceList =
                          Array.isArray(sale.items) && sale.items.length > 0 ? sale.items : [sale];
                        const deviceLabel =
                          deviceList.length > 1
                            ? `${deviceList.length} Devices (${deviceList.map((it) => it.modelName).join(', ')})`
                            : deviceList[0].modelName;
                        const dateStr = sale.createdAt
                          ? new Date(sale.createdAt).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })
                          : '';
                        return {
                          value: sale._id,
                          label: `${sale.customerName} — ${deviceLabel}`,
                          searchText: `${sale.customerName} ${sale.customerNumber} ${deviceLabel} ${dateStr} ${sale.price} ${sale.status || ''} ${deviceList.map((d) => `${d.modelNumber || ''} ${d.imei1 || ''} ${d.status || ''}`).join(' ')}`,
                          sale,
                          deviceLabel,
                          dateStr,
                        };
                      })}
                    renderSelected={(opt) => (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', width: '100%', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, color: '#090d16', fontSize: '13px', whiteSpace: 'nowrap' }}>
                            {opt.sale.customerName}
                          </span>
                          <span style={{ color: '#64748b', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '3px', whiteSpace: 'nowrap' }}>
                            <Phone size={11} /> {opt.sale.customerNumber}
                          </span>
                          <span style={{ color: '#334155', fontSize: '12.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            • {opt.deviceLabel}
                          </span>
                        </div>
                        <span style={{ fontWeight: 700, color: '#059669', fontSize: '12.5px', flexShrink: 0 }}>
                          PKR {Number(opt.sale.price).toLocaleString()}
                        </span>
                      </div>
                    )}
                    renderOption={(opt) => (
                      <div className="smart-dropdown-grid-invoice">
                        <span style={{ fontWeight: 700, fontSize: '13px', color: '#090d16', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {opt.sale.customerName}
                        </span>
                        <span className="smart-dropdown-col-hide-mobile" style={{ fontSize: '11.5px', color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                          <Phone size={10} style={{ flexShrink: 0 }} /> {opt.sale.customerNumber}
                        </span>
                        <span style={{ fontSize: '12px', color: '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {opt.deviceLabel}
                        </span>
                        <span className="smart-dropdown-col-hide-mobile" style={{ fontSize: '11px', color: '#94a3b8', whiteSpace: 'nowrap', textAlign: 'right' }}>
                          {opt.dateStr || ''}
                        </span>
                        <span style={{ fontWeight: 700, fontSize: '12.5px', color: '#059669', whiteSpace: 'nowrap', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          PKR {Number(opt.sale.price).toLocaleString()}
                        </span>
                      </div>
                    )}
                  />
                </div>
              )}

              {/* Customer Information Header Section */}
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
                  <label>
                    Customer Phone Number * (11 digits)
                    {invoiceData.customerNumber && (
                      <span style={{ marginLeft: '6px', color: invoiceData.customerNumber.length === 11 ? 'var(--success-color)' : 'var(--text-muted)' }}>
                        ({invoiceData.customerNumber.length}/11)
                      </span>
                    )}
                  </label>
                  <input
                    type="tel"
                    maxLength={11}
                    placeholder="e.g. 03001234567"
                    value={invoiceData.customerNumber}
                    onChange={(e) => setInvoiceData({ ...invoiceData, customerNumber: e.target.value.replace(/\D/g, '').slice(0, 11) })}
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
                  <label>Payment Mode</label>
                  <select
                    value={invoiceData.paymentMode || 'Cash / Instant'}
                    onChange={(e) => setInvoiceData({ ...invoiceData, paymentMode: e.target.value })}
                  >
                    <option value="Cash / Instant">Cash / Instant</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="JazzCash / Easypaisa">JazzCash / Easypaisa</option>
                    <option value="Card / POS">Card / POS</option>
                    <option value="Installment / Credit">Installment / Credit</option>
                  </select>
                </div>

                {/* Multiple Devices Section */}
                <div className="invoice-devices-section">
                  <div className="invoice-devices-section-header">
                    <span className="invoice-devices-section-title">
                      <Smartphone size={16} /> Devices / Items in Invoice
                      <span className="invoice-devices-count-pill">
                        {invoiceData.items.length} {invoiceData.items.length === 1 ? 'Device' : 'Devices'}
                      </span>
                    </span>
                  </div>

                  {invoiceData.items.map((item, index) => (
                    <div key={index} className="invoice-device-card">
                      <div className="invoice-device-header">
                        <div className="invoice-device-title">
                          <span className="invoice-device-badge">#{index + 1}</span>
                          <span>{item.modelName ? item.modelName : `Device #${index + 1}`}</span>
                          {item.price !== '' && !isNaN(item.price) && (
                            <span style={{ color: '#059669', fontSize: '12px', fontWeight: 700 }}>
                              • PKR {Number(item.price).toLocaleString()}
                            </span>
                          )}
                        </div>
                        {invoiceData.items.length > 1 && (
                          <button
                            type="button"
                            className="invoice-device-remove-btn"
                            onClick={() => handleRemoveItem(index)}
                            title={`Remove Device #${index + 1}`}
                          >
                            <Trash2 size={12} /> Remove Device
                          </button>
                        )}
                      </div>

                      <div className="form-grid-3">
                        <div className="form-field">
                          <label>Device Model Name *</label>
                          <input
                            type="text"
                            placeholder="e.g. iPhone 13 Pro"
                            value={item.modelName}
                            onChange={(e) => handleItemChange(index, 'modelName', e.target.value)}
                          />
                        </div>

                        <div className="form-field">
                          <label>Model Number (Optional)</label>
                          <input
                            type="text"
                            placeholder="e.g. A2638"
                            value={item.modelNumber}
                            onChange={(e) => handleItemChange(index, 'modelNumber', e.target.value)}
                          />
                        </div>

                        <div className="form-field">
                          <label>Device Condition *</label>
                          <select
                            value={item.condition || 'New'}
                            onChange={(e) => handleItemChange(index, 'condition', e.target.value)}
                          >
                            <option value="New">Brand New</option>
                            <option value="Used">Used / Pre-Owned</option>
                          </select>
                        </div>

                        <div className="form-field">
                          <label>Sale Price (PKR) *</label>
                          <input
                            type="number"
                            placeholder="0"
                            value={item.price}
                            onChange={(e) => handleItemChange(index, 'price', e.target.value)}
                          />
                        </div>

                        <div className="form-field">
                          <label>IMEI 1 (Optional)</label>
                          <input
                            type="text"
                            maxLength={15}
                            placeholder="15 digits"
                            value={item.imei1}
                            onChange={(e) => handleItemChange(index, 'imei1', e.target.value.replace(/\D/g, ''))}
                          />
                        </div>

                        <div className="form-field">
                          <label>IMEI 2 (Optional)</label>
                          <input
                            type="text"
                            maxLength={15}
                            placeholder="15 digits"
                            value={item.imei2}
                            onChange={(e) => handleItemChange(index, 'imei2', e.target.value.replace(/\D/g, ''))}
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Footer Controls: Add Another Device & Live Summary */}
                  <div className="invoice-actions-footer">
                    <button
                      type="button"
                      className="btn-add-device"
                      onClick={handleAddItem}
                    >
                      <Plus size={14} /> Add Another Device
                    </button>

                    <div className="invoice-live-summary">
                      <span>Devices: <strong>{invoiceData.items.length}</strong></span>
                      <span>Grand Total: <strong>PKR {calculateTotal().toLocaleString()}</strong></span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons Above Invoice Preview (Always visible without scrolling A4 sheet) */}
          <div className="invoice-bottom-actions hide-on-print">
            {viewMode === 'generator' && (
              <button
                type="button"
                className="btn-primary action-btn-lg"
                style={{ background: '#16a34a', borderColor: '#15803d' }}
                onClick={() => saveInvoiceRecord({ switchToHistory: true })}
                disabled={isSaving}
                title={invoiceData._id ? 'Save modifications to database' : 'Save invoice to database'}
              >
                <Check size={16} />
                <span>{isSaving ? 'Saving...' : invoiceData._id ? 'Save Updates' : 'Save Record'}</span>
              </button>
            )}
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
                    <p style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Phone size={11} style={{ flexShrink: 0 }} />
                      <span>Phone: 03326421749</span>
                    </p>
                  </div>
                </div>

                <div className="invoice-meta-box">
                  <h3>INVOICE</h3>
                  <p><strong>Invoice No:</strong> {invoiceData.invoiceNumber || 'UM-XXXX (Draft)'}</p>
                  <p><strong>Date:</strong> {invoiceData.date || new Date().toISOString().split('T')[0]}</p>
                </div>
              </div>

              {/* Customer & Sale Meta Information */}
              <div className="invoice-details-grid">
                <div className="invoice-col">
                  <h4>CUSTOMER DETAILS</h4>
                  <p><strong>Name:</strong> {invoiceData.customerName || '—'}</p>
                  <p style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Phone size={11} style={{ flexShrink: 0 }} />
                    <span><strong>Phone:</strong> {invoiceData.customerNumber || '—'}</span>
                  </p>
                </div>

                <div className="invoice-col">
                  <h4>INVOICE SUMMARY</h4>
                  <p><strong>Total Items:</strong> {invoiceData.items.length} {invoiceData.items.length === 1 ? 'Device' : 'Devices'}</p>
                  <p><strong>Payment Mode:</strong> {invoiceData.paymentMode || 'Cash / Instant'}</p>
                </div>
              </div>

              {/* Multiple Items Table */}
              <table className="invoice-table">
                <thead>
                  <tr>
                    <th style={{ width: '10%', whiteSpace: 'nowrap' }}>Sr. #</th>
                    <th style={{ width: '55%' }}>Item Description</th>
                    <th style={{ width: '12%', textAlign: 'center' }}>Qty</th>
                    <th style={{ width: '23%', textAlign: 'right' }}>Total (PKR)</th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceData.items.map((item, index) => (
                    <tr key={index}>
                      <td>{index + 1}</td>
                      <td>
                        <strong>{item.modelName || 'Device Sale'} {item.condition ? `(${item.condition})` : ''}</strong>
                        {item.modelNumber && <div style={{ fontSize: '12px', color: '#555' }}>Model: {item.modelNumber}</div>}
                        {item.imei1 && <div style={{ fontSize: '11px', color: '#666' }}>IMEI: {item.imei1}</div>}
                        {item.imei2 && <div style={{ fontSize: '11px', color: '#666' }}>IMEI 2: {item.imei2}</div>}
                      </td>
                      <td style={{ textAlign: 'center' }}>{item.quantity || 1}</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                        {item.price ? Number(item.price).toLocaleString() : '0'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Summary Total */}
              <div className="invoice-total-container">
                <div className="invoice-total-box">
                  <span>Grand Total:</span>
                  <span>PKR {calculateTotal().toLocaleString()}</span>
                </div>
              </div>

              {/* Terms and Return Policy */}
              <div className="invoice-terms-box">
                <p><strong>Notice &amp; Warranty Terms:</strong></p>
                <p>1. Please inspect all devices carefully before leaving the store.</p>
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
