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

// Sales
export const getSales = (params) => api.get('/sales', { params });
export const createSale = (data) => api.post('/sales', data);

// Inventory
export const getInventory = (params) => api.get('/inventory', { params });
export const createInventoryItem = (data) => api.post('/inventory', data);
export const updateInventoryItem = (id, data) => api.put(`/inventory/${id}`, data);
export const deleteInventoryItem = (id) => api.delete(`/inventory/${id}`);

// Invoices
export const getInvoices = (params) => api.get('/invoices', { params });
export const createInvoice = (data) => api.post('/invoices', data);
export const getInvoiceById = (id) => api.get(`/invoices/${id}`);

export default api;
