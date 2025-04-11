import React from 'react';
import { Settings } from 'lucide-react';
import { Button } from '../ui/button';
import { LanguageSelector } from '../shared/LanguageSelector';

interface HeaderProps {
  currentLanguage: string;
  setLanguage: (language: string) => void;
  onOpenSettings: () => void;
}

export function Header({ currentLanguage, setLanguage, onOpenSettings }: HeaderProps) {
  return (
    <div className="bg-black p-2 border-b border-white/10 flex items-center justify-between">
      <div className="flex items-center space-x-1">
        <LanguageSelector 
          currentLanguage={currentLanguage}
          setLanguage={setLanguage}
        />
      </div>
      
      <div className="flex items-center space-x-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-white/70 hover:text-white hover:bg-white/10"
          onClick={onOpenSettings}
          title="Settings"
        >
          <Settings className="h-4 w-4 mr-1" />
          <span className="text-xs">Settings</span>
        </Button>
      </div>
    </div>
  );
}
