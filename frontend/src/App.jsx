import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import MobileTopBar from './components/MobileTopBar';
import Purchases from './components/Purchases';
import Sales from './components/Sales';
import Inventory from './components/Inventory';
import Invoice from './components/Invoice';

function App() {
  const [activeTab, setActiveTab] = useState('purchases');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedSaleForInvoice, setSelectedSaleForInvoice] = useState(null);
  const [alert, setAlertState] = useState(null);

  const setAlert = (newAlert) => {
    setAlertState(newAlert);
    if (newAlert) {
      setTimeout(() => {
        setAlertState(null);
      }, 4000);
    }
  };

  const handleOpenInvoiceFromSale = (sale) => {
    setSelectedSaleForInvoice(sale);
    setActiveTab('invoices');
  };

  return (
    <div className="app-layout">
      {/* Sidebar (Desktop Persistent / Mobile Drawer) */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
      />

      {/* Main Content Area */}
      <div className="app-main-viewport">
        {/* Mobile Top Header with Hamburger */}
        <MobileTopBar
          activeTab={activeTab}
          onOpenMenu={() => setIsSidebarOpen(true)}
        />

        <main className="main-content">
          {alert && (
            <div className={`alert-banner alert-${alert.type} hide-on-print`}>
              <span>{alert.message}</span>
              <button
                onClick={() => setAlert(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
              >
                ✕
              </button>
            </div>
          )}

          {activeTab === 'purchases' && (
            <Purchases
              setAlert={setAlert}
            />
          )}

          {activeTab === 'sales' && (
            <Sales
              onOpenInvoice={handleOpenInvoiceFromSale}
              setAlert={setAlert}
            />
          )}

          {activeTab === 'inventory' && (
            <Inventory
              setAlert={setAlert}
            />
          )}

          {activeTab === 'invoices' && (
            <Invoice
              initialSale={selectedSaleForInvoice}
              clearInitialSale={() => setSelectedSaleForInvoice(null)}
              setAlert={setAlert}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
