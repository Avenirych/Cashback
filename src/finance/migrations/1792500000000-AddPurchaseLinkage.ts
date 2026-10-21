import type {MigrationInterface,QueryRunner} from 'typeorm';
/** Prepared/test-only until a reviewed production authority and migration release. */
export class AddPurchaseLinkage1792500000000 implements MigrationInterface {
  name='AddPurchaseLinkage1792500000000';
  async up(q:QueryRunner):Promise<void>{await q.query(`
CREATE TABLE public.finance_purchase_clicks (
 id varchar(160) PRIMARY KEY, "buyerReference" varchar(160) NOT NULL,
 "partnerReference" varchar(160) NOT NULL, "offerReference" varchar(160) NOT NULL,
 "materialHash" varchar(64) NOT NULL, "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.finance_purchase_orders (
 "sourceNamespace" varchar(160) NOT NULL, "orderId" varchar(160) NOT NULL,
 "clickId" varchar(160) NOT NULL REFERENCES public.finance_purchase_clicks(id),
 state varchar(30) NOT NULL CHECK(state='pending_review'),
 "createdAt" timestamptz NOT NULL DEFAULT now(), PRIMARY KEY("sourceNamespace","orderId")
);
CREATE FUNCTION public.finance_linkage_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Immutable purchase evidence'; END $$;
CREATE TRIGGER finance_linkage_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON public.finance_purchase_clicks FOR EACH STATEMENT EXECUTE FUNCTION public.finance_linkage_immutable();
CREATE TRIGGER finance_linkage_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON public.finance_purchase_orders FOR EACH STATEMENT EXECUTE FUNCTION public.finance_linkage_immutable();
`);}
  async down():Promise<void>{throw new Error('No automatic destructive purchase evidence rollback');}
}
