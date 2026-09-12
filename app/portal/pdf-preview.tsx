"use client";

import { useRef } from "react";
import { Download, Eye, X } from "lucide-react";
import styles from "./pdf-preview.module.css";

export function PdfPreview({
  href,
  downloadHref,
  title,
  triggerLabel = "Vorschau",
}: {
  href: string;
  downloadHref: string;
  title: string;
  triggerLabel?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  function open() {
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
  }

  return (
    <>
      <button className={styles.trigger} type="button" onClick={open}>
        <Eye size={15} aria-hidden="true" />
        {triggerLabel}
      </button>

      <dialog
        ref={dialogRef}
        className={styles.dialog}
        aria-labelledby={`pdf-preview-${title}`}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        <div className={styles.panel}>
          <header className={styles.topbar}>
            <div>
              <span>WERK / DOKUMENT</span>
              <strong id={`pdf-preview-${title}`}>{title}</strong>
            </div>
            <div className={styles.actions}>
              <a href={downloadHref}>
                <Download size={15} aria-hidden="true" />
                Download
              </a>
              <button type="button" onClick={close} aria-label="PDF-Vorschau schließen">
                <X size={18} aria-hidden="true" />
              </button>
            </div>
          </header>

          <div className={styles.viewer}>
            <iframe src={href} title={`PDF-Vorschau: ${title}`} />
            <p>
              Falls dein Browser die PDF nicht direkt darstellen kann, kannst du sie über
              {" "}<a href={href} target="_blank" rel="noreferrer">PDF öffnen</a>.
            </p>
          </div>
        </div>
      </dialog>
    </>
  );
}
