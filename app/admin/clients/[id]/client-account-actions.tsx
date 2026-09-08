"use client";

import { KeyboardEvent, useEffect, useRef, useState } from "react";
import { KeyRound, Trash2, X } from "lucide-react";
import { deleteClient, sendClientAccessLink } from "../actions";

export function ClientAccountActions({
  clientId,
  clientNumber,
  displayName,
}: {
  clientId: string;
  clientNumber: string | null;
  displayName: string;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const deleteTriggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmationInputRef = useRef<HTMLInputElement>(null);
  const confirmation = clientNumber || "LÖSCHEN";

  useEffect(() => {
    if (!deleteOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => confirmationInputRef.current?.focus());

    return () => {
      document.body.style.overflow = previousOverflow;
      window.requestAnimationFrame(() => deleteTriggerRef.current?.focus());
    };
  }, [deleteOpen]);

  function closeDialog() {
    setDeleteOpen(false);
  }

  function handleDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeDialog();
      return;
    }

    if (event.key !== "Tab" || !dialogRef.current) return;
    const focusable = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="client-account-actions">
      <form action={sendClientAccessLink}>
        <input type="hidden" name="clientId" value={clientId} />
        <button className="secondary-button" type="submit">
          <KeyRound size={16} aria-hidden="true" /> Zugangslink senden
        </button>
      </form>

      <button ref={deleteTriggerRef} className="danger-button" type="button" onClick={() => setDeleteOpen(true)} aria-haspopup="dialog" aria-expanded={deleteOpen}>
        <Trash2 size={16} aria-hidden="true" /> Kunde löschen
      </button>

      {deleteOpen ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={closeDialog}>
          <div
            ref={dialogRef}
            className="confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-client-title"
            aria-describedby="delete-client-description"
            onMouseDown={(event) => event.stopPropagation()}
            onKeyDown={handleDialogKeyDown}
          >
            <div className="confirm-dialog-head">
              <div>
                <div className="eyebrow">Gefahrenzone</div>
                <h2 id="delete-client-title">{displayName} vollständig löschen?</h2>
              </div>
              <button className="icon-button" type="button" onClick={closeDialog} aria-label="Dialog schließen"><X size={18} aria-hidden="true" /></button>
            </div>
            <p id="delete-client-description">Dadurch werden das Auth-Konto, die Kundenakte, alle Projekte, Nachrichten, Aufgaben, Benachrichtigungen und gespeicherten Projektdateien dieses Kunden entfernt.</p>
            <form action={deleteClient} className="confirm-delete-form">
              <input type="hidden" name="clientId" value={clientId} />
              <label htmlFor="delete-confirmation">Zur Bestätigung <strong>{confirmation}</strong> eingeben</label>
              <input ref={confirmationInputRef} id="delete-confirmation" name="confirmation" required autoComplete="off" placeholder={confirmation} />
              <div className="confirm-dialog-actions">
                <button className="secondary-button" type="button" onClick={closeDialog}>Abbrechen</button>
                <button className="danger-button danger-button-solid" type="submit"><Trash2 size={16} aria-hidden="true" /> Endgültig löschen</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
