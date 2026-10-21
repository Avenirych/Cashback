import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { User } from './users/user.entity';
import { AnalyticsEvent } from './analytics/analytics.entity';
import { Topic } from './topics.entity';
import { Post } from './posts.entity';
import { ForumUser } from './forum/forum-user.entity';
import { ForumTopic } from './forum/forum-topic.entity';
import { ForumPost } from './forum/forum-post.entity';
import { BonusItem } from './bonus/bonus-item.entity';
import { BonusTransfer } from './bonus/bonus-transfer.entity';
import { MarketingPreferences } from './marketing-preferences/marketing-preferences.entity';
import { InitialApplicationTables1733927999000 } from './migrations/1733927999000-InitialApplicationTables';
import { AddMarketingPreferences1733928000000 } from './migrations/1733928000000-AddMarketingPreferences';
import { AddEmailVerification1735000000000 } from './migrations/1735000000000-AddEmailVerification';
import { AddForumUsers1791394800000 } from './migrations/1791394800000-AddForumUsers';
import { AddUsersEmailUnique1791888000000 } from './migrations/1791888000000-AddUsersEmailUnique';
import { CreateBonusTables1791630000000 } from './migrations/CreateBonusTables';

// No dotenv import, filesystem env loading, DATABASE_URL or production DB_*.
// Run only inside the Compose database network, with an explicit target.
const host = process.env.CB_DOCKER_MIGRATION_HOST;
const database = process.env.CB_DOCKER_MIGRATION_DATABASE;
const password = process.env.CB_DOCKER_DB_PASSWORD;
if (host !== 'postgres-test') {
  throw new Error('CB_DOCKER_MIGRATION_HOST must explicitly be postgres-test');
}
if (!database || !/^cashback_docker_migration_check_[a-f0-9]{30}$/.test(database)) {
  throw new Error('Set an explicit allowed Docker test database name');
}
if (!password || !/^[a-f0-9]{64}$/.test(password)) {
  throw new Error('Set CB_DOCKER_DB_PASSWORD from the dedicated Docker test env file');
}

export const DockerTestDataSource = new DataSource({
  type: 'postgres',
  host,
  port: 5432,
  username: 'cashback_test',
  password,
  database,
  schema: 'public',
  entities: [
    User, AnalyticsEvent, Topic, Post, ForumUser, ForumTopic, ForumPost,
    BonusItem, BonusTransfer, MarketingPreferences,
  ],
  subscribers: [],
  migrations: [
    InitialApplicationTables1733927999000,
    AddMarketingPreferences1733928000000,
    AddEmailVerification1735000000000,
    AddForumUsers1791394800000,
    CreateBonusTables1791630000000,
    AddUsersEmailUnique1791888000000,
  ],
  synchronize: false,
  migrationsRun: false,
  migrationsTransactionMode: 'all',
  // Avoid driver's automatic CREATE EXTENSION on initialize (UUIDs use pg core).
  installExtensions: false,
  uuidExtension: 'pgcrypto',
  logging: false,
});

// Deliberately do not initialize or execute migrations on import.
