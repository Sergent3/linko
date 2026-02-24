'use client';

import React, { useState } from 'react';
import Widget from '@/components/Widget';
import { Settings, Plus } from 'lucide-react';

interface Bookmark {
  title: string;
  url: string;
}

interface TodoItem {
  task: string;
  completed: boolean;
}

interface WidgetData {
  id: string;
  title: string;
  type: 'bookmarks' | 'notes' | 'todo';
  content: Bookmark[] | string | TodoItem[];
}

interface PageData {
  id: string;
  name: string;
  widgets: WidgetData[];
}

const MOCK_DATA: PageData[] = [
  {
    id: '1',
    name: 'Work Dashboard',
    widgets: [
      {
        id: 'w1',
        title: 'Quick Links',
        type: 'bookmarks',
        content: [
          { title: 'Google', url: 'https://google.com' },
          { title: 'GitHub', url: 'https://github.com' },
          { title: 'Jira Board', url: 'https://jira.atlassian.com/' },
        ],
      },
      {
        id: 'w2',
        title: 'Project Notes',
        type: 'notes',
        content: 'Meeting notes for sprint planning. Remember to follow up on the API changes.',
      },
      {
        id: 'w3',
        title: 'Weekly Todos',
        type: 'todo',
        content: [
          { task: 'Finish dashboard implementation', completed: false },
          { task: 'Review PR #123', completed: true },
          { task: 'Deploy to staging', completed: false },
        ],
      },
      {
        id: 'w4',
        title: 'Development Bookmarks',
        type: 'bookmarks',
        content: [
          { title: 'React Docs', url: 'https://react.dev/' },
          { title: 'Tailwind CSS', url: 'https://tailwindcss.com/' },
        ],
      },
    ],
  },
  {
    id: '2',
    name: 'Personal Space',
    widgets: [
      {
        id: 'w5',
        title: 'Shopping List',
        type: 'todo',
        content: [
          { task: 'Buy groceries', completed: false },
          { task: 'Order new headphones', completed: false },
        ],
      },
      {
        id: 'w6',
        title: 'Ideas',
        type: 'notes',
        content: 'Ideas for a new side project: A recipe organizer with AI suggestions.',
      },
    ],
  },
];

const DashboardPage: React.FC = () => {
  const [activePageId, setActivePageId] = useState(MOCK_DATA[0].id);

  const activePage = MOCK_DATA.find((page) => page.id === activePageId);

  return (
    <div
      className="min-h-screen bg-cover bg-center transition-all duration-300"
      style={{
        backgroundImage: `url('https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D')`,
      }}
    >
      {/* Background Overlay */}
      <div className="absolute inset-0 bg-black/10 backdrop-blur-[1px] z-10"></div>

      <main className="relative z-20 pt-20 pb-8 px-4 md:px-8 lg:px-12">
        {/* Page Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-white drop-shadow-lg">{activePage?.name || 'Dashboard'}</h1>
          <div className="flex items-center space-x-3">
            <button className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700 transition-colors shadow-md">
              <Plus size={20} />
              <span>Add Widget</span>
            </button>
            <button className="bg-white/20 text-white p-2 rounded-lg hover:bg-white/30 transition-colors shadow-md">
              <Settings size={20} />
            </button>
          </div>
        </div>

        {/* Widget Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activePage?.widgets.map((widget) => (
            <Widget key={widget.id} title={widget.title} type={widget.type} content={widget.content} />
          ))}
        </div>
      </main>
    </div>
  );
};

export default DashboardPage;
