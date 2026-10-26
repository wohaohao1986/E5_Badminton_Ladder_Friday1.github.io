const { test, expect } = require('@playwright/test');

const mockMainData = {
  currentRound: 2,
  currentSeason: '2026/27',
  seasons: {
    '2026/27': { status: 'active', finalRound: 2 },
    '2025/26': { status: 'ended', finalRound: 10 },
  },
  players: [
    { id: 'p1', name: 'Alice', category: 'huitailang', active: true, ranking: 1, isDropin: false },
    { id: 'p2', name: 'Bob', category: 'huitailang', active: true, ranking: 2, isDropin: false },
    { id: 'p3', name: 'Carol', category: 'huitailang', active: true, ranking: 3, isDropin: false },
    { id: 'p4', name: 'David', category: 'huitailang', active: true, ranking: 4, isDropin: false },
    { id: 'p5', name: 'Eve', category: 'xiyangyang', active: true, ranking: 1, isDropin: false },
    { id: 'p6', name: 'Frank', category: 'xiyangyang', active: true, ranking: 2, isDropin: false },
    { id: 'p7', name: 'Grace', category: 'xiyangyang', active: true, ranking: 3, isDropin: false },
    { id: 'p8', name: 'Hank', category: 'xiyangyang', active: true, ranking: 4, isDropin: false },
  ],
  groups: [
    { id: 'huitailang-group-1', category: 'huitailang', level: 1, playerIds: ['p1', 'p2', 'p3', 'p4'] },
    { id: 'xiyangyang-group-1', category: 'xiyangyang', level: 1, playerIds: ['p5', 'p6', 'p7', 'p8'] },
  ],
  matches: [
    { id: 'match-1', round: 2, groupId: 'huitailang-group-1', team1: ['p1', 'p2'], team2: ['p3', 'p4'], score1: null, score2: null, completed: false },
    { id: 'match-2', round: 2, groupId: 'xiyangyang-group-1', team1: ['p5', 'p6'], team2: ['p7', 'p8'], score1: null, score2: null, completed: false },
  ],
  roundHistory: {
    '2026/27': [
      {
        round: 1,
        rankings: [
          { name: 'Alice', category: 'huitailang', group: 1, netScore: 4, change: 'none' },
          { name: 'Bob', category: 'huitailang', group: 1, netScore: 2, change: 'none' },
          { name: 'Carol', category: 'huitailang', group: 1, netScore: -1, change: 'none' },
          { name: 'David', category: 'huitailang', group: 1, netScore: -5, change: 'none' },
          { name: 'Eve', category: 'xiyangyang', group: 1, netScore: 5, change: 'none' },
          { name: 'Frank', category: 'xiyangyang', group: 1, netScore: 1, change: 'none' },
          { name: 'Grace', category: 'xiyangyang', group: 1, netScore: -2, change: 'none' },
          { name: 'Hank', category: 'xiyangyang', group: 1, netScore: -4, change: 'none' },
        ],
      },
    ],
    '2025/26': [],
  },
  matchHistory: {
    '2026/27': [
      {
        round: 1,
        team1: ['p1', 'p2'],
        team2: ['p3', 'p4'],
        score1: 21,
        score2: 18,
        completed: true,
        timestamp: 1710000000000,
      },
    ],
    '2025/26': [],
  },
};

