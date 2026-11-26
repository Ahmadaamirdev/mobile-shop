import React, { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Reusable centered popup modal for viewing record details
 * across Purchases, Sales, and Inventory.
 */
const DetailModal = ({ isOpen, onClose, title, subtitle, icon: Icon, badge, children }) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="detail-modal-backdrop" onClick={onClose}>
      <div className="detail-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="detail-modal-header">
          <div className="detail-modal-header-left">
            {Icon && (
              <div className="panel-icon-box">
                <Icon size={18} />
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h3 className="detail-modal-title">{title}</h3>
                {badge}
              </div>
              {subtitle && <p className="detail-modal-subtitle">{subtitle}</p>}
            </div>
          </div>

          <button
            type="button"
            className="detail-modal-close"
            onClick={onClose}
            aria-label="Close details"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="detail-modal-body">{children}</div>

        {/* Footer */}
        <div className="detail-modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default DetailModal;
