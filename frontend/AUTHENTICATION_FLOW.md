┌────────────────────┐
│ React Frontend     │
│ (Supabase JS SDK)  │
└─────────┬──────────┘
          │
          │ signIn/signUp
          ▼
┌────────────────────┐
│ Supabase Auth      │
│ auth.users         │
└─────────┬──────────┘
          │
          │ JWT Token
          ▼
┌────────────────────┐
│ Browser LocalStorage│
└─────────┬──────────┘
          │
          │ Authorization Bearer Token
          ▼
┌────────────────────┐
│ Express Backend    │
│ authMiddleware     │
└─────────┬──────────┘
          │ verifies token
          ▼
┌────────────────────┐
│ Supabase Auth      │
└────────────────────┘