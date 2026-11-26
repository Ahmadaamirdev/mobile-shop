import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach session Bearer token to all outgoing requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('unity_auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth endpoints
export const loginUser = (credentials) => api.post('/auth/login', credentials);
export const verifyAuth = () => api.get('/auth/verify');
export const logoutUser = () => {
  localStorage.removeItem('unity_auth_token');
  localStorage.removeItem('unity_auth_user');
  clearApiCache();
};

// Client-Side In-Memory Cache (45-second TTL) for 0ms Section Switching & Navigation
const clientCache = new Map();
const CACHE_TTL_MS = 45 * 1000;

export const clearApiCache = () => {
  clientCache.clear();
};

export const invalidateApiCache = (keywords = []) => {
  const keys = Array.isArray(keywords) ? keywords : [keywords];
  for (const cacheKey of clientCache.keys()) {
    for (const kw of keys) {
      if (cacheKey.includes(kw)) {
        clientCache.delete(cacheKey);
        break;
      }
    }
  }
};

const cachedGet = async (url, params = {}, forceRefresh = false) => {
  const queryStr = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&');
  const cacheKey = `${url}?${queryStr}`;

  if (!forceRefresh) {
    const cached = clientCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return Promise.resolve({ data: cached.data, fromCache: true });
    }
  }

  const res = await api.get(url, { params });
  if (res.data) {
    clientCache.set(cacheKey, {
      timestamp: Date.now(),
      data: res.data,
    });
  }
  return res;
};

const notifyDataUpdated = () => {
  window.dispatchEvent(new Event('unity-data-updated'));
};

// Dashboard
export const getDashboard = (params = {}, force = false) =>
  cachedGet('/dashboard', force ? { ...params, _refresh: 'true' } : params, force);

// Purchases
export const getPurchases = (params, force = false) => cachedGet('/purchases', params, force);
export const uploadIdCard = (data) => api.post('/purchases/upload-id', data);
export const createPurchase = async (data) => {
  const res = await api.post('/purchases', data);
  invalidateApiCache(['purchases', 'inventory', 'dashboard']);
  notifyDataUpdated();
  return res;
};
export const deletePurchase = async (id) => {
  const res = await api.delete(`/purchases/${id}`);
  invalidateApiCache(['purchases', 'inventory', 'dashboard']);
  notifyDataUpdated();
  return res;
};

// Sales
export const getSales = (params, force = false) => cachedGet('/sales', params, force);
export const createSale = async (data) => {
  const res = await api.post('/sales', data);
  invalidateApiCache(['sales', 'inventory', 'invoices', 'dashboard']);
  notifyDataUpdated();
  return res;
};
export const deleteSale = async (id) => {
  const res = await api.delete(`/sales/${id}`);
  invalidateApiCache(['sales', 'inventory', 'invoices', 'dashboard']);
  notifyDataUpdated();
  return res;
};

// Inventory
export const getInventory = (params, force = false) => cachedGet('/inventory', params, force);
export const createInventoryItem = async (data) => {
  const res = await api.post('/inventory', data);
  invalidateApiCache(['inventory', 'sales', 'purchases', 'dashboard']);
  notifyDataUpdated();
  return res;
};
export const updateInventoryItem = async (id, data) => {
  const res = await api.put(`/inventory/${id}`, data);
  invalidateApiCache(['inventory', 'sales', 'dashboard']);
  notifyDataUpdated();
  return res;
};
export const deleteInventoryItem = async (id) => {
  const res = await api.delete(`/inventory/${id}`);
  invalidateApiCache(['inventory', 'sales', 'dashboard']);
  notifyDataUpdated();
  return res;
};

// Invoices
export const getInvoices = (params, force = false) => cachedGet('/invoices', params, force);
export const createInvoice = async (data) => {
  const res = await api.post('/invoices', data);
  invalidateApiCache(['invoices', 'sales', 'dashboard']);
  notifyDataUpdated();
  return res;
};
export const updateInvoice = async (id, data) => {
  const res = await api.put(`/invoices/${id}`, data);
  invalidateApiCache(['invoices', 'sales', 'dashboard']);
  notifyDataUpdated();
  return res;
};
export const getInvoiceById = (id) => api.get(`/invoices/${id}`);
export const deleteInvoice = async (id) => {
  const res = await api.delete(`/invoices/${id}`);
  invalidateApiCache(['invoices', 'sales', 'dashboard']);
  notifyDataUpdated();
  return res;
};

// Auto-retry on transient database reconnection, proxy glitches, or temporary network hiccup
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    if (!config) return Promise.reject(error);

    if (error.response?.status === 401 && !config.url?.includes('/auth/login')) {
      logoutUser();
      window.dispatchEvent(new Event('unity-auth-expired'));
      return Promise.reject(error);
    }

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

    // Retry up to 4 times with exponential backoff for transient 502/503/504 or initial DB connection buffering
    const isTransient =
      !error.response ||
      error.response.status === 503 ||
      error.response.status === 502 ||
      error.response.status === 504 ||
      (error.response.status === 500 && isDbConnectionIssue);

    // Retry only safe GET requests (or 503 DB-warmup) to avoid duplicate POST writes
    const method = (config.method || 'get').toLowerCase();
    const isSafeToRetry = method === 'get' || error.response?.status === 503;

    if (isTransient && isSafeToRetry && config.__retryCount < 4) {
      config.__retryCount += 1;
      const delays = [800, 1500, 2500, 3500];
      const delay = delays[config.__retryCount - 1] || 2000;
      await new Promise((resolve) => setTimeout(resolve, delay));
      return api(config);
    }

    return Promise.reject(error);
  }
);

export default api;
