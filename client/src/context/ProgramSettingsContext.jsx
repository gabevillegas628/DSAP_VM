// context/ProgramSettingsContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';

const API_BASE = 'http://localhost:5000/api';

const ProgramSettingsContext = createContext();

export const useProgramSettingsContext = () => {
  const context = useContext(ProgramSettingsContext);
  if (!context) {
    throw new Error('useProgramSettingsContext must be used within a ProgramSettingsProvider');
  }
  return context;
};

export const ProgramSettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/program-settings`);
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
        setError(null);
      } else {
        throw new Error('Failed to fetch program settings');
      }
    } catch (err) {
      console.error('Error fetching program settings:', err);
      setError(err.message);
      // Set default settings on error
      setSettings({ projectHeader: 'DNA Analysis Program' });
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (newSettings) => {
    try {
      const response = await fetch(`${API_BASE}/program-settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newSettings),
      });

      if (response.ok) {
        const updatedSettings = await response.json();
        setSettings(updatedSettings);
        return { success: true, data: updatedSettings };
      } else {
        throw new Error('Failed to update program settings');
      }
    } catch (err) {
      console.error('Error updating program settings:', err);
      return { success: false, error: err.message };
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const value = {
    settings,
    loading,
    error,
    updateSettings,
    refreshSettings: fetchSettings
  };

  return (
    <ProgramSettingsContext.Provider value={value}>
      {children}
    </ProgramSettingsContext.Provider>
  );
};