const mockOpensData = [
  {
    id: 'AYJ-2026-05-11',
    name: 'AYJ',
    date: '2026-05-11',
    categories: [
      { id: 'A', males: [], females: [] },
      { id: 'B', males: [], females: [] },
    ],
    matches: [],
  },
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript((data) => {
    const state = {
      main: structuredClone(data.main),
      opens: structuredClone(data.opens),
    };
    window.__requestLog = [];

    const normalizeCategoryRankings = (category) => {
      const categoryPlayers = state.main.players
        .filter(player => player.category === category)
        .sort((a, b) => {
          const rankA = typeof a.ranking === 'number' ? a.ranking : Infinity;
          const rankB = typeof b.ranking === 'number' ? b.ranking : Infinity;
          return rankA - rankB;
        });
      categoryPlayers.forEach((player, index) => {
        player.ranking = index + 1;
      });
    };

    const normalizeAllRankings = () => {
      normalizeCategoryRankings('huitailang');
      normalizeCategoryRankings('xiyangyang');
    };

    window.fetch = async (input, init = {}) => {
      const url = typeof input === 'string' ? input : input.url;
      const method = (init.method || 'GET').toUpperCase();
      window.__requestLog.push({ url, method });

      if (url.includes('/api/season/new')) {
        if (method !== 'PUT') {
          return {
            ok: false,
            status: 404,
            json: async () => ({ success: false, message: 'Not Found' }),
          };
        }

        const nextSeason = '2027/28';
        const previousSeason = state.main.currentSeason;
        state.main.seasons[previousSeason] = { ...(state.main.seasons[previousSeason] || {}), status: 'archived', finalRound: state.main.currentRound };
        state.main.currentSeason = nextSeason;
        state.main.seasons[nextSeason] = { status: 'active', currentRound: 1 };
        state.main.roundHistory[nextSeason] = [];
        state.main.matchHistory[nextSeason] = [];
        state.main.currentRound = 1;
        state.main.groups = [];
        state.main.matches = [];
        return {
          ok: true,
          json: async () => ({ success: true, message: '新赛季 2027/28 已启动！' }),
        };
      }

      if (url.includes('/api/main')) {
        return {
          ok: true,
          json: async () => structuredClone(state.main),
        };
      }

      if (url.includes('/api/admin')) {
        return {
          ok: true,
          json: async () => ({ authenticated: true }),
        };
      }

      if (url.includes('/api/opens')) {
        if (url.includes('/api/opens/importPlayers') && method === 'PUT') {
          const payload = JSON.parse(init.body || '{}');
          const target = state.opens.find(item => item.id === payload.opensId);
          if (target) {
            target.categories = [
              { id: 'A', males: [
                  { id: 'm1', name: 'Alice' }, { id: 'm2', name: 'Bob' }, { id: 'm3', name: 'Carol' },
                  { id: 'm4', name: 'David' }, { id: 'm5', name: 'Eli' }, { id: 'm6', name: 'Frank' }
                ],
                females: [
                  { id: 'f1', name: 'Eve' }, { id: 'f2', name: 'Grace' }, { id: 'f3', name: 'Hank' },
                  { id: 'f4', name: 'Iris' }, { id: 'f5', name: 'Judy' }, { id: 'f6', name: 'Kate' }
                ] },
              { id: 'B', males: [
                  { id: 'm7', name: 'Leo' }, { id: 'm8', name: 'Mia' }, { id: 'm9', name: 'Nina' },
                  { id: 'm10', name: 'Omar' }, { id: 'm11', name: 'Pia' }, { id: 'm12', name: 'Quinn' }
                ],
                females: [
                  { id: 'f7', name: 'Ruby' }, { id: 'f8', name: 'Sara' }, { id: 'f9', name: 'Tia' },
                  { id: 'f10', name: 'Uma' }, { id: 'f11', name: 'Vera' }, { id: 'f12', name: 'Wendy' }
                ] },
            ];
            target.matches = [
              { type: 'males', group: 1, team1: ['Alice', 'Bob', 'Carol', 'David', 'Eli', 'Frank'], team2: ['Leo', 'Mia', 'Nina', 'Omar', 'Pia', 'Quinn'], completed: false, score1: null, score2: null },
              { type: 'females', group: 1, team1: ['Eve', 'Grace', 'Hank', 'Iris', 'Judy', 'Kate'], team2: ['Ruby', 'Sara', 'Tia', 'Uma', 'Vera', 'Wendy'], completed: false, score1: null, score2: null },
            ];
          }
          return {
            ok: true,
            json: async () => ({ message: 'Players imported successfully' }),
          };
        }

        if (url.includes('/api/opens/generateMatchesAndGroups') && method === 'PUT') {
          const payload = JSON.parse(init.body || '{}');
          const target = state.opens.find(item => item.id === payload.opensId);
          if (target) {
            target.matches = [
              { type: 'males', group: 1, team1: ['Alice', 'Bob', 'Carol', 'David', 'Eli', 'Frank'], team2: ['Leo', 'Mia', 'Nina', 'Omar', 'Pia', 'Quinn'], completed: false, score1: null, score2: null },
              { type: 'females', group: 1, team1: ['Eve', 'Grace', 'Hank', 'Iris', 'Judy', 'Kate'], team2: ['Ruby', 'Sara', 'Tia', 'Uma', 'Vera', 'Wendy'], completed: false, score1: null, score2: null }
            ];
            return {
              ok: true,
              json: async () => structuredClone(target),
            };
          }
          return {
            ok: true,
            json: async () => ({ message: 'Groups generated successfully' }),
          };
        }

        if (url.includes('/api/opens/') && !url.endsWith('/api/opens')) {
          const opensId = url.split('/api/opens/')[1].split('?')[0];
          const found = state.opens.find(item => item.id === opensId);
          return {
            ok: !!found,
            json: async () => structuredClone(found || { error: 'Opens not found' }),
          };
        }

        if (method === 'POST') {
          const payload = JSON.parse(init.body || '{}');
          const nextOpens = {
            id: `${payload.name}-${payload.date}`,
            name: payload.name,
            date: payload.date,
            categories: [{ id: 'A', males: [], females: [] }, { id: 'B', males: [], females: [] }],
            matches: [],
          };
          state.opens.push(nextOpens);
          return {
            ok: true,
            json: async () => ({ message: 'Opens added successfully' }),
          };
        }

        return {
          ok: true,
          json: async () => structuredClone(state.opens),
        };
      }

      if (url.includes('/api/player/delete') && method === 'PUT') {
        const payload = JSON.parse(init.body || '{}');
        state.main.players = state.main.players.filter(player => player.id !== payload.id);
        normalizeAllRankings();
        return {
          ok: true,
          json: async () => ({ message: '删除成功' }),
        };
      }

      if (url.includes('/api/player') && method === 'PUT') {
        const payload = JSON.parse(init.body || '{}');
        const player = state.main.players.find(item => item.id === payload.id);
        if (player) {
          if (typeof payload.active === 'boolean') {
            player.active = payload.active;
          }
          if (payload.category) {
            player.category = payload.category;
          }
          if (typeof payload.ranking === 'number') {
            player.ranking = payload.ranking;
          }
          normalizeAllRankings();
        }
        return {
          ok: true,
          json: async () => ({ message: '选手信息已更新' }),
        };
      }

      if (url.includes('/api/resetGroup') && method === 'PUT') {
        return {
          ok: true,
          json: async () => ({ message: '分组已重置' }),
        };
      }

      if (url.includes('/api/rearrangeGroups') && method === 'PUT') {
        return {
          ok: true,
          json: async () => ({ success: true, message: '分组重新排列成功！' }),
        };
      }

      if (url.includes('/api/calculateStats') && method === 'PUT') {
        return {
          ok: true,
          json: async () => ({ message: '选手数据已重新计算' }),
        };
      }

      if (url.includes('/api/calculateAvgRank') && method === 'PUT') {
        return {
          ok: true,
          json: async () => ({ message: 'Average rank in category calculated for all players' }),
        };
      }

      if (url.includes('/api/player') && method === 'POST') {
        const payload = JSON.parse(init.body || '{}');
        const nextPlayer = {
          ...payload,
          id: payload.id || `player-${Date.now()}`,
          active: true,
          ranking: state.main.players.filter(p => p.category === payload.category && p.active).length + 1,
          isDropin: Boolean(payload.isDropin),
        };
        state.main.players.push(nextPlayer);
        return {
          ok: true,
          json: async () => ({ message: '添加成功' }),
        };
      }

      if (url.includes('/api/match') && method === 'PUT') {
        const payload = JSON.parse(init.body || '{}');
        state.main.matches = state.main.matches.map(match => {
          if (match.id !== payload.id) return match;
          return { ...match, score1: payload.score1, score2: payload.score2, completed: true, timestamp: payload.timestamp };
        });
        return {
          ok: true,
          json: async () => ({ message: '比赛已更新' }),
        };
      }

      if (url.includes('/api/finishRound') && method === 'PUT') {
        const currentMatches = state.main.matches.filter(match => match.round === state.main.currentRound);
        state.main.roundHistory[state.main.currentSeason] = state.main.roundHistory[state.main.currentSeason] || [];
        state.main.matchHistory[state.main.currentSeason] = state.main.matchHistory[state.main.currentSeason] || [];
        state.main.roundHistory[state.main.currentSeason].push({
          round: state.main.currentRound,
          rankings: currentMatches.map(match => ({ id: match.id, category: 'huitailang', name: match.id, group: 1, netScore: 0, change: 'none' })),
        });
        state.main.matchHistory[state.main.currentSeason].push(...currentMatches);
        state.main.matches = state.main.matches.filter(match => match.round !== state.main.currentRound);
        state.main.groups = [];
        state.main.currentRound += 1;
        return {
          ok: true,
          json: async () => ({ message: '本轮比赛结束，升降名次详情如下：\n=== 灰太狼 ===\n排名上升：\n排名下降：\n请截图保存本轮升降名次详情以备查阅！' }),
        };
      }

      return {
        ok: true,
        json: async () => ({ message: 'OK' }),
      };
    };
  }, { main: mockMainData, opens: mockOpensData });

  await page.goto('file://' + __dirname.replace(/\\/g, '/').replace(/\/test$/, '/src/index.html'));
  await page.waitForFunction(() => {
    const homeNav = document.getElementById('nav-home');
    return !!homeNav && homeNav.classList.contains('active');
  });
});

