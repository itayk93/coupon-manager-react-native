import fs from "node:fs";
import path from "node:path";
import { expect, type Page } from "@playwright/test";

export interface CouponFixture {
  authUser: { id: string; email: string; role: string; aud: string };
  legacyUser: {
    id: number;
    public_id: string;
    auth_user_id: string;
    email: string;
    first_name: string;
    last_name: string;
    gender: string;
    is_admin: boolean;
    is_confirmed: boolean;
    dismissed_onboarding: boolean;
    show_onboarding_widget: boolean;
  };
  companies: Array<{ id: number; name: string; image_path: string }>;
  coupons: Array<Record<string, any>>;
  notifications: Array<Record<string, any>>;
  usageHistory: Record<string, Array<Record<string, any>>>;
}

export function loadSanitizedFixture(): CouponFixture {
  const file = path.resolve(process.cwd(), "e2e/sanitized-fixture.json");
  return JSON.parse(fs.readFileSync(file, "utf8")) as CouponFixture;
}

function b64Url(obj: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(obj))
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function makeFakeJwt(sub: string, email: string): string {
  const header = b64Url({ alg: "HS256", typ: "JWT" });
  const payload = b64Url({
    aud: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 3600,
    sub,
    email,
    role: "authenticated",
  });
  return `${header}.${payload}.e2e-signature`;
}

export interface MockCouponBackendOptions {
  aiConsentGranted?: boolean;
  vaultNetworkError?: boolean;
  parseShouldFail?: boolean;
}

export interface MockCouponBackendState {
  coupons: Array<Record<string, any>>;
  userMetadata: Record<string, any>;
  tutorials: Record<string, string>;
  vaultNetworkError: boolean;
  parseShouldFail: boolean;
  accountDeleted: boolean;
  parseCalls: Array<Record<string, any>>;
  vaultActions: string[];
  exportCalls: number;
  deleteAccountCalls: number;
  passwordResetCalls: Array<Record<string, any>>;
  signupCalls: Array<Record<string, any>>;
  externalRequests: string[];
}

