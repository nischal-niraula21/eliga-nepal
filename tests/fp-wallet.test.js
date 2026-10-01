import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import User from "../server/models/User.js";
import Room from "../server/models/Room.js";
import Referral from "../server/models/Referral.js";
import Settings from "../server/models/Settings.js";
import WalletTransaction from "../server/models/WalletTransaction.js";
import PlayerNotification from "../server/models/PlayerNotification.js";
import DepositRequest from "../server/models/DepositRequest.js";
import WithdrawalRequest from "../server/models/WithdrawalRequest.js";
import Result from "../server/models/Result.js";
import roomsRouter from "../server/routes/rooms.js";
import walletRouter from "../server/routes/wallet.js";
import authRouter from "../server/routes/auth.js";
import adminRouter from "../server/routes/admin.js";
import referralsRouter from "../server/routes/referrals.js";
import { rewardReferralForVerifiedDeposit } from "../server/utils/referrals.js";
import { creditWallet, holdWithdrawal } from "../server/utils/wallet.js";
import { settleRoom } from "../server/utils/settleRoom.js";

// These tests never load .env or use MONGODB_URI. Every test uses a temporary,
// local replica set so real MongoDB transactions and conflicts are exercised.
const TEST_SECRET = "local-fp-wallet-tests-only";
const models = [User, Room, Referral, Settings, WalletTransaction, PlayerNotification, DepositRequest, WithdrawalRequest, Result];
let replSet, server, baseUrl, dataDir;
let counter = 0;
const previousSecret = process.env.JWT_SECRET;

before(async () => {
  process.env.JWT_SECRET = TEST_SECRET;
  dataDir = await mkdtemp(path.join(process.cwd(), "wallet-test-"));
  replSet = await MongoMemoryReplSet.create({
    binary: { version: "7.0.24" },
    instanceOpts: [{ dbPath: dataDir, args: process.platform === "win32" ? [] : ["--nounixsocket"] }],
    replSet: { count: 1 }
  });
  await mongoose.connect(replSet.getUri(), { dbName: "eleague_fp_tests" });
  for (const model of models) await model.init();
  const app = express();
  app.use(express.json());
  app.use("/api/rooms", roomsRouter);
  app.use("/api/wallet", walletRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/referrals", referralsRouter);
  server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
}, { timeout: 180000 });

beforeEach(async () => {
  for (const model of models) await model.deleteMany({});
  await Settings.create({ minEntryFee: 20, maxEntryFee: 500, commissionPercent: 10,
    minDeposit: 20, minWithdrawal: 1, referralRewardAmount: 5 });
});

after(async () => {
  if (server) await new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); });
  await mongoose.disconnect();
  if (replSet) await replSet.stop();
  if (dataDir) await rm(dataDir, { recursive: true, force: true });
  if (previousSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = previousSecret;
});

async function player(values = {}) {
  counter += 1;
  return User.create({ name: `Player ${counter}`, email: `player${counter}@example.test`,
    passwordHash: "test-unused-password", referralCode: `TEST${counter}`, ...values });
}

async function qualifiedPlayer(values = {}, count = 4) {
  const user = await player(values);
  const rows = Array.from({ length: count }, () => ({
    referrer: user._id, referredUser: new mongoose.Types.ObjectId(), codeUsed: user.referralCode,
    status: "REWARDED", rewardAmount: 5, rewardWalletType: "FP", rewardedAt: new Date()
  }));
  if (rows.length) await Referral.insertMany(rows);
  return user;
}

async function request(user, method, route, body) {
  const token = jwt.sign({ id: user._id, role: user.role }, TEST_SECRET);
  const response = await fetch(baseUrl + route, {
    method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000)
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { text }; }
  return { status: response.status, data };
}

function roomPayload(walletType = "MAIN", overrides = {}) {
  return { game: "FC_MOBILE", gameMode: "H2H", matchFormat: "1V1",
    gameUsername: "Test player", entryFee: 20, walletType, ...overrides };
}

