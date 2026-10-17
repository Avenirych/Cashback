# Registration UI demo

From PowerShell:

```powershell
Set-Location 'C:\Users\serge\cashback+'
$env:PORT = '3003'
$env:REACT_APP_REGISTRATION_ISOLATED = 'true'
npm --prefix cashback-frontend start
```

Open http://localhost:3003/register. This starts only the frontend. The existing
launcher explicitly enables registration isolation and blocks bonus-api traffic.
Only the exact isolation value `true` enables the synthetic email field; unset,
empty, `false` or misspelled values do not enable it. Ambiguous nonempty values
still block bonus traffic under the existing fail-closed policy.

The local part starts empty. The UI appends `@example.test`, shows the complete
address and validates both the local part and complete address before submitting.
Outside this explicit mode the email field accepts ordinary domains. This UI flag
is not evidence of backend/database isolation or permission to start services.
The server Mailpit guard, recipient allowlist and verification flow are unchanged.
There is no automatic registration or email verification.

Phone defaults to GB (+44). The native keyboard-accessible selector stores ISO
country codes, pins GB first and sorts translated country names using the current
EN/RU/DE/FR locale. Missing Intl APIs fall back to ISO names (GB: United Kingdom)
and deterministic ordering. E.164 validation continues using max phone metadata.

Terms consent starts unchecked and is required before a request. Terms and privacy
links open their existing pages in new tabs, preserving the form in the current tab.
All four supported interface languages retain their existing translated consent.
