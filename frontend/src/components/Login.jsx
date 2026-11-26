import React, { useState } from 'react';
import { Eye, EyeOff, Lock, User, LogIn, AlertCircle } from 'lucide-react';
import { loginUser } from '../services/api';

const Login = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password) {
      setError('Please enter both username and password.');
      return;
    }

    setLoading(true);
    try {
      const res = await loginUser({ username: username.trim(), password });
      if (res.data?.success && res.data?.token) {
        localStorage.setItem('unity_auth_token', res.data.token);
        localStorage.setItem('unity_auth_user', JSON.stringify(res.data.user || { username: username.trim() }));
        if (onLoginSuccess) onLoginSuccess(res.data.user);
      } else {
        setError(res.data?.message || 'Sign in failed.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid username or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Unity Mobile Brand Logo */}
        <div className="login-brand">
          <img src="/logo.jpg" alt="Unity Mobile" className="login-logo" />
          <h1 className="login-title">Unity Mobile</h1>
          <p className="login-subtitle">Shop Management &amp; Billing System</p>
        </div>

        {error && (
          <div className="login-error-banner" role="alert">
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-field">
            <label htmlFor="login-username">Sign In ID / Username</label>
            <div className="login-input-wrap">
              <User size={16} className="login-input-icon" />
              <input
                id="login-username"
                name="username"
                type="text"
                autoComplete="username"
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="login-field">
            <label htmlFor="login-password">Password</label>
            <div className="login-input-wrap">
              <Lock size={16} className="login-input-icon" />
              <input
                id="login-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                style={{ paddingRight: '46px' }}
              />
              <button
                type="button"
                className="login-eye-btn"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          <button type="submit" className="login-submit-btn" disabled={loading}>
            <LogIn size={17} />
            <span>{loading ? 'Signing In...' : 'Sign In'}</span>
          </button>
        </form>

        <div className="login-footer-note">
          Shop #14, Rehma Center, Kachery Road, Multan
        </div>
      </div>
    </div>
  );
};

export default Login;