async function createRoom(host, walletType = "MAIN") {
  const response = await request(host, "POST", "/rooms", roomPayload(walletType));
  assert.equal(response.status, 201, JSON.stringify(response.data));
  return response.data.room;
}

async function joinRoom(room, challenger, walletType = "MAIN") {
  const reservation = await request(challenger, "POST", `/rooms/${room._id}/reserve`, { walletType });
  assert.equal(reservation.status, 200, JSON.stringify(reservation.data));
  const response = await request(challenger, "POST", `/rooms/${room._id}/join`, { gameUsername: "Challenger", walletType });
  assert.equal(response.status, 200, JSON.stringify(response.data));
  return response.data.room;
}

async function assertBalances(user, main, fp, held = 0) {
  const fresh = await User.findById(user._id);
  assert.equal(fresh.walletBalance || 0, main, "Main Wallet");
  assert.equal(fresh.fpWalletBalance || 0, fp, "FP Wallet");
  assert.equal(fresh.walletHeld || 0, held, "withdrawal hold");
}

test("first verified deposit rewards FP exactly once; deposits still credit Main", async () => {
  const referrer = await player({ walletBalance: 10 });
  const referred = await player({ referredBy: referrer._id });
  const admin = await player({ role: "admin" });
  await Referral.create({ referrer: referrer._id, referredUser: referred._id, codeUsed: referrer.referralCode });
  for (let i = 0; i < 2; i += 1) {
    const deposit = await DepositRequest.create({ user: referred._id, method: "ESEWA", amount: 20,
      transactionId: `deposit-${i}`, screenshotUrl: "/test-proof.png" });
    const response = await request(admin, "PATCH", `/admin/deposits/${deposit._id}`, { action: "VERIFY" });
    assert.equal(response.status, 200, JSON.stringify(response.data));
  }
  await assertBalances(referrer, 10, 5);
  await assertBalances(referred, 40, 0);
  assert.equal(await WalletTransaction.countDocuments({ user: referrer._id, type: "REFERRAL_BONUS", walletType: "FP" }), 1);
  const referral = await Referral.findOne({ referredUser: referred._id });
  assert.equal(referral.rewardWalletType, "FP");
  const notifications = await request(referrer, "GET", "/wallet/notifications");
  assert.ok(notifications.data.items.some((item) => item.type === "REFERRAL_REWARD" && item.detail.includes("FP Wallet")));
});

test("concurrent reward attempts cannot issue two bonuses or notifications", async () => {
  const referrer = await player();
  const referred = await player();
  await Referral.create({ referrer: referrer._id, referredUser: referred._id, codeUsed: referrer.referralCode });
  const depositId = new mongoose.Types.ObjectId();
  await Promise.all(Array.from({ length: 4 }, () => rewardReferralForVerifiedDeposit(referred._id, depositId, null)));
  await assertBalances(referrer, 0, 5);
  assert.equal(await PlayerNotification.countDocuments({ user: referrer._id, type: "REFERRAL_REWARD" }), 1);
});

test("legacy bonus recovery preserves the original Main credit", async () => {
  const referrer = await player();
  const referred = await player();
  const referral = await Referral.create({ referrer: referrer._id, referredUser: referred._id, codeUsed: referrer.referralCode });
  await creditWallet(referrer._id, 5, { type: "REFERRAL_BONUS", idempotencyKey: `referral:${referral._id}:reward` });
  await rewardReferralForVerifiedDeposit(referred._id, new mongoose.Types.ObjectId(), null);
  await assertBalances(referrer, 5, 0);
  assert.equal((await Referral.findById(referral._id)).rewardWalletType, "MAIN");
});

test("legacy profile saves cannot erase a concurrent first FP credit", async () => {
  const user = await player({ walletBalance: 50 });
  await User.collection.updateOne({ _id: user._id }, { $unset: { fpWalletBalance: "" } });
  const staleProfile = await User.findById(user._id);
  await creditWallet(user._id, 5, { walletType: "FP", type: "REFERRAL_BONUS" });
  staleProfile.name = "Updated name";
  await staleProfile.save();
  await assertBalances(user, 50, 5);
});

