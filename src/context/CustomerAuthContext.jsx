import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  EMPTY_CUSTOMER_DATA,
  normalizeCustomerData,
  addOfferToAccount,
  addComparisonToAccount,
  addTestDriveToAccount,
  addFavoriteToAccount,
  updateProfile,
  buildComparisonEntry,
  buildTestDriveEntry,
  buildFavoriteEntry,
  buildConfigurationEntry,
  addConfigurationToAccount,
  linkConfigurationOffer,
} from '../services/customerAccountService.js';

const SESSION_KEY = 'clever-neuwagen-customer-session';
const DATA_PREFIX = 'clever-neuwagen-customer-data-';
const PENDING_CODE_PREFIX = 'clever-neuwagen-pending-code-';

const CustomerAuthContext = createContext(null);

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function loadCustomerData(email) {
  try {
    const raw = localStorage.getItem(`${DATA_PREFIX}${email}`);
    if (raw) return normalizeCustomerData(JSON.parse(raw));
  } catch {
    /* Fallback */
  }
  return { ...EMPTY_CUSTOMER_DATA };
}

function saveCustomerData(email, data) {
  localStorage.setItem(`${DATA_PREFIX}${email}`, JSON.stringify(data));
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function CustomerAuthProvider({ children }) {
  const [session, setSession] = useState(loadSession);
  const [customerData, setCustomerData] = useState(null);
  const [pendingEmail, setPendingEmail] = useState(null);
  const [demoCode, setDemoCode] = useState(null);

  useEffect(() => {
    if (session?.email) {
      setCustomerData(loadCustomerData(session.email));
    } else {
      setCustomerData(null);
    }
  }, [session]);

  function persistData(email, data) {
    saveCustomerData(email, data);
    if (email === session?.email) {
      setCustomerData(data);
    }
    return data;
  }

  const api = useMemo(() => ({
    isLoggedIn: !!session?.email,
    email: session?.email ?? null,
    customerData,
    pendingEmail,
    demoCode,

    requestCode(email) {
      const normalized = email.trim().toLowerCase();
      if (!normalized || !normalized.includes('@')) {
        return { ok: false, error: 'Bitte gültige E-Mail eingeben.' };
      }
      const code = generateCode();
      sessionStorage.setItem(`${PENDING_CODE_PREFIX}${normalized}`, code);
      setPendingEmail(normalized);
      setDemoCode(code);
      return { ok: true, email: normalized };
    },

    verifyCode(code) {
      if (!pendingEmail) {
        return { ok: false, error: 'Bitte zuerst E-Mail eingeben.' };
      }
      const stored = sessionStorage.getItem(`${PENDING_CODE_PREFIX}${pendingEmail}`);
      if (code.trim() !== stored) {
        return { ok: false, error: 'Code ungültig. Bitte erneut versuchen.' };
      }
      sessionStorage.removeItem(`${PENDING_CODE_PREFIX}${pendingEmail}`);
      const newSession = { email: pendingEmail, loggedInAt: new Date().toISOString() };
      localStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
      setSession(newSession);
      setPendingEmail(null);
      setDemoCode(null);
      const data = loadCustomerData(pendingEmail);
      saveCustomerData(pendingEmail, data);
      setCustomerData(data);
      return { ok: true };
    },

    loginWithEmail(email) {
      const normalized = email.trim().toLowerCase();
      if (!normalized.includes('@')) return { ok: false };
      const newSession = { email: normalized, loggedInAt: new Date().toISOString() };
      localStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
      setSession(newSession);
      const data = loadCustomerData(normalized);
      saveCustomerData(normalized, data);
      setCustomerData(data);
      return { ok: true };
    },

    resendCode() {
      if (!pendingEmail) return { ok: false };
      const code = generateCode();
      sessionStorage.setItem(`${PENDING_CODE_PREFIX}${pendingEmail}`, code);
      setDemoCode(code);
      return { ok: true };
    },

    logout() {
      localStorage.removeItem(SESSION_KEY);
      setSession(null);
      setCustomerData(null);
      setPendingEmail(null);
      setDemoCode(null);
    },

    cancelLogin() {
      setPendingEmail(null);
      setDemoCode(null);
    },

    saveProfile(profile, emailOverride) {
      const targetEmail = emailOverride ?? session?.email;
      if (!targetEmail) return null;
      const current = loadCustomerData(targetEmail);
      const next = updateProfile(current, profile);
      return persistData(targetEmail, next);
    },

    registerOffer(offer, emailOverride) {
      const targetEmail = emailOverride ?? offer.customer?.email ?? session?.email;
      if (!targetEmail) return null;
      const current = loadCustomerData(targetEmail);
      const next = addOfferToAccount(current, offer);
      return persistData(targetEmail.trim().toLowerCase(), next);
    },

    saveComparison(recommendations, profile, emailOverride) {
      const targetEmail = emailOverride ?? session?.email;
      if (!targetEmail) return null;
      const entry = buildComparisonEntry(recommendations, profile);
      const current = loadCustomerData(targetEmail);
      const next = addComparisonToAccount(current, entry);
      return persistData(targetEmail, next);
    },

    registerTestDrive(rec, contact, dealerName, emailOverride) {
      const targetEmail = emailOverride ?? contact.email ?? session?.email;
      if (!targetEmail) return null;
      const entry = buildTestDriveEntry(rec, contact, dealerName);
      const current = loadCustomerData(targetEmail);
      const next = addTestDriveToAccount(current, entry);
      return persistData(targetEmail.trim().toLowerCase(), next);
    },

    addFavorite(rec, emailOverride) {
      const targetEmail = emailOverride ?? session?.email;
      if (!targetEmail) return null;
      const entry = buildFavoriteEntry(rec);
      const current = loadCustomerData(targetEmail);
      const next = addFavoriteToAccount(current, entry);
      return persistData(targetEmail, next);
    },

    registerConfiguration(config, price, dealerName, labels, emailOverride) {
      const targetEmail = emailOverride ?? session?.email;
      if (!targetEmail) return null;
      const entry = buildConfigurationEntry(config, price, dealerName, labels);
      const current = loadCustomerData(targetEmail);
      const next = addConfigurationToAccount(current, entry);
      persistData(targetEmail.trim().toLowerCase(), next);
      return entry;
    },

    linkConfigOffer(configId, offerCode, emailOverride) {
      const targetEmail = emailOverride ?? session?.email;
      if (!targetEmail || !configId) return null;
      const current = loadCustomerData(targetEmail);
      const next = linkConfigurationOffer(current, configId, offerCode);
      return persistData(targetEmail, next);
    },

    getDataForEmail(email) {
      return loadCustomerData(email);
    },
  }), [session, customerData, pendingEmail, demoCode]);

  return (
    <CustomerAuthContext.Provider value={api}>
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth() {
  const ctx = useContext(CustomerAuthContext);
  if (!ctx) {
    throw new Error('useCustomerAuth muss innerhalb von CustomerAuthProvider verwendet werden');
  }
  return ctx;
}
