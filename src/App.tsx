import React, { useState } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { RobloxGuide } from './components/RobloxGuide';
import { Gamepad2, FileCode2 } from 'lucide-react';

export default function App() {
  const [tab, setTab] = useState<'play' | 'code'>('play');

  return (
    <div className="h-screen bg-neutral-950 text-neutral-100 font-sans flex flex-col overflow-hidden">
      <header className="shrink-0 border-b border-neutral-800 bg-neutral-900/50 backdrop-blur-md px-4 sm:px-8 py-3 flex flex-col sm:flex-row items-center justify-between gap-4 z-50">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 shadow-lg shadow-blue-500/20">
            <Gamepad2 className="text-white w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              Tank Battlecade
            </h1>
          </div>
        </div>
        
        <div className="flex bg-neutral-950/50 p-1 rounded-lg border border-neutral-800/50">
          <button 
            onClick={() => setTab('play')} 
            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 uppercase tracking-widest ${tab === 'play' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-500 hover:text-white hover:bg-neutral-900'}`}
          >
            <Gamepad2 size={14} />
            Play
          </button>
          <button 
            onClick={() => setTab('code')} 
            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 uppercase tracking-widest ${tab === 'code' ? 'bg-blue-600 text-white shadow-sm' : 'text-neutral-500 hover:text-white hover:bg-neutral-900'}`}
          >
            <FileCode2 size={14} />
            Roblox
          </button>
        </div>
      </header>
      
      <main className="flex-1 relative overflow-hidden bg-neutral-950">
        {tab === 'play' ? (
          <div className="absolute inset-0 animate-in fade-in duration-700">
            <GameCanvas />
          </div>
        ) : (
          <div className="h-full overflow-y-auto p-4 sm:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="max-w-6xl mx-auto">
              <RobloxGuide />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
