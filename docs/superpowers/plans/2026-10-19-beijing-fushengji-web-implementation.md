# 北京浮生记网页版 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `beijing-game` 中交付一款可离线游玩的《北京浮生记》响应式网页重写版，包含规则可核对的经典模式和启用六项新机制的新北京模式。

**Architecture:** 使用 React + TypeScript 构建界面，将所有状态变化放入无 DOM 依赖的纯函数规则引擎。经典与现代内容实现同一个 `ContentPack` 契约，本地存档由版本化适配器负责，React 只分发命令和展示结果。

**Tech Stack:** React, TypeScript, Vite, Vitest, Testing Library, fast-check, Zod, Lucide React, Playwright, CSS

## Global Constraints

- 纯前端单机应用；首版不得引入服务器、登录、云同步或在线排行榜。
- 经典模式固定为 8 类商品、10 个站点、40 天，并保持旧版有效规则和主要文案。
- 新北京模式固定为 12 类商品、4 条线路上的 12 个站点、4 个身份和至少 36 个原创事件。
- 新北京模式必须实现天气与空气质量、信用、热点趋势、多条地铁线、手机支付、身份与职业六项机制。
- 桌面端使用行情/库存双栏；手机端使用行情/存货/城市标签，主操作不得遮挡内容。
- 视觉使用“地铁调度台 × 套色版画”；不复制或引用旧 BMP、ICO、照片、背景和音效。
- 项目整体按 GNU GPL v2 发布，保留原作者、改编说明、无担保声明和资产许可清单。
- 自动化验收覆盖 1440px、768px、390px 三档视口，以及完整开局、买卖、换站、恢复和结算流程。
- 每个任务均先写失败测试，再写最小实现；任务结束前运行该任务的聚焦测试和全量测试。

---

## File Map

```text
beijing-game/
├── index.html                         # Vite 入口
├── package.json                       # 依赖与脚本
├── eslint.config.js                   # ESLint flat config
├── playwright.config.ts               # 三档视口浏览器测试
├── vite.config.ts                     # Vite/Vitest 配置
├── LICENSE                            # GNU GPL v2 全文
├── NOTICE.md                          # 原作署名、改编和资产许可
├── public/assets/events/*.webp        # 新生成的套色版画事件图
├── src/
│   ├── main.tsx                       # React 挂载
│   ├── App.tsx                        # 启动恢复与顶层路由
│   ├── test/fixtures.ts               # 引擎测试状态、随机数与内存存储
│   ├── test/render-game.tsx            # UI 测试 Provider 和 dispatch spy
│   ├── styles/*.css                   # tokens、布局、组件、响应式
│   ├── engine/
│   │   ├── types.ts                   # 领域类型与命令契约
│   │   ├── rng.ts                     # 可重放随机数
│   │   ├── create-game.ts             # 新局初始化
│   │   ├── market.ts                  # 价格、供应、趋势修正
│   │   ├── transactions.ts            # 买卖与资金服务
│   │   ├── services.ts                # 银行、医院、住房
│   │   ├── modern.ts                  # 六项现代机制
│   │   ├── day-cycle.ts               # 换站和每日结算
│   │   └── reducer.ts                 # 统一命令入口
│   ├── content/
│   │   ├── contract.ts                # ContentPack 契约
│   │   ├── classic/index.ts           # 旧版数据包
│   │   └── modern/index.ts            # 新北京数据包
│   ├── persistence/
│   │   ├── schema.ts                  # Zod 存档结构
│   │   └── storage.ts                 # 当前/备份存档与排行榜
│   ├── game/
│   │   ├── GameProvider.tsx           # 引擎与自动保存桥接
│   │   └── useGame.ts                 # UI 命令 API
│   └── ui/
│       ├── StartScreen.tsx             # 模式、姓名、身份、继续
│       ├── GameShell.tsx               # 主交易台布局
│       ├── StatusStrip.tsx             # 数字状态区
│       ├── MarketTable.tsx             # 行情表
│       ├── InventoryTable.tsx          # 库存表
│       ├── TradeDialog.tsx             # 买卖数量与支付方式
│       ├── ServiceDialog.tsx           # 银行、医院、住房
│       ├── SubwayMap.tsx               # 线路和换站确认
│       ├── EventDialog.tsx             # 事件队列
│       ├── JournalDrawer.tsx           # 日记/流水
│       ├── SettingsDialog.tsx          # 音效与减少动画
│       ├── ScoreboardDialog.tsx        # 本地排行榜
│       ├── AboutDialog.tsx             # GPL 与署名
│       └── EndGameDialog.tsx           # 结算与再开一局
└── tests/e2e/game.spec.ts              # Playwright 主流程与视口测试
```

---

### Task 1: 工程骨架、许可证和测试运行器

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `tsconfig.json`
- Create: `eslint.config.js`
- Create: `vite.config.ts`
- Create: `playwright.config.ts`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/test/setup.ts`
- Create: `src/App.test.tsx`
- Create: `LICENSE`
- Create: `NOTICE.md`

**Interfaces:**
- Produces: `App(): JSX.Element`; scripts `dev`, `build`, `test`, `test:watch`, `test:e2e`, `lint`.
- Consumes: None.

- [ ] **Step 1: 创建依赖清单和测试脚本**

Run:

```bash
pnpm add react react-dom lucide-react zod
pnpm add -D typescript vite @vitejs/plugin-react @types/react @types/react-dom vitest jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom fast-check @playwright/test eslint @eslint/js globals typescript-eslint eslint-plugin-react-hooks
```

Set these scripts in `package.json`:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "lint": "eslint ."
  }
}
```

- [ ] **Step 2: 写入失败的应用烟雾测试**

