import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import Icon from "./Icon";

const ToastContext = createContext({
  toast: { success: () => {}, error: () => {}, info: () => {} },
});

let idCounter = 0;

const TOAST_ICON = { success: "check", error: "alert", info: "info" };

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
      dismiss,
    }),
    [push, dismiss]
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="toast-region" role="status" aria-live="polite" aria-atomic="false">
        {items.map((item) => (
          <div key={item.id} className={`toast toast-${item.type}`}>
            <span className="toast-icon">
              <Icon name={TOAST_ICON[item.type] || "info"} size={16} strokeWidth={2.4} />
            </span>
            <div className="toast-body">{item.message}</div>
            <button
              type="button"
              className="toast-close"
              aria-label="Dismiss notification"
              onClick={() => dismiss(item.id)}
            >
              <Icon name="close" size={14} strokeWidth={2.4} />
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