test("four successful referrals and enough FP allow a host to pay only from FP", async () => {
  const host = await qualifiedPlayer({ walletBalance: 50, fpWalletBalance: 20 });
  const room = await createRoom(host, "FP");
  assert.equal(room.hostWalletType, "FP");
  await assertBalances(host, 50, 0);
  const transaction = await WalletTransaction.findOne({ type: "ENTRY_FEE", user: host._id });
  assert.equal(transaction.walletType, "FP");
  assert.equal(transaction.balanceAfter, 0);
  const user = await request(host, "GET", "/auth/me");
  assert.equal(user.data.user.fpWalletBalance, 0);
});

test("three successful referrals cannot pay or reserve with FP even with enough balance", async () => {
  const locked = await qualifiedPlayer({ walletBalance: 80, fpWalletBalance: 100 }, 3);
  const response = await request(locked, "POST", "/rooms", roomPayload("FP"));
  assert.equal(response.status, 409);
  assert.match(response.data.message, /4 successful referrals/);
  const host = await player({ walletBalance: 20 });
  const room = await createRoom(host);
  const reservation = await request(locked, "POST", `/rooms/${room._id}/reserve`, { walletType: "FP" });
  assert.equal(reservation.status, 409);
  await assertBalances(locked, 80, 100);
});

test("FP never borrows from Main to make up a shortfall", async () => {
  const host = await qualifiedPlayer({ walletBalance: 100, fpWalletBalance: 15 });
  const response = await request(host, "POST", "/rooms", roomPayload("FP"));
  assert.equal(response.status, 409);
  await assertBalances(host, 100, 15);
  assert.equal(await Room.countDocuments(), 0);
});

test("Main payments work without referrals; invalid wallet values are rejected", async () => {
  const host = await player({ walletBalance: 80, fpWalletBalance: 40 });
  const invalid = await request(host, "POST", "/rooms", roomPayload("BOTH"));
  assert.equal(invalid.status, 400);
  await createRoom(host);
  await assertBalances(host, 60, 40);
});

test("a player with only FP can reserve and join an existing room", async () => {
  const host = await player({ walletBalance: 20 });
  const challenger = await qualifiedPlayer({ fpWalletBalance: 20 });
  const room = await createRoom(host);
  const joined = await joinRoom(room, challenger, "FP");
  assert.equal(joined.challengerWalletType, "FP");
  await assertBalances(challenger, 0, 0);
  const repeat = await request(challenger, "POST", `/rooms/${room._id}/join`, { gameUsername: "Again", walletType: "MAIN" });
  assert.equal(repeat.status, 409);
  assert.equal(await WalletTransaction.countDocuments({ user: challenger._id, type: "ENTRY_FEE" }), 1);
});

test("a failed FP join rolls back the room claim and does not touch Main", async () => {
  const host = await player({ walletBalance: 20 });
  const challenger = await qualifiedPlayer({ walletBalance: 100, fpWalletBalance: 20 });
  const room = await createRoom(host);
  await request(challenger, "POST", `/rooms/${room._id}/reserve`, { walletType: "FP" });
  await User.updateOne({ _id: challenger._id }, { $set: { fpWalletBalance: 10 } });
  const failed = await request(challenger, "POST", `/rooms/${room._id}/join`, { gameUsername: "Test", walletType: "FP" });
  assert.equal(failed.status, 409);
  const fresh = await Room.findById(room._id);
  assert.equal(fresh.status, "OPEN");
  assert.equal(fresh.challenger, null);
  await assertBalances(challenger, 100, 10);
  assert.equal(await WalletTransaction.countDocuments({ user: challenger._id }), 0);
});

test("failed room creation rolls back the FP debit and ledger", async () => {
  const host = await qualifiedPlayer({ walletBalance: 100, fpWalletBalance: 20 });
  const response = await request(host, "POST", "/rooms", roomPayload("FP", { gameUsername: "x".repeat(61) }));
  assert.ok(response.status >= 400);
  await assertBalances(host, 100, 20);
  assert.equal(await WalletTransaction.countDocuments({ user: host._id }), 0);
  assert.equal(await Room.countDocuments(), 0);
});

