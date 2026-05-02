import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, error, ...props }, ref) => {
    return (
      <div className="w-full mb-4">
        {label && (
          <label className="block text-sm font-medium mb-1 opacity-90">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`w-full px-4 py-2 bg-white/10 border ${error ? 'border-red-500' : 'border-white/20'} rounded-xl focus:outline-none focus:ring-2 focus:ring-primary backdrop-blur-md transition-all ${className}`}
          {...props}
        />
        {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
