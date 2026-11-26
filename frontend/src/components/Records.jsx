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
  ChevronDown,
  ChevronRight,
  Layers,
} from 'lucide-react';
import DateRangeFilter from './DateRangeFilter';

const formatDayHeading = (dateStr) => {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatTime = (isoStr) => {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

const Records = ({ isActive, onNavigate, setAlert }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [viewMode, setViewMode] = useState('daily'); // 'daily' | 'ledger'
  const [selectedType, setSelectedType] = useState('all'); // 'all' | 'in' | 'out'
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [specificDate, setSpecificDate] = useState('');
  const [collapsedDays, setCollapsedDays] = useState({});

  const fetchRecords = useCallback(
    async (force = false) => {
      if (force) setRefreshing(true);
      try {
        const params = {};
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
        setRefreshing(false);
      }
    },
    [specificDate, startDate, endDate, selectedType, selectedCategory, search, setAlert]
  );

  useEffect(() => {
    fetchRecords(true);
  }, [fetchRecords]);

  useEffect(() => {
    if (isActive) {
      fetchRecords(true);
    }
  }, [isActive, fetchRecords]);

  useEffect(() => {
    const handleSync = () => fetchRecords(true);
    window.addEventListener('unity-data-updated', handleSync);
    return () => window.removeEventListener('unity-data-updated', handleSync);
  }, [fetchRecords]);

  useEffect(() => {
    if (!isActive) return undefined;
    const timer = setInterval(() => fetchRecords(true), 30000);
    return () => clearInterval(timer);
  }, [isActive, fetchRecords]);

  const toggleDay = (dateKey) => {
    setCollapsedDays((prev) => ({ ...prev, [dateKey]: !prev[dateKey] }));
  };

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

  const days = data?.days || [];
  const inventoryLedger = data?.inventoryLedger || [];

  const getMovementBadge = (m) => {
    if (m.type === 'PURCHASE_IN') return { label: 'Purchased (+Added)', cls: 'badge-success', isIn: true };
    if (m.type === 'SALE_OUT') return { label: 'Sold (-Subtracted)', cls: 'badge-danger', isIn: false };
    if (m.type === 'SALE_RESTORE') return { label: 'Sale Restored (+)', cls: 'badge-success', isIn: true };
    if (m.type === 'PURCHASE_REVERSAL') return { label: 'Purchase Removed (-)', cls: 'badge-warning', isIn: false };
    return m.direction === 'IN'
      ? { label: 'Stock Added (+)', cls: 'badge-success', isIn: true }
      : { label: 'Stock Deducted (-)', cls: 'badge-warning', isIn: false };
  };

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
              <p>Day-by-day ledger linking Purchases (+added) and Sales (-subtracted) directly with Live Inventory.</p>
            </div>
          </div>

          <div className="records-header-actions">
            <div className="records-view-toggle">
              <button
                type="button"
                className={`records-tab-btn ${viewMode === 'daily' ? 'active' : ''}`}
                onClick={() => setViewMode('daily')}
              >
                <Calendar size={13} /> Daily Log
              </button>
              <button
                type="button"
                className={`records-tab-btn ${viewMode === 'ledger' ? 'active' : ''}`}
                onClick={() => setViewMode('ledger')}
              >
                <Layers size={13} /> Inventory Sync
              </button>
            </div>
            <button
              type="button"
              className="btn-secondary dashboard-refresh-btn"
              onClick={() => fetchRecords(true)}
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
              <option value="all">All Movements</option>
              <option value="in">+ Purchased (Added)</option>
              <option value="out">- Sold (Subtracted)</option>
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

          <div className="toolbar-desktop-grid">
            <div className="panel-filter-pills">
              {[
                { id: 'all', label: 'All Movements' },
                { id: 'in', label: '+ Purchased (Added)', pillClass: 'pill-new' },
                { id: 'out', label: '- Sold (Subtracted)', pillClass: 'pill-used' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`filter-pill ${t.pillClass || ''} ${selectedType === t.id ? 'active' : 'inactive'}`}
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
            <span>Purchased (+Added)</span>
            <ArrowDownLeft size={15} style={{ color: '#059669' }} />
          </div>
          <div className="records-sum-val" style={{ color: '#059669' }}>
            +{summary.totalAddedUnits} {summary.totalAddedUnits === 1 ? 'unit' : 'units'}
          </div>
          <div className="records-sum-sub">PKR {Number(summary.totalAddedValue || 0).toLocaleString()}</div>
        </div>

        <div className="records-summary-card">
          <div className="records-sum-top">
            <span>Sold (-Subtracted)</span>
            <ArrowUpRight size={15} style={{ color: '#dc2626' }} />
          </div>
          <div className="records-sum-val" style={{ color: '#dc2626' }}>
            -{summary.totalSubtractedUnits} {summary.totalSubtractedUnits === 1 ? 'unit' : 'units'}
          </div>
          <div className="records-sum-sub">PKR {Number(summary.totalSubtractedValue || 0).toLocaleString()}</div>
        </div>

        <div className="records-summary-card">
          <div className="records-sum-top">
            <span>Net Stock Flow</span>
            <Calendar size={15} style={{ color: '#d97706' }} />
          </div>
          <div className="records-sum-val">
            {summary.netUnits > 0 ? `+${summary.netUnits}` : summary.netUnits} units
          </div>
          <div className="records-sum-sub">
            Across {summary.daysCount} {summary.daysCount === 1 ? 'day' : 'days'} ({summary.movementsCount} events)
          </div>
        </div>

        <button
          type="button"
          className="records-summary-card records-summary-clickable"
          onClick={() => onNavigate && onNavigate('inventory')}
        >
          <div className="records-sum-top">
            <span>Live Inventory Stock</span>
            <Package size={15} style={{ color: '#2563eb' }} />
          </div>
          <div className="records-sum-val" style={{ color: '#2563eb' }}>
            {summary.liveInventoryUnits} in stock
          </div>
          <div className="records-sum-sub">
            PKR {Number(summary.liveInventoryValue || 0).toLocaleString()} • View Stock →
          </div>
        </button>
      </div>

      {/* 3. Main Content: Daily Log OR Inventory Sync Ledger */}
      {loading && !data ? (
        <div className="table-card">
          <div className="empty-state">Loading synchronized stock records...</div>
        </div>
      ) : viewMode === 'daily' ? (
        days.length === 0 ? (
          <div className="table-card">
            <div className="empty-state">No stock movements found for the selected filters.</div>
          </div>
        ) : (
          <div className="records-days-list">
            {days.map((day) => {
              const isCollapsed = Boolean(collapsedDays[day.date]);
              return (
                <div key={day.date} className="table-card records-day-card">
                  {/* Day Header */}
                  <button
                    type="button"
                    className="records-day-header"
                    onClick={() => toggleDay(day.date)}
                  >
                    <div className="records-day-left">
                      {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                      <div>
                        <div className="records-day-title">{formatDayHeading(day.date)}</div>
                        <div className="records-day-sub">
                          {day.transactions.length} {day.transactions.length === 1 ? 'movement' : 'movements'}
                        </div>
                      </div>
                    </div>

                    <div className="records-day-badges">
                      <span className="cell-badge badge-success">
                        +{day.purchasedUnits} Added (PKR {Number(day.purchasedAmount || 0).toLocaleString()})
                      </span>
                      <span className="cell-badge badge-danger">
                        -{day.soldUnits} Sold (PKR {Number(day.soldAmount || 0).toLocaleString()})
                      </span>
                      <span className="cell-badge badge-gray">
                        Net: {day.netUnits > 0 ? `+${day.netUnits}` : day.netUnits}
                      </span>
                    </div>
                  </button>

                  {!isCollapsed && (
                    <div className="records-day-body">
                      {/* Desktop Table */}
                      <div className="hide-on-mobile desktop-table-container">
                        <table className="pro-table">
                          <thead>
                            <tr>
                              <th style={{ width: '10%' }}>Time</th>
                              <th style={{ width: '18%' }}>Action</th>
                              <th style={{ width: '24%' }}>Device / Item</th>
                              <th style={{ width: '18%' }}>Party / Link</th>
                              <th style={{ width: '16%' }}>Inventory Effect</th>
                              <th style={{ width: '14%', textAlign: 'right', paddingRight: '14px' }}>Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {day.transactions.map((m) => {
                              const badge = getMovementBadge(m);
                              const absQty = Math.abs(Number(m.quantityDelta) || 0);
                              return (
                                <tr key={m._id}>
                                  <td>
                                    <span className="cell-mono">{formatTime(m.occurredAt)}</span>
                                  </td>
                                  <td>
                                    <span className={`cell-badge ${badge.cls}`}>{badge.label}</span>
                                  </td>
                                  <td>
                                    <span className="cell-title">{m.modelName || 'Accessory'}</span>
                                    <span className="cell-sub">
                                      {m.category} • {m.condition || 'New'}
                                      {m.imei1 ? ` • ${m.imei1}` : ''}
                                    </span>
                                  </td>
                                  <td>
                                    <span className="cell-title">{m.partyName || '—'}</span>
                                    <span className="cell-sub">{m.note}</span>
                                  </td>
                                  <td>
                                    <span
                                      style={{
                                        fontWeight: 700,
                                        color: badge.isIn ? '#059669' : '#dc2626',
                                        fontVariantNumeric: 'tabular-nums',
                                      }}
                                    >
                                      {badge.isIn ? `+${absQty}` : `-${absQty}`} unit{absQty === 1 ? '' : 's'}
                                    </span>
                                    <span className="cell-sub">
                                      {m.previousStock} → {m.resultingStock} (Live: {m.liveStock})
                                    </span>
                                  </td>
                                  <td style={{ textAlign: 'right', paddingRight: '14px' }}>
                                    <span className="cell-price">
                                      PKR {Number(m.totalAmount || 0).toLocaleString()}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile Cards */}
                      <div className="show-on-mobile mobile-card-container">
                        {day.transactions.map((m) => {
                          const badge = getMovementBadge(m);
                          const absQty = Math.abs(Number(m.quantityDelta) || 0);
                          return (
                            <div key={m._id} className="mobile-card">
                              <div className="mobile-card-top">
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '4px' }}>
                                    <span className={`cell-badge ${badge.cls}`} style={{ fontSize: '10.5px', padding: '2px 7px' }}>
                                      {badge.isIn ? `+${absQty} Added` : `-${absQty} Sold`}
                                    </span>
                                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                                      {formatTime(m.occurredAt)}
                                    </span>
                                  </div>
                                  <div className="mobile-card-title">{m.modelName || 'Accessory'}</div>
                                  <div className="mobile-card-subtitle">
                                    {m.category} • {m.condition || 'New'}
                                  </div>
                                </div>
                                <div className="mobile-card-price">
                                  PKR {Number(m.totalAmount || 0).toLocaleString()}
                                </div>
                              </div>

                              <div className="mobile-card-meta-grid">
                                <div className="mobile-meta-cell">
                                  <div className="mobile-meta-label">Inventory Sync</div>
                                  <div className="mobile-meta-val">
                                    {m.previousStock} → {m.resultingStock} • <strong>Live: {m.liveStock}</strong>
                                  </div>
                                </div>
                                <div className="mobile-meta-cell">
                                  <div className="mobile-meta-label">Party</div>
                                  <div className="mobile-meta-val">{m.partyName || '—'}</div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* View 2: Inventory Reconciliation Ledger */
        <div className="table-card">
          <div className="hide-on-mobile desktop-table-container">
            <table className="pro-table">
              <thead>
                <tr>
                  <th style={{ width: '26%' }}>Device Model</th>
                  <th style={{ width: '12%' }}>Category</th>
                  <th style={{ width: '12%' }}>Condition</th>
                  <th style={{ width: '18%' }}>+ Purchased (Added)</th>
                  <th style={{ width: '18%' }}>- Sold (Subtracted)</th>
                  <th style={{ width: '14%', textAlign: 'center', paddingRight: '14px' }}>Live Stock</th>
                </tr>
              </thead>
              <tbody>
                {inventoryLedger.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="empty-state">No model stock ledger entries match filters.</td>
                  </tr>
                ) : (
                  inventoryLedger.map((row) => (
                    <tr key={row.key}>
                      <td>
                        <span className="cell-title">{row.modelName}</span>
                        {row.companyName && <span className="cell-sub">{row.companyName}</span>}
                      </td>
                      <td>
                        <span className="cell-badge badge-gray category-pill">{row.category}</span>
                      </td>
                      <td>
                        <span className={`cell-badge condition-pill ${row.condition === 'Used' ? 'badge-warning' : 'badge-success'}`}>
                          {row.condition}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, color: '#059669' }}>
                          +{row.purchasedUnits} units
                        </span>
                        <span className="cell-sub">PKR {Number(row.purchasedAmount || 0).toLocaleString()}</span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, color: '#dc2626' }}>
                          -{row.soldUnits} units
                        </span>
                        <span className="cell-sub">PKR {Number(row.soldAmount || 0).toLocaleString()}</span>
                      </td>
                      <td style={{ textAlign: 'center', paddingRight: '14px' }}>
                        <span
                          className={`cell-badge ${row.liveStock > 0 ? 'badge-success' : 'badge-gray'}`}
                          style={{ cursor: 'pointer' }}
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
            {inventoryLedger.length === 0 ? (
              <div className="empty-state">No model stock ledger entries match filters.</div>
            ) : (
              inventoryLedger.map((row) => (
                <div key={row.key} className="mobile-card">
                  <div className="mobile-card-top">
                    <div>
                      <div className="mobile-card-title">{row.modelName}</div>
                      <div className="mobile-card-subtitle">
                        {row.category} • {row.condition}{row.companyName ? ` • ${row.companyName}` : ''}
                      </div>
                    </div>
                    <span className={`cell-badge ${row.liveStock > 0 ? 'badge-success' : 'badge-gray'}`}>
                      {row.liveStock} in stock
                    </span>
                  </div>
                  <div className="mobile-card-meta-grid">
                    <div className="mobile-meta-cell">
                      <div className="mobile-meta-label">Purchased (+Added)</div>
                      <div className="mobile-meta-val" style={{ color: '#059669', fontWeight: 700 }}>
                        +{row.purchasedUnits} • PKR {Number(row.purchasedAmount || 0).toLocaleString()}
                      </div>
                    </div>
                    <div className="mobile-meta-cell">
                      <div className="mobile-meta-label">Sold (-Subtracted)</div>
                      <div className="mobile-meta-val" style={{ color: '#dc2626', fontWeight: 700 }}>
                        -{row.soldUnits} • PKR {Number(row.soldAmount || 0).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Records;
