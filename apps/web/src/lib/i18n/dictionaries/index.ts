import type { Locale } from "../config";
import { en, type Dictionary } from "./en";
import { vi } from "./vi";

export type { Dictionary, Plural } from "./en";

const dictionaries: Record<Locale, Dictionary> = { en, vi };

export const getDictionary = (locale: Locale): Dictionary => dictionaries[locale];
