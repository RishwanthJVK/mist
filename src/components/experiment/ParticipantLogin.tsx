import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface ParticipantLoginProps {
  onLogin: (participantId: string) => void;
}

export const ParticipantLogin: React.FC<ParticipantLoginProps> = ({ onLogin }) => {
  const [participantId, setParticipantId] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (participantId.trim()) {
      onLogin(participantId.trim());
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <Card className="w-full max-w-md p-8 shadow-lg">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">MIST Explorer</h1>
          <p className="text-sm text-slate-500 mt-2">Montreal Imaging Stress Task</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="participantId">Participant ID</Label>
            <Input 
              id="participantId"
              type="text" 
              placeholder="e.g. SUBJ-001" 
              value={participantId}
              onChange={(e) => setParticipantId(e.target.value)}
              required
              className="w-full"
            />
          </div>
          <Button type="submit" className="w-full" disabled={!participantId.trim()}>
            Start Session
          </Button>
        </form>
      </Card>
    </div>
  );
};
