import type {MigrationInterface,QueryRunner} from 'typeorm';
/** Isolated development only. Not in any active application DataSource. */
export class AddIsolatedLotOperations1792510000000 implements MigrationInterface {
 name='AddIsolatedLotOperations1792510000000';
 async up(q:QueryRunner):Promise<void>{await q.query(`
CREATE TABLE public.finance_domain_commands (
 id uuid PRIMARY KEY, actor varchar(160) NOT NULL, key varchar(160) NOT NULL,
 "requestHash" varchar(64) NOT NULL, action varchar(40) NOT NULL,
 proof varchar(160) NOT NULL, command jsonb NOT NULL, result jsonb NOT NULL, "createdAt" timestamptz NOT NULL DEFAULT now(), UNIQUE(actor,key)
);
CREATE TABLE public.finance_bonus_lots (
 id uuid PRIMARY KEY, owner varchar(160) NOT NULL, origin varchar(160) NOT NULL,
 responsible varchar(160) NOT NULL, "confirmedAt" timestamptz NOT NULL,
 kind varchar(30) NOT NULL CHECK(kind IN ('bonus','withdrawal_gbp')),
 parent uuid REFERENCES public.finance_bonus_lots(id),
 available uuid NOT NULL UNIQUE REFERENCES public.finance_accounts(id),
 reserved uuid NOT NULL UNIQUE REFERENCES public.finance_accounts(id), CHECK(available<>reserved), CHECK(parent IS NULL OR parent<>id)
);
CREATE TABLE public.finance_bonus_reservations (
 id uuid PRIMARY KEY, lot uuid NOT NULL REFERENCES public.finance_bonus_lots(id),
 click varchar(160) NOT NULL REFERENCES public.finance_purchase_clicks(id),
 amount bigint NOT NULL CHECK(amount>0), state varchar(20) NOT NULL CHECK(state IN ('active','released'))
);
CREATE UNIQUE INDEX finance_one_active_lot_click ON public.finance_bonus_reservations(lot,click) WHERE state='active';
CREATE TABLE public.finance_lot_transfers (
 id uuid PRIMARY KEY, parent uuid NOT NULL REFERENCES public.finance_bonus_lots(id),
 child uuid NOT NULL UNIQUE REFERENCES public.finance_bonus_lots(id), amount bigint NOT NULL CHECK(amount>0),
 command uuid NOT NULL REFERENCES public.finance_domain_commands(id) DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE public.finance_verified_debts (
 id uuid PRIMARY KEY, debtor varchar(160) NOT NULL, origin varchar(160) NOT NULL,
 evidence varchar(160) NOT NULL UNIQUE, cap bigint NOT NULL CHECK(cap>0),
 account uuid NOT NULL UNIQUE REFERENCES public.finance_accounts(id)
);
CREATE TABLE public.finance_refund_reviews (
 id uuid PRIMARY KEY, source varchar(160) NOT NULL, refund varchar(160) NOT NULL,
 "orderSource" varchar(160) NOT NULL, "orderId" varchar(160) NOT NULL,
 actor varchar(160) NOT NULL, kind varchar(20) NOT NULL CHECK(kind IN ('full','partial')),
 state varchar(20) NOT NULL CHECK(state='pending_review'), proof varchar(160) NOT NULL,
 UNIQUE(source,refund), FOREIGN KEY("orderSource","orderId") REFERENCES public.finance_purchase_orders("sourceNamespace","orderId")
);
CREATE FUNCTION public.finance_domain_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Immutable domain financial history'; END $$;
CREATE TRIGGER finance_domain_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON public.finance_domain_commands FOR EACH STATEMENT EXECUTE FUNCTION public.finance_domain_immutable();
CREATE TRIGGER finance_domain_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON public.finance_bonus_lots FOR EACH STATEMENT EXECUTE FUNCTION public.finance_domain_immutable();
CREATE TRIGGER finance_domain_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON public.finance_lot_transfers FOR EACH STATEMENT EXECUTE FUNCTION public.finance_domain_immutable();
CREATE TRIGGER finance_domain_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON public.finance_verified_debts FOR EACH STATEMENT EXECUTE FUNCTION public.finance_domain_immutable();
CREATE TRIGGER finance_domain_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON public.finance_refund_reviews FOR EACH STATEMENT EXECUTE FUNCTION public.finance_domain_immutable();
CREATE FUNCTION public.finance_lot_provenance() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p public.finance_bonus_lots; a public.finance_accounts; r public.finance_accounts;
BEGIN
 SELECT * INTO a FROM public.finance_accounts WHERE id=NEW.available;
 SELECT * INTO r FROM public.finance_accounts WHERE id=NEW.reserved;
 IF a."ownerReference" IS DISTINCT FROM NEW.owner OR r."ownerReference" IS DISTINCT FROM NEW.owner OR a."normalSide"<>'credit' OR r.kind<>'reserved' OR
 a.kind<>(CASE WHEN NEW.kind='bonus' THEN 'bonus_liability' ELSE 'user_gbp' END) THEN RAISE EXCEPTION 'Lot ownership/account mismatch'; END IF;
 IF NEW.parent IS NOT NULL THEN
 SELECT * INTO p FROM public.finance_bonus_lots WHERE id=NEW.parent;
 IF NEW.origin<>p.origin OR NEW.responsible<>p.responsible OR NEW."confirmedAt"<>p."confirmedAt" OR NEW.kind<>p.kind THEN RAISE EXCEPTION 'Lineage changed'; END IF;
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER finance_lot_provenance BEFORE INSERT ON public.finance_bonus_lots FOR EACH ROW EXECUTE FUNCTION public.finance_lot_provenance();
CREATE FUNCTION public.finance_reservation_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' OR TG_OP='TRUNCATE' THEN RAISE EXCEPTION 'Reservation history cannot be deleted'; END IF;
 IF TG_OP='UPDATE' AND (OLD.state<>'active' OR NEW.id<>OLD.id OR NEW.lot<>OLD.lot OR NEW.amount<>OLD.amount) THEN RAISE EXCEPTION 'Invalid reservation transition'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER finance_reservation_guard BEFORE UPDATE OR DELETE ON public.finance_bonus_reservations FOR EACH ROW EXECUTE FUNCTION public.finance_reservation_guard();
CREATE TRIGGER finance_reservation_no_truncate BEFORE TRUNCATE ON public.finance_bonus_reservations FOR EACH STATEMENT EXECUTE FUNCTION public.finance_domain_immutable();
CREATE FUNCTION public.finance_check_reserved() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE held numeric; cached bigint;
BEGIN
 SELECT COALESCE(sum(amount),0) INTO held FROM public.finance_bonus_reservations WHERE lot=NEW.lot AND state='active';
 SELECT a."balancePence" INTO cached FROM public.finance_bonus_lots l JOIN public.finance_accounts a ON a.id=l.reserved WHERE l.id=NEW.lot;
 IF held IS DISTINCT FROM cached::numeric THEN RAISE EXCEPTION 'Reservation/ledger mismatch'; END IF; RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER finance_reserved_consistent AFTER INSERT OR UPDATE ON public.finance_bonus_reservations DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.finance_check_reserved();
CREATE FUNCTION public.finance_check_reserved_account() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE lot_id uuid; held numeric; cached bigint;
BEGIN
 SELECT id INTO lot_id FROM public.finance_bonus_lots WHERE reserved=NEW.id;
 IF lot_id IS NULL THEN RETURN NULL; END IF;
 SELECT COALESCE(sum(amount),0) INTO held FROM public.finance_bonus_reservations WHERE lot=lot_id AND state='active';
 SELECT "balancePence" INTO cached FROM public.finance_accounts WHERE id=NEW.id;
 IF held IS DISTINCT FROM cached::numeric THEN RAISE EXCEPTION 'Reservation/ledger mismatch'; END IF; RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER finance_reserved_account_consistent AFTER UPDATE ON public.finance_accounts DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.finance_check_reserved_account();
`);}
 async down():Promise<void>{throw new Error('No automatic destructive financial history rollback');}
}