test('homepage renders the main ladder guidance and nav', async ({ page }) => {
  await expect(page.getByRole('button', { name: '首页', exact: true })).toHaveClass(/active/);
  await expect(page.getByRole('heading', { name: /欢迎使用 E5羽毛球俱乐部 Ladder 工具/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: '规则说明', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '公开赛', exact: true })).toBeVisible();
});

test('admin page shows the management panel and allows adding a player', async ({ page }) => {
  await page.getByRole('button', { name: '管理', exact: true }).click();

  await expect(page.getByRole('heading', { name: '管理面板', exact: true })).toBeVisible();
  await expect(page.getByText('排名管理')).toBeVisible();
  await expect(page.locator('#player-ranking-list')).toContainText('Alice');
  await expect(page.locator('#player-ranking-list')).toContainText('Bob');

  await page.locator('#new-player-name').fill('Frank');
  await page.getByRole('button', { name: '添加', exact: true }).click();

  await expect(page.locator('#player-ranking-list')).toContainText('Frank');
  await expect(page.locator('#player-count')).toHaveText('9');
});

test('admin page supports player edits, toggles, and deletions', async ({ page }) => {
  page.on('dialog', async dialog => {
    const message = dialog.message();
    if (dialog.type() === 'prompt' && message.includes('当前排名')) {
      await dialog.accept('3');
      return;
    }
    if (dialog.type() === 'prompt' && message.includes('当前类别')) {
      await dialog.accept('2');
      return;
    }
    await dialog.accept();
  });

  await page.getByRole('button', { name: '管理', exact: true }).click();

  const aliceRow = page.locator('#player-ranking-list .ranking-item').filter({ hasText: 'Alice' }).first();
  await aliceRow.click();
  await aliceRow.getByRole('button', { name: '改排名', exact: true }).click();
  await expect(page.locator('#admin-modal')).toBeVisible();
  await page.locator('#admin-modal input[type="text"]').fill('admin');
  await page.locator('#admin-modal input[type="password"]').fill('admin');
  await page.locator('#admin-modal button').first().click();
  await expect(page.locator('#player-ranking-list')).toContainText('Alice');

  const carolRow = page.locator('#player-ranking-list .ranking-item').filter({ hasText: 'Carol' }).first();
  await carolRow.click();
  await carolRow.getByRole('button', { name: '改类别', exact: true }).click();
  await expect(page.locator('#player-ranking-list')).toContainText('Carol');

  const bobRow = page.locator('#player-ranking-list .ranking-item').filter({ hasText: 'Bob' }).first();
  await bobRow.click();
  await bobRow.getByRole('button', { name: '停用', exact: true }).click();
  await expect(page.locator('#active-count')).toHaveText('7');

  const graceRow = page.locator('#player-ranking-list .ranking-item').filter({ hasText: 'Grace' }).first();
  await graceRow.click();
  await graceRow.getByRole('button', { name: '删除', exact: true }).click();

  const adminModal = page.locator('#admin-modal');
  await expect(adminModal).toBeVisible();
  await adminModal.locator('input[type="text"]').fill('admin');
  await adminModal.locator('input[type="password"]').fill('admin');
  await adminModal.getByRole('button', { name: '确定', exact: true }).click();

  await expect(page.locator('#player-count')).toHaveText('7');
  await expect(page.locator('#active-count')).toHaveText('6');
});

