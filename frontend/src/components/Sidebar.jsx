import React from 'react';
import { LayoutDashboard, ShoppingBag, Tag, Package, History, FileText, X, LogOut } from 'lucide-react';

const Sidebar = ({ activeTab, setActiveTab, isOpen, setIsOpen, onLogout }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'purchases', label: 'Purchases', icon: ShoppingBag },
    { id: 'sales', label: 'Sales', icon: Tag },
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'records', label: 'Records', icon: History },
    { id: 'invoices', label: 'Invoices', icon: FileText },
  ];

  const handleSelectTab = (tabId) => {
    setActiveTab(tabId);
    if (setIsOpen) setIsOpen(false); // Close drawer on mobile after selection
  };

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {isOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside className={`app-sidebar ${isOpen ? 'sidebar-open' : ''}`}>
        {/* Sidebar Header */}
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <img src="/logo.jpg" alt="Unity Mobile" className="sidebar-logo" />
          </div>
          {/* Close button on mobile */}
          <button
            className="sidebar-close-btn mobile-only"
            onClick={() => setIsOpen(false)}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="sidebar-nav">
          <div className="nav-section-label">MAIN NAVIGATION</div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => handleSelectTab(item.id)}
              >
                <Icon size={19} className="nav-icon" />
                <span className="nav-label">{item.label}</span>
                {isActive && <span className="nav-active-pill" />}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer info */}
        <div className="sidebar-footer">
          <div className="sidebar-shop-pill">
            <div className="shop-status-dot" />
            <div className="shop-footer-text">
              <strong>Shop #14</strong>
              <span>Rehma Center, Kachery Rd</span>
            </div>
          </div>
          {onLogout && (
            <button
              type="button"
              className="sidebar-logout-btn"
              onClick={onLogout}
            >
              <LogOut size={15} />
              <span>Sign Out</span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
