"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface PopupContextType {
    openPopup: (id: string, content?: any) => void;
    closePopup: (id: string) => void;
    isPopupOpen: (id: string) => boolean;
    getPopupData: (id: string) => any;
}

const PopupContext = createContext<PopupContextType | null>(null);

export const PopupProvider = ({ children }: { children: ReactNode }) => {
    const [popups, setPopups] = useState<Record<string, any>>({});

    const openPopup = useCallback((id: string, content: any = null) => {
        setPopups((prev) => ({ ...prev, [id]: content || true }));
    }, []);

    const closePopup = useCallback((id: string) => {
        setPopups((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
        });
    }, []);

    const isPopupOpen = useCallback((id: string) => !!popups[id], [popups]);
    const getPopupData = useCallback((id: string) => popups[id], [popups]);

    return (
        <PopupContext.Provider value={{ openPopup, closePopup, isPopupOpen, getPopupData }}>
            {children}
        </PopupContext.Provider>
    );
};

export const usePopups = () => {
    const context = useContext(PopupContext);
    if (!context) {
        throw new Error("usePopups must be used within a PopupProvider");
    }
    return context;
};
