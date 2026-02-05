// src/modules/billing/razorpay.routes.ts

import { Router } from "express";
import Razorpay from "razorpay";
import crypto from "crypto";
import { authenticate } from "../../middleware/auth";
import { AppError } from "../../middleware/errorHandler";
import prisma from "../../config/database";
import { PlanType } from "@prisma/client";

const router = Router();
router.use(authenticate);

console.log("✅ Razorpay routes loaded");

// ✅ Your duration pricing (INR paise)
export const PRICE_MAP: Record<string, { amount: number; months: number; label: string }> = {
  monthly: { amount: 89900, months: 1, label: "Monthly" },
  three_month: { amount: 250000, months: 3, label: "3-Month" },
  six_month: { amount: 500000, months: 6, label: "6-Month" },
  one_year: { amount: 899900, months: 12, label: "1-Year" },
};

type PlanKey = keyof typeof PRICE_MAP;

let razorpayClient: Razorpay | null = null;

function getRazorpayClient() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    // ✅ clear message for you
    throw new AppError("Razorpay keys missing in backend .env (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET)", 500);
  }

  if (!razorpayClient) {
    razorpayClient = new Razorpay({ key_id: keyId, key_secret: keySecret });
  }

  return razorpayClient;
}

async function assertOwner(organizationId: string, userId: string) {
  const org = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!org) throw new AppError("Organization not found", 404);
  if (org.ownerId !== userId) throw new AppError("Only owner can make payments/upgrade", 403);
}

router.post("/create-order", async (req: any, res, next) => {
  try {
    const organizationId = req.user?.organizationId as string | undefined;
    const userId = req.user?.id as string | undefined;

    if (!organizationId) throw new AppError("Organization context required", 400);
    if (!userId) throw new AppError("Authentication required", 401);

    await assertOwner(organizationId, userId);

    const planKey = req.body?.planKey as PlanKey | undefined;
    if (!planKey) throw new AppError("planKey is required", 400);

    const selected = PRICE_MAP[planKey];
    if (!selected) throw new AppError("Invalid planKey", 400);

    const razorpay = getRazorpayClient();

    const order = await razorpay.orders.create({
      amount: selected.amount,
      currency: "INR",
      receipt: `org_${organizationId}_${Date.now()}`.slice(0, 40), // Razorpay receipt limit safety
      notes: { organizationId, planKey },
    });

    return res.json({
      success: true,
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: process.env.RAZORPAY_KEY_ID, // public key to frontend
        planKey,
      },
    });
  } catch (e: any) {
    console.error("❌ Razorpay create-order error:", e);

    // ✅ Razorpay SDK errors come with statusCode + error object
    if (e?.statusCode) {
      return next(new AppError(e?.error?.description || e?.message || "Razorpay error", e.statusCode));
    }

    return next(e);
  }
});

router.post("/verify", async (req: any, res, next) => {
  try {
    const organizationId = req.user?.organizationId as string | undefined;
    const userId = req.user?.id as string | undefined;

    if (!organizationId) throw new AppError("Organization context required", 400);
    if (!userId) throw new AppError("Authentication required", 401);

    await assertOwner(organizationId, userId);

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planKey } = req.body || {};
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !planKey) {
      throw new AppError("Missing payment verification fields", 400);
    }

    const selected = PRICE_MAP[planKey as PlanKey];
    if (!selected) throw new AppError("Invalid planKey", 400);

    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) throw new AppError("Razorpay secret missing in backend .env", 500);

    // ✅ Verify signature
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");

    if (expected !== razorpay_signature) {
      throw new AppError("Payment verification failed", 400);
    }

    // ✅ Activate paid plan: map all paid packages to PRO
    const planType = PlanType.PRO;
    const plan = await prisma.plan.findUnique({ where: { type: planType } });
    if (!plan) throw new AppError("PRO plan missing in DB", 404);

    const now = new Date();
    const end = new Date(now);
    end.setMonth(end.getMonth() + selected.months);

    await prisma.$transaction(async (tx) => {
      await tx.organization.update({
        where: { id: organizationId },
        data: { planType },
      });

      await tx.subscription.upsert({
        where: { organizationId },
        update: {
          planId: plan.id,
          status: "ACTIVE",
          billingCycle: planKey, // store duration key
          currentPeriodStart: now,
          currentPeriodEnd: end,
          cancelledAt: null,
          lastPaymentAt: now,
          nextPaymentAt: end,
        },
        create: {
          organizationId,
          planId: plan.id,
          status: "ACTIVE",
          billingCycle: planKey,
          currentPeriodStart: now,
          currentPeriodEnd: end,
          lastPaymentAt: now,
          nextPaymentAt: end,
        },
      });

      await tx.activityLog.create({
        data: {
          organizationId,
          userId,
          action: "billing.razorpay_success",
          metadata: { planKey, razorpay_order_id, razorpay_payment_id },
        },
      });
    });

    return res.json({ success: true, message: "Payment verified & subscription activated" });
  } catch (e: any) {
    console.error("❌ Razorpay verify error:", e);

    if (e?.statusCode) {
      return next(new AppError(e?.error?.description || e?.message || "Razorpay error", e.statusCode));
    }

    return next(e);
  }
});

export default router;