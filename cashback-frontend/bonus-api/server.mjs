import express from "express";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const PORT = Number(process.env.PORT ?? 3002);
const AUTH_BASE = (
  process.env.AUTH_API_BASE ?? "http://localhost:3001"
).replace(/\/$/, "");

const FRONTEND_ORIGIN =
  process.env.FRONTEND_ORIGIN ?? "http://localhost:3000";

const DATABASE_PATH = resolve(
  process.env.BONUS_DATABASE ?? "./data/bonuses.sqlite"
);

// Ограничение для минимального сервиса:
// не более 1 000 000 бонусов на одну позицию.
const MAX_MINOR_AMOUNT = 100_000_000;

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function requirePositiveId(value) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new ApiError(400, "Invalid user ID");
  }
  return value;
}

async function upstream(path, token) {
  let response;

  try {
    response = await fetch(`${AUTH_BASE}${path}`, {
      headers: token
        ? { Authorization: `Bearer ${token}` }
        : {},
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    throw new ApiError(503, "Authentication backend unavailable");
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new ApiError(401, "Invalid session");
    }
    if (response.status === 403) {
      throw new ApiError(403, "Access denied");
    }
    if (response.status === 404) {
      throw new ApiError(404, "Forum recipient not found");
    }

    throw new ApiError(503, "Authentication backend error");
  }

  try {
    return await response.json();
  } catch {
    throw new ApiError(503, "Invalid authentication response");
  }
}

async function authenticate(req, res, next) {
  try {
    const authorization = req.get("Authorization") ?? "";
    const match = /^Bearer ([^\s]+)$/.exec(authorization);

    if (!match) {
      throw new ApiError(401, "Bearer token required");
    }

    const token = match[1];

    // Токен проверяет настоящий backend сайта.
    // Мы не доверяем userId, присланному браузером.
    const user = await upstream("/auth/profile", token);

    requirePositiveId(user?.id);

    if (user.email_verified !== true) {
      throw new ApiError(403, "Verify your email first");
    }

    req.identity = {
      userId: user.id,
      token,
    };

    next();
  } catch (error) {
    next(error);
  }
}

class BonusService {
  constructor(databasePath) {
    mkdirSync(dirname(databasePath), { recursive: true });

    this.db = new DatabaseSync(databasePath);

    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA busy_timeout = 5000;
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS bonus_lots (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL CHECK (user_id > 0),
        source TEXT NOT NULL
          CHECK (source IN ('ads', 'research', 'transfer', 'purchase', 'refund')),
        amount_minor INTEGER NOT NULL
          CHECK (amount_minor > 0 AND amount_minor <= 100000000),
        state TEXT NOT NULL
          CHECK (state IN ('pending', 'confirmed', 'spent', 'transferred', 'failed')),
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        used_at TEXT,
        reference_id TEXT,
        from_user_id INTEGER,
        from_username TEXT,
        to_username TEXT
      );

      CREATE INDEX IF NOT EXISTS bonus_lots_owner
        ON bonus_lots(user_id);

      CREATE UNIQUE INDEX IF NOT EXISTS bonus_credit_reference
        ON bonus_lots(reference_id)
        WHERE source <> 'transfer' AND reference_id IS NOT NULL;

      CREATE TABLE IF NOT EXISTS bonus_transfers (
        id TEXT PRIMARY KEY,
        lot_id TEXT NOT NULL REFERENCES bonus_lots(id),
        recipient_lot_id TEXT NOT NULL REFERENCES bonus_lots(id),
        from_user_id INTEGER NOT NULL,
        to_user_id INTEGER NOT NULL,
        from_username TEXT NOT NULL,
        to_username TEXT NOT NULL,
        amount_minor INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        UNIQUE(lot_id)
      );

      CREATE INDEX IF NOT EXISTS bonus_transfers_sender
        ON bonus_transfers(from_user_id);

      CREATE INDEX IF NOT EXISTS bonus_transfers_recipient
        ON bonus_transfers(to_user_id);

      CREATE TABLE IF NOT EXISTS bonus_requests (
        user_id INTEGER NOT NULL,
        request_key TEXT NOT NULL,
        fingerprint TEXT NOT NULL,
        response_json TEXT NOT NULL,
        PRIMARY KEY(user_id, request_key)
      );
    `);
  }

  transaction(work) {
    this.db.exec("BEGIN IMMEDIATE");

    try {
      const result = work();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  transferDto(row) {
    return {
      id: row.id,
      fromUserId: row.from_user_id,
      toUserId: row.to_user_id,
      fromUsername: row.from_username,
      toUsername: row.to_username,
      amount: row.amount_minor / 100,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      status: "completed",
    };
  }

  snapshot(userId) {
    requirePositiveId(userId);

    return this.transaction(() => {
      const now = new Date().toISOString();

      const rows = this.db
        .prepare(`
          SELECT * FROM bonus_lots
          WHERE user_id = ?
          ORDER BY created_at DESC, id
        `)
        .all(userId);

      const totals = {
        available: 0,
        pending: 0,
        spent: 0,
        expired: 0,
      };

      const items = rows.map((row) => {
        const expired = row.expires_at <= now;
        const unused =
          row.state === "confirmed" || row.state === "pending";

        if (unused && expired) {
          totals.expired += row.amount_minor;
        } else if (row.state === "confirmed") {
          totals.available += row.amount_minor;
        } else if (row.state === "pending") {
          totals.pending += row.amount_minor;
        } else if (row.state === "spent") {
          totals.spent += row.amount_minor;
        }

        let status = row.state;

        if (row.state === "transferred") {
          // Совместимость с frontend-типами.
          // В истории переводов видно назначение операции.
          status = "spent";
        } else if (unused && expired) {
          status = "expired";
        }

        return {
          id: row.id,
          userId: row.user_id,
          source: row.source,
          amount: row.amount_minor / 100,
          status,
          createdAt: row.created_at,
          expiresAt: row.expires_at,
          usedAt: row.used_at,
          referenceId: row.reference_id,
          isExpired: unused && expired,
          ...(row.source === "transfer"
            ? {
                transferMeta: {
                  fromUserId: row.from_user_id,
                  toUserId: row.user_id,
                  fromUsername: row.from_username,
                  toUsername: row.to_username,
                },
              }
            : {}),
        };
      });

      const transferRows = this.db
        .prepare(`
          SELECT * FROM bonus_transfers
          WHERE from_user_id = ? OR to_user_id = ?
          ORDER BY created_at DESC, id
        `)
        .all(userId, userId);

      const available = totals.available / 100;

      return {
        summary: {
          balance: available,
          confirmed: available,
          available,
          pending: totals.pending / 100,
          spent: totals.spent / 100,
          expired: totals.expired / 100,
          lastUpdated: now,
        },
        items,
        transfers: transferRows.map((row) => this.transferDto(row)),
      };
    });
  }

  transfer(from, to, bonusIds, key) {
    requirePositiveId(from.userId);
    requirePositiveId(to.userId);

    if (from.userId === to.userId) {
      throw new ApiError(400, "Cannot transfer to yourself");
    }

    const sortedIds = [...bonusIds].sort();
    const fingerprint = JSON.stringify({
      toUserId: to.userId,
      bonusIds: sortedIds,
    });

    return this.transaction(() => {
      const previous = this.db
        .prepare(`
          SELECT fingerprint, response_json FROM bonus_requests
          WHERE user_id = ? AND request_key = ?
        `)
        .get(from.userId, key);

      if (previous) {
        if (previous.fingerprint !== fingerprint) {
          throw new ApiError(
            409,
            "Idempotency key already used for another request"
          );
        }

        return JSON.parse(previous.response_json);
      }

      const now = new Date().toISOString();
      const results = [];

      for (const id of sortedIds) {
        const lot = this.db
          .prepare(`
            SELECT * FROM bonus_lots
            WHERE id = ? AND user_id = ?
          `)
          .get(id, from.userId);

        if (
          !lot ||
          lot.state !== "confirmed" ||
          lot.expires_at <= now
        ) {
          throw new ApiError(
            409,
            "A selected bonus is no longer available"
          );
        }

        const recipientLotId = randomUUID();

        this.db
          .prepare(`
            INSERT INTO bonus_lots (
              id, user_id, source, amount_minor, state,
              created_at, expires_at, reference_id,
              from_user_id, from_username, to_username
            ) VALUES (?, ?, 'transfer', ?, 'confirmed', ?, ?, ?, ?, ?, ?)
          `)
          .run(
            recipientLotId,
            to.userId,
            lot.amount_minor,
            now,
            lot.expires_at,
            lot.id,
            from.userId,
            from.username,
            to.username
          );

        const updated = this.db
          .prepare(`
            UPDATE bonus_lots
            SET state = 'transferred', used_at = ?
            WHERE id = ? AND user_id = ? AND state = 'confirmed'
          `)
          .run(now, lot.id, from.userId);

        if (updated.changes !== 1) {
          throw new ApiError(409, "Bonus changed; retry");
        }

        const transferId = randomUUID();

        this.db
          .prepare(`
            INSERT INTO bonus_transfers (
              id, lot_id, recipient_lot_id,
              from_user_id, to_user_id,
              from_username, to_username,
              amount_minor, created_at, expires_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
          .run(
            transferId,
            lot.id,
            recipientLotId,
            from.userId,
            to.userId,
            from.username,
            to.username,
            lot.amount_minor,
            now,
            lot.expires_at
          );

        results.push({
          id: transferId,
          fromUserId: from.userId,
          toUserId: to.userId,
          fromUsername: from.username,
          toUsername: to.username,
          amount: lot.amount_minor / 100,
          createdAt: now,
          expiresAt: lot.expires_at,
          status: "completed",
        });
      }

      this.db
        .prepare(`
          INSERT INTO bonus_requests (
            user_id, request_key, fingerprint, response_json
          ) VALUES (?, ?, ?, ?)
        `)
        .run(
          from.userId,
          key,
          fingerprint,
          JSON.stringify(results)
        );

      return results;
    });
  }

  // Только локальная CLI-команда для проверки.
  // Этот метод не опубликован как HTTP endpoint.
  testCredit(userId, amount, eventId) {
    requirePositiveId(userId);

    const amountMinor = Math.round(amount * 100);

    if (
      !Number.isFinite(amount) ||
      !Number.isSafeInteger(amountMinor) ||
      amountMinor <= 0 ||
      amountMinor > MAX_MINOR_AMOUNT ||
      Math.abs(amount * 100 - amountMinor) > 0.000001
    ) {
      throw new Error("Amount must have at most two decimal places");
    }

    if (!/^[A-Za-z0-9_-]{8,100}$/.test(eventId ?? "")) {
      throw new Error("Provide a unique test event ID (8–100 characters)");
    }

    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000
    ).toISOString();

    this.db
      .prepare(`
        INSERT INTO bonus_lots (
          id, user_id, source, amount_minor, state,
          created_at, expires_at, reference_id
        ) VALUES (?, ?, 'ads', ?, 'confirmed', ?, ?, ?)
      `)
      .run(
        id,
        userId,
        amountMinor,
        createdAt,
        expiresAt,
        `test:${eventId}`
      );

    return { id, userId, amount, expiresAt };
  }

  close() {
    this.db.close();
  }
}

