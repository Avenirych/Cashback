import { EntityManager, Repository } from 'typeorm';
import { BalanceService } from './balance.service';
import { BalanceOperation } from './balance.entity';
import { fromPence, toPence } from './money';

describe('GBP reward ledger', () => {
  const service = new BalanceService({} as Repository<BalanceOperation>);

  it.each([
    ['9.99', 999], ['10', 1000], [10, 1000], ['0.01', 1], ['6.50', 650],
  ])('converts %s to exact pence', (input, expected) => {
    expect(toPence(input)).toBe(expected);
    expect(toPence(fromPence(expected))).toBe(expected);
  });

  it.each([-10, 0.001, NaN, Infinity, '1e3', '10.001', null, {}, '-1', ''])(
    'rejects invalid money %s', (input) => expect(() => toPence(input)).toThrow(),
  );

  it('aggregates only confirmed GBP cashback and bonuses less reservations', async () => {
    const find = jest.fn().mockResolvedValue([
      { type: 'cashback', amount: '6.50' },
      { type: 'bonus', amount: '4.50' },
      { type: 'withdraw', amount: '1.00' },
    ]);
    expect(await service.availablePence({ find } as unknown as EntityManager, 7)).toBe(1000);
    expect(find).toHaveBeenCalledWith(BalanceOperation, {
      where: { user: { id: 7 }, status: 'confirmed', currency: 'GBP' },
    });
  });
});
