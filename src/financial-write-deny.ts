import { CanActivate, ExecutionContext, Injectable, SetMetadata, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
export const NON_FINANCIAL_MUTATION = Symbol('NON_FINANCIAL_MUTATION');
/** Per-handler classification only. Does not replace JWT/owner/moderation authorization. */
export const NonFinancialMutation = () => SetMetadata(NON_FINANCIAL_MUTATION, true);
/** No env, role, demo switch or runtime activation API can override this deny. */
export function assertFinancialWritesAllowed(): void {
  throw new ForbiddenException({ code: 'FINANCIAL_WRITES_DISABLED', message: 'Financial operations are not enabled' });
}
@Injectable()
export class FinancialWriteGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const method = context.switchToHttp().getRequest<{method:string}>().method?.toUpperCase();
    if (['GET','HEAD','OPTIONS'].includes(method)) return true;
    if (this.reflector.get(NON_FINANCIAL_MUTATION, context.getHandler()) === true) return true;
    assertFinancialWritesAllowed();
    return false;
  }
}
