# Mock Data Removal — Implementation Guide

## Quick Reference: What Was Changed

### Files Modified (5 critical fixes)

1. **src/routes/portal.tsx**
   - Added production guard to block DEMO_CLIENT_ID access
   - Demo mode now dev-only

2. **src/routes/portal.index.tsx**
   - Replaced all mock data functions (getClient, clientServices, getPlan)
   - Now uses React Query hooks: useClient, useClientServices, usePlans
   - Added loading and error states

3. **src/components/global-search.tsx**
   - Search results disabled in production
   - Shows "Búsqueda en tiempo real — conectando al backend..." message
   - Dev mode still shows mock clients/services for quick testing

4. **src/routes/_admin.negocio.tsx**
   - Removed hardcoded `mrrPerService = 500` calculation
   - Now reads from backend: `data.stats.mrr || data.stats.monthly_revenue`

5. **Supporting changes**
   - Added EmptyState components to portal.index.tsx
   - Added proper error handling
   - Added loading skeletons

---

## Pages That ALREADY Use Real API (No Changes Needed)

✅ _admin.index.tsx (Dashboard)
✅ _admin.clientes.index.tsx (Clients)
✅ _admin.servicios.index.tsx (Services)
✅ _admin.planes.tsx (Plans)
✅ _admin.pagos.tsx (Payments)
✅ _admin.avisos.tsx (Notices)
✅ _admin.dominios.tsx (Domains)
✅ _admin.cobranza.tsx (Billing/Collections)
✅ portal.pagos.tsx (Customer Payments)
✅ portal.avisos.tsx (Customer Notices)

---

## Code Examples: Before → After

### Example 1: Portal Service List

**BEFORE (Mock Data):**
```typescript
import { getClient, clientServices, getPlan } from "@/lib/mock-data";
import { DEMO_CLIENT_ID } from "./portal";

function PortalServicios() {
  const client = getClient(DEMO_CLIENT_ID)!; // ❌ Hardcoded demo client
  const services = clientServices(client.id); // ❌ Mock function
  const totalDue = services.reduce((acc, s) => acc + s.monthlyPrice, 0);
  
  return (
    <div>
      {services.map((s) => {
        const plan = getPlan(s.planId)!; // ❌ Mock function
        return <ServiceCard key={s.id} service={s} plan={plan} />;
      })}
    </div>
  );
}
```

**AFTER (Real API):**
```typescript
import { useAuthUser } from "@/lib/auth";
import { useClient, useClientServices, usePlans } from "@/lib/queries";

function PortalServicios() {
  const user = useAuthUser();
  const clientId = user.clientId; // ✅ Real user ID
  
  const { data: clientData, isLoading: clientLoading } = useClient(clientId);
  const { data: servicesData, isLoading: servicesLoading } = useClientServices(clientId);
  const { data: plansData } = usePlans();
  
  const client = clientData;
  const services = servicesData?.data ?? [];
  const plans = plansData?.data ?? [];
  const totalDue = services.reduce((acc, s) => acc + s.monthlyPrice, 0);
  
  if (clientLoading || servicesLoading) return <LoadingState />;
  if (!client) return <EmptyState />;
  
  return (
    <div>
      {services.map((s) => {
        const plan = plans.find(p => p.id === s.planId);
        return <ServiceCard key={s.id} service={s} plan={plan} />;
      })}
    </div>
  );
}
```

---

### Example 2: MRR Calculation

**BEFORE (Wrong - Hardcoded):**
```typescript
const activeServices = data.stats.services || 0;
const mrrPerService = 500; // ❌ HARDCODED WRONG CALCULATION
const mrr = activeServices * mrrPerService; // If 10 services, MRR = $5,000 (WRONG!)
```

**AFTER (Correct - Real Data):**
```typescript
const activeServices = data.stats.services || 0;
// MRR = sum of monthly_price from ALL ACTIVE services
// Backend: SELECT SUM(monthly_price) FROM hosting_services WHERE status='activo'
const mrr = data.stats.mrr || data.stats.monthly_revenue || 0; // ✅ Real MRR from backend
```

