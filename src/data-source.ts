import 'dotenv/config';
import { DataSource } from 'typeorm';

import { AddForumUsers1791394800000 } from './migrations/1791394800000-AddForumUsers';
import { CreateBonusTables1791630000000 } from './migrations/CreateBonusTables';

const password = process.env.DB_PASSWORD;

if (!password) {
  throw new Error('Set DB_PASSWORD in the backend .env file');
}

const port = Number(process.env.DB_PORT ?? '5432');

if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  throw new Error('Invalid DB_PORT');
}

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port,
  username: process.env.DB_USER ?? 'postgres',
  password,
  database: process.env.DB_NAME ?? 'cashback',

  entities: [],
  subscribers: [],

  migrations: [
    AddForumUsers1791394800000,
    CreateBonusTables1791630000000,
  ],

  synchronize: false,
  migrationsRun: false,
  migrationsTransactionMode: 'all',
  logging: ['error', 'migration'],
});

// Не вызывайте initialize() здесь.
// Подключением управляет TypeORM CLI.