```tsx
// src/App.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('shows both playable modes', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: '北京浮生记' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '经典模式' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '新北京模式' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: 运行测试并确认因入口未实现而失败**

Run: `pnpm test -- src/App.test.tsx`

Expected: FAIL because `App` or the queried controls do not exist.

- [ ] **Step 4: 创建最小 Vite/React 入口和测试配置**

```tsx
// src/App.tsx
export function App() {
  return (
    <main>
      <h1>北京浮生记</h1>
      <button type="button">经典模式</button>
      <button type="button">新北京模式</button>
    </main>
  );
}
```

Configure Vitest with `environment: 'jsdom'` and `setupFiles: ['./src/test/setup.ts']`; import `@testing-library/jest-dom/vitest` from the setup file.

Configure ESLint flat config for browser and Node globals, TypeScript recommended rules and React Hooks recommended rules. Ignore `dist`, `coverage`, `test-results` and `playwright-report`.

- [ ] **Step 5: 加入 GPL v2 与署名文件**

Copy `/Users/huangzhifang/Desktop/beijing_fushengji/license.txt` to `LICENSE` without changing its text. In `NOTICE.md`, state that the original game was written by 郭祥昊 in 2000–2001, this is a 2026 web adaptation, the project carries no warranty, and no original bitmap, icon, photograph, background, or sound asset is reused.

- [ ] **Step 6: 验证骨架**

Run separately:

```bash
pnpm test -- src/App.test.tsx
pnpm build
pnpm lint
```

Expected: all commands exit 0.

- [ ] **Step 7: 提交**

```bash
git add package.json pnpm-lock.yaml index.html tsconfig.json eslint.config.js vite.config.ts playwright.config.ts src LICENSE NOTICE.md
git commit -m "chore: scaffold the web game"
```

---

### Task 2: 领域类型、确定性随机数与新局初始化

**Files:**
- Create: `src/engine/types.ts`
- Create: `src/engine/rng.ts`
- Create: `src/engine/create-game.ts`
- Create: `src/engine/create-game.test.ts`
- Create: `src/content/contract.ts`
- Create: `src/test/fixtures.ts`

**Interfaces:**
- Produces: `Mode`, `Account`, `GameState`, `GameCommand`, `CommandResult`, `ContentPack`, `RandomSource`, `SeededRng`, `createGame(pack, options)` and shared test fixtures.
- Consumes: None.

- [ ] **Step 1: 写入新局与随机数失败测试**

```ts
import { describe, expect, it } from 'vitest';
import { createGame } from './create-game';
import { SeededRng } from './rng';
import type { ContentPack } from '../content/contract';

describe('game initialization', () => {
  it('creates a reproducible visible day-one state', () => {
    const first = new SeededRng(20261019);
    const second = new SeededRng(20261019);
    expect([first.int(100), first.int(100), first.int(100)])
      .toEqual([second.int(100), second.int(100), second.int(100)]);

    const state = createGame(stubPack as ContentPack, {
      playerName: '铁牛', seed: 20261019, identityId: null,
    });
    expect(state.day).toBe(1);
    expect(state.daysTotal).toBe(40);
    expect(state.inventory).toEqual({});
    expect(state.pendingEvents).toEqual([]);
  });
});
```

- [ ] **Step 2: 运行聚焦测试确认失败**

Run: `pnpm test -- src/engine/create-game.test.ts`

Expected: FAIL with missing module/type errors.

- [ ] **Step 3: 定义稳定的领域契约**

Use these required shapes in `types.ts`:

```ts
export type Mode = 'classic' | 'modern';
export type Account = 'cash' | 'bank' | 'wallet';
export type CreditTier = 'D' | 'C' | 'B' | 'A' | 'S';

export interface InventoryLot { quantity: number; averageCost: number }
export interface Trend { id: string; category: string; multiplier: number; daysLeft: number; reason: string }
export interface GameEvent { id: string; kind: 'market'|'health'|'money'|'weather'|'identity'|'system'; title: string; body: string; artId: string }
export interface JournalEntry { id: string; day: number; title: string; detail: string; delta?: Partial<Record<Account|'debt'|'health'|'fame'|'credit', number>> }

export interface GameState {
  schemaVersion: 1;
  mode: Mode;
  playerName: string;
  seed: number;
  rngState: number;
  day: number;
  daysTotal: 40;
  locationId: string | null;
  cash: number;
  bank: number;
  wallet: number;
  debt: number;
  health: number;
  fame: number;
  credit: CreditTier;
  capacity: number;
  inventory: Record<string, InventoryLot>;
  market: Record<string, number>;
  weatherId: string | null;
  trends: Trend[];
  identityId: string | null;
  walletFrozenDays: number;
  modern: {
    onTimeRepayments: number;
    dailyWalletTransferred: number;
    shopkeeperCapacityBonus: number;
    freeTransitUses: number;
    revealTrendDaysBonus: number;
  } | null;
  pendingEvents: GameEvent[];
  journal: JournalEntry[];
  status: 'playing'|'won'|'lost';
  finalScore: number | null;
}
```

Define `ContentPack` with `mode`, `daysTotal`, `initial`, `goods`, `locations`, `identities`, `weather`, and `events`. Define `GameCommand` as a discriminated union for `BUY`, `SELL`, `TRANSFER`, `REPAY_DEBT`, `BORROW`, `HEAL`, `UPGRADE_HOUSING`, `TRAVEL`, and `ACK_EVENT`.

Use these exact supporting contracts:

```ts
export interface GoodDefinition { id: string; name: string; category: string; basePrice: number; priceRange: number }
export interface LocationDefinition {
  id: string; name: string; lineIds: string[]; neighborIds: string[];
  acceptedAccounts: Account[];
  services: Array<'bank'|'hospital'|'housing'>;
  demand: Record<string, number>;
}
export interface IdentityDefinition {
  id: string; name: string; description: string;
  effect: { kind: 'transit'|'trend-visibility'|'capacity'|'credit-growth'; value: number };
}
export interface EventDefinition {
  id: string; kind: GameEvent['kind']; title: string; body: string; artId: string;
  frequency: number;
  effect: { kind: string; target?: string; multiplier?: number; amount?: number; duration?: number };
}
export interface ContentPack {
  mode: Mode; daysTotal: 40;
  initial: Pick<GameState, 'cash'|'bank'|'wallet'|'debt'|'health'|'fame'|'credit'|'capacity'|'locationId'>;
  goods: GoodDefinition[]; locations: LocationDefinition[]; identities: IdentityDefinition[];
  weather: EventDefinition[];
  events: { market: EventDefinition[]; health: EventDefinition[]; money: EventDefinition[]; identity: EventDefinition[] };
}
export interface RandomSource { readonly state: number; int(maxExclusive: number): number }
export type GameCommand =
  | { type: 'BUY'; itemId: string; quantity: number; account: Account }
  | { type: 'SELL'; itemId: string; quantity: number; account: Account }
  | { type: 'TRANSFER'; from: Account; to: Account; amount: number }
  | { type: 'REPAY_DEBT'; amount: number; account: Account }
  | { type: 'BORROW'; amount: number }
  | { type: 'HEAL'; points: number; account: Account }
  | { type: 'UPGRADE_HOUSING'; account: Account }
  | { type: 'TRAVEL'; targetId: string }
  | { type: 'ACK_EVENT' };
