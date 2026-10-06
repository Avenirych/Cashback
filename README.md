<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## UK GBP bonus programme onboarding (draft)

The home-page **Get bonuses** action sends signed-in, unenrolled customers to
Profile. Joining is voluntary. After choosing to join, customers provide their
account-holder full name, six-digit sort code and eight-digit account number,
acknowledge the draft privacy notice and confirm accuracy. Successful server
storage activates bonus access; cancellation or failed validation does not.
There is no minimum balance to join or earn bonuses. Capture is **not bank
ownership verification**.

Email is taken from the authenticated account. No National Insurance number,
date of birth, address, phone or card credentials are collected. Programme
membership and encrypted recipient records are separate. Generic auth/profile
responses contain only the eligibility flag; `/onboarding` returns masked details.
JWT identity, never a supplied customer ID, controls onboarding, bonus and
withdrawal access.

### Backend configuration and deployment

Use Node **24.9 or newer** for the existing Nest 12/Jest 30 ESM dependencies.
Install locked dependencies with `npm ci` in the repository root and in
`cashback-frontend`. Copy `.env.example` to `.env` and supply database credentials,
a strong independent `JWT_SECRET`, and `RECIPIENT_ENCRYPTION_KEY`.
Generate the recipient key securely with
`node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('base64'))"`
and place it only in backend environment/secret management, never in source,
frontend `REACT_APP_*` variables, logs or browser storage. Missing/invalid
recipient keys fail closed for capture/decryption. Changing the key without
re-encrypting records makes them unreadable; back up and rotate keys with a
reviewed operator procedure.

Recipient fields use AES-256-GCM with a fresh nonce and customer-bound
authenticated additional data. Do not enable SQL parameter logging, request-body
logging or error dumps containing onboarding requests. Disable request/response
capture for `/onboarding` in proxies, APM and analytics. Require HTTPS, least-privilege
database access and access-controlled encrypted backups. Encryption at rest does
not protect a compromised backend or replace a production security review.

`DB_SYNCHRONIZE=true` is only for a disposable local database. Before production,
review and apply a schema migration for `programme_memberships`, encrypted
recipients, ledger status/currency and withdrawal request/recipient references,
including the unique customer/request-ID constraint. Existing ledger records
default to **pending**: reconcile them against confirmed partner rewards before
making funds available; do not treat the legacy user balance as proof of
confirmation. The old plaintext withdrawal `details` column is no longer used;
review secure disposal/migration of any historical recipient data instead of
blindly enabling schema synchronization on a production database.

The draft privacy and programme pages use version `2026-10-draft`. Operator
legal review must establish the actual controller identity/contact, lawful basis,
retention, recipient disclosures, rights procedure and programme conditions
before launch. Voluntary joining is separate from privacy-notice acknowledgement:
acknowledgement is not GDPR consent, and necessary payout processing may rely
on contract where the ICO's necessity test is satisfied. No marketing consent
is preselected or inferred.

### Withdrawals and Wise limitations

The existing withdrawal path is pending/manual only. It does **not** call Wise,
send money, claim bank ownership verification or mark a request completed.
Wise Business/API access, permitted product/use case, actual recipient route,
additional required fields, verification, fees and funding must be confirmed
before implementing live payouts. Do not assume a fixed fee, NI threshold or
£3,000 KYC threshold.

`POST /withdrawal/:userId` requires an authenticated enrolled customer and a
body such as `{ "amount": "10.00", "requestId": "<UUID-v4>" }`.
The route's customer ID is not authority; JWT identity is used. Retry with the
same UUID and amount to obtain the original request. Amounts are GBP decimals
with at most two places; arithmetic uses integer pence. **£10 total** confirmed,
available GBP cashback **plus bonuses** is the minimum withdrawal, not £10 in
each category. Pending/reversed/non-GBP rewards and another customer's rewards
do not count. The reservation and pending request commit atomically under a
customer row lock. Client balance-credit and unauthenticated approval/rejection
endpoints are not exposed.

Only trusted, verified partner/operator processing may write **confirmed**
ledger rewards; `BalanceService.addOperation` defaults new entries to pending.
The older cashback/bonus-transfer modules are not wired into the application,
and must not be enabled as alternative balance writers without reconciling
them with this ledger and its locking rules. There is no new payout administration
UI/API in this change: an operator must reconcile pending requests and implement
reviewed, authorized settlement/rejection handling (including exactly-once
refunds) before operational use. Never simply mark requests paid on submission.

Official references to verify for the selected live route:

- [Wise recipients](https://docs.wise.com/guides/product/send-money/recipients)
- [Wise correspondent recipient requirements](https://docs.wise.com/guides/product/send-money/use-cases/correspondent/correspondent-create-recipient)
- [ICO: contract lawful basis](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/a-guide-to-lawful-basis/contract/)

### Focused verification

```bash
# Backend (Node >=24.9)
npm run build
npm test -- --runInBand src/onboarding src/auth src/bonus src/balance src/withdrawal

# Optional real PostgreSQL concurrency tests; use a dedicated test database.
# DB_HOST/DB_PORT/DB_USERNAME/DB_PASSWORD must identify that disposable database.
WITHDRAWAL_TEST_DATABASE=cashback_onboarding_test npm test -- --runInBand src/withdrawal/withdrawal.integration.spec.ts

# Frontend
cd cashback-frontend
npx tsc --noEmit
CI=true npm test -- --watchAll=false --runInBand
npm run build
```

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Observability

In production applications, observability is essential for understanding how your system behaves, detecting issues early, and maintaining reliable performance.

[NestJS Observe](https://observe.nestjs.com) automatically instruments your NestJS application, giving you deep visibility into your system with minimal setup:

- **Distributed tracing:** Follow requests across services and understand how they flow through your system.
- **Waterfall analysis:** Visualize request execution and identify slow operations, bottlenecks, and unexpected delays.
- **Performance analysis:** Analyze application performance in real time and quickly pinpoint areas that need optimization.
- **Metrics:** Track key application and infrastructure metrics to understand system health and performance trends.
- **Logging:** Centralize and correlate logs with traces and other telemetry to make debugging easier.
- **Error tracking:** Detect errors quickly and investigate their root causes with the surrounding context.
- **SLA monitoring:** Track service-level objectives and identify when your application is approaching or exceeding defined thresholds.
- **Alarms and alerts:** Set up alerts for critical errors, performance degradation, SLA violations, and other anomalies so your team can react quickly.

This project is already instrumented. Create a free account at [observe.nestjs.com](https://observe.nestjs.com), add an application, and paste the generated app key and secret into the `ObserveModule.forRoot()` call in `src/app.module.ts`.

The free plan needs no payment details and covers 300,000 events a month. You can also browse the [live demo](https://www.observe-demo.nestjs.com/dashboard) first - the whole dashboard over a busy service's data, with nothing to install.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Auto-instrument your application with [NestJS Observe](https://observe.nestjs.com). Distributed tracing, metrics, and logging made easy. Error tracking and performance monitoring for your NestJS applications.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