test("canceling an FP room returns FP once, even if the client asks for Main", async () => {
  const host = await qualifiedPlayer({ walletBalance: 50, fpWalletBalance: 20 });
  const room = await createRoom(host, "FP");
  const first = await request(host, "POST", `/rooms/${room._id}/cancel`, { walletType: "MAIN" });
  assert.equal(first.status, 200);
  const second = await request(host, "POST", `/rooms/${room._id}/cancel`, {});
  assert.equal(second.status, 409);
  await assertBalances(host, 50, 20);
  const refund = await WalletTransaction.findOne({ user: host._id, type: "REFUND" });
  assert.equal(refund.walletType, "FP");
});

for (const outcome of ["DRAW", "VOID"]) {
  test(`${outcome} returns mixed wallet entries to their original wallets, once`, async () => {
    const host = await qualifiedPlayer({ walletBalance: 10, fpWalletBalance: 20 });
    const challenger = await player({ walletBalance: 40 });
    const room = await createRoom(host, "FP");
    await joinRoom(room, challenger);
    await settleRoom(room, outcome);
    await settleRoom(room, outcome);
    await assertBalances(host, 10, 20);
    await assertBalances(challenger, 40, 0);
    assert.equal(await WalletTransaction.countDocuments({ type: "REFUND" }), 2);
  });
}

for (const outcome of ["HOST_WIN", "CHALLENGER_WIN"]) {
  test(`${outcome} credits the full finalized prize to Main with an FP-funded host`, async () => {
    const host = await qualifiedPlayer({ walletBalance: 10, fpWalletBalance: 20 });
    const challenger = await player({ walletBalance: 40 });
    const room = await createRoom(host, "FP");
    await joinRoom(room, challenger);
    await Promise.all([settleRoom(room, outcome), settleRoom(room, outcome), settleRoom(room, outcome)]);
    await assertBalances(host, outcome === "HOST_WIN" ? 46 : 10, 0);
    await assertBalances(challenger, outcome === "CHALLENGER_WIN" ? 56 : 20, 0);
    const prizes = await WalletTransaction.find({ type: "PRIZE" });
    assert.equal(prizes.length, 1);
    assert.equal(prizes[0].walletType, "MAIN");
    assert.equal(prizes[0].amount, 36);
  });
}

test("opponent-confirmed FP match credits Main and produces the winning notification", async () => {
  const host = await qualifiedPlayer({ fpWalletBalance: 20 });
  const challenger = await player({ walletBalance: 20 });
  const room = await createRoom(host, "FP");
  await joinRoom(room, challenger);
  const result = await Result.create({ room: room._id, submittedBy: host._id,
    claimedOutcome: "HOST_WIN", claimedWinner: host._id, hostScore: 2,
    challengerScore: 1, screenshotUrl: "/test-result.png" });
  await Room.updateOne({ _id: room._id }, { $set: { result: result._id, status: "RESULT_PENDING" } });
  const selfConfirm = await request(host, "POST", `/rooms/${room._id}/result/confirm`, {});
  assert.equal(selfConfirm.status, 403);
  await assertBalances(host, 0, 0);
  const response = await request(challenger, "POST", `/rooms/${room._id}/result/confirm`, {});
  assert.equal(response.status, 200, JSON.stringify(response.data));
  await assertBalances(host, 36, 0);
  const notifications = await request(host, "GET", "/wallet/notifications");
  assert.ok(notifications.data.items.some((item) => item.type === "PRIZE" && item.status === "WON" && item.walletType === "MAIN"));
});

test("conflicting settlements cannot pay a prize and refunds for the same room", async () => {
  const host = await qualifiedPlayer({ fpWalletBalance: 20 });
  const challenger = await player({ walletBalance: 20 });
  const room = await createRoom(host, "FP");
  await joinRoom(room, challenger);
  const outcomes = await Promise.allSettled([settleRoom(room, "HOST_WIN"), settleRoom(room, "DRAW")]);
  assert.equal(outcomes.filter((value) => value.status === "fulfilled").length, 1);
  const settled = await Room.findById(room._id);
  if (settled.settlementOutcome === "HOST_WIN") {
    await assertBalances(host, 36, 0);
    assert.equal(await WalletTransaction.countDocuments({ type: "REFUND" }), 0);
  } else {
    await assertBalances(host, 0, 20);
    assert.equal(await WalletTransaction.countDocuments({ type: "PRIZE" }), 0);
  }
});

