import React, { useEffect, useState, useRef } from 'react';
import { runCriticAgent, setupPeriodicCriticism } from '../../agents/CriticAgent';
import { useLogStore } from '../../stores/logStore';
import { useMemoryStore } from '../../stores/memoryStore';

interface CriticManagerProps {
  enablePeriodic?: boolean;
  intervalMinutes?: number;
}

export function CriticManager({ 
  enablePeriodic = false, // DISABLED by default to prevent token loops
  intervalMinutes = 15    // Increased interval for safety
}: CriticManagerProps) {
  const [isEnabled, setIsEnabled] = useState(enablePeriodic);
  const [activityCount, setActivityCount] = useState(0);
  const [lastCriticismTime, setLastCriticismTime] = useState(0);
  const cleanupRef = useRef<(() => void) | null>(null);
  
  const { logs } = useLogStore();
  const { entries: memoryEntries } = useMemoryStore();

  // Monitor activity levels (but don't auto-trigger to avoid loops)
  useEffect(() => {
    if (!isEnabled) return;

    // Count significant activities in last 5 minutes
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    const recentActivity = [
      ...logs.filter(log => log.timestamp > fiveMinutesAgo && ['error', 'success', 'agent'].includes(log.level)),
      ...memoryEntries.filter(entry => entry.timestamp > fiveMinutesAgo && ['file_action', 'claude_response'].includes(entry.type))
    ];

    setActivityCount(recentActivity.length);

    // Don't auto-trigger here to prevent loops - let periodic timer handle it
  }, [logs.length, memoryEntries.length, isEnabled]);

  // Setup/cleanup periodic criticism
  useEffect(() => {
    if (isEnabled) {
      cleanupRef.current = setupPeriodicCriticism(intervalMinutes);
      
      useLogStore.getState().addLog({
        level: 'info',
        source: 'Critic Manager',
        message: `🤖 Automatic criticism enabled (every ${intervalMinutes} minutes)`
      });
    } else {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      
      useLogStore.getState().addLog({
        level: 'info',
        source: 'Critic Manager',
        message: '⏸️ Automatic criticism disabled'
      });
    }

    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, [isEnabled, intervalMinutes]);

  const handleAutomaticCriticism = async () => {
    try {
      useLogStore.getState().addLog({
        level: 'info',
        source: 'Critic Manager',
        message: `🔄 Auto-triggering criticism (${activityCount} recent activities)`
      });

      await runCriticAgent();
      setLastCriticismTime(Date.now());
    } catch (error) {
      useLogStore.getState().addLog({
        level: 'warn',
        source: 'Critic Manager',
        message: `⚠️ Auto-criticism failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  };

  const togglePeriodic = () => {
    setIsEnabled(!isEnabled);
  };

  // This component renders nothing but manages the periodic criticism
  return (
    <div className="hidden">
      {/* Hidden manager component - could be made visible for debugging */}
      <div className="text-xs text-gray-500">
        Critic Manager: {isEnabled ? 'Active' : 'Inactive'} | 
        Activity: {activityCount} | 
        Last: {lastCriticismTime ? new Date(lastCriticismTime).toLocaleTimeString() : 'Never'}
      </div>
    </div>
  );
}

// Hook for easier usage
export function useCriticManager(enablePeriodic: boolean = false, intervalMinutes: number = 3) {
  const [isActive, setIsActive] = useState(enablePeriodic);
  
  const toggleCriticism = () => setIsActive(!isActive);
  
  return {
    isActive,
    toggleCriticism,
    CriticManagerComponent: () => (
      <CriticManager 
        enablePeriodic={isActive} 
        intervalMinutes={intervalMinutes} 
      />
    )
  };
}