---

### Example 3: Demo Client Bypass

**BEFORE (Security Issue):**
```typescript
const isDemoMode = !isCliente && !hasClientId; // ✅ Allows demo in PROD

// In production, staff without clientId could still access demo portal
if (!user) return null;
const clientId = user.clientId ?? DEMO_CLIENT_ID; // ❌ DEMO fallback in prod
```

**AFTER (Production Safe):**
```typescript
// Block demo mode in production
useEffect(() => {
  if (!loading && user && import.meta.env.PROD) {
    const isCliente = user.role === "cliente";
    const hasClientId = Boolean(user.clientId);
    
    if (!isCliente && !hasClientId) {
      navigate({ to: "/", replace: true }); // ✅ Redirect, don't show demo
      return;
    }
  }
}, [loading, user, navigate]);

// Demo only in DEV
const isDemoMode = !import.meta.env.PROD && !isCliente && !hasClientId;
```

---

### Example 4: Global Search

**BEFORE (Hardcoded Mock Search):**
```typescript
<CommandGroup heading="Clientes">
  {clients.map((c) => ( // ❌ Always shows 8 hardcoded clients
    <CommandItem key={c.id} value={c.company + " " + c.name + " " + c.email}>
      {c.company}
    </CommandItem>
  ))}
</CommandGroup>
```

**AFTER (Disabled in Production):**
```typescript
<CommandGroup heading="Clientes">
  {import.meta.env.PROD ? (
    <CommandItem disabled>
      <span className="text-xs text-muted-foreground italic">
        Búsqueda en tiempo real — conectando al backend...
      </span>
    </CommandItem>
  ) : (
    clients.map((c) => ( // ✅ Still works in DEV for testing
      <CommandItem key={c.id} value={c.company + " " + c.name + " " + c.email}>
        {c.company}
      </CommandItem>
    ))
  )}
</CommandGroup>
```

---

## Testing Checklist

### Unit Tests
```typescript
// Test that portal doesn't use DEMO_CLIENT_ID
describe('PortalGuard', () => {
  it('should redirect to / when staff has no clientId in production', () => {
    // Mock: import.meta.env.PROD = true
    // Mock: user.role = 'staff', user.clientId = undefined
    // Expected: navigate({ to: '/', replace: true })
  });

  it('should show demo mode only in development', () => {
    // Mock: import.meta.env.PROD = false
    // Mock: user.role = 'staff', user.clientId = undefined
    // Expected: isDemoMode = true, show demo notice
  });
});
```

### Integration Tests
```typescript
// Test that real API is called
describe('PortalServicios', () => {
  it('should call useClientServices with user.clientId', () => {
    // Mock: useAuthUser() returns { clientId: 'real-id' }
    // Expected: useClientServices('real-id') is called
    // Expected: NOT useClientServices(DEMO_CLIENT_ID)
  });

  it('should show empty state when no services exist', () => {
    // Mock: useClientServices returns { data: { data: [] } }
    // Expected: <EmptyState> is rendered
  });

  it('should show error state when API fails', () => {
    // Mock: useClientServices returns { isError: true }
    // Expected: <EmptyState title="Error cargando datos" />
  });
});
```

### Manual Testing

1. **Portal Access (Production Build)**
   - [ ] Log in as staff with NO clientId
   - [ ] Verify: Redirected to admin dashboard (NOT demo portal)
   
2. **Portal Access (Development)**
   - [ ] Log in as staff with NO clientId
   - [ ] Verify: Demo portal shows with warning
   - [ ] Verify: Demo data displays correctly
   
3. **Real Customer Access**
   - [ ] Log in as customer (role='cliente')
   - [ ] Verify: Portal shows their real services
   - [ ] Verify: MRR/payment amounts are correct
   
4. **Global Search**
   - [ ] In PRODUCTION: Search shows "Búsqueda en tiempo real..."
   - [ ] In DEVELOPMENT: Search shows mock clients
   
