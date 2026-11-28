import React from 'react';
import { LayoutDashboard, ShoppingBag, Tag, Package, FileText, BookOpen } from 'lucide-react';

const MobileBottomNav = ({ activeTab, setActiveTab }) => {
  const tabs = [
    { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
    { id: 'purchases', label: 'Purchases', icon: ShoppingBag },
    { id: 'sales', label: 'Sales', icon: Tag },
    { id: 'inventory', label: 'Stock', icon: Package },
    { id: 'ledger', label: 'Ledger', icon: BookOpen },
    { id: 'invoices', label: 'Invoices', icon: FileText },
  ];

  return (
    <nav className="mobile-bottom-nav mobile-only hide-on-print" aria-label="Mobile Navigation">
      <div className="mobile-bottom-nav-inner">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              className={`mobile-nav-item ${isActive ? 'active' : ''}`}
              onClick={() => {
                setActiveTab(tab.id);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              aria-label={tab.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className="mobile-nav-icon-wrapper">
                <Icon size={20} className="mobile-nav-icon" />
                {isActive && <span className="mobile-nav-active-dot" />}
              </div>
              <span className="mobile-nav-label">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
