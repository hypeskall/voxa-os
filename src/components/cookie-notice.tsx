"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { T } from "./locale-provider";
import { marketingPages } from "@/features/marketing/navigation";

const storageKey = "voxa-cookie-notice-v1";
const changeEvent = "voxa-cookie-notice-change";
export const noticeCookie = "voxa-cookie-notice";
const ServerDismissed = createContext(false);
let dismissedThisVisit = false;

export function CookieNoticeProvider({
  dismissed,
  children,
}: {
  dismissed: boolean;
  children: ReactNode;
}) {
  return (
    <ServerDismissed.Provider value={dismissed}>
      {children}
    </ServerDismissed.Provider>
  );
}

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
    return (
      dismissedThisVisit || localStorage.getItem(storageKey) === "dismissed"
    );
  } catch {
    return dismissedThisVisit;
  }
}

export function CookieNotice({ inline = false }: { inline?: boolean }) {
  const pathname = usePathname();
  const serverDismissed = useContext(ServerDismissed);
  const dismissed = useSyncExternalStore(
    subscribe,
    () => serverDismissed || isDismissed(),
    () => serverDismissed,
  );
  const marketingPage =
    pathname === "/" ||
    marketingPages.some((page) => page.href === pathname) ||
    ["/integrari", "/migrare", "/securitate"].includes(pathname);
  const informationalPage =
    marketingPage ||
    pathname === "/help" ||
    pathname === "/legal" ||
    pathname.startsWith("/legal/");
  if (dismissed || !informationalPage) return null;
  if (inline !== marketingPage) return null;

  function dismiss() {
    dismissedThisVisit = true;
    try {
      localStorage.setItem(storageKey, "dismissed");
      document.cookie = `${noticeCookie}=dismissed; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    } catch {
      // The notice can still be closed when browser storage is unavailable.
    }
    window.dispatchEvent(new Event(changeEvent));
  }

  return (
    <aside
      className={`cookie-notice${inline ? " cookie-notice-inline" : ""}`}
      aria-labelledby="cookie-notice-title"
    >
      <h2 id="cookie-notice-title">
        <T>{"Cookies"}</T>
      </h2>
      <p>
        <T>{"Cookies pentru autentificare și preferințe. Fără publicitate."}</T>
      </p>
      <div className="cookie-notice-actions">
        <Link href="/legal/cookies">
          <T>{"Politica de cookies"}</T>
        </Link>
        <button type="button" onClick={dismiss}>
          <T>{"Am înțeles"}</T>
        </button>
      </div>
    </aside>
  );
}
