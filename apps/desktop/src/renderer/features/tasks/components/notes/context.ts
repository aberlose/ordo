import { attachmentUrl } from '@ordo/contracts';
import { createContext, useContext } from 'react';

/** The task whose notes are edited, for the node views (images read the task's attachments). */
export interface NotesContextValue {
  taskId: string;
  /** Address of an attachment's file (`ordo-file://…`; stories pass sample images). */
  imageUrl: (attachmentId: string) => string;
}

export const NotesContext = createContext<NotesContextValue>({ taskId: '', imageUrl: attachmentUrl });
export const useNotesContext = () => useContext(NotesContext);
