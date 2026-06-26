import { useLeads } from './LeadsContext.jsx';
import { CleverInboxProvider } from './CleverInboxContext.jsx';

export default function CleverInboxBridge({ children }) {
  const { leads } = useLeads();
  return (
    <CleverInboxProvider leads={leads}>
      {children}
    </CleverInboxProvider>
  );
}
