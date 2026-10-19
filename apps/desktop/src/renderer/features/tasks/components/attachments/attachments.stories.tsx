import type { Attachment, Task } from '@ordo/contracts';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useFeedback } from '@renderer/shared/feedback/store';
import { today } from '@renderer/shared/lib/dates';
import { board, columns, now, tasks } from '@renderer/test/fixtures';
import { TaskCard } from '../TaskCard';
import { TaskDetailView } from '../TaskDetailView';
import { AttachmentList, type AttachmentListProps } from './AttachmentList';
import { DropOverlay } from './AttachmentDropTarget';
import type { Upload } from './uploads';

const meta = { title: 'Tasks/Attachments' } satisfies Meta;
export default meta;
type Story = StoryObj;

const header = tasks[4]!;
const day = 86_400_000;

/** A thumbnail stand-in (Storybook has no `ordo-file://` protocol): a header mockup as an SVG. */
const thumbnail = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72"><rect width="72" height="72" fill="#E6EFFF"/><rect y="0" width="72" height="16" fill="#1A52E6"/><rect x="8" y="26" width="40" height="6" rx="3" fill="#C9D9FB"/><rect x="8" y="38" width="56" height="6" rx="3" fill="#C9D9FB"/><rect x="8" y="50" width="30" height="6" rx="3" fill="#C9D9FB"/></svg>',
)}`;

const file = (
  n: number,
  fileName: string,
  sizeBytes: number,
  ago: number,
  extra: Partial<Attachment> = {},
) => ({
  id: `01920000-0000-7000-8000-00000000a00${n}`,
  taskId: header.id,
  fileName,
  mimeType: null,
  sizeBytes,
  createdAt: now - ago * day,
  url: '',
  ...extra,
});

const files: Attachment[] = [
  file(1, 'maquette-header-v3.png', 412 * 1024, 2, { mimeType: 'image/png', url: thumbnail }),
  file(2, 'cahier-des-charges.pdf', 1.8 * 1024 * 1024, 4),
  file(3, 'header-mobile.fig', 6.2 * 1024 * 1024, 1),
];

const uploads: Upload[] = [
  {
    id: 'upload-1',
    taskId: header.id,
    fileName: 'demo-menu-burger.mov',
    status: 'copying',
    source: { kind: 'path', path: '/Users/me/demo-menu-burger.mov' },
  },
  {
    id: 'upload-2',
    taskId: header.id,
    fileName: 'export-figma.zip',
    status: 'failed',
    source: { kind: 'path', path: '/Users/me/export-figma.zip' },
  },
];

/** The list with local state: delete, retry and dismiss work in the story. */
function ListDemo(props: Partial<AttachmentListProps>) {
  const [list, setList] = useState(props.attachments ?? files);
  const [pending, setPending] = useState(props.uploads ?? []);
  return (
    <AttachmentList
      reveal="mac"
      onAdd={() => undefined}
      onOpen={() => undefined}
      onReveal={() => undefined}
      onRetryUpload={(upload) =>
        setPending((current) => current.map((u) => (u.id === upload.id ? { ...u, status: 'copying' } : u)))
      }
      onDismissUpload={(upload) => setPending((current) => current.filter((u) => u.id !== upload.id))}
      {...props}
      attachments={list}
      uploads={pending}
      onDelete={(attachment) => setList((current) => current.filter((a) => a.id !== attachment.id))}
    />
  );
}

/** The task window as in the mockup: the section after the title (and the drop overlay, when given). */
function Window({ children, overlay }: { children: ReactNode; overlay?: ReactNode }) {
  const [task, setTask] = useState<Task>(header);
  return (
    <TaskDetailView
      task={task}
      boardName={board.name}
      columns={columns}
      today={today()}
      now={now}
      expanded={false}
      dark={false}
      onChange={(change) => setTask((current) => ({ ...current, ...change }) as Task)}
      onDelete={() => undefined}
      onClose={() => undefined}
      onToggleExpanded={() => undefined}
      onToggleTheme={() => undefined}
      attachments={children}
      {...(overlay ? { dropTarget: overlay } : {})}
    />
  );
}

/** Approved mockups task-detail and notes-attachments/Attachments A: image thumbnail, PDF, other type. */
export const Files: Story = {
  render: () => (
    <Window>
      <ListDemo />
    </Window>
  ),
};
export const FilesDark: Story = { ...Files, globals: { mode: 'dark' } };

/** Attachments A, "Survol · menu": ⋯ opens Ouvrir (↵), Afficher dans le Finder, Supprimer…. */
export const Menu: Story = {
  render: () => (
    <Window>
      <ListDemo menuOpenId={files[0]!.id} />
    </Window>
  ),
};
export const MenuDark: Story = { ...Menu, globals: { mode: 'dark' } };

/** Attachments A, "Confirmer la suppression": an image, so the notes hint is shown. Annuler is focused. */
export const DeleteConfirmation: Story = {
  render: () => (
    <Window>
      <ListDemo confirmingId={files[0]!.id} />
    </Window>
  ),
};
export const DeleteConfirmationDark: Story = { ...DeleteConfirmation, globals: { mode: 'dark' } };

/** Attachments A, "Fichiers glissés sur la fenêtre". */
export const DropOverlayShown: Story = {
  render: () => (
    <Window overlay={<DropOverlay count={2} />}>
      <ListDemo />
    </Window>
  ),
};
export const DropOverlayShownDark: Story = { ...DropOverlayShown, globals: { mode: 'dark' } };

/** Attachments A, "Copie en cours · échec": a "Copie…" tile and a red tile with Réessayer and ×. */
export const CopyingAndFailed: Story = {
  render: () => (
    <Window>
      <ListDemo attachments={files.slice(0, 2)} uploads={uploads} />
    </Window>
  ),
};
export const CopyingAndFailedDark: Story = { ...CopyingAndFailed, globals: { mode: 'dark' } };

/** "Ajouter ou déposer" chosen: while the dialog and its copy run, the tile shows the indeterminate "Copie…". */
export const PickerCopying: Story = {
  render: () => (
    <Window>
      <ListDemo attachments={files.slice(0, 2)} adding />
    </Window>
  ),
};
export const PickerCopyingDark: Story = { ...PickerCopying, globals: { mode: 'dark' } };

/** The list could not be loaded: the dashed box with Réessayer (as the archives and the sub-tasks). */
export const LoadError: Story = {
  render: () => (
    <Window>
      <AttachmentList
        attachments={undefined}
        uploads={[]}
        reveal="mac"
        loadError
        onRetryLoad={() => undefined}
        onAdd={() => undefined}
        onOpen={() => undefined}
        onReveal={() => undefined}
        onDelete={() => undefined}
        onRetryUpload={() => undefined}
        onDismissUpload={() => undefined}
      />
    </Window>
  ),
};
export const LoadErrorDark: Story = { ...LoadError, globals: { mode: 'dark' } };

/** Shows the toast of a program opened from its tile (hides after 6 s; reload the story to see it again). */
function ProgramToast() {
  const { t } = useTranslation();
  useEffect(() => {
    useFeedback.getState().showToast(t('attachments.notOpened.mac'));
    return () => useFeedback.getState().dismissToast();
  }, [t]);
  return null;
}

/** A program or a script is never run: it is shown in the Finder, and the toast says why. */
export const ProgramShownInFolder: Story = {
  render: () => (
    <Window>
      <ListDemo attachments={[...files.slice(0, 2), file(4, 'installer.dmg', 48 * 1024 * 1024, 0)]} />
      <ProgramToast />
    </Window>
  ),
};
export const ProgramShownInFolderDark: Story = { ...ProgramShownInFolder, globals: { mode: 'dark' } };

/** No file yet: only the dashed "Ajouter ou déposer" tile. */
export const Empty: Story = {
  render: () => (
    <Window>
      <ListDemo attachments={[]} />
    </Window>
  ),
};
export const EmptyDark: Story = { ...Empty, globals: { mode: 'dark' } };

/** Board mockup: the paperclip and the count on the card's bottom line, before the sub-task ring. */
export const CardWithAttachments: Story = {
  render: () => (
    <div className="flex min-h-screen flex-col gap-2.5 p-10">
      <div className="flex w-column flex-col gap-2.5">
        <TaskCard task={{ ...header, attachmentCount: 3 }} today={today()} onOpen={() => undefined} />
        <TaskCard
          task={{ ...tasks[0]!, attachmentCount: 1, subtasks: { done: 2, total: 5 } }}
          today={today()}
          onOpen={() => undefined}
          color="blue"
        />
        <TaskCard task={tasks[1]!} today={today()} onOpen={() => undefined} />
      </div>
    </div>
  ),
};
export const CardWithAttachmentsDark: Story = { ...CardWithAttachments, globals: { mode: 'dark' } };
