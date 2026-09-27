"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getGuidanceSubmission, saveGuidanceSubmission } from "@/lib/guidance-store";
import {
  hasAcceptedCookies,
  subscribeToCookieConsent,
} from "@/app/components/ui/CookieConsent";

// Fraction of the page the user has to scroll through before the modal appears.
const TRIGGER_SCROLL_RATIO = 0.35;

type Status = "idle" | "submitting" | "success";

function hasScrolledPastTrigger() {
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  if (scrollable <= 0) return false;
  return window.scrollY / scrollable >= TRIGGER_SCROLL_RATIO;
}

export default function GuidanceModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Shown once per page view to anyone who hasn't already submitted the form.
  useEffect(() => {
    let cancelled = false;
    let disarm = () => {};

    const tryOpen = () => {
      // Don't stack on top of the cookie banner / blocked screen.
      if (!hasAcceptedCookies() || !hasScrolledPastTrigger()) return;
      disarm();
      setIsOpen(true);
    };

    getGuidanceSubmission().then((submission) => {
      if (cancelled || submission) return;

      window.addEventListener("scroll", tryOpen, { passive: true });
      // Re-check the moment cookies are accepted, in case the user is already
      // past the trigger point and doesn't scroll again.
      const unsubscribe = subscribeToCookieConsent(tryOpen);
      disarm = () => {
        window.removeEventListener("scroll", tryOpen);
        unsubscribe();
      };
      tryOpen();
    });

    return () => {
      cancelled = true;
      disarm();
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      root.style.overflow = previous;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function close() {
    setIsOpen(false);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedName = name.trim();

    if (trimmedName.length < 2) {
      setError("Please enter your name.");
      return;
    }
    if (!/^[6-9]\d{9}$/.test(phone)) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }
    if (!consent) {
      setError("Please agree to share your details so we can reach you.");
      return;
    }

    setStatus("submitting");
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("submit_guidance_request", {
      p_name: trimmedName,
      p_phone: phone,
      p_consent: consent,
    });

    if (rpcError) {
      setStatus("idle");
      setError("Something went wrong. Please try again.");
      return;
    }

    await saveGuidanceSubmission(phone);
    setStatus("success");
  }

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          key="guidance-backdrop"
          data-lenis-prevent
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
          className="fixed inset-0 z-90 flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm sm:items-center"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="guidance-title"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ type: "spring", damping: 26, stiffness: 300 }}
            onAnimationComplete={() => nameInputRef.current?.focus()}
            onClick={(event) => event.stopPropagation()}
            className="relative w-full max-w-md rounded-3xl border border-neutral-200 bg-white p-6 shadow-2xl sm:p-8"
          >
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="absolute right-4 top-4 rounded-full p-1.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-black"
            >
              <X size={18} />
            </button>

            {status === "success" ? (
              <div className="flex flex-col items-center py-4 text-center">
                <SuccessTick />
                <h2 id="guidance-title" className="mt-6 text-2xl font-bold text-black">
                  All set!
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                  Thanks, {name.trim().split(" ")[0]}. Our team will get back to
                  you within 48 hours.
                </p>
                <button
                  type="button"
                  onClick={close}
                  className="mt-6 w-full rounded-full bg-black px-6 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate>
                <span className="inline-block rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700">
                  Free guidance
                </span>
                <h2 id="guidance-title" className="mt-3 text-2xl font-bold text-black">
                  Want us to guide your preparation?
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                  Share your details and a Uniprep mentor will call you to plan
                  your CUET prep.
                </p>

                <div className="mt-6 space-y-4">
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-black">Name</span>
                    <input
                      ref={nameInputRef}
                      type="text"
                      autoComplete="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      maxLength={80}
                      placeholder="Your full name"
                      className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm text-black outline-none transition placeholder:text-neutral-400 focus:border-black focus:ring-2 focus:ring-black/10"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-black">Phone number</span>
                    <div className="flex rounded-xl border border-neutral-300 transition focus-within:border-black focus-within:ring-2 focus-within:ring-black/10">
                      <span className="flex items-center border-r border-neutral-200 px-3 text-sm text-neutral-500">
                        +91
                      </span>
                      <input
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel-national"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                        maxLength={10}
                        placeholder="9876543210"
                        className="w-full rounded-r-xl px-3 py-3 text-sm text-black outline-none placeholder:text-neutral-400"
                      />
                    </div>
                  </label>

                  <label className="flex items-start gap-3 text-sm text-neutral-600">
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-black"
                    />
                    <span>
                      I agree to share my data with Uniprep. See our{" "}
                      <Link
                        href="/footer/privacy-policy"
                        className="underline underline-offset-2 hover:text-black"
                      >
                        privacy policy
                      </Link>
                      .
                    </span>
                  </label>
                </div>

                {error ? (
                  <p role="alert" className="mt-4 text-sm text-red-600">
                    {error}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={status === "submitting" || !consent}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-emerald-400 text-black px-6 py-3 text-sm font-semibold transition hover:bg-emerald-500"
                >
                  {status === "submitting" ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Sending…
                    </>
                  ) : (
                    "Request a callback"
                  )}
                </button>
              </form>
            )}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function SuccessTick() {
  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", damping: 14, stiffness: 220 }}
      className="flex h-24 w-24 items-center justify-center rounded-full bg-green-500 shadow-lg shadow-green-500/30"
    >
      <svg viewBox="0 0 52 52" className="h-14 w-14" fill="none" aria-hidden="true">
        <motion.path
          d="M14 27 L22 35 L38 18"
          stroke="white"
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay: 0.2, duration: 0.45, ease: "easeOut" }}
        />
      </svg>
    </motion.div>
  );
}