export type EngineErrorCode =
  | 'INVALID_QUANTITY' | 'ITEM_UNAVAILABLE' | 'INSUFFICIENT_FUNDS'
  | 'CAPACITY_EXCEEDED' | 'INSUFFICIENT_INVENTORY' | 'ACCOUNT_UNSUPPORTED'
  | 'WALLET_FROZEN' | 'TRANSFER_LIMIT' | 'CREDIT_LIMIT'
  | 'SAME_LOCATION' | 'UNKNOWN_LOCATION' | 'FEATURE_UNAVAILABLE' | 'GAME_ENDED';
export type CommandResult =
  | { ok: true; state: GameState }
  | { ok: false; state: GameState; error: { code: EngineErrorCode; message: string } };
```

- [ ] **Step 4: 实现 xorshift32 随机数与 `createGame`**

`SeededRng.int(maxExclusive)` must reject non-positive bounds, return an integer in `[0, maxExclusive)`, and expose the updated unsigned state. `createGame` must normalize the name, copy the content pack's initial values, generate the initial market, and never mutate content data.

Create `src/test/fixtures.ts` with `stubPack`, `stateWith(partial)`, `classicState(partial)`, `modernState(partial)`, `trend(partial)`, `event(title)`, `MaxRng`, `ScriptedRng` and a standards-compatible `memoryStorage`. `MaxRng.int(n)` returns `n - 1`; `ScriptedRng` consumes normalized floats and returns `Math.floor(value * n)`; `memoryStorage` implements the `Storage` interface over a `Map<string,string>`. Later test snippets import these helpers from this file.

- [ ] **Step 5: 验证类型和初始化不变量**

Run separately:

```bash
pnpm test -- src/engine/create-game.test.ts
pnpm build
```

Expected: PASS and a clean TypeScript build.

- [ ] **Step 6: 提交**

```bash
git add src/engine src/content/contract.ts
git commit -m "feat: define deterministic game state"
```

---

### Task 3: 经典模式数据包与价格生成

**Files:**
- Create: `src/content/classic/index.ts`
- Create: `src/content/classic/classic.test.ts`
- Create: `src/engine/market.ts`
- Create: `src/engine/market.test.ts`

**Interfaces:**
- Produces: `classicContent: ContentPack`; `generateMarket(pack, rng, context): Record<string, number>`; `inventoryCount(state): number`.
- Consumes: `ContentPack`, `GameState`, `SeededRng` from Task 2.

- [ ] **Step 1: 写入经典数据和价格边界失败测试**

```ts
it('matches the eight original goods and ten stations', () => {
  expect(classicContent.goods.map((item) => item.name)).toEqual([
    '进口香烟', '走私汽车', '盗版VCD、游戏', '假白酒（剧毒！）',
    '《上海小宝贝》（禁书）', '进口玩具', '水货手机', '伪劣化妆品',
  ]);
  expect(classicContent.locations).toHaveLength(10);
  expect(classicContent.events.market).toHaveLength(18);
  expect(classicContent.events.health).toHaveLength(12);
  expect(classicContent.events.money).toHaveLength(7);
});

it('uses the original exclusive upper price ranges', () => {
  const prices = generateMarket(classicContent, new MaxRng(), { day: 1, trends: [], weatherId: null });
  expect(prices).toMatchObject({ cigarettes: 449, cars: 29999, vcd: 54, liquor: 3499 });
});
```

- [ ] **Step 2: 运行测试确认经典数据缺失**

Run: `pnpm test -- src/content/classic/classic.test.ts src/engine/market.test.ts`

Expected: FAIL because `classicContent` and `generateMarket` are missing.

- [ ] **Step 3: 转录旧版固定数据**

Transcribe from `/Users/huangzhifang/Desktop/beijing_fushengji/SelectionDlg.cpp` after GB18030 decoding:

- initial values and goods: lines 320–360;
- 18 market events: lines 107–141;
- 12 health events: lines 143–167;
- 7 money events: lines 169–189;
- price bases/ranges: lines 1177–1205;
- locations from `DoRandomEvent`: lines 1548–1572.

Use stable ASCII IDs and preserve Chinese display names. Store frequencies and effects as structured fields rather than executable callbacks. Add a source comment containing the exact original file and line span above each transcribed table.

Set the visible classic initial state to cash 2,000, bank 0, wallet 0, debt 5,500, health 100, fame 100, credit `C`, capacity 100 and location `null`. The UI labels the null starting location “初到北京” and permits the first trip to any of the 10 stations, matching the source's `m_MyCurrentLoc = -1`. Wallet and credit remain hidden and unavailable in classic mode; debt 5,500 represents the source's 5,000 principal after its initialization interest pass.

- [ ] **Step 4: 实现经典市场生成**

Generate every base price as `base + rng.int(range)`. On normal days perform three independent omissions exactly like the source, so duplicate omission rolls may leave more than five goods. When `day >= 39`, omit none. Remove entries whose computed price is zero.

- [ ] **Step 5: 验证经典数据与价格**

Run separately:

```bash
pnpm test -- src/content/classic/classic.test.ts src/engine/market.test.ts
pnpm test
```

Expected: all tests pass.

- [ ] **Step 6: 提交**

```bash
git add src/content/classic src/engine/market.ts src/engine/market.test.ts
git commit -m "feat: port classic market content"
```

---

### Task 4: 买卖、资金、医院和住房服务

**Files:**
- Create: `src/engine/transactions.ts`
- Create: `src/engine/transactions.test.ts`
- Create: `src/engine/services.ts`
- Create: `src/engine/services.test.ts`
- Create: `src/engine/reducer.ts`
- Create: `src/engine/reducer.test.ts`

**Interfaces:**
- Produces: `buy`, `sell`, `transfer`, `repayDebt`, `borrow`, `heal`, `upgradeHousing`, `reduceGameState`.
- Consumes: `GameState`, `GameCommand`, `CommandResult`, `ContentPack` from Task 2.

- [ ] **Step 1: 写入交易失败测试**

```ts
it('merges purchases using integer weighted average cost', () => {
  const state = stateWith({ cash: 10_000, capacity: 100, inventory: { vcd: { quantity: 10, averageCost: 20 } }, market: { vcd: 40 } });
  const result = buy(state, { itemId: 'vcd', quantity: 5, account: 'cash' }, classicContent);
  expect(result.ok).toBe(true);
  if (result.ok) expect(result.state.inventory.vcd).toEqual({ quantity: 15, averageCost: 26 });
});

