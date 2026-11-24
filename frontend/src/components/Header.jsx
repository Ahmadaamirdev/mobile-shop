import React from 'react';

const Header = ({ activeTab, setActiveTab }) => {
  return (
    <header className="shop-header">
      <div className="header-top">
        <div className="brand-wrapper">
          <img src="/logo.jpg" alt="Unity Mobile" className="brand-logo" />
          <div className="brand-info">
            <h1>Unity Mobile</h1>
            <p>Shop #14, Rehma Center, Kachery Road, Multan</p>
          </div>
        </div>
      </div>

      <nav className="nav-tabs">
        <button
          className={`nav-tab-btn ${activeTab === 'purchases' ? 'active' : ''}`}
          onClick={() => setActiveTab('purchases')}
        >
          Purchases
        </button>
        <button
          className={`nav-tab-btn ${activeTab === 'sales' ? 'active' : ''}`}
          onClick={() => setActiveTab('sales')}
        >
          Sales
        </button>
        <button
          className={`nav-tab-btn ${activeTab === 'inventory' ? 'active' : ''}`}
          onClick={() => setActiveTab('inventory')}
        >
          Inventory
        </button>
        <button
          className={`nav-tab-btn ${activeTab === 'invoices' ? 'active' : ''}`}
          onClick={() => setActiveTab('invoices')}
        >
          Invoices
        </button>
      </nav>
    </header>
  );
};

export default Header;
