import React, { useState, useEffect } from 'react';
import { Calendar, AlertCircle } from 'lucide-react';

export default function DateRangePicker({ value, onChange, label = "Date" }) {
  const [isRange, setIsRange] = useState(false);
  const [error, setError] = useState(null);

  // Local state so the user can type freely without the input instantly snapping to padded dates
  const [startText, setStartText] = useState('');
  const [endText, setEndText] = useState('');

  // Sync incoming props to local state only if they differ materially (to prevent overriding active typing)
  useEffect(() => {
    if (value?.startDate && !startText) {
      setStartText(value.startDate.substring(0, 10));
    }
    if (value?.endDate && !endText) {
      setEndText(value.endDate.substring(0, 10));
    }
  }, [value?.startDate, value?.endDate]);

  useEffect(() => {
    // Determine range toggle state based on distinct dates or custom text
    if ((value?.startDate && value?.endDate && value.startDate !== value.endDate) || value?.dateText) {
      setIsRange(true);
    } else {
      setIsRange(false);
    }
  }, [value?.startDate, value?.endDate, value?.dateText]);

  const parseFuzzyDate = (userInput, isEnd = false) => {
    if (!userInput) return null;
    if (/^\d{4}$/.test(userInput)) return isEnd ? `${userInput}-12-31` : `${userInput}-01-01`;
    if (/^\d{4}-\d{2}$/.test(userInput)) {
      const year = userInput.substring(0, 4);
      const month = userInput.substring(5, 7);
      return isEnd ? `${year}-${month}-28` : `${userInput}-01`;
    }
    return userInput;
  };

  // Auto-format YYYY-MM-DD as user types
  const formatDateInput = (value) => {
    if (!value) return value;

    // Remove all non-digits
    const digits = value.replace(/\D/g, '');

    // Restrict to max 8 digits (YYYYMMDD)
    const truncated = digits.substring(0, 8);

    // Insert hyphens
    if (truncated.length <= 4) {
      return truncated;
    } else if (truncated.length <= 6) {
      return `${truncated.substring(0, 4)}-${truncated.substring(4)}`;
    } else {
      return `${truncated.substring(0, 4)}-${truncated.substring(4, 6)}-${truncated.substring(6)}`;
    }
  };

  const handleStartChange = (e) => {
    // Check if the user is deleting a hyphen, if so, just let the standard erase happen
    const isDeleting = startText.length > e.target.value.length;
    const rawInput = isDeleting ? e.target.value : formatDateInput(e.target.value);

    setStartText(rawInput);
    validateAndChange(rawInput, isRange ? endText : rawInput, value?.dateText);
  };

  const handleEndChange = (e) => {
    const isDeleting = endText.length > e.target.value.length;
    const rawInput = isDeleting ? e.target.value : formatDateInput(e.target.value);

    setEndText(rawInput);
    validateAndChange(startText, rawInput, value?.dateText);
  };

  const handleTextChange = (e) => {
    validateAndChange(startText, endText, e.target.value);
  };

  const handleToggle = () => {
    const newIsRange = !isRange;
    setIsRange(newIsRange);

    if (!newIsRange && startText) {
      setEndText(startText);
      validateAndChange(startText, startText, null);
    } else if (!newIsRange) {
      setEndText('');
      validateAndChange('', '', null);
    }
  };

  const validateAndChange = (rawStart, rawEnd, text) => {
    setError(null);
    const parsedStart = parseFuzzyDate(rawStart, false);
    let parsedEnd = parseFuzzyDate(rawEnd, true);

    if (!isRange) {
      parsedEnd = parsedStart;
    }

    if (isRange && parsedStart && parsedEnd && parsedStart.length >= 10 && parsedEnd.length >= 10) {
      if (new Date(parsedEnd) < new Date(parsedStart)) {
        setError("End date must be after start date");
      }
    }

    let newText = text;
    if (!text && rawStart && (/^\d{4}$/.test(rawStart) || /^\d{4}-\d{2}$/.test(rawStart))) {
      newText = rawStart;
    }

    onChange({
      startDate: parsedStart || null,
      endDate: parsedEnd || null,
      dateText: newText || null
    });
  };

  return (
    <div className="space-y-3 bg-sepia-50/50 p-4 rounded-xl border border-sepia-200">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-sepia-800">{label}</label>
        <label className="flex items-center cursor-pointer">
          <div className="relative">
            <input type="checkbox" className="sr-only" checked={isRange} onChange={handleToggle} />
            <div className={`block w-10 h-6 rounded-full transition-colors ${isRange ? 'bg-sepia-600' : 'bg-sepia-300'}`}></div>
            <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${isRange ? 'transform translate-x-4' : ''}`}></div>
          </div>
          <span className="ml-3 text-sm font-medium text-sepia-700">Fuzzy Range</span>
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs text-sepia-600 uppercase tracking-wider font-semibold">{isRange ? 'Earliest possible' : 'Exact Date'}</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-sepia-500" size={16} />
            <input
              type="text"
              placeholder="YYYY-MM-DD or YYYY"
              value={startText}
              onChange={handleStartChange}
              className="w-full bg-[var(--color-paper)] border border-sepia-300 rounded-lg pl-9 pr-3 py-2 text-sepia-900 focus:outline-none focus:ring-2 focus:ring-sepia-400"
            />
          </div>
        </div>

        {isRange && (
          <div className="space-y-1 animate-in fade-in slide-in-from-left-2 duration-300">
            <label className="text-xs text-sepia-600 uppercase tracking-wider font-semibold">Latest possible</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-sepia-500" size={16} />
              <input
                type="text"
                placeholder="YYYY-MM-DD or YYYY"
                value={endText}
                onChange={handleEndChange}
                className={`w-full bg-[var(--color-paper)] border rounded-lg pl-9 pr-3 py-2 text-sepia-900 focus:outline-none focus:ring-2 ${error ? 'border-red-400 focus:ring-red-400 bg-red-50' : 'border-sepia-300 focus:ring-sepia-400'}`}
              />
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-600 flex items-center gap-1 font-medium"><AlertCircle size={14} /> {error}</p>
      )}

      {isRange && (
        <div className="space-y-1 pt-2 animate-in fade-in duration-300">
          <label className="text-xs text-sepia-600 uppercase tracking-wider font-semibold">Display Title</label>
          <input
            type="text"
            value={value?.dateText || ''}
            onChange={handleTextChange}
            placeholder="e.g. 'Okinawa Tour - Jan 1983 - Jan 1986' or 'Summer 1973'"
            className="w-full bg-[var(--color-paper)] border border-sepia-300 rounded-lg px-3 py-2 text-sm text-sepia-900 focus:outline-none focus:ring-2 focus:ring-sepia-400"
          />
        </div>
      )}
    </div>
  );
}
