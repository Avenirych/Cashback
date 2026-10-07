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

## Demo bonus onboarding

Bonus access requires **valid saved Wise credentials for the current account AND
explicit program enrollment**. Registering, logging in, accepting terms, or merely
typing a valid form does not enroll an account.

Sequence: `/profile` → fill every Wise field → **Save Credentials** →
**Enroll in Program** → **Get bonuses**. Welcome explains the sequence in
English, Russian, German and French and provides a separate profile link while
the bonus button is disabled. `/bonuses`, `/bonuses/ads` and
`/bonuses/research` share the same guard: guests go to `/register`; signed-in
ineligible accounts go to `/profile`. Shop access is unchanged.

State remains browser-only, scoped to a positive integer user ID. Matching-owner
legacy records are supported; malformed, incomplete, invalid, unowned,
other-account records and storage errors cannot grant access. Valid saved
credentials need a valid `savedAt`; enrollment needs a valid `enrolledAt` no
earlier than that save. Old enrollment without valid credentials does not lock
the form. Repairing/saving credentials discards that account's old enrollment
and requires explicit enrollment again. Save/enrollment events and relevant
cross-tab storage events update open views; refresh and account changes re-read
only the current owner's records. Authentication storage is not cleared.

This is **demo UI gating, not production payout authorization**. Browser storage
can be edited by its owner. No Wise service is contacted and no real payouts
are made by this flow. Backend bonus settings/sources, bonus-transfer and balance
mutation controllers exist, but their modules are not imported by the current
`src/app.module.ts`. They do not implement current-user Wise/enrollment checks;
do not enable them for real transactions without server-side identity,
authorization and enrollment enforcement. This frontend fix does not secure
those dormant endpoints.

Manual verification:
1. Register a new account after accepting terms. On Welcome, verify Get bonuses
   is disabled and the profile link opens an editable empty form.
2. Try partial/invalid input and valid **unsaved** input: bonuses remain disabled.
   Save valid input: enrollment enables, but bonus access remains blocked.
3. Explicitly enroll, return home, and open each bonus route; refresh still works.
4. Log out and use another account in the same browser: no credentials/status
   are inherited. Direct bonus URLs redirect appropriately; shops still work.
5. Remove/corrupt the owner's Wise record while retaining enrollment and reload:
   bonuses are blocked and the form is editable. Repair, save and enroll again.
   Removing credentials in another tab also revokes access in an open bonus view.

Frontend checks (from `cashback-frontend`):
`CI=true npm test -- --watchAll=false --runInBand src/onboarding.test.tsx src/pages/Profile.test.tsx src/pages/RegistrationOnboarding.test.tsx`
and `npm run build`.

## Forum registration

After confirming the main account's email, open `/forum/register` to choose a
unique forum username (3–30 ASCII letters, digits or underscores) and accept the
forum rules. Email and name remain read-only. Rules are available publicly at
`/forum/rules` in English and Russian and explain that violations may lead to
content removal, account deletion or a ban.

Forum membership is separate from the main-site session. **Exit Forum** disables
forum participation without signing out of the main site. Verified users can
still read topics; posting requires an active forum session. The server checks
verified email, forum registration, rules agreement and ban status for writes,
regardless of browser state. Banned accounts retain read-only access.

Optional avatars accept JPEG, PNG or WebP up to **500 KiB (512,000 bytes)**.
Uploads are stored in the project's `public/avatars/` directory and served by
the API as `/avatars/{filename}`. Runtime uploads are ignored by Git; keep this
directory writable and persist it when deploying. Public profiles and post
authors expose forum identity, not main-account email or password data.

The reversible TypeORM migration
`src/migrations/1791394800000-AddForumUsers.ts` is registered in AppModule and
runs at startup. It creates `forum_users` against the existing `users` table.
The existing development `synchronize: true` setting is retained; on an empty
development database, synchronization creates both tables after the migration
checks for the prerequisite schema. Production deployments should use managed
migrations rather than automatic schema synchronization.

Manual verification:
1. With an unverified account, open forum registration or topics: email
   verification is required. Forum rules remain public.
2. With a verified account, read topics before registering; posting is disabled.
   Register with an available username and accepted rules, optionally uploading
   an avatar, then confirm the success message and redirect.
3. Try an existing username, missing rules agreement, an unsupported image, and
   an oversized upload: each must be rejected without creating invalid data.
4. Create a topic/comment and check its forum username, avatar and joined date.
   Exit Forum, reload and confirm that posting stays disabled while the main
   profile remains accessible; re-enter the forum to participate again.
5. Ban the forum account through the service and confirm that direct API writes
   are denied, but reading remains available and public profiles omit ban status.

Focused backend checks (from the project root):
`npm test -- --runInBand src/forum` and `npm run build`.
Focused frontend checks (from `cashback-frontend`):
`CI=true npm test -- --watchAll=false --runInBand src/context/AuthContext.test.tsx src/pages/Forum.test.tsx`
and `npm run build`. Existing unrelated lint/build warnings should be reviewed
separately rather than suppressing validation of the forum changes.

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