const service = new BonusService(DATABASE_PATH);

if (process.argv[2] === "--test-credit") {
  if (process.env.NODE_ENV === "production") {
    service.close();
    throw new Error("Test credits are disabled in production");
  }

  try {
    const result = service.testCredit(
      Number(process.argv[3]),
      Number(process.argv[4]),
      process.argv[5]
    );

    console.log(JSON.stringify(result, null, 2));
  } finally {
    service.close();
  }
} else {
  const app = express();

  app.disable("x-powered-by");

  app.use((req, res, next) => {
    const origin = req.get("Origin");

    if (origin && origin !== FRONTEND_ORIGIN) {
      return res.status(403).json({
        message: "Origin not allowed",
      });
    }

    res.set("Vary", "Origin");

    if (origin) {
      res.set("Access-Control-Allow-Origin", FRONTEND_ORIGIN);
    }

    res.set(
      "Access-Control-Allow-Headers",
      "Authorization, Content-Type, Idempotency-Key"
    );
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.set("Cache-Control", "no-store");

    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }

    next();
  });

  app.use(express.json({ limit: "16kb" }));

  app.get("/health", (req, res) => {
    res.json({ ok: true });
  });

  app.get(
    "/api/bonus/snapshot",
    authenticate,
    (req, res) => {
      res.json(service.snapshot(req.identity.userId));
    }
  );

  app.post(
    "/api/bonus/transfer",
    authenticate,
    async (req, res) => {
      const body = req.body;
      const key = req.get("Idempotency-Key") ?? "";

      if (!/^[A-Za-z0-9_-]{16,100}$/.test(key)) {
        throw new ApiError(400, "Valid Idempotency-Key required");
      }

      if (
        !body ||
        typeof body !== "object" ||
        Array.isArray(body) ||
        Object.keys(body).some(
          (name) => !["toUsername", "bonusIds"].includes(name)
        ) ||
        typeof body.toUsername !== "string" ||
        !/^[A-Za-z0-9_]{3,30}$/.test(body.toUsername) ||
        !Array.isArray(body.bonusIds) ||
        body.bonusIds.length < 1 ||
        body.bonusIds.length > 100 ||
        body.bonusIds.some(
          (id) => typeof id !== "string" || id.length > 100
        ) ||
        new Set(body.bonusIds).size !== body.bonusIds.length
      ) {
        throw new ApiError(400, "Invalid transfer request");
      }

      const membership = await upstream(
        "/forum/status",
        req.identity.token
      );

      const sender = membership?.forumUser;

      if (
        membership.registered !== true ||
        !sender ||
        sender.user_id !== req.identity.userId ||
        sender.banned !== false ||
        sender.agreed_to_rules !== true ||
        typeof sender.username !== "string"
      ) {
        throw new ApiError(403, "Active forum membership required");
      }

      const recipient = await upstream(
        `/forum/user/${encodeURIComponent(body.toUsername)}`
      );

      requirePositiveId(recipient?.user_id);

      if (
        recipient.agreed_to_rules !== true ||
        typeof recipient.username !== "string"
      ) {
        throw new ApiError(403, "Recipient has not accepted forum rules");
      }

      const result = service.transfer(
        {
          userId: req.identity.userId,
          username: sender.username,
        },
        {
          userId: recipient.user_id,
          username: recipient.username,
        },
        body.bonusIds,
        key
      );

      res.json(result);
    }
  );

  app.use((req, res) => {
    res.status(404).json({ message: "Endpoint not found" });
  });

  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);

    const status =
      error instanceof ApiError
        ? error.status
        : error?.type === "entity.parse.failed"
        ? 400
        : error?.type === "entity.too.large"
        ? 413
        : 500;

    if (status === 500) {
      console.error(error);
    }

    res.status(status).json({
      message:
        error instanceof ApiError
          ? error.message
          : status === 400
          ? "Invalid JSON"
          : status === 413
          ? "Request body too large"
          : "Internal bonus service error",
    });
  });

  // Локальный адаптер, не публичный финансовый API.
  const server = app.listen(PORT, "127.0.0.1", () => {
    console.log(`Bonus API: http://localhost:${PORT}`);
    console.log(`SQLite: ${DATABASE_PATH}`);
    console.log(`Authentication backend: ${AUTH_BASE}`);
  });

  function shutdown() {
    server.close(() => {
      service.close();
      process.exit(0);
    });
  }

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}