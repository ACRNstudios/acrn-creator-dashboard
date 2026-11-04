"use client";

import { useEffect, type ReactNode } from "react";

interface ModalProps {
  title: string;
  eyebrow?: string;
  onClose: () => void;
  children: ReactNode;
}

export default function Modal({ title, eyebrow, onClose, children }: ModalProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return <div className="sm-modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="sm-modal" role="dialog" aria-modal="true" aria-label={title}>
      <div className="sm-modal-head">
        <div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h2>{title}</h2></div>
        <button className="ghost sm-icon-btn" onClick={onClose} aria-label="Close">✕</button>
      </div>
      {children}
    </div>
  </div>;
}
