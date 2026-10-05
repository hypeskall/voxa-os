"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { T } from "./locale-provider";

const storageKey = "voxa-cookie-notice-v1";
const changeEvent = "voxa-cookie-notice-change";
let dismissedThisVisit = false;

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(changeEvent, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(changeEvent, callback);
  };
}

function isDismissed() {
  try {
    return dismissedThisVisit || localStorage.getItem(storageKey) === "dismissed";
  } catch {
    return dismissedThisVisit;
  }
}

export function CookieNotice() {
  const dismissed = useSyncExternalStore(subscribe, isDismissed, () => true);
  if (dismissed) return null;

  function dismiss() {
    dismissedThisVisit = true;
    try {
      localStorage.setItem(storageKey, "dismissed");
    } catch {
      // The notice can still be closed when browser storage is unavailable.
    }
    window.dispatchEvent(new Event(changeEvent));
  }

  return (
    <aside className="cookie-notice" aria-labelledby="cookie-notice-title">
      <h2 id="cookie-notice-title"><T>{"Cookies"}</T></h2>
      <p><T>{"Folosim cookies pentru autentificare și preferințele tale. Fără cookies de publicitate."}</T></p>
      <div className="cookie-notice-actions">
        <Link href="/legal/cookies"><T>{"Politica de cookies"}</T></Link>
        <button type="button" onClick={dismiss}><T>{"Am înțeles"}</T></button>
      </div>
    </aside>
  );
}
