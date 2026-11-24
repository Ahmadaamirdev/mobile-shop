import React from 'react';
import { Menu } from 'lucide-react';

const MobileTopBar = ({ activeTab, onOpenMenu }) => {
  const titles = {
    purchases: 'Purchases',
    sales: 'Sales',
    inventory: 'Inventory',
    invoices: 'Invoices',
  };

  return (
    <header className="mobile-topbar mobile-only hide-on-print">
      <button
        className="mobile-menu-btn"
        onClick={onOpenMenu}
        aria-label="Open navigation menu"
      >
        <Menu size={22} />
      </button>

      <div className="mobile-topbar-center">
        <img src="/logo.jpg" alt="Unity Mobile" className="mobile-topbar-logo" />
        <span className="mobile-topbar-title">{titles[activeTab] || 'Unity Mobile'}</span>
      </div>

      <div style={{ width: '36px' }} /> {/* Spacer to keep center balanced */}
    </header>
  );
};

export default MobileTopBar;
