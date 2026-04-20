"use client";

import React, { useEffect } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  dismissible?: boolean;
  title?: string;
}

export const Modal: React.FC<ModalProps> = ({ 
  isOpen, 
  onClose, 
  children, 
  dismissible = true,
  title
}) => {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissible) onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleEsc);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose, dismissible]);

  if (!isOpen) return null;

  return (
    <div 
      className="modal-overlay" 
      onClick={() => dismissible && onClose()}
    >
      <div 
        className="modal-content" 
        onClick={e => e.stopPropagation()}
        style={{ padding: 0, overflow: 'hidden' }}
      >
        {title && (
          <div style={{ 
            padding: '16px 20px', 
            borderBottom: '1px solid #F1F5F9', 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            background: 'linear-gradient(to right, #fff, #f8faff)'
          }}>
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.01em' }}>{title}</h3>
            {dismissible && (
              <button 
                onClick={onClose}
                style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '18px', cursor: 'pointer', padding: '4px' }}
              >✕</button>
            )}
          </div>
        )}
        <div style={{ maxHeight: 'calc(90vh - 60px)', overflowY: 'auto' }}>
          {children}
        </div>
      </div>
    </div>
  );
};
