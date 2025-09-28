// context/DNAContext.js
import React, { createContext, useContext } from 'react';

const DNAContext = createContext();

export const useDNAContext = () => {
  const context = useContext(DNAContext);
  if (!context) {
    throw new Error('useDNAContext must be used within a DNAProvider');
  }
  return context;
};

export const DNAProvider = ({ children, value }) => {
  return (
    <DNAContext.Provider value={value}>
      {children}
    </DNAContext.Provider>
  );
};

export default DNAContext;