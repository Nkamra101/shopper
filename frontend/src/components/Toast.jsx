import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

const ToastContext = createContext({
  toast: { success: () => {}, error: () => {}, info: () => {} },
});

let idCounter = 0;

function Icon({ type }) {
  if (type === "success") {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    );
  }
  if (type === "error") {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4M12 16h.01" />
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  );
}

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const timersRef = useRef(new Map());

  const dismiss = useCallback((id) => {
    setItems((current) => current.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (type, message, { duration = 4000 } = {}) => {
      idCounter += 1;
      const id = idCounter;
      setItems((current) => [...current, { id, type, message }]);
      const timer = setTimeout(() => dismiss(id), duration);
      timersRef.current.set(id, timer);
      return id;
    },
    [dismiss]
  );

  const toast = useMemo(
    () => ({
      success: (message, options) => push("success", message, options),
      error: (message, options) => push("error", message, options),
      info: (message, options) => push("info", message, options),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="toast-region" role="status" aria-live="polite" aria-atomic="false">
        {items.map((item) => (
          <div key={item.id} className={`toast ${item.type}`}>
            <span className="toast-icon">
              <Icon type={item.type} />
            </span>
            <div className="toast-body">{item.message}</div>
            <button
              type="button"
              className="toast-close"
              aria-label="Dismiss notification"
              onClick={() => dismiss(item.id)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext).toast;
}
