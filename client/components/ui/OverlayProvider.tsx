"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef } from "react";

interface OverlayProviderProps {
  children: React.ReactNode;
  overlays?: React.ReactNode[];
}

export function OverlayProvider({ children, overlays = [] }: OverlayProviderProps) {
  const overlayRootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Create overlay container if it doesn't exist
    if (!overlayRootRef.current) {
      overlayRootRef.current = document.createElement("div");
      overlayRootRef.current.id = "overlay-root";
      document.body.appendChild(overlayRootRef.current);
    }

    return () => {
      if (overlayRootRef.current) {
        document.body.removeChild(overlayRootRef.current);
        overlayRootRef.current = null;
      }
    };
  }, []);

  return (
    <>
      {children}
      {overlays.map((overlay, index) => 
        createPortal(
          <div 
            key={index}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40"
            style={{ zIndex: 9999 }}
          >
            {overlay}
          </div>,
          overlayRootRef.current!
        )
      )}
    </>
  );
}

export function useOverlay() {
  const overlayRootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!overlayRootRef.current) {
      overlayRootRef.current = document.createElement("div");
      overlayRootRef.current.id = "overlay-root";
      document.body.appendChild(overlayRootRef.current);
    }

    return () => {
      if (overlayRootRef.current) {
        document.body.removeChild(overlayRootRef.current);
        overlayRootRef.current = null;
      }
    };
  }, []);

  return {
    renderOverlay: (content: React.ReactNode) => {
      if (overlayRootRef.current) {
        return createPortal(
          <div 
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40"
            style={{ zIndex: 9999 }}
          >
            {content}
          </div>,
          overlayRootRef.current
        );
      }
      return null;
    }
  };
}
