import React, { useState, useRef, useEffect } from 'react';
import { Calendar, X, ChevronDown } from 'lucide-react';

const formatShortDate = (dateStr) => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const DateRangeFilter = ({ startDate, endDate, onChangeStart, onChangeEnd, onClear }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [open]);

  const hasFilter = Boolean(startDate || endDate);

  let label = 'Select Date Range';
  if (startDate && endDate) {
    label = `${formatShortDate(startDate)} – ${formatShortDate(endDate)}`;
  } else if (startDate) {
    label = `From ${formatShortDate(startDate)}`;
  } else if (endDate) {
    label = `Until ${formatShortDate(endDate)}`;
  }

  return (
    <div className="date-range-single-wrapper" ref={containerRef}>
      <button
        type="button"
        className={`date-range-single-box ${hasFilter ? 'has-value' : ''}`}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-label="Filter by date range"
      >
        <Calendar size={14} className="date-range-icon" />
        <span className="date-range-label">{label}</span>
        {hasFilter ? (
          <span
            role="button"
            tabIndex={0}
            className="date-range-inline-clear"
            title="Clear date filter"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation();
                onClear();
              }
            }}
          >
            <X size={13} />
          </span>
        ) : (
          <ChevronDown size={14} className="date-range-chevron" />
        )}
      </button>

      {open && (
        <div className="date-range-popover">
          <div className="date-range-popover-grid">
            <div className="date-popover-field">
              <label>From Date</label>
              <input
                type="date"
                className="date-filter-input"
                value={startDate}
                max={endDate || undefined}
                onChange={(e) => onChangeStart(e.target.value)}
              />
            </div>
            <div className="date-popover-field">
              <label>To Date</label>
              <input
                type="date"
                className="date-filter-input"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => onChangeEnd(e.target.value)}
              />
            </div>
          </div>
          <div className="date-range-popover-actions">
            {hasFilter && (
              <button
                type="button"
                className="date-clear-btn"
                onClick={() => {
                  onClear();
                  setOpen(false);
                }}
              >
                Clear
              </button>
            )}
            <button
              type="button"
              className="date-done-btn"
              onClick={() => setOpen(false)}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DateRangeFilter;