it('leaves state unchanged when capacity is insufficient', () => {
  const state = stateWith({ capacity: 10, inventory: { vcd: { quantity: 10, averageCost: 20 } } });
  const result = buy(state, { itemId: 'vcd', quantity: 1, account: 'cash' }, classicContent);
  expect(result).toMatchObject({ ok: false, error: { code: 'CAPACITY_EXCEEDED' } });
  expect(result.state).toBe(state);
});
```

- [ ] **Step 2: 运行交易测试确认失败**

Run: `pnpm test -- src/engine/transactions.test.ts src/engine/services.test.ts`

Expected: FAIL with missing implementations.

- [ ] **Step 3: 实现原子买卖和账户转移**

Validate positive integer quantity, listed market item, accepted payment account, available balance, inventory and capacity before cloning state. Buying uses `Math.trunc((oldCost*oldQty + price*qty)/(oldQty+qty))`; selling credits the chosen supported account and removes zero-quantity lots.

- [ ] **Step 4: 实现服务操作**

Classic service rules:

- repayment cannot exceed cash or debt;
- treatment costs 3,500 cash per health point and caps health at 100;
- capacity upgrades stop at 140, add 10, and use the original cash rule from `SelectionDlg.cpp:2062–2105`;
- bank transfer cannot overdraw either account.

Modern borrowing and payment rules are delegated to Task 7; return `FEATURE_UNAVAILABLE` for those commands in classic mode.

- [ ] **Step 5: 用统一 reducer 分发命令**

```ts
export function reduceGameState(
  state: GameState,
  command: GameCommand,
  pack: ContentPack,
): CommandResult;
```

Ensure failed commands return the exact original state reference and successful commands append one journal entry.

- [ ] **Step 6: 运行聚焦、性质与全量测试**

Add a fast-check property asserting that a failed purchase never changes balances or inventory.

Run separately:

```bash
pnpm test -- src/engine/transactions.test.ts src/engine/services.test.ts src/engine/reducer.test.ts
pnpm test
```

Expected: all tests pass.

- [ ] **Step 7: 提交**

```bash
git add src/engine
git commit -m "feat: add atomic trading and services"
```

---

### Task 5: 经典日循环、事件队列和结算

**Files:**
- Create: `src/engine/day-cycle.ts`
- Create: `src/engine/day-cycle.test.ts`
- Modify: `src/engine/reducer.ts`
- Modify: `src/engine/reducer.test.ts`

**Interfaces:**
- Produces: `travel(state, targetId, pack, rng): CommandResult`; `settleDay(state, pack, rng): GameState`; `calculateScore(state): number`; `acknowledgeEvent(state): GameState`.
- Consumes: market and event tables from Tasks 3–4.

- [ ] **Step 1: 写入经典单日顺序失败测试**

```ts
it('settles classic travel in source order', () => {
  const state = classicState({ day: 1, debt: 5_500, bank: 1_000, locationId: 'xizhimen' });
  const result = travel(state, 'fuxingmen', classicContent, new ScriptedRng([0.9]));
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.state.day).toBe(2);
    expect(result.state.debt).toBe(6_050);
    expect(result.state.bank).toBe(1_010);
    expect(result.state.locationId).toBe('fuxingmen');
  }
});

it('rejects travelling to the current station without advancing time', () => {
  const result = travel(classicState({ day: 8, locationId: 'fuxingmen' }), 'fuxingmen', classicContent, new SeededRng(1));
  expect(result).toMatchObject({ ok: false, error: { code: 'SAME_LOCATION' } });
  expect(result.state.day).toBe(8);
});
```

- [ ] **Step 2: 运行测试确认日循环缺失**

Run: `pnpm test -- src/engine/day-cycle.test.ts`

Expected: FAIL.

- [ ] **Step 3: 实现经典结算顺序**

Match `SelectionDlg.cpp:1439–1544`: generate prices, apply debt/bank interest, market events, health event, money event, debt penalty, then advance the day. Queue every visible message as a `GameEvent`; do not stop later state calculations while waiting for UI acknowledgement.

Use `Math.trunc` after each percentage operation. Preserve the source event trigger rule as `rng.int(pool) % frequency === 0`, with pool 950 for classic market events and 1,000 for classic health and money events. Stop after the first triggered health event and first triggered money event, matching the source loops.

- [ ] **Step 4: 实现低健康、死亡和到期清仓**

Match `SelectionDlg.cpp:1548–1641` for forced hospitalization thresholds and delays. At day 40, expose all goods, sell every remaining lot at the final market price, set `finalScore = cash + bank + wallet - debt`, and set status to `won` when score is positive, otherwise `lost`.

- [ ] **Step 5: 加入黄金回放测试**

Use a scripted RNG sequence and assert a 5-day fixture containing starting state, each travel target, final balances, health, inventory, and queued event IDs. Store the fixture inline in the test so a behavioral change creates a readable diff.

- [ ] **Step 6: 验证经典循环**

Run separately:

```bash
pnpm test -- src/engine/day-cycle.test.ts src/engine/reducer.test.ts
pnpm test
```

Expected: all tests pass.

- [ ] **Step 7: 提交**

```bash
git add src/engine/day-cycle.ts src/engine/day-cycle.test.ts src/engine/reducer.ts src/engine/reducer.test.ts
git commit -m "feat: reproduce the classic day cycle"
```

---

### Task 6: 新北京内容包

**Files:**
- Create: `src/content/modern/index.ts`
- Create: `src/content/modern/modern.test.ts`
- Modify: `src/content/contract.ts`

**Interfaces:**
- Produces: `modernContent: ContentPack` with 12 goods, 12 locations, 4 identities, weather table and 36 events.
- Consumes: `ContentPack` contract from Task 2.

- [ ] **Step 1: 写入数据完整性失败测试**

```ts
it('ships the approved modern content scope', () => {
  expect(modernContent.goods).toHaveLength(12);
  expect(new Set(modernContent.locations.flatMap((x) => x.lineIds))).toHaveLength(4);
  expect(modernContent.locations).toHaveLength(12);
  expect(modernContent.identities).toHaveLength(4);
  expect(Object.values(modernContent.events).flat()).toHaveLength(36);
});

