import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';

const BadgeContext = createContext({
  counts: {},
  setCount: (_key, _value) => {},
});

export const useBadges = () => useContext(BadgeContext);

export const BadgeProvider = ({ children }) => {
  const [counts, setCounts] = useState({});
  const setCount = useCallback((key, value) => {
    setCounts((prev) => ({ ...prev, [key]: value }));
  }, []);
  const value = useMemo(() => ({ counts, setCount }), [counts, setCount]);
  return <BadgeContext.Provider value={value}>{children}</BadgeContext.Provider>;
};
