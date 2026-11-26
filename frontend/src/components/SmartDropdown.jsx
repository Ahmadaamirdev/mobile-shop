import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, Check, X } from 'lucide-react';

/**
 * Modern, searchable, structured dropdown component replacing native <select>
 * for rich multi-line items (Recorded Sales in Invoice, Live Inventory in Sales).
 */
const SmartDropdown = ({
  label,
  placeholder = 'Select an option...',
  searchPlaceholder = 'Search...',
  options = [],
  value = '',
  onChange,
  manualOption = null, // { label, description }
  renderOption,
  renderSelected,
  emptyText = 'No matching records found.',
  compact = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 20);
    } else if (!isOpen) {
      setQuery('');
    }
  }, [isOpen]);

  const selectedOption = options.find((opt) => opt.value === value);

  const filteredOptions = options.filter((opt) => {
    if (!query.trim()) return true;
    const term = query.trim().toLowerCase();
    return (opt.searchText || opt.label || '').toLowerCase().includes(term);
  });

  const handleSelect = (val) => {
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div className="smart-dropdown" ref={containerRef}>
      {label && <label className="smart-dropdown-label">{label}</label>}

      <button
        type="button"
        className={`smart-dropdown-trigger ${isOpen ? 'open' : ''} ${compact ? 'compact' : ''}`}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <div className="smart-dropdown-trigger-content">
          {selectedOption ? (
            renderSelected ? (
              renderSelected(selectedOption)
            ) : (
              <span className="smart-dropdown-selected-text">{selectedOption.label}</span>
            )
          ) : (
            <span className="smart-dropdown-placeholder">{placeholder}</span>
          )}
        </div>

        <div className="smart-dropdown-trigger-icons">
          {value && (
            <span
              role="button"
              tabIndex={-1}
              className="smart-dropdown-clear"
              title="Clear selection"
              onClick={(e) => {
                e.stopPropagation();
                handleSelect('');
              }}
            >
              <X size={13} />
            </span>
          )}
          <ChevronDown
            size={15}
            className={`smart-dropdown-chevron ${isOpen ? 'rotated' : ''}`}
          />
        </div>
      </button>

      {isOpen && (
        <div className="smart-dropdown-menu">
          {/* Search Input */}
          <div className="smart-dropdown-search-wrap">
            <Search size={13} className="smart-dropdown-search-icon" />
            <input
              ref={searchInputRef}
              type="text"
              className="smart-dropdown-search-input"
              placeholder={searchPlaceholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="smart-dropdown-list">
            {/* Optional Manual Entry Option */}
            {manualOption && !query.trim() && (
              <button
                type="button"
                className={`smart-dropdown-item manual ${value === '' ? 'selected' : ''}`}
                onClick={() => handleSelect('')}
              >
                <div className="smart-dropdown-item-main">
                  <div className="smart-dropdown-item-title">{manualOption.label}</div>
                  {manualOption.description && (
                    <div className="smart-dropdown-item-sub">{manualOption.description}</div>
                  )}
                </div>
                {value === '' && <Check size={14} className="smart-dropdown-check" />}
              </button>
            )}

            {filteredOptions.length === 0 ? (
              <div className="smart-dropdown-empty">{emptyText}</div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className={`smart-dropdown-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSelect(opt.value)}
                  >
                    <div className="smart-dropdown-item-body">
                      {renderOption ? renderOption(opt, isSelected) : <span>{opt.label}</span>}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SmartDropdown;