it('does not name real people or organizations in satirical copy', () => {
  const copy = JSON.stringify(modernContent.events);
  expect(copy).not.toMatch(/有限公司|委员会|集团董事长|先生实名/);
});
```

- [ ] **Step 2: 运行数据测试确认失败**

Run: `pnpm test -- src/content/modern/modern.test.ts`

Expected: FAIL because the content pack is missing.

- [ ] **Step 3: 创建 12 类合法商品与 12 个站点**

Use these goods IDs and ranges: `coffee-beans` 80–319, `concert-ticket` 280–2,199, `camping-gear` 220–1,199, `power-bank` 60–259, `blind-box` 35–179, `vintage-clothes` 90–679, `smart-watch` 450–2,299, `skincare-set` 180–899, `pet-food` 120–599, `camera-lens` 900–5,199, `office-chair` 350–1,599, `local-snacks` 30–159.

Use four connected line IDs over 12 unique locations:

```text
line-4: 中关村、海淀黄庄、西直门
line-10: 海淀黄庄、三元桥、双井、国贸
line-2: 西直门、复兴门、朝阳门、东直门
line-6: 南锣鼓巷、朝阳门、呼家楼、通州北关
```

Give each station supported payment accounts, service flags and category demand weights. Mark 海淀黄庄 (4/10)、西直门 (4/2) and 朝阳门 (2/6) as interchanges. Use bidirectional neighbor edges in the order shown on each line and test that every location is reachable from every other location.

Set the visible modern initial state to cash 2,000, bank 0, wallet 500, debt 5,500, health 100, fame 100, credit `C`, capacity 100 and location `xizhimen`.

- [ ] **Step 4: 创建四个身份**

```text
courier 跑腿骑手: transitCostMultiplier 0.5
designer 自由设计师: revealsTrendDays +1
shopkeeper 社区店主: startingCapacity +20
graduate 应届毕业生: positiveCreditDeltaMultiplier 2
```

- [ ] **Step 5: 创建 36 个温和都市荒诞事件**

Implement exactly 16 market, 8 weather/health, 8 money/credit and 4 identity events. Required market topics: 咖啡节、临时加场、演出取消、露营季、骤雨囤货、盲盒联名、复古市集、智能表更新、护肤直播、宠物展、摄影周、居家办公、伴手礼节、物流延误、换季清仓、社区团购。 Required weather/health topics: 暴雨、热浪、寒潮、轻雾霾、晴朗大风、花粉、地铁延误、空气优良。 Required money/credit topics: 钱包冻结一天、误点订阅、银行优惠、准时还款奖励、退款到账、信用复核、租金减免、诈骗短信。 Each identity gets one event that reinforces its approved benefit. Every event must define deterministic effect fields and an `artId`.

Use this exact effect matrix; `title` is the Chinese topic above and `body` expands it into one or two sentences of mild urban absurdity without real organizations or people:

```text
market/coffee-festival        coffee-beans     ×1.8  3 days
market/extra-show             concert-ticket   ×2.5  2 days
market/show-cancelled         concert-ticket   ×0.35 2 days
market/camping-season         camping-gear     ×2.0  3 days
market/rain-stockup           power-bank       ×1.7  2 days
market/blindbox-collab        blind-box        ×2.2  3 days
market/vintage-fair           vintage-clothes  ×1.9  3 days
market/watch-update           smart-watch      ×0.55 2 days
market/skincare-stream        skincare-set     ×2.0  2 days
market/pet-expo               pet-food         ×1.8  3 days
market/photo-week             camera-lens      ×1.7  3 days
market/home-office            office-chair     ×1.6  4 days
market/souvenir-week          local-snacks     ×1.9  2 days
market/logistics-delay        all              ×1.25 2 days
market/season-clearance       apparel          ×0.50 2 days
market/community-group-buy    daily            ×0.65 2 days
health/heavy-rain             health           -2, transit fare +1 for 1 day
health/heat-wave              health           -4, drink category ×1.4 for 2 days
health/cold-snap              health           -3, outdoor category ×0.7 for 2 days
health/light-haze             health           -2, health category ×1.5 for 2 days
health/clear-wind             health           +2, outdoor category ×1.3 for 1 day
health/pollen                 health           -1, health-event weight ×1.5 for 2 days
health/subway-delay           cash             -10, journal delay notice
health/clean-air              health           +3, health-event weight ×0.5 for 1 day
money/wallet-freeze           walletFrozenDays = 1
money/subscription-mistap     wallet           -88
money/bank-promotion          bank             +200
money/repayment-reward        onTimeRepayments +1
money/refund-arrives          wallet           +160
money/credit-review           credit           -1 tier
money/rent-relief             cash             +300
money/scam-message            wallet           -min(wallet, 500)
identity/courier-route        courier           next transit fare = 0
identity/designer-radar       designer          reveal all trend days this cycle
identity/shopkeeper-shelf     shopkeeper        capacity +5, max bonus 25
identity/graduate-review      graduate          credit +1 tier when below A
```

Define six daily weather states separately: `clear`, `rain`, `heat`, `cold`, `haze`, `wind`. Each has an AQI label, health-event weight and category multipliers matching the relevant rows above; the event rows are the visible messages produced when those states cause a direct effect.

- [ ] **Step 6: 验证内容引用完整性**

Add tests that every event item/category/location reference exists, every multiplier is positive, all durations are integers, and all four event counts match 16/8/8/4.

Run separately:

```bash
pnpm test -- src/content/modern/modern.test.ts
pnpm test
```

Expected: all tests pass.

- [ ] **Step 7: 提交**

```bash
git add src/content/contract.ts src/content/modern
git commit -m "feat: add the modern Beijing content pack"
```

---

### Task 7: 新北京六项机制

**Files:**
- Create: `src/engine/modern.ts`
- Create: `src/engine/modern.test.ts`
- Modify: `src/engine/market.ts`
- Modify: `src/engine/market.test.ts`
- Modify: `src/engine/day-cycle.ts`
- Modify: `src/engine/reducer.ts`

**Interfaces:**
- Produces: `applyWeather`, `applyTrends`, `travelCost`, `creditTerms`, `borrowModern`, `settleWallet`, `applyIdentity`.
- Consumes: `modernContent`, `GameState`, `SeededRng`.

- [ ] **Step 1: 写入六机制失败测试**

```ts
it('clamps stacked trend multipliers', () => {
  expect(applyTrends(100, 'leisure', [
    trend({ category: 'leisure', multiplier: 3, daysLeft: 2 }),
    trend({ category: 'leisure', multiplier: 2, daysLeft: 1 }),
  ])).toBe(400);
});

it('gives couriers half fare and advances exactly one day', () => {
  expect(travelCost(modernContent, 'xizhimen', 'guomao', 'courier')).toBe(2);
  const result = travel(modernState({ day: 4, identityId: 'courier' }), 'guomao', modernContent, new SeededRng(3));
  expect(result.ok && result.state.day).toBe(5);
});

