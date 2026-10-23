# Moderation personal-data handling and release gate

This is the operational policy for the prepared moderation schema v3, not a legal compliance certification. It must be approved by the controller before activation. Immutability is an integrity control, never a lawful basis or a reason for indefinite retention.

## Data minimisation and purposes

- forum_moderation_events: case reference, action and timestamp only. Case references can still be personal data through joins; do not call this irreversibly anonymous.
- forum_event_identities: restricted subject/reviewer links, separate from explanations. Purpose: own notices, reviewer accountability and appeals.
- forum_event_details: restricted free-text explanation, separate from identities. Do not enter credentials, contact details, unnecessary names, health information or full copies of offending text. Prefer a rule reference and concise contextual explanation.
- Cases: moderation state and minimal risk labels, no copy of material. Text remains in original forum storage. Pending content and report/appeal reasons are private to authorized reviewers.
- Consent history: version and actual acceptance time; no IP address, browser fingerprint or copied identity document is collected.

## Retention decisions

Before release the controller must document purpose, lawful basis, review/expiry date, accountable owner and any specific legal obligation for each category. There is no invented statutory retention period in this implementation. Retain identifiable explanations only while necessary for a live moderation/appeal purpose or a specifically documented lawful requirement. Review when an appeal closes, a restriction expires, an account is deleted or an erasure request arrives. An indefinite publication restriction does NOT authorize indefinite storage of all reasons or personal identifiers.

Owner-only forum_purge_expired_details(cutoff) now applies per-case 30-day abandoned pending, 90-day revoked/unconfirmed, and 180-day confirmed evidence intervals from the latest relevant decision/resolved appeal. Open appeals and unexpired documented holds exclude the case. A fresh appeal resolution restarts the interval. The approved retention schedule must supply a bounded cutoff. It removes eligible hidden material, explanations, identity links and associated report/resolved appeal details; it does not purge active consent or published lawful material by a global date. It does not pretend that the remaining case/author association is anonymous. The controller must separately review ongoing case/author linkage and use subject erasure when it has no remaining lawful purpose. retention_review_at marks minimal sanction linkage for annual owner review; no automatic production job is enabled before these decisions. Holds require basis, scope reference, approver, review and expiry, not an immutability exception. Unapproved schedules block activation.

## Verified erasure procedure

1. Privacy operator verifies identity and scope using the existing authorized support procedure, without collecting a new password or exposing tokens. There is deliberately no public endpoint which can wipe another person's sanction history.
2. Assess current obligations, appeals and third-party interests. Do not retain a copy by default or archive personal data to D: as a substitute for erasure. Exceptions require a recorded, specific lawful basis and review date, not an undocumented permanent hold.
3. In an authorized maintenance transaction call public.forum_erase_personal_data(subject_id). This serializes with that user's profile/content/sanction operations. It removes relevant journals and identity/reason links, consent history, authored or associated reports/appeals, clears original authored text and author links, hides cases, removes reviewer role and sanitizes forum alias/avatar reference. It does not delete/reset main-account balances, bonus data or financial obligations.
4. Review third-party mentions in other people's material/reasons and personal data in avatar files, email, logs, exports and backups. The database procedure cannot infer all third-party references from arbitrary text. Delete an owned avatar file only after database commit and verified ownership. Apply necessary scoped removal through an authorized operator; never infer total erasure from a successful SQL call.
5. Main-account deletion is a separate controller decision. A BEFORE DELETE trigger calls the same moderation erasure procedure and removes forum membership, so moderation immutability no longer blocks deletion. Other application/financial foreign keys and legal obligations must still be assessed; this is not a blanket cascade over financial data.
6. Record completion/evidence without retaining deleted text or unnecessary identity. Backups are access-restricted and time-limited; an approved erasure ledger must be replayed before restored data is brought back into use. No backup restore or new backup is part of this change.

## Privileges and audit integrity

The runtime role may insert/read identity links and explanations, but cannot UPDATE/DELETE them, invoke privacy maintenance or grant itself moderator status. Owner-only SECURITY DEFINER procedures have fixed search_path and no PUBLIC EXECUTE. The immutability trigger permits maintenance only when the executing role is the actual table owner AND the transaction-local maintenance flag is set. Runtime setting that flag alone is insufficient. Table owners can already alter triggers; owner credentials are never application runtime credentials.

## Deployment order (separate authorization required)

Verify schema/role/backup readiness and current identities; approve retention, privacy operations, moderator staffing and legacy moderation plan. Stop new forum writes using an approved maintenance window (do not stop PostgreSQL). Apply the original moderation migration and grants, then 20261023-moderation-privacy.sql and its grants once, with runtime_role bound to the independently verified restricted role. Apply the v3 retention migration and role fence afterwards. Schema marker becomes 3; use the separate restricted cashback_hist_moderated_runtime role, never regrant forum writes to the legacy role. See MODERATION-ROLLBACK.md. Test on an isolated full application before approval for the active database. Coordinate compatible backend/frontend release with feature flag still off, provision independent moderators, review legacy material, then enable only after checks. Do not deploy frontend alone against missing endpoints/schema.

Rollback application images/configuration via the existing verified release procedure; never reverse privacy erasure, re-publish pending content, reinitialize a volume or use synchronize/migrationsRun. Once schema is installed, disabling the flag deliberately fails closed for publication; it does not restore unsafe legacy writes.

Reference: ICO storage limitation guidance https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/storage-limitation/ . The guidance requires justified retention and erasure/anonymisation when no longer necessary; it does not set one universal duration.
