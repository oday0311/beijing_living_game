import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { classicState, modernState } from '../test/fixtures';
import { renderAppWithState } from '../test/render-game';

afterEach(cleanup);

describe('ServiceDialog', () => {
  it('transfers accounts and reports rejected transfers', async () => {
    const { user } = renderAppWithState(modernState({ locationId: 'xizhimen', cash: 100, bank: 0 }));
    await user.click(screen.getByRole('button', { name: '银行' }));
    await user.selectOptions(screen.getByLabelText('转出账户'), 'cash');
    await user.selectOptions(screen.getByLabelText('转入账户'), 'bank');
    await user.clear(screen.getByLabelText('金额'));
    await user.type(screen.getByLabelText('金额'), '200');
    await user.click(screen.getByRole('button', { name: '确认转账' }));
    expect(screen.getByRole('alert')).toHaveTextContent('余额不足');
    expect(screen.getByText('¥100')).toBeInTheDocument();
  });

  it('requires confirmation for repayment above half of liquid assets', async () => {
    const { user } = renderAppWithState(modernState({ locationId: 'xizhimen', cash: 1000, bank: 0, wallet: 0, debt: 900 }));
    await user.click(screen.getByRole('button', { name: '还债' }));
    await user.clear(screen.getByLabelText('金额'));
    await user.type(screen.getByLabelText('金额'), '600');
    await user.click(screen.getByRole('button', { name: '确认还债' }));
    expect(screen.getByRole('dialog', { name: '确认大额支出' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '继续支出' }));
    expect(screen.getByText('¥400')).toBeInTheDocument();
    expect(screen.getByText('¥300')).toBeInTheDocument();
  });

  it('offers classic treatment and housing but no borrow command', async () => {
    const { user } = renderAppWithState(classicState({ locationId: 'xizhimen', health: 99, cash: 4000 }));
    await user.click(screen.getByRole('button', { name: '医院' }));
    expect(screen.getByText(/每点 ¥3,500/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '取消' }));
    await user.click(screen.getByRole('button', { name: '住房' }));
    expect(screen.getByRole('button', { name: '确认扩容' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '借款' })).not.toBeInTheDocument();
  });

  it('borrows in modern mode and keeps the command error visible on rejection', async () => {
    const { user } = renderAppWithState(modernState({ locationId: 'xizhimen', cash: 100, debt: 0 }));
    await user.click(screen.getByRole('button', { name: '借款' }));
    await user.clear(screen.getByLabelText('金额'));
    await user.type(screen.getByLabelText('金额'), '999999');
    await user.click(screen.getByRole('button', { name: '确认借款' }));
    expect(screen.getByRole('alert')).toHaveTextContent('借款上限');
    expect(screen.getByText('¥100')).toBeInTheDocument();
  });

  it('shows the exact housing cost and confirms a large cash charge despite bank savings', async () => {
    const { user } = renderAppWithState(classicState({ locationId: 'xizhimen', cash: 30_000, bank: 100_000, capacity: 100 }));
    await user.click(screen.getByRole('button', { name: '住房' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('¥25,000');
    await user.click(screen.getByRole('button', { name: '确认扩容' }));
    expect(screen.getByRole('dialog', { name: '确认大额支出' })).toBeInTheDocument();
    expect(screen.getByText('¥30,000')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '继续支出' }));
    expect(screen.getByText('¥5,000')).toBeInTheDocument();
    expect(screen.getByText('0 / 110')).toBeInTheDocument();
  });
});