it('blocks wallet spending only while frozen', () => {
  const blocked = buy(modernState({ wallet: 1000, walletFrozenDays: 1 }), { itemId: 'power-bank', quantity: 1, account: 'wallet' }, modernContent);
  expect(blocked).toMatchObject({ ok: false, error: { code: 'WALLET_FROZEN' } });
});
```

- [ ] **Step 2: 运行聚焦测试确认失败**

Run: `pnpm test -- src/engine/modern.test.ts`

Expected: FAIL.

- [ ] **Step 3: 实现天气、空气质量和趋势**

Weather modifies category price by the content table and health-event weights by at most 2x. Apply trend multipliers after weather and location demand, then clamp the combined multiplier to `[0.35, 4]`. Decrement trend durations after prices are generated and remove zero-day trends.

- [ ] **Step 4: 实现线路、票价和身份**

Compute the shortest station path over the content graph. Fare is `min(8, 3 + floor(edgeCount / 4))`; courier fare is `max(1, floor(fare * 0.5))`. Travel always advances one day. Apply the other three identity benefits exactly as declared in Task 6, once per relevant operation.

- [ ] **Step 5: 实现信用、借款和手机支付**

Use this credit table:

```ts
const CREDIT_TERMS = {
  D: { limit: 0, dailyRate: 0.15 },
  C: { limit: 5_000, dailyRate: 0.10 },
  B: { limit: 15_000, dailyRate: 0.08 },
  A: { limit: 30_000, dailyRate: 0.06 },
  S: { limit: 60_000, dailyRate: 0.04 },
} as const;
```

Borrowing adds to bank balance and debt without exceeding remaining limit. Repayment events move one tier upward after three on-time repayments and one tier downward after an overdue penalty. Wallet transfer respects a daily 10,000 limit; a freeze blocks wallet debits for one settlement and then clears automatically.

- [ ] **Step 6: 加入性质测试**

Use fast-check to assert: price is always a positive integer; travel day delta is exactly one; fare remains 1–8; trend duration never becomes negative; wallet freeze never blocks cash; credit never leaves `D|C|B|A|S`.

- [ ] **Step 7: 验证全部现代机制**

Run separately:

```bash
pnpm test -- src/engine/modern.test.ts src/engine/market.test.ts src/engine/day-cycle.test.ts
pnpm test
```

Expected: all tests pass.

- [ ] **Step 8: 提交**

```bash
git add src/engine
git commit -m "feat: implement modern Beijing mechanics"
```

---

### Task 8: 版本化存档、恢复与本地排行榜

**Files:**
- Create: `src/persistence/schema.ts`
- Create: `src/persistence/storage.ts`
- Create: `src/persistence/storage.test.ts`

**Interfaces:**
- Produces: `saveGame`, `loadGame`, `restoreBackup`, `exportCorruptSave`, `clearCurrentGame`, `saveSettings`, `loadSettings`, `recordScore`, `loadScores`.
- Consumes: `GameState` from Task 2.

- [ ] **Step 1: 写入存档失败测试**

```ts
it('keeps the previous valid save as backup', () => {
  saveGame(stateWith({ day: 3 }), memoryStorage);
  saveGame(stateWith({ day: 4 }), memoryStorage);
  expect(loadGame(memoryStorage)).toMatchObject({ kind: 'ok', state: { day: 4 } });
  expect(restoreBackup(memoryStorage)).toMatchObject({ day: 3 });
});

