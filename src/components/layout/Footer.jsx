import React from 'react';

export const Footer = () => {
    return (
        <footer className="bg-brand-darker border-t border-gray-800 py-8 mt-auto md:mb-0 mb-16">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-center">
                <p className="text-gray-500 text-sm font-medium">
                    &copy; {new Date().getFullYear()} Narsinge Premier League. All rights reserved.
                </p>
                <p className="text-gray-600 text-xs mt-2">
                    Auction Platform v1.0
                </p>
            </div>
        </footer>
    );
};
