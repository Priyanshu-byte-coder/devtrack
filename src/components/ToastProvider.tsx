import React from 'react';

// Placeholder for integrating react-hot-toast or similar
export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <>
      <div id="toast-container" className="fixed bottom-4 right-4 z-50"></div>
      {children}
    </>
  );
};