export async function setupCouponBackend(
  page: Page,
  options: MockCouponBackendOptions = {}
): Promise<MockCouponBackendState> {
  const fixture = loadSanitizedFixture();
  const state: MockCouponBackendState = {
    coupons: structuredClone(fixture.coupons),
    userMetadata: options.aiConsentGranted
      ? {
          coupon_ai_consent: {
            granted: true,
            version: "coupon-openai-v1",
            provider: "openai",
            updatedAt: "2026-11-27T10:00:00.000Z",
          },
        }
      : {},
    tutorials: {},
    vaultNetworkError: Boolean(options.vaultNetworkError),
    parseShouldFail: Boolean(options.parseShouldFail),
    accountDeleted: false,
    parseCalls: [],
    vaultActions: [],
    exportCalls: 0,
    deleteAccountCalls: 0,
    passwordResetCalls: [],
    signupCalls: [],
    externalRequests: [],
  };

  let nextCouponId = 200;
  let nextUsageId = 800;

  await page.emulateMedia({ reducedMotion: "reduce" });

  await page.route("**/*", async (route) => {
    const req = route.request();
    const urlStr = req.url();
    const url = new URL(urlStr);

    if (url.hostname === "127.0.0.1" || url.hostname === "localhost" || urlStr.startsWith("data:") || urlStr.startsWith("blob:")) {
      await route.continue();
      return;
    }

    if (url.hostname === "fonts.googleapis.com") {
      await route.fulfill({ status: 200, contentType: "text/css", body: "" });
      return;
    }

    if (url.hostname === "fonts.gstatic.com") {
      await route.fulfill({ status: 200, contentType: "font/woff2", body: "" });
      return;
    }

    if (!url.hostname.endsWith("supabase.co")) {
      state.externalRequests.push(urlStr);
      await route.abort("blockedbyclient");
      return;
    }

    const pathname = url.pathname;
    const method = req.method().toUpperCase();
    const headers = req.headers();
    let body: Record<string, any> = {};
    try {
      const postData = req.postData();
      if (postData) body = JSON.parse(postData);
    } catch {
      body = {};
    }

    if (pathname === "/auth/v1/token") {
      if (state.accountDeleted || body.password === "wrong-password") {
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({
            error: "invalid_grant",
            error_description: "Invalid login credentials",
          }),
        });
        return;
      }

      const token = makeFakeJwt(fixture.authUser.id, fixture.authUser.email);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          access_token: token,
          token_type: "bearer",
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          refresh_token: "e2e-refresh-token",
          user: {
            ...fixture.authUser,
            user_metadata: state.userMetadata,
          },
        }),
      });
      return;
    }

    if (pathname === "/auth/v1/user") {
      if (state.accountDeleted) {
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ message: "User deleted" }),
        });
        return;
      }
      if (method === "PUT" || method === "PATCH") {
        state.userMetadata = {
          ...state.userMetadata,
          ...(body.data || {}),
        };
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...fixture.authUser,
          user_metadata: state.userMetadata,
        }),
      });
      return;
    }

    if (pathname === "/auth/v1/signup") {
      state.signupCalls.push(body);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: {
            id: "e2e-new-user-0002",
            email: body.email,
            identities: [{ id: "e2e-ident-2" }],
          },
          session: null,
        }),
      });
      return;
    }

    if (pathname === "/auth/v1/logout") {
      await route.fulfill({ status: 204, body: "" });
      return;
    }

    if (pathname === "/functions/v1/coupon-vault") {
      const action = String(body.action || "");
      state.vaultActions.push(action);

      if (state.vaultNetworkError) {
        await route.abort("failed");
        return;
      }

      if (action === "list") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: state.coupons.filter((c) => !c.deleted_at) }),
        });
        return;
      }

      if (action === "list_deleted") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: state.coupons.filter((c) => Boolean(c.deleted_at)) }),
        });
        return;
      }

      if (action === "get") {
        const found = state.coupons.find((c) =>
          body.publicId ? c.public_id === body.publicId : c.id === Number(body.id)
        );
        if (!found) {
          await route.fulfill({
            status: 404,
            contentType: "application/json",
            body: JSON.stringify({ error: "Not found" }),
          });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: found }),
        });
        return;
      }

      if (action === "create") {
        const id = nextCouponId++;
        const created = {
          ...(body.coupon || {}),
          id,
          public_id: `cpn_e2e_${id}`,
          user_id: fixture.legacyUser.id,
          used_value: body.coupon?.used_value ?? 0,
          status: body.coupon?.status ?? "פעיל",
          date_added: new Date().toISOString(),
          is_shared_with_me: false,
        };
        state.coupons.unshift(created);
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({ data: created }),
        });
        return;
      }

      if (action === "update") {
        const target = state.coupons.find((c) => c.id === Number(body.id));
        if (!target) {
          await route.fulfill({
            status: 404,
            contentType: "application/json",
            body: JSON.stringify({ error: "Not found" }),
          });
          return;
        }
        Object.assign(target, body.updates || {});
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: target }),
        });
        return;
      }

      if (action === "soft_delete") {
        const ids = Array.isArray(body.ids) ? body.ids.map(Number) : [];
        const now = new Date().toISOString();
        for (const c of state.coupons) {
          if (ids.includes(c.id)) c.deleted_at = now;
        }
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: { deleted: ids.length } }),
        });
        return;
      }

      if (action === "restore") {
        const ids = Array.isArray(body.ids) ? body.ids.map(Number) : [];
        for (const c of state.coupons) {
          if (ids.includes(c.id)) delete c.deleted_at;
        }
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: { ids } }),
        });
        return;
      }

      if (action === "export_account") {
        state.exportCalls += 1;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: {
              exported_at: new Date().toISOString(),
              user: fixture.legacyUser,
              coupons: state.coupons,
            },
          }),
        });
        return;
      }

      if (action === "delete_account") {
        state.deleteAccountCalls += 1;
        state.accountDeleted = true;
        state.coupons = [];
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: { deleted: true } }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: {} }),
      });
      return;
    }

    if (pathname === "/functions/v1/parse-coupon") {
      state.parseCalls.push(body);
      if (state.parseShouldFail) {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "שגיאה זמנית בפענוח, אפשר לנסות שוב" }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          coupons: [
            {
              company: "BuyMe",
              code: "AI-E2E-777",
              value: 120,
              expiration: "2027-08-15",
              description: "שובר E2E מחולץ",
            },
          ],
        }),
      });
      return;
    }

    if (pathname === "/functions/v1/send-password-reset") {
      state.passwordResetCalls.push(body);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
      return;
    }

    if (pathname === "/functions/v1/manage-user-tour") {
      if (body.action === "mark_tutorial" && body.tutorial_key) {
        state.tutorials[String(body.tutorial_key)] = new Date().toISOString();
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, tutorials: state.tutorials }),
      });
      return;
    }

    if (pathname.startsWith("/functions/v1/")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, merchants: [] }),
      });
      return;
    }

    if (pathname === "/rest/v1/users") {
      const wantsObject = String(headers.accept || "").includes("vnd.pgrst.object+json");
      if (state.accountDeleted) {
        if (wantsObject) {
          await route.fulfill({
            status: 406,
            contentType: "application/json",
            body: JSON.stringify({
              code: "PGRST116",
              details: "The result contains 0 rows",
              message: "JSON object requested, multiple (or no) rows returned",
            }),
          });
        } else {
          await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
        }
        return;
      }
      if (wantsObject) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(fixture.legacyUser),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([fixture.legacyUser]),
        });
      }
      return;
    }

    if (pathname === "/rest/v1/rpc/record_coupon_usage") {
      const couponId = Number(body.p_coupon_id);
      const usedAmount = Number(body.p_used_amount || 0);
      const target = state.coupons.find((c) => c.id === couponId);
      if (target) {
        target.used_value = (target.used_value || 0) + usedAmount;
        if (target.used_value >= (target.value || 0)) {
          target.status = "נוצל";
        }
      }
      const list = (fixture.usageHistory[String(couponId)] ||= []);
      list.push({
        id: nextUsageId++,
        coupon_id: couponId,
        transaction_amount: -usedAmount,
        details: body.p_details || "דיווח שימוש",
        timestamp: body.p_timestamp || new Date().toISOString(),
        source_table: "coupon_transaction",
      });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
      return;
    }

    if (pathname === "/rest/v1/companies") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(fixture.companies),
      });
      return;
    }

    if (pathname === "/rest/v1/notifications") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(fixture.notifications),
      });
      return;
    }

    if (pathname === "/rest/v1/coupon_transaction") {
      const eqMatch = url.search.match(/coupon_id=eq\.(\d+)/);
      const couponId = eqMatch?.[1];
      const rows = couponId ? fixture.usageHistory[couponId] || [] : Object.values(fixture.usageHistory).flat();
      const mapped = rows.map((r) => ({
        id: r.id,
        coupon_id: r.coupon_id,
        transaction_date: r.timestamp,
        usage_amount: Math.abs(Number(r.transaction_amount || 0)),
        recharge_amount: 0,
        location: r.details || "",
        source: "manual",
      }));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mapped),
      });
      return;
    }

    if (pathname.startsWith("/rest/v1/")) {
      const wantsObject = String(headers.accept || "").includes("vnd.pgrst.object+json");
      await route.fulfill({
        status: wantsObject ? 406 : 200,
        contentType: "application/json",
        body: wantsObject
          ? JSON.stringify({ code: "PGRST116", details: "0 rows", message: "0 rows" })
          : "[]",
      });
      return;
    }

    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  return state;
}

export async function signInViaUi(page: Page): Promise<void> {
  const fixture = loadSanitizedFixture();
  await page.goto("/login");
  await expect(page.getByTestId("login-email")).toBeVisible();
  await page.getByTestId("login-email").fill(fixture.authUser.email);
  await page.getByTestId("login-password").pressSequentially("e2e-synthetic-pass");
  await page.getByTestId("login-submit").click();
  await expect(page.getByText("BuyMe").first()).toBeVisible({ timeout: 15_000 });
}

export function attachErrorTracker(page: Page): { errors: string[] } {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.push(`console.error: ${msg.text()}`);
    }
  });
  return { errors };
}

export async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  const dims = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(dims.scrollWidth).toBeLessThanOrEqual(dims.clientWidth + 1);
}
