import React from 'react';

interface LoadingScreenProps {
  message?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ message = 'Loading...' }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-400 via-pink-300 to-yellow-300">
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-2xl p-12 max-w-md w-full mx-4">
        <div className="text-center">
          {/* Animated pet egg icon */}
          <div className="relative inline-block mb-6">
            <div className="w-32 h-32 bg-gradient-to-br from-blue-300 to-purple-400 rounded-full animate-bounce shadow-lg">
              <div className="absolute inset-2 bg-white/30 rounded-full"></div>
              <div className="absolute top-3 left-3 w-8 h-8 bg-white/50 rounded-full"></div>
            </div>
          </div>

          <h1 className="text-3xl font-bold text-gray-800 mb-3">Digital Pets</h1>

          {/* Loading spinner */}
          <div className="mb-4">
            <div className="inline-flex items-center gap-2">
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
              <div className="w-2 h-2 bg-pink-500 rounded-full animate-pulse animation-delay-200"></div>
              <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse animation-delay-400"></div>
            </div>
          </div>

          <p className="text-gray-600 font-medium">{message}</p>
        </div>
      </div>
    </div>
  );
};
