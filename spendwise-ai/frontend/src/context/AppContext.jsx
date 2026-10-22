import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { currentMonth } from '../utils/format';

// Holds: the selected month, toast notifications and small local preferences.
const AppContext = createContext(null);

function readPref(key, fallback) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}
function writePref(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable (private mode) - preference simply won't persist */
  }
}

export function AppProvider({ children }) {
  const [month, setMonth] = useState(currentMonth());
  const [toasts, setToasts] = useState([]);
  const [profileName, setProfileNameState] = useState(readPref('sw_profile_name', 'Guest'));
  const [pageSize, setPageSizeState] = useState(Number(readPref('sw_page_size', 10)));

  const dismissToast = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const notify = useCallback(
    (message, type = 'success') => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((t) => [...t.slice(-3), { id, message, type }]);
      setTimeout(() => dismissToast(id), 4500);
    },
    [dismissToast]
  );

  const value = useMemo(
    () => ({
      month,
      setMonth,
      toasts,
      notify,
      dismissToast,
      profileName,
      setProfileName: (v) => {
        setProfileNameState(v);
        writePref('sw_profile_name', v);
      },
      pageSize,
      setPageSize: (v) => {
        setPageSizeState(v);
        writePref('sw_page_size', String(v));
      },
    }),
    [month, toasts, notify, dismissToast, profileName, pageSize]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useApp = () => useContext(AppContext);
