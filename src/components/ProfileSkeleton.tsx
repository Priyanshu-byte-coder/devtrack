import React from 'react';

export const ProfileSkeleton = () => {
  return (
    <div className="animate-pulse flex flex-col gap-4">
      <div className="h-24 w-24 bg-gray-300 rounded-full"></div>
      <div className="h-6 w-48 bg-gray-300 rounded"></div>
      <div className="h-4 w-64 bg-gray-300 rounded"></div>
    </div>
  );
};
