import fs from "node:fs";

export const authEmailSubjects = {
  invite: "Invitație în portalul pacientului · Voxa",
  magic_link: "Linkul tău de conectare în portal · Voxa",
  confirmation: "Confirmă adresa de email · Voxa",
  recovery: "Resetarea parolei · Voxa",
};

export function authEmailConfiguration(staging = false) {
  const files = { invite: "auth-invite", magic_link: "magic-link", confirmation: "confirm-signup", recovery: "recovery" };
  return Object.fromEntries(Object.entries(files).flatMap(([key, file]) => [
    [`mailer_subjects_${key}`, authEmailSubjects[key] + (staging ? " · Test" : "")],
    [`mailer_templates_${key}_content`, fs.readFileSync(`supabase/templates/${staging ? "staging" : "production"}-${file}.html`, "utf8")],
  ]));
}
