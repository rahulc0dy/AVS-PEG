"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export default function Modal({ isOpen, onClose, children }: ModalProps) {
  const [isMounted, setIsMounted] = useState(false);

  // Mount check to ensure compatibility with SSR
  useEffect(() => {
    setIsMounted(true);
  }, []);

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

  if (!isMounted || !isOpen) return null;

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
    document.getElementById("modal-container") as HTMLElement
  );
}
