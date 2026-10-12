"use client";
import { createContext, useContext } from "react";
export const FormFeedback = createContext<Record<string, string>>({});
export const FieldLabel = createContext<{labelId?:string;hintId?:string}>({});
export function useFieldLabel(){return useContext(FieldLabel);}
export function useFieldError(name?: string) { return useContext(FormFeedback)[name ?? ""]; }
