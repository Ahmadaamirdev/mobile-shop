import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Purchases
export const getPurchases = (params) => api.get('/purchases', { params });
export const createPurchase = (data) => api.post('/purchases', data);
export const deletePurchase = (id) => api.delete(`/purchases/${id}`);

// Sales
export const getSales = (params) => api.get('/sales', { params });
export const createSale = (data) => api.post('/sales', data);
export const deleteSale = (id) => api.delete(`/sales/${id}`);

// Inventory
export const getInventory = (params) => api.get('/inventory', { params });
export const createInventoryItem = (data) => api.post('/inventory', data);
export const updateInventoryItem = (id, data) => api.put(`/inventory/${id}`, data);
export const deleteInventoryItem = (id) => api.delete(`/inventory/${id}`);

// Invoices
export const getInvoices = (params) => api.get('/invoices', { params });
export const createInvoice = (data) => api.post('/invoices', data);
export const updateInvoice = (id, data) => api.put(`/invoices/${id}`, data);
export const getInvoiceById = (id) => api.get(`/invoices/${id}`);
export const deleteInvoice = (id) => api.delete(`/invoices/${id}`);

// Auto-retry on transient database reconnection, proxy glitches, or temporary network hiccup
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    if (!config) return Promise.reject(error);

    config.__retryCount = config.__retryCount || 0;

    const errorMsg = String(error.response?.data?.message || error.message || '').toLowerCase();
    const isDbConnectionIssue =
      errorMsg.includes('connection') ||
      errorMsg.includes('timeout') ||
      errorMsg.includes('buffering') ||
      errorMsg.includes('network') ||
      errorMsg.includes('socket') ||
      errorMsg.includes('econnreset') ||
      errorMsg.includes('reconnect');

    // Retry up to 2 times for transient network or 502/503/504 or transient DB connection errors
    const isTransient =
      !error.response ||
      error.response.status === 503 ||
      error.response.status === 502 ||
      error.response.status === 504 ||
      (error.response.status === 500 && isDbConnectionIssue);

    if (isTransient && config.__retryCount < 2) {
      config.__retryCount += 1;
      const delay = (config.__retryCount === 1 ? 700 : 1400);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return api(config);
    }

    return Promise.reject(error);
  }
);

export default api;
