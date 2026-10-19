import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { StartScreen } from './StartScreen';
import { stateWith } from '../test/fixtures';

describe('StartScreen', () => {
  it('requires an identity only for modern mode', async () => {
    const onStart = vi.fn();
    const user = userEvent.setup();
    render(<StartScreen onStart={onStart} savedGame={null} />);
    await user.click(screen.getByRole('button', { name: '新北京模式' }));
    expect(screen.getByRole('radiogroup', { name: '选择身份' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('角色姓名'), '小北');
    await user.click(screen.getByRole('button', { name: '开始游戏' }));
    expect(onStart).not.toHaveBeenCalled();
    await user.click(screen.getByRole('radio', { name: /跑腿骑手/ }));
    await user.click(screen.getByRole('button', { name: '开始游戏' }));
    expect(onStart).toHaveBeenCalledWith(expect.objectContaining({ mode: 'modern', identityId: 'courier', playerName: '小北' }));
    await user.click(screen.getByRole('button', { name: '经典模式' }));
    expect(screen.queryByRole('radiogroup', { name: '选择身份' })).not.toBeInTheDocument();
  });

  it('requires confirmation before restarting a saved game', async () => {
    const user = userEvent.setup();
    const onRestart = vi.fn();
    render(<StartScreen onStart={vi.fn()} savedGame={stateWith({ playerName: '小北', day: 9 })} onRestart={onRestart} onContinue={vi.fn()} />);
    expect(screen.getByRole('button', { name: '继续游戏' })).toBeInTheDocument();
    const restart = screen.getByRole('button', { name: '重新开始' });
    await user.click(restart);
    expect(onRestart).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '取消' }));
    expect(onRestart).not.toHaveBeenCalled();
    expect(restart).toHaveFocus();
    await user.click(screen.getByRole('button', { name: '重新开始' }));
    await user.click(screen.getByRole('button', { name: '确认重新开始' }));
    expect(onRestart).toHaveBeenCalledOnce();
  });
});
