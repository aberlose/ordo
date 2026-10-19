import type { Attachment } from '@ordo/contracts';
import { useCallback, useMemo } from 'react';
import i18n from '@renderer/i18n';
import { useFeedback } from '@renderer/shared/feedback/store';
import {
  openAttachment,
  revealAttachment,
  useAttachments,
  useDeleteAttachment,
} from '../../hooks/attachments';
import { AttachmentList } from './AttachmentList';
import { revealPlatform } from './format';
import { useAttachmentUploads, useTaskUploads } from './uploads';

type FailedAction = 'openAttachment' | 'revealAttachment' | 'deleteAttachment';

function failed(action: FailedAction, retry?: () => void) {
  useFeedback.getState().showToast(i18n.t(`feedback.failed.${action}`), retry);
}

/** The task's attachments in its window (tasks and sub-tasks), wired to the attachment channels. */
export function AttachmentSection({ boardId, taskId }: { boardId: string; taskId: string }) {
  const { data, isError, refetch } = useAttachments(taskId);
  const uploads = useTaskUploads(taskId);
  const { pick, picking, retry, dismiss } = useAttachmentUploads(boardId, taskId);
  const { mutate: remove } = useDeleteAttachment(boardId, taskId);
  const reveal = useMemo(() => revealPlatform(), []);

  const onOpen = useCallback((attachment: Attachment) => {
    openAttachment(attachment.id).catch(() => failed('openAttachment'));
  }, []);
  const onReveal = useCallback((attachment: Attachment) => {
    revealAttachment(attachment.id).catch(() => failed('revealAttachment'));
  }, []);
  const onDelete = useCallback(
    (attachment: Attachment) => remove(attachment.id, { onError: () => failed('deleteAttachment') }),
    [remove],
  );

  return (
    <AttachmentList
      attachments={data}
      uploads={uploads}
      reveal={reveal}
      loadError={isError && !data}
      onRetryLoad={() => void refetch()}
      onAdd={() => void pick()}
      adding={picking}
      onOpen={onOpen}
      onReveal={onReveal}
      onDelete={onDelete}
      onRetryUpload={retry}
      onDismissUpload={dismiss}
    />
  );
}
