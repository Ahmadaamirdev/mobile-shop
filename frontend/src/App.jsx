import React, { useState, Component } from 'react';
import Sidebar from './components/Sidebar';
import MobileTopBar from './components/MobileTopBar';
import MobileBottomNav from './components/MobileBottomNav';
import Purchases from './components/Purchases';
import Sales from './components/Sales';
import Inventory from './components/Inventory';
import Invoice from './components/Invoice';
import { CheckCircle2, AlertCircle, X, RefreshCw } from 'lucide-react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px 20px', textAlign: 'center', background: '#fff', borderRadius: '12px', border: '1px solid var(--border-card)', margin: '20px auto', maxWidth: '500px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#090d16', marginBottom: '8px' }}>Something went wrong</h3>
          <p style={{ color: '#ef4444', fontSize: '13px', marginBottom: '16px' }}>{this.state.error?.message || 'An unexpected rendering error occurred.'}</p>
          <button className="btn-primary" onClick={() => this.setState({ hasError: false })} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={14} /> Reload View
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

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
          <ErrorBoundary>
            {/* Floating Left-Side Toast Popup ("Recorded or Deleted Successfully") */}
            {alert && (
              <div className={`toast-popup-left toast-${alert.type} hide-on-print`}>
                <div className="toast-icon">
                  {alert.type === 'success' ? (
                    <CheckCircle2 size={18} />
                  ) : (
                    <AlertCircle size={18} />
                  )}
                </div>
                <span className="toast-message">{alert.message}</span>
                <button
                  className="toast-close-btn"
                  onClick={() => setAlert(null)}
                  aria-label="Close notification"
                >
                  <X size={15} />
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
          </ErrorBoundary>
        </main>

        {/* Mobile Bottom Navigation Bar (App-like thumb navigation) */}
        <MobileBottomNav
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />
      </div>
    </div>
  );
}

export default App;
