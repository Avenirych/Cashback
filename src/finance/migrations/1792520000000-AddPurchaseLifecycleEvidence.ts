import type {MigrationInterface,QueryRunner} from 'typeorm';
/** Disposable/test-only append-only history. No financial allocation authority. */
export class AddPurchaseLifecycleEvidence1792520000000 implements MigrationInterface {
 name='AddPurchaseLifecycleEvidence1792520000000';
 async up(q:QueryRunner):Promise<void>{await q.query(`
CREATE TABLE public.finance_purchase_evidence (
 source varchar(160) NOT NULL, event varchar(160) NOT NULL, actor varchar(160) NOT NULL,
 "orderSource" varchar(160) NOT NULL, "orderId" varchar(160) NOT NULL,
 version integer NOT NULL CHECK(version>0), kind varchar(30) NOT NULL CHECK(kind IN ('order_update','cancellation','full_refund','partial_refund')),
 material jsonb NOT NULL, "materialHash" varchar(64) NOT NULL,
 "createdAt" timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(source,event),
 UNIQUE("orderSource","orderId",version),
 FOREIGN KEY("orderSource","orderId") REFERENCES public.finance_purchase_orders("sourceNamespace","orderId")
);
CREATE TABLE public.finance_purchase_reviews (
 id uuid PRIMARY KEY, click varchar(160) NOT NULL REFERENCES public.finance_purchase_clicks(id),
 actor varchar(160) NOT NULL, "snapshotHash" varchar(64) NOT NULL, result jsonb NOT NULL,
 "createdAt" timestamptz NOT NULL DEFAULT now(), UNIQUE(click,"snapshotHash")
);
CREATE TRIGGER finance_purchase_evidence_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON public.finance_purchase_evidence FOR EACH STATEMENT EXECUTE FUNCTION public.finance_domain_immutable();
CREATE TRIGGER finance_purchase_review_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON public.finance_purchase_reviews FOR EACH STATEMENT EXECUTE FUNCTION public.finance_domain_immutable();
`);}
 async down():Promise<void>{throw Error('No destructive financial evidence rollback');}
}
