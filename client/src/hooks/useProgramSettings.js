// hooks/useProgramSettings.js
import { useState, useEffect } from 'react';
import apiService from '../services/apiService'; // Use your existing apiService

const useProgramSettings = () => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        // Use apiService instead of raw fetch - this handles the base URL automatically
        const data = await apiService.get('/program-settings');
        setSettings(data);
      } catch (err) {
        console.error('Error fetching program settings for title:', err);
        setError(err.message);
        // Don't set default settings here - let TitleManager handle the fallback
        setSettings(null);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  return { settings, loading, error };
};

export default useProgramSettings;