import React, { useState, useEffect, Component } from 'react';
import Sidebar from './components/Sidebar';
import MobileTopBar from './components/MobileTopBar';
import MobileBottomNav from './components/MobileBottomNav';
import Dashboard from './components/Dashboard';
import Purchases from './components/Purchases';
import Sales from './components/Sales';
import Inventory from './components/Inventory';
import Invoice from './components/Invoice';
import Login from './components/Login';
import { verifyAuth, logoutUser } from './services/api';
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
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedSaleForInvoice, setSelectedSaleForInvoice] = useState(null);
  const [alert, setAlertState] = useState(null);

  useEffect(() => {
    const checkSession = async () => {
      const token = localStorage.getItem('unity_auth_token');
      if (!token) {
        setIsAuthenticated(false);
        setCheckingAuth(false);
        return;
      }
      try {
        await verifyAuth();
        setIsAuthenticated(true);
      } catch {
        logoutUser();
        setIsAuthenticated(false);
      } finally {
        setCheckingAuth(false);
      }
    };

    checkSession();

    const handleAuthExpired = () => {
      setIsAuthenticated(false);
    };
    window.addEventListener('unity-auth-expired', handleAuthExpired);
    return () => window.removeEventListener('unity-auth-expired', handleAuthExpired);
  }, []);

  const handleLogout = () => {
    logoutUser();
    setIsAuthenticated(false);
    setIsSidebarOpen(false);
  };

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

  if (checkingAuth) {
    return (
      <div className="login-page">
        <div style={{ textAlign: 'center', color: '#ffffff', fontSize: '14px', fontWeight: 600 }}>
          Loading Unity Mobile...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="app-layout">
      {/* Sidebar (Desktop Persistent / Mobile Drawer) */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        onLogout={handleLogout}
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

            <div style={{ display: activeTab === 'dashboard' ? 'block' : 'none' }}>
              <Dashboard
                isActive={activeTab === 'dashboard'}
                onNavigate={setActiveTab}
                setAlert={setAlert}
              />
            </div>

            <div style={{ display: activeTab === 'purchases' ? 'block' : 'none' }}>
              <Purchases isActive={activeTab === 'purchases'} setAlert={setAlert} />
            </div>

            <div style={{ display: activeTab === 'sales' ? 'block' : 'none' }}>
              <Sales
                isActive={activeTab === 'sales'}
                onOpenInvoice={handleOpenInvoiceFromSale}
                setAlert={setAlert}
              />
            </div>

            <div style={{ display: activeTab === 'inventory' ? 'block' : 'none' }}>
              <Inventory isActive={activeTab === 'inventory'} setAlert={setAlert} />
            </div>

            <div style={{ display: activeTab === 'invoices' ? 'block' : 'none' }}>
              <Invoice
                isActive={activeTab === 'invoices'}
                initialSale={selectedSaleForInvoice}
                clearInitialSale={() => setSelectedSaleForInvoice(null)}
                setAlert={setAlert}
              />
            </div>
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
