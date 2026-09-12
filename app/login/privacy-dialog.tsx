"use client";

import type { ReactNode } from "react";
import { useRef } from "react";
import styles from "./privacy-dialog.module.css";

export function PrivacyDialog({ children }: { children: ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const open = () => dialogRef.current?.showModal();
  const close = () => dialogRef.current?.close();

  return (
    <>
      <button type="button" className={styles.trigger} onClick={open}>
        Datenschutz
      </button>

      <dialog
        ref={dialogRef}
        className={styles.dialog}
        aria-labelledby="privacy-dialog-title"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        <div className={styles.panel}>
          <div className={styles.topbar}>
            <span id="privacy-dialog-title">WERK / DATENSCHUTZ</span>
            <button type="button" className={styles.close} onClick={close} aria-label="Datenschutz schließen">
              <span aria-hidden="true">×</span>
            </button>
          </div>

          <div className={styles.scroll}>
            <article className="legal-page">{children}</article>
          </div>
        </div>
      </dialog>
    </>
  );
}