test("concurrent FP entries cannot spend the same balance twice", async () => {
  const host = await qualifiedPlayer({ walletBalance: 100, fpWalletBalance: 20 });
  const responses = await Promise.all([
    request(host, "POST", "/rooms", roomPayload("FP")),
    request(host, "POST", "/rooms", roomPayload("FP"))
  ]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
  await assertBalances(host, 100, 0);
  assert.equal(await Room.countDocuments(), 1);
  assert.equal(await WalletTransaction.countDocuments({ user: host._id, type: "ENTRY_FEE" }), 1);
});

test("joining and canceling concurrently cannot produce a ready refunded room", async () => {
  const host = await qualifiedPlayer({ fpWalletBalance: 20 });
  const challenger = await qualifiedPlayer({ fpWalletBalance: 20 });
  const room = await createRoom(host, "FP");
  await request(challenger, "POST", `/rooms/${room._id}/reserve`, { walletType: "FP" });
  const [cancel, join] = await Promise.all([
    request(host, "POST", `/rooms/${room._id}/cancel`, {}),
    request(challenger, "POST", `/rooms/${room._id}/join`, { gameUsername: "Test", walletType: "FP" })
  ]);
  assert.deepEqual([cancel.status, join.status].sort(), [200, 409]);
  const fresh = await Room.findById(room._id);
  await assertBalances(host, 0, fresh.status === "CANCELLED" ? 20 : 0);
  await assertBalances(challenger, 0, fresh.status === "CANCELLED" ? 20 : 0);
});

test("withdrawals reject FP and only hold Main balance", async () => {
  const user = await qualifiedPlayer({ walletBalance: 25, fpWalletBalance: 100 });
  const body = { amount: 20, method: "ESEWA", accountName: "Test", accountNumber: "9800000000" };
  const blocked = await request(user, "POST", "/wallet/withdraw", { ...body, walletType: "FP" });
  assert.equal(blocked.status, 400);
  await assert.rejects(holdWithdrawal(user._id, 10, { walletType: "FP" }), /FP Wallet cannot be withdrawn/);
  await assertBalances(user, 25, 100);
  const success = await request(user, "POST", "/wallet/withdraw", body);
  assert.equal(success.status, 201, JSON.stringify(success.data));
  await assertBalances(user, 5, 100, 20);
  const insufficient = await request(user, "POST", "/wallet/withdraw", body);
  assert.equal(insufficient.status, 409);
  await assertBalances(user, 5, 100, 20);
});

test("API clients cannot set wallet balances or transfer FP into Main", async () => {
  const user = await qualifiedPlayer({ walletBalance: 10, fpWalletBalance: 20 });
  const response = await request(user, "PATCH", "/auth/me", { walletBalance: 50000, fpWalletBalance: 50000 });
  assert.equal(response.status, 200);
  const transfer = await request(user, "POST", "/wallet/transfer", { amount: 20, from: "FP", to: "MAIN" });
  assert.equal(transfer.status, 404);
  await assertBalances(user, 10, 20);
});

test("legacy rooms with no funding fields refund Main and preserve existing balances", async () => {
  const user = await player({ walletBalance: 20 });
  const room = await createRoom(user);
  await Room.collection.updateOne({ _id: new mongoose.Types.ObjectId(room._id) },
    { $unset: { hostWalletType: "", challengerWalletType: "" } });
  const response = await request(user, "POST", `/rooms/${room._id}/cancel`, {});
  assert.equal(response.status, 200);
  await assertBalances(user, 20, 0);
  const wallet = await request(user, "GET", "/wallet");
  assert.equal(wallet.data.fpBalance, 0);
  assert.equal(wallet.data.fpMinimumSuccessfulReferrals, 4);
});
