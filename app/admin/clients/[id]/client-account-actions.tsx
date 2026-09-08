"use client";

import { useState } from "react";
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
  const confirmation = clientNumber || "LÖSCHEN";

  return (
    <div className="client-account-actions">
      <form action={sendClientAccessLink}>
        <input type="hidden" name="clientId" value={clientId} />
        <button className="secondary-button" type="submit">
          <KeyRound size={16} aria-hidden="true" /> Zugangslink senden
        </button>
      </form>

      <button className="danger-button" type="button" onClick={() => setDeleteOpen(true)}>
        <Trash2 size={16} aria-hidden="true" /> Kunde löschen
      </button>

      {deleteOpen ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setDeleteOpen(false)}>
          <div className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-client-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="confirm-dialog-head">
              <div>
                <div className="eyebrow">Gefahrenzone</div>
                <h2 id="delete-client-title">{displayName} vollständig löschen?</h2>
              </div>
              <button className="icon-button" type="button" onClick={() => setDeleteOpen(false)} aria-label="Dialog schließen"><X size={18} aria-hidden="true" /></button>
            </div>
            <p>Dadurch werden das Auth-Konto, die Kundenakte, alle Projekte, Nachrichten, Aufgaben, Benachrichtigungen und gespeicherten Projektdateien dieses Kunden entfernt.</p>
            <form action={deleteClient} className="confirm-delete-form">
              <input type="hidden" name="clientId" value={clientId} />
              <label htmlFor="delete-confirmation">Zur Bestätigung <strong>{confirmation}</strong> eingeben</label>
              <input id="delete-confirmation" name="confirmation" required autoComplete="off" placeholder={confirmation} />
              <div className="confirm-dialog-actions">
                <button className="secondary-button" type="button" onClick={() => setDeleteOpen(false)}>Abbrechen</button>
                <button className="danger-button danger-button-solid" type="submit"><Trash2 size={16} aria-hidden="true" /> Endgültig löschen</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
