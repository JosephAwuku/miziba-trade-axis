"use client";

import React, { useState, useRef, useEffect, useMemo } from 'react';

interface CustomDatePickerProps {
  value: string | undefined;
  onChange: (value: any) => void;
  name?: string;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  error?: string | boolean;
}

export const CustomDatePicker: React.FC<CustomDatePickerProps> = ({
  value,
  onChange,
  name,
  placeholder = "Select Date",
  className = "",
  style,
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
      const menuHeight = 360; // Calendar is taller than select dropdown
      if (spaceBelow < menuHeight && rect.top > menuHeight) {
        setOpenUpwards(true);
      } else {
        setOpenUpwards(false);
      }
    }
  }, [isOpen]);

  // Internal view state (what month we are looking at)
  const [viewDate, setViewDate] = useState(() => {
    if (value) return new Date(value);
    return new Date();
  });

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

  const handleSelect = (d: Date) => {
    const iso = d.toISOString().split('T')[0];
    onChange({ target: { name, value: iso } }); // Mimic standard event
    setIsOpen(false);
  };

  const currentYear = viewDate.getFullYear();
  const currentMonth = viewDate.getMonth();

  const daysInMonth = useMemo(() => {
    const lastDay = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDayIndices = new Date(currentYear, currentMonth, 1).getDay();

    const days = [];
    // Padding from prev month
    for (let i = 0; i < firstDayIndices; i++) {
      days.push(null);
    }
    // Days of this month
    for (let i = 1; i <= lastDay; i++) {
      days.push(new Date(currentYear, currentMonth, i));
    }
    return days;
  }, [currentYear, currentMonth]);

  const monthName = viewDate.toLocaleString('default', { month: 'long' });

  const shiftMonth = (n: number) => {
    setViewDate(new Date(currentYear, currentMonth + n, 1));
  };

  const selectedDateStr = value ? new Date(value).toDateString() : null;
  const todayStr = new Date().toDateString();

  return (
    <div
      ref={containerRef}
      className={`custom-datepicker-container ${className}`}
      style={{
        position: 'relative',
        width: '100%',
        zIndex: isOpen ? 1000 : 1,
        ...style
      }}
    >
      <div
        className={`custom-datepicker-display ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        style={{
          fontSize: '16px',
          borderRadius: '10px',
          padding: '14px 40px 14px 16px',
          width: '100%',
          color: value ? 'var(--text)' : 'var(--text3)',
          background: error
            ? 'var(--da-bg)'
            : 'linear-gradient(#fff, #fff) padding-box, linear-gradient(135deg, var(--cr), var(--pu)) border-box',
          border: error ? '2px solid var(--da)' : '2px solid transparent',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          transition: 'all 0.2s',
          position: 'relative',
          zIndex: 1001
        }}
      >
        <span>{value ? new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : placeholder}</span>

        {/* Calendar Icon */}
        <div style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', display: 'flex' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--nv)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
        </div>
      </div>

      {isOpen && (
        <div
          className="custom-datepicker-menu fade-in"
          style={{
            position: 'absolute',
            top: openUpwards ? 'auto' : 'calc(100% + 8px)',
            bottom: openUpwards ? 'calc(100% + 8px)' : 'auto',
            left: 0,
            minWidth: '280px',
            backgroundColor: '#fff',
            borderRadius: '12px',
            boxShadow: openUpwards ? '0 -10px 40px rgba(0, 0, 0, 0.15)' : '0 10px 40px rgba(0, 0, 0, 0.15)',
            zIndex: 9999,
            border: '1px solid var(--bdr)',
            padding: '16px'
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <button
              onClick={() => shiftMonth(-1)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--nv)' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
            </button>
            <div style={{ fontWeight: 800, color: 'var(--nv)', fontSize: '14px' }}>
              {monthName} {currentYear}
            </div>
            <button
              onClick={() => shiftMonth(1)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--nv)' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </button>
          </div>

          {/* Day Names */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '8px' }}>
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: '10px', fontWeight: 700, color: '#9CA3AF' }}>{d}</div>
            ))}
          </div>

          {/* Days Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
            {daysInMonth.map((date, i) => {
              if (!date) return <div key={`empty-${i}`} />;

              const isSelected = date.toDateString() === selectedDateStr;
              const isToday = date.toDateString() === todayStr;

              return (
                <div
                  key={date.toISOString()}
                  onClick={() => handleSelect(date)}
                  style={{
                    height: '34px',
                    width: '34px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '13px',
                    fontWeight: isSelected || isToday ? 800 : 500,
                    borderRadius: '50%',
                    cursor: 'pointer',
                    color: isSelected ? '#fff' : isToday ? 'var(--nv)' : '#4B5563',
                    background: isSelected ? 'var(--cr)' : 'transparent',
                    border: isToday && !isSelected ? '2px solid var(--nv)' : '2px solid transparent',
                    transition: 'all 0.1s',
                    margin: '0 auto'
                  }}
                  className="calendar-day"
                >
                  {date.getDate()}
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'center' }}>
            <button
              onClick={() => handleSelect(new Date())}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--pu)',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: '6px'
              }}
              className="today-btn"
            >
              TODAY
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .calendar-day:hover {
          background-color: ${'var(--cr-bg)'} !important;
          color: var(--cr) !important;
        }
        .today-btn:hover {
            background-color: #F5F3FF;
        }
        .custom-datepicker-display:hover {
           background: linear-gradient(#fff, #fff) padding-box, linear-gradient(135deg, var(--cr-l), var(--pu)) border-box !important;
           box-shadow: 0 4px 15px rgba(139, 0, 0, 0.1);
        }
      `}</style>
    </div>
  );
};