test('ranking and history pages render ladder season data', async ({ page }) => {
  await page.getByRole('button', { name: '总排名', exact: true }).click();

  await expect(page.getByRole('heading', { name: '当前总排名', exact: true })).toBeVisible();
  await expect(page.locator('#ranking-list')).toContainText('Alice');
  await expect(page.locator('#ranking-list')).toContainText('2026/27');

  await page.getByRole('button', { name: '历史记录', exact: true }).click();
  await expect(page.getByRole('heading', { name: '历史记录', exact: true })).toBeVisible();
  await page.locator('#round-select').selectOption('1');
  await expect(page.locator('#history-content')).toContainText('第 1 轮');
  await expect(page.locator('#history-content')).toContainText('Alice');
  await expect(page.locator('#history-content')).toContainText('比赛结果');
});

test('admin maintenance actions can generate, rearrange, reset, and start a new season', async ({ page }) => {
  page.on('dialog', async dialog => {
    await dialog.accept();
  });

  await page.getByRole('button', { name: '管理', exact: true }).click();

  await page.getByRole('button', { name: '生成本轮分组和比赛（管理员）', exact: true }).click();
  const generateModal = page.locator('#admin-modal');
  await expect(generateModal).toBeVisible();
  await generateModal.locator('input[type="text"]').fill('admin');
  await generateModal.locator('input[type="password"]').fill('admin');
  await generateModal.getByRole('button', { name: '确定', exact: true }).click();

  await expect(page.locator('#current-groups')).toContainText('第 1 组');

  await page.getByRole('button', { name: '重新排列灰太狼组', exact: true }).click();
  const rearrangeModal = page.locator('#rearrangeModal');
  await expect(rearrangeModal).toBeVisible();
  await rearrangeModal.getByRole('button', { name: '确认', exact: true }).click();
  await expect(page.locator('#current-groups')).toContainText('灰太狼');

  await page.getByRole('button', { name: '重置一个分组（管理员）', exact: true }).click();
  const resetModal = page.locator('div[style*="position: fixed"][style*="z-index: 10000"]');
  await expect(resetModal).toBeVisible();
  await resetModal.locator('select').selectOption({ label: '灰太狼 第 1 组' });
  await resetModal.getByRole('button', { name: '确定', exact: true }).click();

  const resetAuthModal = page.locator('#admin-modal');
  await expect(resetAuthModal).toBeVisible();
  await resetAuthModal.locator('input[type="text"]').fill('admin');
  await resetAuthModal.locator('input[type="password"]').fill('admin');
  await resetAuthModal.getByRole('button', { name: '确定', exact: true }).click();

  await page.getByRole('button', { name: '计算数据（测试用）', exact: true }).click();
  const statsModal = page.locator('#admin-modal');
  await expect(statsModal).toBeVisible();
  await statsModal.locator('input[type="text"]').fill('admin');
  await statsModal.locator('input[type="password"]').fill('admin');
  await statsModal.getByRole('button', { name: '确定', exact: true }).click();

  await page.getByRole('button', { name: '计算平均排名（测试用）', exact: true }).click();
  const avgModal = page.locator('#admin-modal');
  await expect(avgModal).toBeVisible();
  await avgModal.locator('input[type="text"]').fill('admin');
  await avgModal.locator('input[type="password"]').fill('admin');
  await avgModal.getByRole('button', { name: '确定', exact: true }).click();

  await page.getByRole('button', { name: /启动新赛季/ }).click();
  const seasonModal = page.locator('#admin-modal');
  await expect(seasonModal).toBeVisible();
  await seasonModal.locator('input[type="text"]').fill('admin');
  await seasonModal.locator('input[type="password"]').fill('admin');
  await seasonModal.getByRole('button', { name: '确定', exact: true }).click();

  await expect(page.locator('#stat-round')).toHaveText('1');
  await expect(page.locator('#stat-groups')).toHaveText('0');
  await expect(page.locator('#stat-matches')).toHaveText('0');
  await expect(page.locator('#season-card')).toContainText('2027/28');
});

