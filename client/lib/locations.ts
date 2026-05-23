export type LocationOption = { label: string; value: string };
import { Country, State, City } from "country-state-city";

const resolveCountryIso = (countryValue?: string) => {
  if (!countryValue) return "";
  const all = Country.getAllCountries();
  const matchByIso = all.find((c) => c.isoCode === countryValue);
  if (matchByIso) return matchByIso.isoCode;
  const matchByName = all.find(
    (c) => c.name.toLowerCase() === countryValue.toLowerCase(),
  );
  return matchByName?.isoCode || "";
};

const resolveStateIso = (countryIso: string, stateValue?: string) => {
  if (!countryIso || !stateValue) return "";
  const states = State.getStatesOfCountry(countryIso);
  const matchByIso = states.find((s) => s.isoCode === stateValue);
  if (matchByIso) return matchByIso.isoCode;
  const matchByName = states.find(
    (s) => s.name.toLowerCase() === stateValue.toLowerCase(),
  );
  return matchByName?.isoCode || "";
};

export const getCountryOptions = (): LocationOption[] =>
  Country.getAllCountries().map((entry) => ({
    label: entry.name,
    value: entry.name,
  }));

export const getStateOptions = (countryValue: string): LocationOption[] => {
  const countryIso = resolveCountryIso(countryValue);
  if (!countryIso) return [];
  return State.getStatesOfCountry(countryIso).map((state) => ({
    label: state.name,
    value: state.name,
  }));
};

export const getCityOptions = (
  countryValue: string,
  stateValue: string,
): LocationOption[] => {
  const countryIso = resolveCountryIso(countryValue);
  if (!countryIso) return [];
  const stateIso = resolveStateIso(countryIso, stateValue);
  if (!stateIso) return [];
  return City.getCitiesOfState(countryIso, stateIso).map((city) => ({
    label: city.name,
    value: city.name,
  }));
};

export const ensureOption = (
  options: LocationOption[],
  value?: string,
): LocationOption[] => {
  if (!value) return options;
  const exists = options.some((opt) => opt.value === value);
  if (exists) return options;
  return [{ label: value, value }, ...options];
};

export type AddressValue =
  | string
  | {
      addressLine?: string;
      city?: string;
      state?: string;
      country?: string;
      pincode?: string;
    };

export const formatAddress = (address?: AddressValue): string => {
  if (!address) return "";
  if (typeof address === "string") return address;
  const parts = [
    address.addressLine,
    address.city,
    address.state,
    address.country,
    address.pincode,
  ].filter(Boolean);
  return parts.join(", ");
};
