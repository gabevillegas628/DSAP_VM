// components/TitleManager.js
import useProgramSettings from '../hooks/useProgramSettings';
import useDocumentTitle from '../hooks/useDocumentTitle';

const TitleManager = ({ children }) => {
  const { settings, loading } = useProgramSettings();
  
  // Update document title when settings are loaded
  useDocumentTitle(
    loading ? 'Loading...' : (settings?.projectHeader || 'DNA Analysis Program')
  );

  // This component doesn't render anything visible, just manages the title
  return children || null;
};

export default TitleManager;