import React from 'react';
import { Folder, Plus, Settings } from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
  pages: { id: string; name: string; active: boolean }[];
  onPageSelect: (id: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, toggleSidebar, pages, onPageSelect }) => {
  return (
    <div
      className={`fixed top-0 left-0 h-full w-64 bg-white/90 backdrop-blur-md shadow-lg z-30 transform transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full'} pt-16`}
    >
      <div className="p-4">
        <button className="w-full bg-blue-600 text-white py-2 rounded-lg flex items-center justify-center space-x-2 hover:bg-blue-700 transition-colors">
          <Plus size={20} />
          <span>Add Page</span>
        </button>

        <nav className="mt-6">
          <ul className="space-y-2">
            {pages.map((page) => (
              <li key={page.id}>
                <a
                  href="#"
                  onClick={() => onPageSelect(page.id)}
                  className={`flex items-center space-x-3 p-2 rounded-md transition-colors ${page.active ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-700 hover:bg-gray-100'}`}
                >
                  <Folder size={20} />
                  <span>{page.name}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="absolute bottom-0 left-0 w-full p-4 border-t border-gray-200">
        <button className="w-full flex items-center space-x-3 p-2 rounded-md text-gray-700 hover:bg-gray-100 transition-colors">
          <Settings size={20} />
          <span>Settings</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;