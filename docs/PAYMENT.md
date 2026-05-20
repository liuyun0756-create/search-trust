# SearchTrust — Paddle Payment Integration

## Overview

SearchTrust uses **Paddle (Merchant of Record)** as the payment provider. Users purchase audit credits through Paddle Checkout, and the backend syncs credits via Paddle Webhooks.

---

## Payment Flow

```
User clicks "Buy One Report" on Pricing page
        ↓
Frontend calls Paddle.Checkout.open({ items: [{ priceId }] })
        ↓
User completes payment in Paddle popup (credit card / PayPal / Apple Pay)
        ↓
Paddle sends webhook → POST /api/webhook/paddle
        ↓
Backend verifies signature → extracts transaction_id + custom_data (user_id)
        ↓
Insert into orders table (order_id = paddle transaction_id, status = paid)
        ↓
Update users table: audit_credits += credits_purchased
        ↓
User can now generate reports (each report costs 1 credit)
        ↓
generate-report API deducts audit_credits by 1
```

---

## Database Table Relationships

### Entity Relationship

```
users (id)
  ├── orders (user_id)        — one user has many orders
  └── reports (user_id)       — one user has many reports
```

### users Table

| Field | Type | Description |
|---|---|---|
| id | UUID (PK) | Internal user ID |
| clerk_user_id | VARCHAR(255) | Clerk authentication ID |
| email | VARCHAR(255) | User email |
| name | VARCHAR(255) | User display name |
| audit_credits | INT (default 5) | Available audit credits (new users get 5 free) |
| created_at | TIMESTAMP | Account creation time |
| updated_at | TIMESTAMP | Last update time |

### orders Table

| Field | Type | Description |
|---|---|---|
| id | UUID (PK) | Internal order ID |
| user_id | UUID (FK → users) | Which user placed the order |
| order_id | VARCHAR(255) | **Paddle transaction_id** (e.g. `txn_01abc123`) |
| amount | INT | Payment amount in cents (e.g. 1900 = $19) |
| credits_purchased | INT | How many credits this order grants (e.g. 1) |
| status | VARCHAR(20) | `pending` / `paid` / `failed` / `refunded` |
| created_at | TIMESTAMP | Order creation time |
| paid_at | TIMESTAMP | Actual payment time |

### reports Table

| Field | Type | Description |
|---|---|---|
| id | UUID (PK) | Internal report ID |
| report_id | VARCHAR(50) | Public report identifier |
| user_id | UUID (FK → users) | Which user owns this report |
| page_url | TEXT | Audited page URL |
| page_type | VARCHAR(100) | Service Page / Landing Page |
| gbp_url | TEXT | Google Business Profile URL |
| task_id | VARCHAR(100) | Async task ID for polling |
| status | VARCHAR(20) | `free_preview` / `paid_full` |
| ... | JSONB | Report modules (module_1 ~ module_5) |
| created_at | TIMESTAMP | Report creation time |

### How Credits Flow

```
New user registration → audit_credits = 5 (free trials)

Payment webhook (transaction.completed):
  → INSERT INTO orders (user_id, order_id=paddle_txn_id, amount=1900, credits_purchased=1, status=paid)
  → UPDATE users SET audit_credits = audit_credits + 1 WHERE id = user_id

Generate report:
  → Check audit_credits > 0
  → UPDATE users SET audit_credits = audit_credits - 1
  → INSERT INTO reports (user_id, status, ...)

Refund webhook (transaction.refunded):
  → UPDATE orders SET status = refunded WHERE order_id = txn_id
  → UPDATE users SET audit_credits = audit_credits - credits_purchased (prevent negative)
```

---

## Environment Configuration

### Sandbox (Development / Testing)

```env
NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=test_xxxxxxxxxxxx
PADDLE_SELLER_ID=12345
PADDLE_PRICE_ID=pri_01sandbox_xxxxxxxxxxxx
PADDLE_WEBHOOK_SECRET=pdl_ntfset_sandbox_xxxxxxxxxxxx
PADDLE_ENV=sandbox
```

### Live (Production)

```env
NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=live_xxxxxxxxxxxx
PADDLE_SELLER_ID=12345
PADDLE_PRICE_ID=pri_01live_xxxxxxxxxxxx
PADDLE_WEBHOOK_SECRET=pdl_ntfset_live_xxxxxxxxxxxx
PADDLE_ENV=production
```

> Note: Seller ID is the same for both environments. Price ID, Client Token, and Webhook Secret are different per environment.

---

## Paddle Dashboard Setup

### Sandbox Environment

1. Login to Paddle Dashboard → switch to **Sandbox** (top-left toggle)
2. **Catalog → Products → Create Product**
   - Name: `SearchTrust Single Report`
   - Tax Category: `SaaS` (or appropriate category)
3. After product creation → **Create Price**
   - Price: `$19.00`
   - Billing Cycle: `One-time`
   - Copy the **Price ID** (starts with `pri_`)
4. **Developer Tools → Auth**
   - Copy **Client Token** (starts with `test_`)
   - Copy **Seller ID**
