import { useEffect, useRef, useState } from "react";
import { submitLead } from "../api";

interface FieldInvalid {
  name?: boolean;
  email?: boolean;
  company?: boolean;
}

export function TrialModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [error, setError] = useState("");
  const [invalid, setInvalid] = useState<FieldInvalid>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const companyRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => nameRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setName("");
      setEmail("");
      setCompany("");
      setError("");
      setInvalid({});
      setSuccess(false);
    }, 220);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  }, [open, onClose]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInvalid({});

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedCompany = company.trim();

    if (!trimmedName) {
      setInvalid({ name: true });
      setError("Name is required.");
      nameRef.current?.focus();
      return;
    }
    if (!trimmedEmail || !emailRef.current?.checkValidity()) {
      setInvalid({ email: true });
      setError("A valid work email is required.");
      emailRef.current?.focus();
      return;
    }
    if (!trimmedCompany) {
      setInvalid({ company: true });
      setError("Company is required.");
      companyRef.current?.focus();
      return;
    }

    setSubmitting(true);
    try {
      await submitLead({ name: trimmedName, email: trimmedEmail, company: trimmedCompany });
      setSuccess(true);
    } catch (err) {
      setError((err as Error).message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      id="trial-modal"
      className={`modal-overlay${open ? " open" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="trial-modal-title"
      aria-hidden={!open}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-card">
        <button
          id="trial-modal-close"
          className="modal-close"
          aria-label="Close"
          tabIndex={open ? 0 : -1}
          onClick={onClose}
        >
          ×
        </button>

        {!success && (
          <form id="trial-form" onSubmit={handleSubmit} noValidate>
            <h2 id="trial-modal-title">Talk to us</h2>
            <div className="modal-sub">
              Prefer a hand getting set up? Tell us who you are and we'll reach out. You can also start on your own
              anytime.
            </div>

            <div className="field">
              <label htmlFor="trial-name">Name</label>
              <input
                id="trial-name"
                ref={nameRef}
                type="text"
                autoComplete="name"
                required
                tabIndex={open ? 0 : -1}
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-invalid={invalid.name || undefined}
              />
            </div>
            <div className="field">
              <label htmlFor="trial-email">Work email</label>
              <input
                id="trial-email"
                ref={emailRef}
                type="email"
                autoComplete="email"
                required
                tabIndex={open ? 0 : -1}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={invalid.email || undefined}
              />
            </div>
            <div className="field">
              <label htmlFor="trial-company">Company</label>
              <input
                id="trial-company"
                ref={companyRef}
                type="text"
                autoComplete="organization"
                required
                tabIndex={open ? 0 : -1}
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                aria-invalid={invalid.company || undefined}
              />
            </div>
            <div id="trial-error" className="modal-error">{error}</div>

            <button
              id="trial-submit"
              type="submit"
              className="btn btn-primary modal-submit"
              tabIndex={open ? 0 : -1}
              disabled={submitting}
            >
              {submitting ? "Submitting…" : "Send"}
            </button>
          </form>
        )}

        {success && (
          <div id="trial-success" className="modal-success">
            <div className="ms-icon">✓</div>
            <h2>You're in</h2>
            <p>Thanks, we've got your request. A team member will follow up at the email you gave us to get you set up.</p>
            <button
              id="trial-success-close"
              type="button"
              className="btn btn-ghost modal-submit"
              tabIndex={open ? 0 : -1}
              onClick={onClose}
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
