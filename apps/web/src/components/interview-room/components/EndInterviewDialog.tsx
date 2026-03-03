'use client';

import { useInterviewRoom } from '../hooks/useInterviewRoom';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { PhoneOff } from 'lucide-react';

export function EndInterviewDialog() {
  const { sendClientEvent } = useInterviewRoom();

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <PhoneOff className="mr-2 h-4 w-4" />
          End
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>End Interview?</AlertDialogTitle>
          <AlertDialogDescription>
            This will end the interview session. The AI will wrap up and evaluation will begin.
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => sendClientEvent('stop')}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            End Interview
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