it('preserves malformed raw data for export', () => {
  memoryStorage.setItem(CURRENT_SAVE_KEY, '{broken');
  const result = loadGame(memoryStorage);
  expect(result).toMatchObject({ kind: 'corrupt', raw: '{broken' });
  expect(memoryStorage.getItem(CURRENT_SAVE_KEY)).toBe('{broken');
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test -- src/persistence/storage.test.ts`

Expected: FAIL.

- [ ] **Step 3: 实现 Zod schema 与双份存档**

Use keys `beijing-fushengji.save.v1`, `beijing-fushengji.save.backup.v1`, `beijing-fushengji.settings.v1`, and `beijing-fushengji.scores.v1`. Validate every loaded save. Before replacing a valid current save, copy it to backup. Never overwrite a malformed current save during automatic recovery.

- [ ] **Step 4: 实现排行榜**

Store `{ id, playerName, mode, score, health, fame, finishedAt }`; sort descending by score, keep 10 per mode, and use `id` to avoid duplicate insertion after refresh.

- [ ] **Step 5: 验证存档与排行榜**

Run separately:

```bash
pnpm test -- src/persistence/storage.test.ts
pnpm test
```

Expected: all tests pass.

- [ ] **Step 6: 提交**

```bash
git add src/persistence
git commit -m "feat: add resilient local saves and scores"
```

---

### Task 9: React 游戏会话与开局流程

**Files:**
- Create: `src/game/GameProvider.tsx`
- Create: `src/game/useGame.ts`
- Create: `src/game/GameProvider.test.tsx`
- Create: `src/test/render-game.tsx`
- Create: `src/ui/StartScreen.tsx`
- Create: `src/ui/StartScreen.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

**Interfaces:**
- Produces: `GameProvider`, `useGame(): { state, dispatch, startGame, abandonGame }`, `StartScreen`.
- Consumes: reducer from Task 4, content packs from Tasks 3/6, storage from Task 8.

- [ ] **Step 1: 写入开局和恢复失败测试**

```tsx
it('requires an identity only for modern mode', async () => {
  const user = userEvent.setup();
  render(<StartScreen onStart={onStart} savedGame={null} />);
  await user.click(screen.getByRole('button', { name: '新北京模式' }));
  expect(screen.getByRole('radiogroup', { name: '选择身份' })).toBeInTheDocument();
  await user.click(screen.getByRole('radio', { name: /跑腿骑手/ }));
  await user.type(screen.getByLabelText('角色姓名'), '小北');
  await user.click(screen.getByRole('button', { name: '开始游戏' }));
  expect(onStart).toHaveBeenCalledWith(expect.objectContaining({ mode: 'modern', identityId: 'courier' }));
});
```

- [ ] **Step 2: 运行测试确认 UI 尚未实现**

Run: `pnpm test -- src/game/GameProvider.test.tsx src/ui/StartScreen.test.tsx`

Expected: FAIL.

- [ ] **Step 3: 实现 Provider 和自动保存**

Initialize from `loadGame`; expose a stable dispatch that calls `reduceGameState`; save after every successful command; clear current save only after explicit confirmation or a completed game has been recorded.

Create `src/test/render-game.tsx` with `renderGame(initialState)` and `renderAppWithState(initialState)`. `renderGame` wraps children in a test `GameProvider`, creates `const user = userEvent.setup()` and a Vitest dispatch spy, and returns `{ user, dispatch, ...renderResult }`. Tests must destructure these values rather than relying on globals.

- [ ] **Step 4: 实现直接可玩的开局界面**

Provide continue, mode segmented control, name input, modern identity radio choices, start, local scoreboard and about actions. “重新开始” must open a confirmation dialog and remain visually secondary to “继续游戏”. When `loadGame` returns `corrupt`, show three explicit actions: restore the valid backup, download the malformed raw value as a timestamped JSON text file, or confirm a new game without first overwriting the malformed value.

- [ ] **Step 5: 验证开局与恢复**

Run separately:

```bash
pnpm test -- src/App.test.tsx src/game/GameProvider.test.tsx src/ui/StartScreen.test.tsx
pnpm test
```

Expected: all tests pass.

- [ ] **Step 6: 提交**

```bash
git add src/App.tsx src/App.test.tsx src/game src/ui/StartScreen.tsx src/ui/StartScreen.test.tsx
git commit -m "feat: add game start and resume flows"
```

---

### Task 10: 主交易台、交易与服务对话框

**Files:**
- Create: `src/ui/GameShell.tsx`
- Create: `src/ui/GameShell.test.tsx`
- Create: `src/ui/StatusStrip.tsx`
- Create: `src/ui/MarketTable.tsx`
- Create: `src/ui/InventoryTable.tsx`
- Create: `src/ui/TradeDialog.tsx`
- Create: `src/ui/TradeDialog.test.tsx`
- Create: `src/ui/ServiceDialog.tsx`
- Create: `src/ui/ServiceDialog.test.tsx`
- Create: `src/styles/tokens.css`
- Create: `src/styles/layout.css`
- Create: `src/styles/components.css`
- Modify: `src/App.tsx`

**Interfaces:**
- Produces: accessible desktop double-table board, mobile tabs, trade and service commands.
- Consumes: `useGame` from Task 9; engine errors from Tasks 4/7.

- [ ] **Step 1: 写入交易台失败测试**

```tsx
it('buys the selected quantity and reports engine errors', async () => {
  const { user } = renderGame(modernState({ cash: 500, market: { 'power-bank': 100 } }));
  await user.click(screen.getByRole('row', { name: /充电宝/ }));
  await user.click(screen.getByRole('button', { name: '买进' }));
  await user.clear(screen.getByLabelText('数量'));
  await user.type(screen.getByLabelText('数量'), '6');
  await user.click(screen.getByRole('button', { name: '确认买进' }));
  expect(screen.getByRole('alert')).toHaveTextContent('余额不足');
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test -- src/ui/GameShell.test.tsx src/ui/TradeDialog.test.tsx src/ui/ServiceDialog.test.tsx`

Expected: FAIL.

- [ ] **Step 3: 实现稳定主布局和状态区**

Use semantic tables for market and inventory. Status fields must have stable labels and tabular numerals. Classic mode hides wallet, credit and weather rather than displaying inert controls. Use Lucide icons for services and icon-only tools; every icon-only button gets `aria-label` and a native or custom tooltip.

- [ ] **Step 4: 实现买卖对话框**

The dialog shows item, unit price, owned quantity, capacity, account balance, max quantity, numeric input and account selector when more than one account is accepted. Disable confirmation only for syntactically invalid input; submit valid commands to the engine and display its structured rejection in `role="alert"`.

- [ ] **Step 5: 实现银行、还债、借款、医院和住房**

Render only commands available in the active mode. Preserve focus on close, trap focus while open, support Escape, and require confirmation for operations that spend more than half of liquid assets.

- [ ] **Step 6: 实现响应式规则**

At `min-width: 900px`, show market and inventory side-by-side. Below 900px, render tabs named 行情、存货、城市 and one content region at a time. Reserve bottom padding equal to the sticky action bar height; do not scale fonts with viewport width.

- [ ] **Step 7: 验证组件与构建**

Run separately:

```bash
pnpm test -- src/ui/GameShell.test.tsx src/ui/TradeDialog.test.tsx src/ui/ServiceDialog.test.tsx
pnpm build
pnpm test
```

Expected: all commands pass.

- [ ] **Step 8: 提交**

```bash
git add src/App.tsx src/ui src/styles
git commit -m "feat: build the responsive trading desk"
```

---

### Task 11: 地铁图、事件版画、日记和视觉完成度

**Files:**
- Create: `src/ui/SubwayMap.tsx`
- Create: `src/ui/SubwayMap.test.tsx`
- Create: `src/ui/EventDialog.tsx`
- Create: `src/ui/EventDialog.test.tsx`
- Create: `src/ui/JournalDrawer.tsx`
- Create: `src/ui/JournalDrawer.test.tsx`
- Create: `src/audio/sounds.ts`
- Create: `src/audio/sounds.test.ts`
- Create: `src/styles/art.css`
- Create: `public/assets/events/classic-market.webp`
- Create: `public/assets/events/classic-health.webp`
- Create: `public/assets/events/classic-money.webp`
- Create: `public/assets/events/classic-system.webp`
- Create: `public/assets/events/modern-market.webp`
- Create: `public/assets/events/modern-weather.webp`
- Create: `public/assets/events/modern-credit.webp`
- Create: `public/assets/events/modern-identity.webp`
- Modify: `NOTICE.md`

**Interfaces:**
- Produces: travel confirmation, sequential event acknowledgement, filterable journal, eight original bitmap illustrations.
- Consumes: locations/events from content packs and `useGame`.

- [ ] **Step 1: 写入地图和事件队列失败测试**

```tsx
it('shows fare before travel and dispatches only after confirmation', async () => {
  const { user, dispatch } = renderGame(modernState({ locationId: 'xizhimen' }));
  await user.click(screen.getByRole('button', { name: /国贸/ }));
  expect(screen.getByText(/票价/)).toBeInTheDocument();
  expect(dispatch).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: '确认换站' }));
  expect(dispatch).toHaveBeenCalledWith({ type: 'TRAVEL', targetId: 'guomao' });
});

it('acknowledges queued events one at a time', async () => {
  const { user } = renderGame(stateWith({ pendingEvents: [event('one'), event('two')] }));
  expect(screen.getByRole('dialog')).toHaveTextContent('one');
  await user.click(screen.getByRole('button', { name: '继续' }));
  expect(screen.getByRole('dialog')).toHaveTextContent('two');
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test -- src/ui/SubwayMap.test.tsx src/ui/EventDialog.test.tsx src/ui/JournalDrawer.test.tsx`

Expected: FAIL.

- [ ] **Step 3: 实现线路图、事件和日记**

Render the line graph with HTML/CSS nodes and connectors, not a hand-drawn SVG. Each station is a button with line-color swatch, interchange marker and selected/current states. Event dialog selects art by `artId`; journal groups entries by day and filters交易、行情、健康、资金、系统.

- [ ] **Step 4: 生成八张套色版画资产**

Use the `imagegen` skill during execution. Generate 3:2 bitmap illustrations at 1200×800 with this shared direction: “Chinese two-color risograph print, coarse paper grain, dark ink green, ticket yellow and operation red, bold geometric Beijing transit motifs, no text, no logo, no photorealism.” Generate one image for each file category listed above, optimize to WebP, and verify each file is nonblank and contains no embedded text.

- [ ] **Step 5: 完成视觉 tokens 与资产许可**

Define exact CSS tokens: ink `#17201f`, panel `#22302d`, paper `#eee3c7`, ticket `#d5aa45`, action `#bd4334`, success `#4f8067`, border `#6f7f79`, white `#fffaf0`. Use 0–8px corner radii and no gradients, decorative orbs, nested cards or viewport-scaled typography. Record image generation date/tool and Lucide license in `NOTICE.md`.

Implement `playCue(cue, enabled)` in `src/audio/sounds.ts` with short Web Audio oscillator/envelope cues for `buy`, `sell`, `travel` and `event`; do not add or reuse sound files. Unit-test that `enabled === false` returns before constructing an `AudioContext` and that unavailable Web Audio fails silently without changing game state.

- [ ] **Step 6: 验证交互和资产**

Run separately:

```bash
pnpm test -- src/ui/SubwayMap.test.tsx src/ui/EventDialog.test.tsx src/ui/JournalDrawer.test.tsx src/audio/sounds.test.ts
pnpm build
pnpm test
```

Also inspect all eight WebP files and confirm their dimensions and nonzero file sizes with `sips -g pixelWidth -g pixelHeight public/assets/events/*.webp`.

- [ ] **Step 7: 提交**

```bash
git add src/ui src/styles/art.css src/audio public/assets/events NOTICE.md
git commit -m "feat: add transit navigation and event artwork"
```

---

### Task 12: 设置、排行榜、署名、结算与端到端验收

**Files:**
- Create: `src/ui/SettingsDialog.tsx`
- Create: `src/ui/ScoreboardDialog.tsx`
- Create: `src/ui/AboutDialog.tsx`
- Create: `src/ui/EndGameDialog.tsx`
- Create: `src/ui/auxiliary.test.tsx`
- Create: `tests/e2e/game.spec.ts`
- Modify: `src/ui/GameShell.tsx`
- Modify: `src/App.tsx`
- Modify: `playwright.config.ts`
- Create: `README.md`

**Interfaces:**
- Produces: completed start-to-finish game, settings persistence, local top ten, GPL attribution and responsive E2E coverage.
- Consumes: all previous tasks.

- [ ] **Step 1: 写入辅助界面失败测试**

```tsx
it('records a completed score once and exposes GPL attribution', async () => {
  const { user } = renderAppWithState(stateWith({ status: 'won', finalScore: 123_456 }));
  expect(screen.getByRole('dialog', { name: '本局结算' })).toHaveTextContent('123,456');
  await user.click(screen.getByRole('button', { name: '关于' }));
  expect(screen.getByText(/郭祥昊/)).toBeInTheDocument();
  expect(screen.getByText(/GNU General Public License v2/)).toBeInTheDocument();
  expect(loadScores(memoryStorage).filter((x) => x.score === 123_456)).toHaveLength(1);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test -- src/ui/auxiliary.test.tsx`

Expected: FAIL.

- [ ] **Step 3: 实现设置、排行榜、关于和结算**

Settings persist sound and reduced-motion booleans. Scoreboard switches between classic and modern top tens. About shows original author/year, web adaptation date, no-warranty notice, GPL link and asset credits. End-game dialog shows score formula, health, fame, debt, final rank, restart and return-to-menu.

- [ ] **Step 4: 写入完整 Playwright 流程**

```ts
test('classic game survives reload and reaches settlement', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '经典模式' }).click();
  await page.getByLabel('角色姓名').fill('测试玩家');
  await page.getByRole('button', { name: '开始游戏' }).click();
  await expect(page.getByRole('heading', { name: '北京浮生记' })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: '继续游戏' }).click();
  await expect(page.getByText('测试玩家')).toBeVisible();
});
```

Add a test-only seed and accelerated-day helper exposed only under `import.meta.env.MODE === 'test'` so E2E can exercise buy, sell, service, travel, event acknowledgement and final settlement without 40 manual repetitions.

- [ ] **Step 5: 配置三档视口和视觉断言**

Create Playwright projects `desktop-1440` (1440×1000), `tablet-768` (768×1024), and `mobile-390` (390×844). For each, assert no horizontal overflow, sticky actions do not overlap the last table row, visible text fits controls, event art loads with `naturalWidth > 0`, and no `pageerror` or console error occurs. Capture screenshots into `test-results/` for review without committing generated output.

- [ ] **Step 6: 编写运行说明**

Create `README.md` with prerequisites, `pnpm install`, `pnpm dev`, `pnpm test`, `pnpm test:e2e`, `pnpm build`, both game modes, local-save behavior, original attribution and GPL notice.

- [ ] **Step 7: 运行最终验证**

Run:

```bash
pnpm lint
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

Expected: lint, unit/component tests, production build and all three Playwright projects pass. Inspect the three screenshots and verify a nonblank board, correct framing, rendered event art and no overlapping controls.

- [ ] **Step 8: 提交**

```bash
git add src tests playwright.config.ts README.md
git commit -m "feat: complete the single-player web game"
```

- [ ] **Step 9: 最终仓库检查**

Run:

```bash
git status --short
rg -n "\.bmp|\.ico|\.wav|old-cover|game-backg|news\.bmp|riji\.bmp|sound/" src public README.md NOTICE.md
```

Expected: clean status after the commit; `rg` returns no references to old assets.
