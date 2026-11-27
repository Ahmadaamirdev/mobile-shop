import React, { useState, useEffect, useCallback } from 'react';
import { getRecords } from '../services/api';
import {
  History,
  Search,
  RefreshCw,
  ArrowDownLeft,
  ArrowUpRight,
  Package,
  Calendar,
} from 'lucide-react';
import DateRangeFilter from './DateRangeFilter';

const Records = ({ isActive, onNavigate, setAlert }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedType, setSelectedType] = useState('all'); // 'all' | 'in' | 'out'
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [specificDate, setSpecificDate] = useState('');

  const fetchRecords = useCallback(
    async (force = false, showSpinner = false) => {
      if (showSpinner) setRefreshing(true);
      try {
        const params = { tzOffset: new Date().getTimezoneOffset() };
        if (specificDate) {
          params.date = specificDate;
        } else {
          if (startDate) params.startDate = startDate;
          if (endDate) params.endDate = endDate;
        }
        if (selectedType !== 'all') params.type = selectedType;
        if (selectedCategory !== 'All') params.category = selectedCategory;
        if (search.trim()) params.search = search.trim();

        const res = await getRecords(params, force);
        if (res.data && res.data.data) {
          setData(res.data.data);
        }
      } catch (err) {
        if (setAlert) {
          setAlert({
            type: 'error',
            message: err.response?.data?.message || 'Error loading stock records.',
          });
        }
      } finally {
        setLoading(false);
        if (showSpinner) setRefreshing(false);
      }
    },
    [specificDate, startDate, endDate, selectedType, selectedCategory, search, setAlert]
  );

  useEffect(() => {
    if (isActive) {
      fetchRecords(false, false);
    }
  }, [isActive, fetchRecords]);

  useEffect(() => {
    const handleSync = () => fetchRecords(true, false);
    window.addEventListener('unity-data-updated', handleSync);
    return () => window.removeEventListener('unity-data-updated', handleSync);
  }, [fetchRecords]);

  useEffect(() => {
    if (!isActive) return undefined;
    const timer = setInterval(() => fetchRecords(true, false), 30000);
    return () => clearInterval(timer);
  }, [isActive, fetchRecords]);

  const summary = data?.summary || {
    daysCount: 0,
    movementsCount: 0,
    totalAddedUnits: 0,
    totalAddedValue: 0,
    totalSubtractedUnits: 0,
    totalSubtractedValue: 0,
    netUnits: 0,
    liveInventoryUnits: 0,
    liveInventoryValue: 0,
  };

  const inventoryLedger = data?.inventoryLedger || [];

  // Build flat non-zero rows so "0 units / PKR 0" never repeats
  const ledgerRows = [];
  inventoryLedger.forEach((row) => {
    if (selectedType !== 'out' && row.purchasedUnits > 0) {
      ledgerRows.push({
        rowKey: `${row.key}-in`,
        ...row,
        recordType: 'Purchased',
        units: row.purchasedUnits,
        amount: row.purchasedAmount,
      });
    }
    if (selectedType !== 'in' && row.soldUnits > 0) {
      ledgerRows.push({
        rowKey: `${row.key}-out`,
        ...row,
        recordType: 'Sold',
        units: row.soldUnits,
        amount: row.soldAmount,
      });
    }
  });

  return (
    <div>
      {/* 1. Header Card */}
      <div className="panel-header-card">
        <div className="panel-header-row records-header-row">
          <div className="panel-header-left">
            <div className="panel-icon-box">
              <History size={18} />
            </div>
            <div className="panel-header-text">
              <h2>Stock &amp; Daily Records</h2>
              <p>Inventory synchronization ledger linking Purchases and Sales directly with Live Inventory.</p>
            </div>
          </div>

          <div className="records-header-actions records-header-actions-single">
            <button
              type="button"
              className="btn-secondary dashboard-refresh-btn"
              onClick={() => fetchRecords(true, true)}
              disabled={refreshing}
              title="Sync records with live inventory"
            >
              <RefreshCw size={14} className={refreshing ? 'spin-icon' : ''} />
              <span>{refreshing ? 'Syncing...' : 'Sync'}</span>
            </button>
          </div>
        </div>

        {/* Toolbar Filters */}
        <div className="panel-toolbar-row">
          {/* Mobile: compact dropdowns */}
          <div className="mobile-filter-row">
            <select
              className="mobile-filter-select"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
            >
              <option value="all">All Records</option>
              <option value="in">Purchased</option>
              <option value="out">Sold</option>
            </select>
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
          </div>

          <div className="toolbar-desktop-grid records-toolbar-grid">
            <div className="panel-filter-pills records-type-pills">
              {[
                { id: 'all', label: 'All Records' },
                { id: 'in', label: 'Purchased', pillClass: 'pill-new' },
                { id: 'out', label: 'Sold', pillClass: 'pill-used' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`filter-pill records-type-pill ${t.pillClass || ''} ${selectedType === t.id ? 'active' : 'inactive'}`}
                  onClick={() => setSelectedType(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="subfilter-group panel-filter-pills">
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

            <div className="panel-search-box">
              <Search size={14} className="search-icon" />
              <input
                type="text"
                placeholder="Search model, IMEI, customer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="records-date-controls">
              <div className="records-day-picker-wrap" title="Filter by a specific single day">
                <span className="date-input-label">Day</span>
                <input
                  type="date"
                  className="records-day-input"
                  value={specificDate}
                  onChange={(e) => {
                    setSpecificDate(e.target.value);
                    if (e.target.value) {
                      setStartDate('');
                      setEndDate('');
                    }
                  }}
                  aria-label="Filter by specific day"
                />
                {specificDate && (
                  <button
                    type="button"
                    className="records-day-clear"
                    onClick={() => setSpecificDate('')}
                    title="Clear day filter"
                  >
                    ×
                  </button>
                )}
              </div>

              <DateRangeFilter
                startDate={startDate}
                endDate={endDate}
                onChangeStart={(val) => {
                  setSpecificDate('');
                  setStartDate(val);
                }}
                onChangeEnd={(val) => {
                  setSpecificDate('');
                  setEndDate(val);
                }}
                onClear={() => {
                  setStartDate('');
                  setEndDate('');
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2. Sync Summary Strip */}
      <div className="records-summary-grid">
        <div className="records-summary-card">
          <div className="records-sum-top">
            <span>Purchased</span>
            <ArrowDownLeft size={15} className="records-mobile-purchase-icon" style={{ color: '#64748b' }} />
          </div>
          <div className="records-sum-val records-mobile-purchase-val">
            {summary.totalAddedUnits} {summary.totalAddedUnits === 1 ? 'unit' : 'units'}
          </div>
          <div className="records-sum-sub">PKR {Number(summary.totalAddedValue || 0).toLocaleString()}</div>
        </div>

        <div className="records-summary-card">
          <div className="records-sum-top">
            <span>Sold</span>
            <ArrowUpRight size={15} className="records-mobile-sale-icon" style={{ color: '#64748b' }} />
          </div>
          <div className="records-sum-val records-mobile-sale-val">
            {summary.totalSubtractedUnits} {summary.totalSubtractedUnits === 1 ? 'unit' : 'units'}
          </div>
          <div className="records-sum-sub">PKR {Number(summary.totalSubtractedValue || 0).toLocaleString()}</div>
        </div>

        <div className="records-summary-card">
          <div className="records-sum-top">
            <span>Net Stock</span>
            <Calendar size={15} style={{ color: '#64748b' }} />
          </div>
          <div className="records-sum-val">
            {summary.netUnits} {Math.abs(summary.netUnits) === 1 ? 'unit' : 'units'}
          </div>
          <div className="records-sum-sub">
            Across {summary.daysCount} {summary.daysCount === 1 ? 'day' : 'days'} ({summary.movementsCount} records)
          </div>
        </div>

        <button
          type="button"
          className="records-summary-card records-summary-clickable"
          onClick={() => onNavigate && onNavigate('inventory')}
        >
          <div className="records-sum-top">
            <span>Live Inventory Stock</span>
            <Package size={15} style={{ color: '#64748b' }} />
          </div>
          <div className="records-sum-val">
            {summary.liveInventoryUnits} in stock
          </div>
          <div className="records-sum-sub">
            PKR {Number(summary.liveInventoryValue || 0).toLocaleString()} • View Stock →
          </div>
        </button>
      </div>

      {/* 3. Inventory Sync Ledger (Default & Only View) */}
      {loading && !data ? (
        <div className="table-card">
          <div className="empty-state">Loading synchronized stock records...</div>
        </div>
      ) : (
        <div className="table-card">
          <div className="hide-on-mobile desktop-table-container">
            <table className="pro-table">
              <thead>
                <tr>
                  <th style={{ width: '24%' }}>Device Model</th>
                  <th style={{ width: '13%', textAlign: 'center' }}>Category</th>
                  <th style={{ width: '13%', textAlign: 'center' }}>Condition</th>
                  <th style={{ width: '15%', textAlign: 'center' }}>Type</th>
                  <th style={{ width: '20%', textAlign: 'center' }}>Units &amp; Price</th>
                  <th style={{ width: '15%', textAlign: 'center', paddingRight: '14px' }}>Live Stock</th>
                </tr>
              </thead>
              <tbody>
                {ledgerRows.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="empty-state">No model stock ledger entries match filters.</td>
                  </tr>
                ) : (
                  ledgerRows.map((row) => (
                      <tr key={row.rowKey}>
                        <td>
                          <span className="cell-title">{row.modelName}</span>
                          {row.companyName && <span className="cell-sub">{row.companyName}</span>}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className="cell-badge badge-gray category-pill records-table-pill">{row.category}</span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`cell-badge condition-pill records-table-pill ${row.condition === 'Used' ? 'badge-warning' : 'badge-success'}`}>
                            {row.condition}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ fontWeight: 700, fontSize: '13px', color: '#090d16' }}>
                            {row.recordType}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div className="records-col-pill-wrap">
                            <span style={{ fontWeight: 700, color: '#090d16' }}>
                              {row.units} {row.units === 1 ? 'unit' : 'units'}
                            </span>
                            <span className="cell-sub">PKR {Number(row.amount || 0).toLocaleString()}</span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'center', paddingRight: '14px' }}>
                          <span
                            className="cell-badge badge-gray records-table-pill"
                            style={{ cursor: 'pointer', color: '#090d16' }}
                            onClick={() => onNavigate && onNavigate('inventory')}
                            title="Open Live Inventory"
                          >
                            {row.liveStock} in stock
                          </span>
                        </td>
                      </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="show-on-mobile mobile-card-container">
            {ledgerRows.length === 0 ? (
              <div className="empty-state">No model stock ledger entries match filters.</div>
            ) : (
              ledgerRows.map((row) => {
                const isPurchase = row.recordType === 'Purchased';
                const typeColor = isPurchase ? '#059669' : '#dc2626';
                const formattedDate = row.lastActivityAt
                  ? new Date(row.lastActivityAt).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })
                  : '—';
                return (
                  <div key={row.rowKey} className="mobile-card">
                    <div className="mobile-card-top">
                      <div>
                        <div className="mobile-card-title">{row.modelName}</div>
                        <div className="mobile-card-subtitle">
                          {row.category} • {row.condition}{row.companyName ? ` • ${row.companyName}` : ''}
                        </div>
                      </div>
                      <div className="mobile-card-price" style={{ color: typeColor }}>
                        PKR {Number(row.amount || 0).toLocaleString()}
                      </div>
                    </div>
                    <div className="mobile-card-meta-grid">
                      <div className="mobile-meta-cell">
                        <div className="mobile-meta-label">Type &amp; Units</div>
                        <div className="mobile-meta-val" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 700, color: typeColor }}>
                            {row.recordType}
                          </span>
                          <span>•</span>
                          <span style={{ fontWeight: 700, color: typeColor }}>
                            {row.units} {row.units === 1 ? 'unit' : 'units'}
                          </span>
                        </div>
                      </div>
                      <div className="mobile-meta-cell">
                        <div className="mobile-meta-label">Live Stock</div>
                        <div className="mobile-meta-val">
                          <span className="cell-badge badge-gray" style={{ color: '#090d16' }}>
                            {row.liveStock} in stock
                          </span>
                        </div>
                      </div>
                      <div className="mobile-meta-cell full-width">
                        <div className="mobile-meta-label">Date</div>
                        <div className="mobile-meta-val">{formattedDate}</div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Records;
