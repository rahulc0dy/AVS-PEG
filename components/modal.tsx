"use client";

import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export default function Modal({ isOpen, onClose, children }: ModalProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [portalEl, setPortalEl] = useState<HTMLElement | null>(null);
  const createdRef = useRef(false);

  // Mount check to ensure compatibility with SSR
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Ensure a portal container exists on the client. If a global
  // `#modal-container` is present in the page use it; otherwise create
  // one and clean it up on unmount (only if we created it).
  useEffect(() => {
    if (!isMounted) return;
    let el = document.getElementById("modal-container") as HTMLElement | null;
    if (!el) {
      el = document.createElement("div");
      el.id = "modal-container";
      document.body.appendChild(el);
      createdRef.current = true;
    }
    setPortalEl(el);
    return () => {
      // only remove if we created it
      if (createdRef.current && el && el.parentNode) {
        el.parentNode.removeChild(el);
      }
    };
  }, [isMounted]);

  // Escape key closes modal only when open
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isMounted || !isOpen || !portalEl) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/65 flex items-center justify-center backdrop-blur"
      onClick={onClose} // Close on outside click
    >
      <div
        className="bg-primary rounded shadow-lg overflow-clip"
        onClick={(e) => e.stopPropagation()} // Prevent inside clicks from closing
      >
        {children}
      </div>
    </div>,
    portalEl
  );
}
