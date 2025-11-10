// components/ProfilePicture.jsx
import React, { useState } from 'react';
import { User } from 'lucide-react';

const ProfilePicture = ({ 
  src, 
  name, 
  size = 'md', 
  className = '', 
  showFallback = true 
}) => {
  const [hasError, setHasError] = useState(false);

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10', 
    lg: 'w-16 h-16',
    xl: 'w-20 h-20'
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-8 h-8', 
    xl: 'w-10 h-10'
  };
  console.log('++++++++++++++++++++++ProfilePicture src:', src);


  // If there's no src or if image failed to load, show fallback
  if (!src || hasError) {
    return (
      <div className={`${sizeClasses[size]} bg-blue-100 rounded-full flex items-center justify-center ${className}`}>
        <User className={`${iconSizes[size]} text-blue-600`} />
      </div>
    );
  }

  return (
    <img
      key={src} // Force component remount when src changes - breaks browser cache
      src={src}
      alt={`${name}'s profile`}
      className={`${sizeClasses[size]} rounded-full object-cover border border-gray-200 ${className}`}
      onError={() => setHasError(true)}
    />
  );
};

export default ProfilePicture;