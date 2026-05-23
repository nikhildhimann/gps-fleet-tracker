const User = require("../common/classes/userclass");

class Validator {
  constructor(data, rules) {
    this.data = data;
    this.rules = rules;
    this.errors = {};
  }
  validate_required_if(value, param) {
    const [otherField, expectedValue] = param.split(",");

    const otherValue = this.data[otherField];

    if (otherValue === expectedValue) {
      return this.validate_required(value);
    }

    return true;
  }

  validate() {
    for (const field in this.rules) {
      const fieldRules = this.rules[field].split("|");

      // Handle wildcard rules like subDepartments.*.name
      if (field.includes(".*.")) {
        const [arrayField, nestedKey] = field.split(".*.");
        const items = this.data[arrayField];

        if (Array.isArray(items)) {
          items.forEach((item, index) => {
            const value = item[nestedKey];
            for (const rule of fieldRules) {
              const [ruleName, ruleParam] = rule.includes(":")
                ? rule.split(":")
                : [rule];

              if (!this[`validate_${ruleName}`]) {
                throw new Error(
                  `Validation rule "${ruleName}" is not defined.`
                );
              }

              const isValid = this[`validate_${ruleName}`](value, ruleParam);
              if (!isValid) {
                this.addError(
                  `${arrayField}[${index}].${nestedKey}`,
                  ruleName,
                  ruleParam
                );
              }
            }
          });
        } else {
          this.addError(arrayField, "array");
        }
      } else {
        // Normal fields
        const value = this.data[field];
        // 🆕 FIX: If field is not required and value is null/undefined/empty, skip validation
        const isRequired = fieldRules.some((r) => r === "required" || r.startsWith("required_if"));
        if (!isRequired && (value === undefined || value === null || value === "")) {
          continue;
        }

        for (const rule of fieldRules) {
          const [ruleName, ruleParam] = rule.includes(":")
            ? rule.split(":")
            : [rule];

          if (!this[`validate_${ruleName}`]) {
            throw new Error(`Validation rule "${ruleName}" is not defined.`);
          }

          const isValid = this[`validate_${ruleName}`](value, ruleParam);
          if (!isValid) {
            this.addError(field, ruleName, ruleParam);
          }
        }
      }
    }

    if (Object.keys(this.errors).length > 0) {
      const error = new Error("Validation failed");
      error.status = 400;
      error.errors = this.errors;
      throw error;
    }

    return true;
  }

  addError(field, rule, param) {
    const messages = {
      required: `${field} is required.`,
      min: `${field} must be at least ${param} characters long.`,
      max: `${field} must not exceed ${param} characters.`,
      size: `${field} must be exactly ${param} characters long.`,
      email: `${field} must be a valid email.`,
      numeric: `${field} must be a number.`,
      array: `${field} must be a array.`,
      object: `${field} must be an object.`,
      integer: `${field} must be a number.`,
      min_value: `${field} must be a min.`,
      string: `${field} must be a string.`,
      date: `${field} must be a valid date.`,
      boolean: `${field} must be a boolean.`,
      in: `${field} must be one of the following values: ${param}.`,
      string: `${field} must be a string.`,
    };

    if (!this.errors[field]) {
      this.errors[field] = [];
    }
    this.errors[field].push(messages[rule]);
  }

  validate_required(value) {
    return value !== undefined && value !== null && value !== "";
  }

  validate_min(value, param) {
    const min = parseFloat(param);

    if (typeof value === "string" || Array.isArray(value)) {
      return value.length >= min;
    }

    if (typeof value === "number") {
      return value >= min;
    }

    return false;
  }
  validate_object(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  validate_max(value, param) {
    const max = parseFloat(param);

    if (typeof value === "string" || Array.isArray(value)) {
      return value.length <= max;
    }

    if (typeof value === "number") {
      return value <= max;
    }

    return false;
  }

  validate_array(value) {
    return Array.isArray(value);
  }
  validate_string(value) {
    return typeof value === "string";
  }

  validate_boolean(value) {
    return typeof value === "boolean";
  }

  // Size validation (exact length)
  validate_size(value, param) {
    return typeof value === "string" && value.length === parseInt(param);
  }
  validate_email(value) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(value);
  }

  validate_integer(value) {
    return !isNaN(value);
  }
  validate_numeric(value) {
    return !isNaN(value);
  }
  validate_min_value(value, param) {
    return typeof value === "number" && value >= parseFloat(param);
  }
  // String validation
  validate_string(value) {
    return typeof value === "string";
  }

  // Date validation
  validate_date(value) {
    return !isNaN(Date.parse(value));
  }

  // Validation for specific values (e.g., gender must be Male/Female/Other)
  validate_in(value, param) {
    const allowedValues = param.split(",");
    return allowedValues.includes(value);
  }
  static isnotEmpty(value, minLength = 1) {
    return value && value.trim().length >= minLength;
  }
  static isvalidEmail(email) {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/;
    return emailRegex.test(email);
  }
  static isvalidPassword(password) {
    return typeof password === "string" && password.trim().length >= 8;
  }

  static isvalidRole(role) {
    return User.isRoleAllowed(role);
  }
}
module.exports = Validator;
