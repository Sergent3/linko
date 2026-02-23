import React from 'react';
import { Bell, Share2, Search, LayoutGrid, Menu } from 'lucide-react';

interface NavbarProps {
  onMenuClick: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ onMenuClick }) => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-md shadow-sm h-16 flex items-center px-4">
      {/* Left section: Hamburger and Logo */}
      <div className="flex items-center space-x-3">
        <button onClick={onMenuClick} className="p-2 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <Menu size={24} className="text-gray-700" />
        </button>
        <div className="flex items-center space-x-2">
          <LayoutGrid size={24} className="text-blue-600" />
          <span className="text-xl font-bold text-gray-800">Linko</span>
        </div>
      </div>

      {/* Center section: Search Bar */}
      <div className="flex-grow flex justify-center">
        <div className="relative w-full max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search everything..."
            className="w-full py-2 pl-10 pr-4 rounded-full bg-gray-100 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Right section: Icons and Avatar */}
      <div className="flex items-center space-x-4">
        <Bell size={20} className="text-gray-600 cursor-pointer hover:text-gray-800" />
        <Share2 size={20} className="text-gray-600 cursor-pointer hover:text-gray-800" />
        <div className="w-8 h-8 rounded-full bg-blue-400 flex items-center justify-center text-white font-semibold text-sm">
          JD
        </div>
      </div>
    </nav>
  );
};

export default Navbar;