test('new season reset keeps the ladder pages working', async ({ page }) => {
  page.on('dialog', async dialog => {
    await dialog.accept();
  });

  await page.getByRole('button', { name: '管理', exact: true }).click();
  await page.getByRole('button', { name: /启动新赛季/ }).click();

  const seasonModal = page.locator('#admin-modal');
  await expect(seasonModal).toBeVisible();
  await seasonModal.locator('input[type="text"]').fill('admin');
  await seasonModal.locator('input[type="password"]').fill('admin');
  await seasonModal.getByRole('button', { name: '确定', exact: true }).click();

  const seasonRequests = await page.evaluate(() => window.__requestLog.filter(entry => entry.url.includes('/api/season/new')));
  expect(seasonRequests).toHaveLength(1);
  expect(seasonRequests[0].method).toBe('PUT');
  expect(seasonRequests[0].url).toContain('/api/season/new');

  await page.getByRole('button', { name: '当前比赛', exact: true }).click();
  await expect(page.getByRole('heading', { name: /第 1 轮/ })).toBeVisible();
  await expect(page.locator('#home-groups')).toContainText('暂无分组，请前往管理页面生成分组');

  await page.getByRole('button', { name: '报分', exact: true }).click();
  await expect(page.getByRole('heading', { name: '报分', exact: true })).toBeVisible();
  await expect(page.locator('#score-match')).toContainText('-- 请选择 --');

  await page.getByRole('button', { name: '总排名', exact: true }).click();
  await expect(page.getByRole('heading', { name: '当前总排名', exact: true })).toBeVisible();
  await expect(page.locator('#ranking-list')).toContainText('Alice');

  await page.getByRole('button', { name: '历史记录', exact: true }).click();
  await expect(page.getByRole('heading', { name: '历史记录', exact: true })).toBeVisible();
  await expect(page.locator('#history-content')).toContainText('2027/28');

  await page.getByRole('button', { name: '管理', exact: true }).click();
  await expect(page.getByRole('heading', { name: '管理面板', exact: true })).toBeVisible();
  await expect(page.locator('#stat-round')).toHaveText('1');
  await expect(page.locator('#stat-groups')).toHaveText('0');
  await expect(page.locator('#stat-matches')).toHaveText('0');
});

