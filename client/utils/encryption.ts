import CryptoJS from "crypto-js";

// Use environment variable for key, fallback for dev
const ENCRYPTION_KEY = process.env.NEXT_PUBLIC_ENCRYPTION_KEY || "fallback_dev_secret_key_12345";

export const encryptPayload = (data: any): string => {
    try {
        const jsonString = JSON.stringify(data);
        const encrypted = CryptoJS.AES.encrypt(jsonString, ENCRYPTION_KEY).toString();
        return encrypted;
    } catch (error) {
        console.error("Encryption failed:", error);
        return "";
    }
};