5. **Developer Tools → Notifications → Create Webhook**
   - Endpoint URL: `https://xxxx.ngrok.io/api/webhook/paddle` (use ngrok for local dev)
   - Events: `transaction.completed`, `transaction.payment.failed`, `transaction.refunded`
   - Copy the **Webhook Secret**

**Test Card Numbers:**
- Visa: `4242 4242 4242 4242`
- Expiry: any future date
- CVC: any 3 digits

### Live Environment

1. Switch to **Live** in Paddle Dashboard
2. Repeat all steps above (products and prices are independent per environment)
3. Ensure Paddle account has passed **KYC verification** (otherwise Live cannot collect payments)
4. Webhook URL: `https://your-production-domain.com/api/webhook/paddle`

---

## File Changes

### New Files

| File | Purpose |
|---|---|
| `src/app/api/webhook/paddle/route.ts` | Receive Paddle webhook events |
| `src/lib/paddle.ts` | Initialize Paddle client (shared config) |

### Modified Files

| File | Change |
|---|---|
| `package.json` | Add `@paddle/paddle-js`, `@paddle/paddle-node-sdk` |
| `src/app/layout.tsx` | Initialize Paddle on app load |
| `src/components/pricing/PricingHero.tsx` | Buy button triggers Paddle Checkout |
| `src/components/common/RunAuditButton.tsx` | Check credits before opening audit form |
| `src/lib/auth.ts` | `getCurrentUser()` returns `auditCredits` |
| `.env.local` | Add Paddle environment variables |

---

## API Endpoints

### POST /api/webhook/paddle

Paddle calls this endpoint when payment events occur.

**Flow:**

```
1. Receive POST from Paddle
2. Verify webhook signature using PADDLE_WEBHOOK_SECRET
3. Parse event type:
   - transaction.completed
     → Extract: transaction_id, amount, custom_data.user_id
     → INSERT INTO orders (order_id = transaction_id)
     → UPDATE users SET audit_credits = audit_credits + credits_purchased
   - transaction.payment.failed
     → INSERT INTO orders (status = failed)
   - transaction.refunded
     → UPDATE orders SET status = refunded
     → Deduct credits from user (prevent going below 0)
4. Return 200 OK
```

**Request payload (simplified):**

```json
{
  "event_type": "transaction.completed",
  "event_data": {
    "id": "txn_01abc123def456",
    "amount": "19.00",
    "currency_code": "USD",
    "status": "completed",
    "custom_data": {
      "user_id": "uuid-of-the-user"
    }
  }
}
```

---

## Frontend Integration

### Initialize Paddle (layout.tsx)

```typescript
import { initializePaddle, type Paddle } from '@paddle/paddle-js';
import { useEffect, useState } from 'react';

export default function RootLayout({ children }) {
  const [paddle, setPaddle] = useState<Paddle | undefined>();

  useEffect(() => {
    initializePaddle({
      environment: process.env.NEXT_PUBLIC_PADDLE_ENV === 'production' ? undefined : 'sandbox',
      seller: Number(process.env.NEXT_PUBLIC_PADDLE_SELLER_ID),
    }).then((paddleInstance) => {
      setPaddle(paddleInstance);
    });
  }, []);

  // Pass paddle instance down via context or props
}
```

### Buy Button (PricingHero.tsx)

```typescript
paddle.Checkout.open({
  items: [{ priceId: process.env.NEXT_PUBLIC_PADDLE_PRICE_ID, quantity: 1 }],
  customData: { user_id: currentUserId },
});
```

---

## Credits Lifecycle

| Event | Credits Change | Trigger |
|---|---|---|
| New user registration | +5 (free) | Clerk webhook → user creation |
| Purchase 1 report | +1 | Paddle webhook (transaction.completed) |
| Generate report | -1 | POST /api/generate-report |
| Refund | -purchased | Paddle webhook (transaction.refunded) |
| Report generation blocked | 0 (blocked) | audit_credits <= 0 → redirect to /pricing |

---

## Deployment Checklist

### Pre-deployment (Sandbox)

- [ ] Paddle Sandbox environment configured with product + price
- [ ] Webhook endpoint created in Sandbox
- [ ] All environment variables set in `.env.local`
- [ ] Test payment completes successfully with test card
- [ ] Webhook received and processed (orders table + credits updated)
- [ ] Report generation deducts credits correctly

### Production Deployment

- [ ] Paddle Live environment configured with product + price
- [ ] KYC verification passed on Paddle account
- [ ] Vercel environment variables updated to Live keys
- [ ] `PADDLE_ENV` set to `production`
- [ ] Webhook URL updated to production domain in Paddle Dashboard
- [ ] First real payment test completed
- [ ] Remove debug console.log statements from webhook handler

---

## Security Notes

- **Webhook Secret** must never be committed to git (only in `.env.local` or Vercel env vars)
- Always **verify webhook signature** before processing — prevents forged payment notifications
- Client Token (`NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`) is safe to expose in frontend code
- Seller ID is public information, safe to expose
- Price ID is public, safe to expose (but environment-specific)