test('match and score pages render real round data and allow score submission', async ({ page }) => {
  await page.getByRole('button', { name: '当前比赛', exact: true }).click();

  await expect(page.getByRole('heading', { name: /第 2 轮/ })).toBeVisible();
  await expect(page.locator('#home-groups')).toContainText('灰太狼');
  await expect(page.locator('#home-groups')).toContainText('Alice');
  await expect(page.locator('#home-groups')).toContainText('待比赛');

  await page.getByRole('button', { name: '报分', exact: true }).click();
  await expect(page.getByRole('heading', { name: '报分', exact: true })).toBeVisible();

  const matchSelect = page.locator('#score-match');
  await expect(matchSelect).toHaveCount(1);
  await expect(matchSelect.locator('option').filter({ hasText: 'Alice' })).toHaveCount(1);
  await matchSelect.selectOption({ value: 'match-1' });

  await page.locator('#score1').fill('21');
  await page.locator('#score2').fill('18');
  await page.getByRole('button', { name: '提交比分', exact: true }).click();

  await expect(page.locator('#completed-matches')).toContainText('Alice');
  await expect(page.locator('#completed-matches')).toContainText('Bob');
});

test('ladder round flow lets the user complete matches and finish the round', async ({ page }) => {
  await page.getByRole('button', { name: '当前比赛', exact: true }).click();

  const scoreSelect = page.locator('#score-match');
  await page.getByRole('button', { name: '报分', exact: true }).click();
  await expect(scoreSelect).toBeVisible();
  await scoreSelect.selectOption({ value: 'match-1' });
  await page.locator('#score1').fill('21');
  await page.locator('#score2').fill('18');
  await page.getByRole('button', { name: '提交比分', exact: true }).click();

  await page.getByRole('button', { name: '报分', exact: true }).click();
  await scoreSelect.selectOption({ value: 'match-2' });
  await page.locator('#score1').fill('21');
  await page.locator('#score2').fill('16');
  await page.getByRole('button', { name: '提交比分', exact: true }).click();

  await page.getByRole('button', { name: '管理', exact: true }).click();
  await page.getByRole('button', { name: /本轮结束/ }).click();

  const adminModal = page.locator('#admin-modal');
  await expect(adminModal).toBeVisible();
  await adminModal.locator('input[type="text"]').fill('admin');
  await adminModal.locator('input[type="password"]').fill('admin');

  page.once('dialog', async dialog => {
    await dialog.accept();
  });
  await adminModal.getByRole('button', { name: '确定', exact: true }).click();

  await page.getByRole('button', { name: '当前比赛', exact: true }).click();
  await expect(page.locator('#home-round')).toHaveText('3');
  await expect(page.locator('#home-groups')).toContainText('暂无分组，请前往管理页面生成分组');
});

