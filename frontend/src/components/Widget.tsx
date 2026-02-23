import React, { useState } from 'react';
import { Grip, ExternalLink, Link, Trash2, Settings, Bell, Share2, LayoutGrid, Folder, Plus, Search, Menu } from 'lucide-react';

interface WidgetProps {
  title: string;
  type: 'bookmarks' | 'notes' | 'todo';
  content: any; // MOCK_DATA type
}

const Favicon = ({ url }: { url: string }) => {
  const [error, setError] = useState(false);
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${url}&sz=32`;

  if (error) {
    return <Link size={16} className="text-gray-500" />;
  }

  return (
    <img
      src={faviconUrl}
      alt="favicon"
      className="w-4 h-4 rounded-sm"
      onError={() => setError(true)}
    />
  );
};

const Widget: React.FC<WidgetProps> = ({ title, type, content }) => {
  const [hover, setHover] = useState(false);

  return (
    <div
      className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-sm border border-white/60 p-4 relative"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
        <div className="flex items-center space-x-2">
          {hover && (
            <Grip size={18} className="text-gray-400 cursor-grab" />
          )}
          <Settings size={18} className="text-gray-400 cursor-pointer hover:text-gray-600" />
          <Trash2 size={18} className="text-red-400 cursor-pointer hover:text-red-600" />
        </div>
      </div>

      <div className="text-gray-700">
        {type === 'bookmarks' && (
          <div>
            <ul className="space-y-2">
              {content.map((bookmark: any, index: number) => (
                <li key={index} className="flex items-center group">
                  <Favicon url={bookmark.url} />
                  <a
                    href={bookmark.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 flex-grow text-blue-600 hover:underline"
                  >
                    {bookmark.title}
                  </a>
                  <ExternalLink size={16} className="ml-2 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-center border-t border-gray-200 pt-3">
              <input
                type="text"
                placeholder="Quick Add Bookmark..."
                className="flex-grow p-2 text-sm rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500 bg-gray-50"
              />
              <Plus size={20} className="ml-2 text-blue-500 cursor-pointer" />
            </div>
          </div>
        )}
        {type === 'notes' && (
          <textarea
            className="w-full h-32 p-2 text-sm rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500 bg-gray-50 resize-none"
            placeholder="Write your notes here..."
            defaultValue={content}
          ></textarea>
        )}
        {type === 'todo' && (
          <div>
            <ul className="space-y-2">
              {content.map((todo: any, index: number) => (
                <li key={index} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={todo.completed}
                    className="form-checkbox h-4 w-4 text-blue-600 rounded"
                    readOnly
                  />
                  <span className={`ml-2 text-sm ${todo.completed ? 'line-through text-gray-500' : 'text-gray-800'}`}>
                    {todo.task}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-center border-t border-gray-200 pt-3">
              <input
                type="text"
                placeholder="Quick Add Todo..."
                className="flex-grow p-2 text-sm rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500 bg-gray-50"
              />
              <Plus size={20} className="ml-2 text-blue-500 cursor-pointer" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Widget;