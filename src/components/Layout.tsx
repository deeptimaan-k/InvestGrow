import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Menu } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="fixed top-4 left-4 z-50 p-3 bg-gray-800/90 backdrop-blur-lg rounded-lg text-gray-400 hover:text-white md:hidden shadow-lg"
      >
        <Menu size={24} />
      </button>

      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <main className="md:pl-64 transition-all duration-300 min-h-screen">
        {children}
      </main>
    </div>
  );
}