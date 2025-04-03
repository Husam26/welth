import React from 'react';
import Link from 'next/link';

const NotFound = () => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-r from-purple-500 via-pink-500 to-red-500">
      <div className="text-center p-8 bg-white shadow-xl rounded-lg max-w-md w-full">
        <h1 className="text-6xl font-extrabold text-gray-800 mb-6">
          404 - Page Not Found
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          Oops! The page you’re looking for doesn’t exist or has been moved.
        </p>
        <Link
          href="/"
          className="bg-gradient-to-r from-red-400 to-pink-600 text-white px-6 py-3 text-lg font-semibold rounded-lg hover:from-red-500 hover:to-pink-700 transition duration-300"
        >
          Go Back to Home
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
