// hooks/useDocumentTitle.js
import { useEffect } from 'react';

const useDocumentTitle = (title) => {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title;
    
    // Cleanup function to restore previous title if component unmounts
    return () => {
      document.title = previousTitle;
    };
  }, [title]);
};

export default useDocumentTitle;