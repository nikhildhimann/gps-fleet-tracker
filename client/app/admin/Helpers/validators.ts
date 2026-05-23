export interface ValidationRule {
    required?: boolean;
    type?: "string" | "number" | "boolean" | "array" | "object" | "email";
    errorMessage?: string;
}

export type ValidationRules = Record<string, ValidationRule>;

class Validator {
    private rules: ValidationRules;

    constructor(rules: ValidationRules = {}) {
        this.rules = rules; // Store the validation rules
    }

    // Validate if the value is not empty
    isNotEmpty(value: any): boolean {
        if (typeof value === "string") return value.trim().length > 0;
        if (value === null || value === undefined) return false;
        return true;
    }

    // Validate if the value matches the expected type
    isValidType(value: any, type: string): boolean {
        if (type === "string") return typeof value === "string";
        if (type === "email") {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return typeof value === "string" && emailRegex.test(value);
        }
        if (type === "number") return typeof value === "number" || (!isNaN(Number(value)) && value !== "");
        if (type === "boolean") return typeof value === "boolean";
        if (type === "array") return Array.isArray(value);
        if (type === "object") return typeof value === "object" && value !== null;
        return true;
    }

    // Validate the entire data object based on rules
    async validate(data: any): Promise<Record<string, string>> {
        const errors: Record<string, string> = {};

        for (const [key, rule] of Object.entries(this.rules)) {
            const value = data[key];

            // Check if the field is required and not empty
            if (rule.required && !this.isNotEmpty(value)) {
                errors[key] = rule.errorMessage || `${key} is required.`;
            }

            // Check if the value matches the required type
            if (rule.type && !this.isValidType(value, rule.type)) {
                errors[key] =
                    rule.errorMessage || `${key} must be of type ${rule.type}.`;
            }
        }

        return errors; // Return errors object
    }

    // Validate a single form field asynchronously
    async validateFormField(name: string, value: any): Promise<Record<string, string>> {
        if (!this.rules[name]) {
            return {}; // No validation rule for the field
        }
        const fieldData = { [name]: value };
        const validationErrors = await this.validate(fieldData);
        return validationErrors;
    }
}

export default Validator;
