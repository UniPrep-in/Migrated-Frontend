"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Cookie, ShieldAlert } from "lucide-react";

type Consent = "accepted" | "denied" | null;

const STORAGE_KEY = "uniprep-cookie-consent";
const CHANGE_EVENT = "uniprep-cookie-consent-change";
const PRIVACY_POLICY_PATH = "/footer/privacy-policy";

function readConsent(): Consent {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "accepted" || value === "denied" ? value : null;
  } catch {
    return null;
  }
}

export function hasAcceptedCookies() {
  return readConsent() === "accepted";
}

function writeConsent(value: Exclude<Consent, null>) {
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Storage blocked — consent still applies for this page view.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function subscribeToCookieConsent(callback: () => void) {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

// "pending" on the server so nothing renders until the client knows the real value.
function useConsent(): Consent | "pending" {
  return useSyncExternalStore<Consent | "pending">(
    subscribeToCookieConsent,
    readConsent,
    () => "pending",
  );
}

export default function CookieConsent() {
  const consent = useConsent();
  const pathname = usePathname() ?? "/";

  // Legal pages stay readable so users can review the policy before deciding.
  const isLegalPage = pathname.startsWith("/footer");
  const isBlocked = consent === "denied" && !isLegalPage;
  // Until the user picks Accept or Deny, the page behind the banner is inert.
  const isUndecided = consent === null && !isLegalPage;
  const locksScroll = isBlocked || isUndecided;

  useEffect(() => {
    if (!locksScroll) return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previous;
    };
  }, [locksScroll]);

  if (consent === "pending" || consent === "accepted") return null;

  if (isBlocked) {
    return (
      <div
        data-lenis-prevent
        role="dialog"
        aria-modal="true"
        aria-labelledby="cookie-blocked-title"
        className="fixed inset-0 z-100 flex items-center justify-center bg-white/80 px-4 backdrop-blur-md"
      >
        <div className="w-full max-w-md rounded-3xl border border-neutral-200 bg-white p-8 text-center shadow-2xl">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-100 text-purple-700">
            <ShieldAlert size={28} />
          </div>
          <h2 id="cookie-blocked-title" className="mb-3 text-2xl font-bold text-black">
            Cookies are required
          </h2>
          <p className="mb-6 text-sm leading-relaxed text-neutral-600">
            Uniprep uses cookies to keep you signed in, save your mock test
            progress and secure your account. Please allow cookies to continue
            browsing the site.
          </p>
          <button
            type="button"
            onClick={() => writeConsent("accepted")}
            className="w-full rounded-full bg-black px-6 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800"
          >
            Allow cookies
          </button>
          <Link
            href={PRIVACY_POLICY_PATH}
            className="mt-4 inline-block text-xs text-neutral-500 underline underline-offset-4 hover:text-black"
          >
            Read our privacy policy
          </Link>
        </div>
      </div>
    );
  }

  // Denied but on a legal page — let them read without the overlay or banner.
  if (consent === "denied") return null;

  return (
    <>
    {isUndecided ? (
      <div
        data-lenis-prevent
        aria-hidden="true"
        className="fixed inset-0 z-99 bg-black/40 backdrop-blur-[2px]"
      />
    ) : null}
    <div
      data-lenis-prevent
      role="dialog"
      aria-modal={isUndecided}
      aria-labelledby="cookie-banner-title"
      className="fixed inset-x-0 bottom-0 z-100 p-3 sm:p-4"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-2xl sm:flex-row sm:items-center sm:gap-6">
        <div className="flex items-start gap-3 sm:flex-1">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
            <Cookie size={20} />
          </div>
          <div>
            <p id="cookie-banner-title" className="text-sm font-semibold text-black">
              We use cookies
            </p>
            <p className="mt-1 text-xs leading-relaxed text-neutral-600 sm:text-sm">
              We use cookies to keep you signed in and improve your experience.
              See our{" "}
              <Link
                href={PRIVACY_POLICY_PATH}
                className="underline underline-offset-2 hover:text-black"
              >
                privacy policy
              </Link>
              .
            </p>
          </div>
        </div>
        <div className="flex gap-2 sm:shrink-0">
          <button
            type="button"
            onClick={() => writeConsent("denied")}
            className="flex-1 rounded-full border border-neutral-300 px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-neutral-100 sm:flex-none"
          >
            Deny
          </button>
          <button
            type="button"
            onClick={() => writeConsent("accepted")}
            className="flex-1 rounded-full bg-black px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800 sm:flex-none"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
    </>
  );
}
