import { ClassificationCandidatesService } from './classification-candidates.service';
import { ClassificationCorrectionsService } from './classification-corrections.service';
import { CORRECTION_AUTHORITY, DisabledCorrectionAuthority } from './correction-authority';
import { EvidenceService } from './evidence.service';
import { EVIDENCE_AUTHORITY, DisabledEvidenceAuthority } from './evidence-authority';
import { CoverageService } from './coverage.service';
import { COVERAGE_MANDATE_PROVIDER, DisabledCoverageMandateProvider } from './coverage-mandate';
import { ClassificationService } from './classification.service';
import { CLASSIFICATION_AUTHORITY, DisabledClassificationAuthority } from './classification-authority';
import { Module } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { FinanceEventsService } from './finance-events.service';
import { BankReceiptsService } from './bank-receipts.service';
import { BANK_EVIDENCE_VERIFIER, DisabledBankEvidenceVerifier } from './bank-evidence-verifier';
/** Intentionally not imported by AppModule. No legacy entities are registered. */
@Module({ providers: [FinanceService, FinanceEventsService, BankReceiptsService, EvidenceService, CoverageService, ClassificationService, ClassificationCorrectionsService, ClassificationCandidatesService, {provide:CORRECTION_AUTHORITY,useClass:DisabledCorrectionAuthority}, {provide:CLASSIFICATION_AUTHORITY,useClass:DisabledClassificationAuthority}, {provide:COVERAGE_MANDATE_PROVIDER,useClass:DisabledCoverageMandateProvider}, {provide:EVIDENCE_AUTHORITY,useClass:DisabledEvidenceAuthority}, { provide:BANK_EVIDENCE_VERIFIER, useClass:DisabledBankEvidenceVerifier }], exports: [FinanceService, FinanceEventsService, BankReceiptsService] })
export class FinanceModule {}
