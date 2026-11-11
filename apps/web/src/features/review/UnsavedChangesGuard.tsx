import { useEffect } from 'react';
import { useBlocker } from 'react-router';

import { Button, Modal, ModalFooter } from '../../ui';
import { unsavedCopy } from './copy';

/**
 * Protects unsaved edits (UX-REVIEW-01): while `when` is true, leaving the review for another page asks for
 * confirmation, and closing or reloading the browser tab triggers the browser's own warning. Switching between the
 * review modes or the copy tabs never needs it: the edits stay where they are.
 */
export function UnsavedChangesGuard({ when }: { when: boolean }) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => when && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (!when) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [when]);

  if (blocker.state !== 'blocked') return null;
  return (
    <Modal title={unsavedCopy.title} onClose={() => blocker.reset()}>
      <p className="m-0 mb-4 font-sans text-body-md text-text-secondary">{unsavedCopy.body}</p>
      <ModalFooter onCancel={() => blocker.reset()}>
        <Button variant="danger" onClick={() => blocker.proceed()}>
          {unsavedCopy.leave}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