test('opens page can create a tournament and show it in the list', async ({ page }) => {
  await page.getByRole('button', { name: '公开赛', exact: true }).click();

  await page.locator('#opens-name').fill('Spring Cup');
  await page.locator('#opens-date').fill('2026-07-20');
  await page.getByRole('button', { name: '提交新公开赛', exact: true }).click();

  await expect(page.locator('#opens-list')).toContainText('Spring Cup');
  await expect(page.locator('#opens-list')).toContainText('2026-07-20');
});

test('opens workflow can create, import players, and generate match data from the UI', async ({ page }) => {
  await page.getByRole('button', { name: '公开赛', exact: true }).click();

  await page.locator('#opens-name').fill('Spring Cup');
  await page.locator('#opens-date').fill('2026-07-20');
  await page.getByRole('button', { name: '提交新公开赛', exact: true }).click();

  const opensSelector = page.locator('#opens-selector');
  await expect(opensSelector).toContainText('Spring Cup');
  await opensSelector.selectOption({ label: 'Spring Cup (2026-07-20)' });

  await expect(page.locator('#opens-detail-container')).toContainText('Spring Cup');
  await expect(page.locator('#tab-players-content')).toContainText('队伍数量');

  await page.getByRole('button', { name: '选手', exact: true }).click();
  await page.getByRole('button', { name: '从Ladder导入选手', exact: true }).click();

  await page.locator('#admin-modal input[type="text"]').fill('admin');
  await page.locator('#admin-modal input[type="password"]').fill('admin');
  await page.locator('#admin-modal button').first().click();

  await expect(page.locator('#tab-players-content')).toContainText('Team 野茫茫');
  await expect(page.locator('#tab-players-content')).toContainText('Alice');
  await expect(page.locator('#tab-players-content')).toContainText('Eve');

  await page.getByRole('button', { name: '比赛', exact: true }).click();
  page.once('dialog', async dialog => {
    await dialog.accept();
  });
  await page.getByRole('button', { name: /生成分组和比赛/ }).click();

  const adminModal = page.locator('#admin-modal');
  await expect(adminModal).toBeVisible();
  await adminModal.locator('input[type="text"]').fill('admin');
  await adminModal.locator('input[type="password"]').fill('admin');
  await adminModal.getByRole('button', { name: '确定', exact: true }).click();

  await expect(page.locator('#matches-list')).toContainText('Alice');
  await expect(page.locator('#matches-list')).toContainText('Eve');
});

test('opens page renders the tournament list from mocked API data', async ({ page }) => {
  await page.getByRole('button', { name: '公开赛', exact: true }).click();

  await expect(page.getByRole('heading', { name: '公开赛', exact: true })).toBeVisible();
  await expect(page.locator('#opens-list')).toContainText('AYJ');
  await expect(page.locator('#opens-list')).toContainText('2026-05-11');
});
