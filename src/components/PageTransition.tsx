import React from 'react';

interface PageTransitionProps {
  children: React.ReactNode;
}

export const PageTransition: React.FC<PageTransitionProps> = ({ children }) => {
  return (
    <div className="w-full min-h-full animate-zs-page-enter">
      {children}
    </div>
  );
};
