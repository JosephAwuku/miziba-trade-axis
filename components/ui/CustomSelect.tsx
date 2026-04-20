"use client";

import React, { useState, useRef, useEffect } from 'react';

export interface Option {
  label: string;
  value: string | number;
}

interface CustomSelectProps {
  options: Option[];
  value: string | number | undefined;
  onChange: (value: any) => void;
  placeholder?: string;
  name?: string;
  className?: string;
  style?: React.CSSProperties;
  compact?: boolean;
  error?: string | boolean;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({ 
  options, 
  value, 
  onChange, 
  placeholder = "Select Option",
  name,
  className = "",
  style,
  compact = false,
  error = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpwards, setOpenUpwards] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Measure space and flip direction if needed
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const menuHeight = 280; // Approximate height with padding
      if (spaceBelow < menuHeight && rect.top > menuHeight) {
        setOpenUpwards(true);
      } else {
        setOpenUpwards(false);
      }
    }
  }, [isOpen]);
  
  const selectedOption = options.find(o => o.value === value);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (val: string | number) => {
    onChange({ target: { name, value: val } }); // Mimic standard event for easier drop-in
    setIsOpen(false);
  };

  return (
    <div 
      ref={containerRef} 
      className={`custom-select-container ${className}`} 
      style={{ 
        position: 'relative', 
        width: '100%',
        zIndex: isOpen ? 1000 : 1,
        ...style 
      }}
    >
      <div 
        className={`custom-select-display ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        style={{
          fontSize: compact ? '11px' : '16px',
          borderRadius: '10px',
          padding: compact ? '4px 34px 4px 10px' : '14px 40px 14px 16px',
          width: '100%',
          color: selectedOption ? 'var(--text)' : 'var(--text3)',
          background: error 
            ? 'var(--da-bg)' 
            : 'linear-gradient(#fff, #fff) padding-box, linear-gradient(135deg, var(--cr), var(--pu)) border-box',
          border: error ? '2px solid var(--da)' : '2px solid transparent',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          transition: 'all 0.2s',
          height: compact ? '32px' : 'auto',
          position: 'relative',
          zIndex: 1001
        }}
      >
        <span style={{ 
          whiteSpace: 'nowrap', 
          overflow: 'hidden', 
          textOverflow: 'ellipsis',
          flex: 1
        }}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        
        {/* Custom Arrow */}
        <div style={{ 
          position: 'absolute', 
          right: compact ? '10px' : '14px', 
          top: '50%', 
          transform: `translateY(-50%) rotate(${isOpen ? '180deg' : '0deg'})`,
          transition: 'transform 0.2s ease',
          display: 'flex',
          alignItems: 'center'
        }}>
          <svg xmlns='http://www.w3.org/2000/svg' width={compact ? "12" : "16"} height={compact ? "12" : "16"} fill='none' viewBox='0 0 24 24' stroke='var(--nv)' strokeWidth='2.5'>
            <path strokeLinecap='round' strokeLinejoin='round' d='M19.5 8.25l-7.5 7.5-7.5-7.5' />
          </svg>
        </div>
      </div>

      {/* Flyout Menu */}
      {isOpen && (
        <div 
          className="custom-select-menu fade-in"
          style={{
            position: 'absolute',
            top: openUpwards ? 'auto' : 'calc(100% + 8px)',
            bottom: openUpwards ? 'calc(100% + 8px)' : 'auto',
            left: 0,
            width: '100%',
            backgroundColor: '#fff',
            borderRadius: '12px',
            boxShadow: openUpwards ? '0 -10px 40px rgba(0, 0, 0, 0.15)' : '0 10px 40px rgba(0, 0, 0, 0.15)',
            zIndex: 9999,
            maxHeight: '260px',
            overflowY: 'auto',
            border: '1px solid var(--bdr)',
            padding: '6px'
          }}
        >
          {options.length === 0 ? (
            <div style={{ padding: '12px', color: 'var(--text3)', textAlign: 'center', fontSize: '13px' }}>
              No options available
            </div>
          ) : (
            options.map((opt) => (
              <div 
                key={opt.value}
                className="custom-select-option"
                onClick={() => handleSelect(opt.value)}
                style={{
                  padding: compact ? '8px 12px' : '12px 14px',
                  borderRadius: '8px',
                  fontSize: compact ? '12px' : '14px',
                  fontWeight: selectedOption?.value === opt.value ? 700 : 500,
                  color: selectedOption?.value === opt.value ? 'var(--cr)' : 'var(--nv)',
                  backgroundColor: selectedOption?.value === opt.value ? 'var(--cr-bg)' : 'transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                {opt.label}
                {selectedOption?.value === opt.value && (
                   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                   </svg>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* CSS for Option Hover */}
      <style jsx>{`
        .custom-select-option:hover {
          background-color: var(--cr-bg) !important;
          color: var(--cr) !important;
          transform: translateX(4px);
        }
        .custom-select-display:hover {
           border-color: transparent !important;
           background: linear-gradient(#fff, #fff) padding-box, linear-gradient(135deg, var(--cr-l), var(--pu)) border-box !important;
           box-shadow: 0 4px 15px rgba(139, 0, 0, 0.1);
        }
      `}</style>
    </div>
  );
};
