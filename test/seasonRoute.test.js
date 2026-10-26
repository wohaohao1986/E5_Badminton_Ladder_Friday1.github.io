jest.mock('../src/utils/fileUtils', () => ({
  DATA_FILE: 'mock-data.json',
  ADMIN_CONFIG_FILE: 'mock-admin.json',
  safeReadJson: jest.fn(),
  safeWriteJson: jest.fn(),
  logToFile: jest.fn(),
}));

jest.mock('../src/utils/dataUtils', () => {
  const express = require('express');
  return {
    currentDateTime: jest.fn(),
    sortPlayersByRanking: jest.fn(),
    generateGroups: jest.fn(),
    generateMatches: jest.fn(),
    generateGroupsAndMatches: jest.fn(),
    finishRound: jest.fn(),
    autoFillScores: jest.fn(),
    calculatePlayerStats: jest.fn(),
    calculateAllPlayerAvgRankInCat: jest.fn(),
    resetGroupLogic: jest.fn(),
    rearrangeGroups: jest.fn(),
    startNewSeason: jest.fn(),
    normalizeSeasonData: jest.fn(data => data),
  };
});

jest.mock('../src/routes/playerRoutes', () => require('express').Router());
jest.mock('../src/routes/matchRoutes', () => require('express').Router());
jest.mock('../src/routes/opensRoutes', () => require('express').Router());

const request = require('supertest');
const { safeReadJson } = require('../src/utils/fileUtils');
const { startNewSeason } = require('../src/utils/dataUtils');
const app = require('../src/server');

beforeEach(() => {
  jest.clearAllMocks();
  safeReadJson.mockImplementation((file) => {
    if (file.includes('admin')) {
      return { admin: { username: 'admin', password: 'admin' } };
    }
    return {
      currentSeason: '2025/26',
      seasons: { '2025/26': { status: 'active' } },
      players: [],
      groups: [],
      matches: [],
      currentRound: 1,
      roundHistory: {},
      matchHistory: {},
    };
  });
  startNewSeason.mockReturnValue({ success: true, message: '新赛季 2026/27 已启动！' });
});

describe('PUT /api/season/new', () => {
  test('starts a new season with valid admin credentials', async () => {
    const res = await request(app)
      .put('/api/season/new')
      .send({ adminName: 'admin', adminPassword: 'admin' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(startNewSeason).toHaveBeenCalled();
  });

  test('returns 400 when admin credentials are missing', async () => {
    const res = await request(app).put('/api/season/new').send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('returns 401 when admin credentials are invalid', async () => {
    const res = await request(app)
      .put('/api/season/new')
      .send({ adminName: 'bad', adminPassword: 'bad' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('returns 404 for POST because the route is PUT-only', async () => {
    const res = await request(app)
      .post('/api/season/new')
      .send({ adminName: 'admin', adminPassword: 'admin' });

    expect(res.status).toBe(404);
  });
});