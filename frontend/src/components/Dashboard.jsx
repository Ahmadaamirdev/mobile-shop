import React, { useState, useEffect, useCallback } from 'react';
import { getDashboard } from '../services/api';
import {
  LayoutDashboard,
  ShoppingBag,
  Tag,
  Package,
  RefreshCw,
  ArrowRight,
  FileText,
} from 'lucide-react';
import DateRangeFilter from './DateRangeFilter';

const Dashboard = ({ isActive, onNavigate, setAlert }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchDashboard = useCallback(
    async (force = false) => {
      if (force) setRefreshing(true);
      try {
        const params = {};
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;
        const res = await getDashboard(params, force);
        if (res.data && res.data.data) {
          setStats(res.data.data);
        }
      } catch (err) {
        if (setAlert) {
          setAlert({
            type: 'error',
            message: err.response?.data?.message || 'Error loading dashboard totals.',
          });
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [startDate, endDate, setAlert]
  );

  // Fetch on mount & whenever date filter changes
  useEffect(() => {
    fetchDashboard(true);
  }, [fetchDashboard]);

  // Sync in real time whenever Dashboard becomes active or any mutation occurs
  useEffect(() => {
    if (isActive) {
      fetchDashboard(true);
    }
  }, [isActive, fetchDashboard]);

  useEffect(() => {
    const handleSync = () => {
      fetchDashboard(true);
    };
    window.addEventListener('unity-data-updated', handleSync);
    return () => window.removeEventListener('unity-data-updated', handleSync);
  }, [fetchDashboard]);

  // Background real-time poll every 30s while Dashboard is open
  useEffect(() => {
    if (!isActive) return undefined;
    const timer = setInterval(() => {
      fetchDashboard(true);
    }, 30000);
    return () => clearInterval(timer);
  }, [isActive, fetchDashboard]);

  const purchases = stats?.purchases || { count: 0, units: 0, totalAmount: 0, byCategory: {}, recent: [] };
  const sales = stats?.sales || { count: 0, units: 0, totalAmount: 0, byCategory: {}, recent: [] };
  const inventory = stats?.inventory || {
    totalModels: 0,
    inStockModels: 0,
    outOfStockModels: 0,
    totalUnits: 0,
    totalValue: 0,
    byCategory: {},
  };

  return (
    <div>
      {/* Header Card */}
      <div className="panel-header-card">
        <div className="panel-header-row">
          <div className="panel-header-left">
            <div className="panel-icon-box">
              <LayoutDashboard size={18} />
            </div>
            <div className="panel-header-text">
              <h2>Business Overview &amp; Live Totals</h2>
              <p>Real-time synchronized summary of Purchases, Sales, and Live Inventory.</p>
            </div>
          </div>

          <div className="dashboard-header-actions">
            <DateRangeFilter
              startDate={startDate}
              endDate={endDate}
              onChangeStart={setStartDate}
              onChangeEnd={setEndDate}
              onClear={() => {
                setStartDate('');
                setEndDate('');
              }}
            />
            <button
              type="button"
              className="btn-secondary dashboard-refresh-btn"
              onClick={() => fetchDashboard(true)}
              disabled={refreshing}
              title="Refresh live totals"
            >
              <RefreshCw size={14} className={refreshing ? 'spin-icon' : ''} />
              <span>{refreshing ? 'Syncing...' : 'Refresh'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3 Primary KPI Cards */}
      <div className="dashboard-kpi-grid">
        {/* Total Purchases */}
        <button
          type="button"
          className="dashboard-kpi-card"
          onClick={() => onNavigate && onNavigate('purchases')}
        >
          <div className="kpi-card-top">
            <span className="kpi-label">Total Purchases</span>
            <span className="kpi-icon-pill kpi-amber">
              <ShoppingBag size={16} />
            </span>
          </div>
          <div className="kpi-value">
            {loading && !stats ? '—' : `PKR ${Number(purchases.totalAmount || 0).toLocaleString()}`}
          </div>
          <div className="kpi-meta-row">
            <span>
              <strong>{purchases.count}</strong> records • <strong>{purchases.units}</strong> units
            </span>
            <span className="kpi-link">
              View <ArrowRight size={13} />
            </span>
          </div>
        </button>

        {/* Total Sales */}
        <button
          type="button"
          className="dashboard-kpi-card"
          onClick={() => onNavigate && onNavigate('sales')}
        >
          <div className="kpi-card-top">
            <span className="kpi-label">Total Sales</span>
            <span className="kpi-icon-pill kpi-green">
              <Tag size={16} />
            </span>
          </div>
          <div className="kpi-value">
            {loading && !stats ? '—' : `PKR ${Number(sales.totalAmount || 0).toLocaleString()}`}
          </div>
          <div className="kpi-meta-row">
            <span>
              <strong>{sales.count}</strong> sales • <strong>{sales.units}</strong> units
            </span>
            <span className="kpi-link">
              View <ArrowRight size={13} />
            </span>
          </div>
        </button>

        {/* Total Inventory */}
        <button
          type="button"
          className="dashboard-kpi-card"
          onClick={() => onNavigate && onNavigate('inventory')}
        >
          <div className="kpi-card-top">
            <span className="kpi-label">Total Inventory (Live)</span>
            <span className="kpi-icon-pill kpi-blue">
              <Package size={16} />
            </span>
          </div>
          <div className="kpi-value">
            {loading && !stats ? '—' : `PKR ${Number(inventory.totalValue || 0).toLocaleString()}`}
          </div>
          <div className="kpi-meta-row">
            <span>
              <strong>{inventory.totalUnits}</strong> in stock • <strong>{inventory.inStockModels}</strong> models
              {inventory.outOfStockModels > 0 ? ` (${inventory.outOfStockModels} empty)` : ''}
            </span>
            <span className="kpi-link">
              View <ArrowRight size={13} />
            </span>
          </div>
        </button>
      </div>

      {/* Category Breakdown Table */}
      <div className="table-card dashboard-section-card" style={{ marginBottom: '16px' }}>
        <div className="dashboard-section-header">
          <div>
            <h3>Category Breakdown</h3>
            <p>Live distribution across Mobiles, Tablets, and Accessories</p>
          </div>
          <button
            type="button"
            className="btn-secondary"
            style={{ height: '32px', fontSize: '12px', padding: '0 10px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
            onClick={() => onNavigate && onNavigate('invoices')}
          >
            <FileText size={13} /> {stats?.invoices?.count || 0} Invoices
          </button>
        </div>

        <div className="dashboard-cat-grid">
          {['Mobile', 'Tablet', 'Accessory'].map((cat) => {
            const pCat = purchases.byCategory?.[cat] || {};
            const sCat = sales.byCategory?.[cat] || {};
            const iCat = inventory.byCategory?.[cat] || {};
            return (
              <div key={cat} className="dashboard-cat-card">
                <div className="dashboard-cat-title">
                  <span>{cat === 'Accessory' ? 'Accessories' : `${cat}s`}</span>
                  <span className="cell-badge badge-success">
                    {iCat.units || 0} in stock
                  </span>
                </div>
                <div className="dashboard-cat-rows">
                  <div className="dashboard-cat-row">
                    <span>Purchases ({pCat.count || 0})</span>
                    <strong>PKR {Number(pCat.totalAmount || 0).toLocaleString()}</strong>
                  </div>
                  <div className="dashboard-cat-row">
                    <span>Sales ({sCat.count || 0})</span>
                    <strong>PKR {Number(sCat.totalAmount || 0).toLocaleString()}</strong>
                  </div>
                  <div className="dashboard-cat-row">
                    <span>Stock Value</span>
                    <strong>PKR {Number(iCat.totalValue || 0).toLocaleString()}</strong>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Purchases & Recent Sales */}
      <div className="dashboard-split-grid">
        <div className="table-card dashboard-section-card">
          <div className="dashboard-section-header">
            <div>
              <h3>Recent Purchases</h3>
              <p>Latest 5 inward stock entries</p>
            </div>
            <button
              type="button"
              className="dashboard-view-all-btn"
              onClick={() => onNavigate && onNavigate('purchases')}
            >
              View All <ArrowRight size={13} />
            </button>
          </div>
          {purchases.recent && purchases.recent.length > 0 ? (
            <div className="dashboard-recent-list">
              {purchases.recent.map((item) => (
                <div key={item._id} className="dashboard-recent-item">
                  <div className="dashboard-recent-main">
                    <div className="dashboard-recent-title">{item.modelName || 'Accessory'}</div>
                    <div className="dashboard-recent-sub">
                      {item.category} • {item.customerName || 'Walk-in'} •{' '}
                      {new Date(item.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                    </div>
                  </div>
                  <div className="dashboard-recent-price">
                    PKR {Number(item.price || 0).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state" style={{ padding: '24px 12px' }}>No purchases in selected range.</div>
          )}
        </div>

        <div className="table-card dashboard-section-card">
          <div className="dashboard-section-header">
            <div>
              <h3>Recent Sales</h3>
              <p>Latest 5 customer dispatches</p>
            </div>
            <button
              type="button"
              className="dashboard-view-all-btn"
              onClick={() => onNavigate && onNavigate('sales')}
            >
              View All <ArrowRight size={13} />
            </button>
          </div>
          {sales.recent && sales.recent.length > 0 ? (
            <div className="dashboard-recent-list">
              {sales.recent.map((item) => (
                <div key={item._id} className="dashboard-recent-item">
                  <div className="dashboard-recent-main">
                    <div className="dashboard-recent-title">{item.modelName || 'Accessory'}</div>
                    <div className="dashboard-recent-sub">
                      {item.category} • {item.customerName || 'Walk-in'} •{' '}
                      {new Date(item.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                    </div>
                  </div>
                  <div className="dashboard-recent-price" style={{ color: '#059669' }}>
                    PKR {Number(item.price || 0).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state" style={{ padding: '24px 12px' }}>No sales in selected range.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