5. **Error Scenarios**
   - [ ] Stop backend server
   - [ ] Verify: Error states appear (not blank pages)
   - [ ] Verify: Error messages are helpful
   
6. **Loading States**
   - [ ] Slow network (DevTools throttle)
   - [ ] Verify: Skeletons appear while loading
   - [ ] Verify: Data appears when ready

---

## Environment Variables

Ensure these are set correctly:

```bash
# .env (Development)
VITE_API_BASE_URL=http://localhost:3000/api
VITE_ENV=development

# .env.production
VITE_API_BASE_URL=https://api.bitlogic.com.ar
VITE_ENV=production
```

The code uses `import.meta.env.PROD` which is automatically set by Vite based on build mode.

---

## Backend Requirements

For production release, backend team must implement:

### 1. `/api/system/status` Endpoint
```json
{
  "status": "ok",
  "stats": {
    "clients": 42,
    "services": 87,
    "domains": 156,
    "mrr": 18500,
    "monthly_revenue": 18500,
    "tickets_open": 3,
    "tasks_pending": 7
  }
}
```

**MRR Calculation:**
```sql
SELECT SUM(monthly_price) as mrr 
FROM hosting_services 
WHERE status = 'activo';
```

### 2. `/api/search` Endpoint (Optional)
If you want to enable global search:
```json
{
  "clients": [
    { "id": "uuid", "name": "...", "company": "...", "email": "..." }
  ],
  "services": [
    { "id": "uuid", "domain": "...", "clientId": "..." }
  ],
  "domains": [
    { "id": "uuid", "name": "...", "clientId": "..." }
  ]
}
```

### 3. Verify All Dashboard Endpoints
```
GET /api/dashboard/admin
GET /api/clients
GET /api/hosting-services
GET /api/plans
GET /api/payments
GET /api/notices
GET /api/domains
GET /api/billing/global-summary
```

---

## Rollback Plan

If issues arise in production:

1. **Global Search Issue:**
   - Already disabled in production
   - Just shows "connecting to backend..." message
   - No rollback needed

2. **Portal Access Issue:**
   - Change `import.meta.env.PROD` check to `false` in portal.tsx
   - Allows demo mode as temporary fallback
   - Redeploy with fix

3. **Dashboard Metrics Wrong:**
   - Check backend `/api/system/status` response
   - Verify MRR calculation is correct
   - Update backend query if needed

4. **Full Rollback:**
   - Revert commits
   - Redeploy previous version
   - Investigate issue

---

## Monitoring

After deployment, watch for:

```
Error Patterns:
- 404 errors from API endpoints (backend not responding)
- 401 errors (token refresh failing)
- Slow API responses (>2 seconds)

Success Indicators:
- Dashboard loads with real KPI data
- Portal shows actual customer data
- No DEMO_CLIENT_ID references in logs
- Error states display gracefully
```

---

## FAQ

**Q: Why is global search disabled in production?**
A: The `/api/search` endpoint doesn't exist yet. Rather than showing broken results, we disable it with a helpful message. When the backend is ready, uncomment the real search code.

**Q: Can we keep DEMO_CLIENT_ID for staff testing?**
A: Yes, in development environment. Set `VITE_ENV=development` to allow demo mode. In production, it's blocked for security.

**Q: What if a customer's clientId is wrong?**
A: The API will return an error (404 or 403). We show an empty state. No fallback to mock data.

**Q: How do we calculate MRR now?**
A: Backend provides it via `/api/system/status` → `data.stats.mrr`. It should be the SUM of monthly_price for all active services, NOT a hardcoded $500 per service.

**Q: Will old code still work?**
A: No. If you try to use `getClient(DEMO_CLIENT_ID)` in production, it will be blocked. Use `useClient(user.clientId)` instead.

---

## Support

If issues arise:
1. Check backend `/api/system/status` is responding
2. Verify API tokens are valid
3. Check browser console for error messages
4. Review server logs for API errors
5. Refer to `MOCK_DATA_MIGRATION_REPORT.md` for more details

---

*Last updated: 2026-06-17*
