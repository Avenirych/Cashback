import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { OnboardingService } from './onboarding.service';

@Injectable()
export class BonusEligibilityGuard implements CanActivate {
  constructor(private readonly onboarding: OnboardingService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const id = context.switchToHttp().getRequest().user?.id;
    if (!Number.isSafeInteger(id) || id <= 0) throw new UnauthorizedException();
    await this.onboarding.assertEligible(id);
    return true;
  }
}
