"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { T } from "./locale-provider";
import { marketingPages } from "@/features/marketing/navigation";

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
  const pathname = usePathname();
  const dismissed = useSyncExternalStore(subscribe, isDismissed, () => true);
  const informationalPage = pathname === "/" || pathname === "/help"
    || pathname === "/legal" || pathname.startsWith("/legal/")
    || marketingPages.some(page => page.href === pathname);
  if (dismissed || !informationalPage) return null;

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
