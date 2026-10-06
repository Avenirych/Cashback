import { BalanceController } from './balance.controller';
import { BalanceService } from './balance.service';

describe('BalanceController', () => {
  it('reads only the authenticated customer ledger', async () => {
    const getUserBalanceHistory = jest.fn();
    const controller = new BalanceController({ getUserBalanceHistory } as unknown as BalanceService);
    await controller.getHistory({ user: { id: 7 } });
    expect(getUserBalanceHistory).toHaveBeenCalledWith(7);
  });

  it('does not expose a customer balance-credit operation', () => {
    expect(BalanceController.prototype).not.toHaveProperty('addOperation');
  });
});
