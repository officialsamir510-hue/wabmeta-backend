import axios from 'axios';
import prisma from '../../config/database';
import { config } from '../../config';
import { AppError } from '../../middleware/errorHandler';

const GRAPH_API_VERSION = config.meta?.graphApiVersion || 'v21.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

type Waba = { id: string; name?: string; business?: { id: string } };
type PhoneNumber = {
  id: string; // phone_number_id
  display_phone_number?: string;
  verified_name?: string;
  quality_rating?: string;
  status?: string;
};

const digitsOnly = (v: string) => String(v || '').replace(/\D/g, '');

export class MetaService {
  // =========================================================
  // OAuth: exchange code for token
  // =========================================================
  static async exchangeCodeForToken(code: string) {
    try {
      const response = await axios.get(`${GRAPH_API_BASE}/oauth/access_token`, {
        params: {
          client_id: config.meta.appId,
          client_secret: config.meta.appSecret,
          redirect_uri: config.meta.redirectUri,
          code,
        },
      });

      return response.data as { access_token: string; token_type?: string; expires_in?: number };
    } catch (error: any) {
      const msg = error?.response?.data?.error?.message || error.message || 'Token exchange failed';
      throw new AppError(msg, 400);
    }
  }

  // =========================================================
  // Read WABA IDs from debug_token granular scopes
  // =========================================================
  private static async getWabaIdsFromToken(accessToken: string): Promise<string[]> {
    const resp = await axios.get(`${GRAPH_API_BASE}/debug_token`, {
      params: {
        input_token: accessToken,
        access_token: `${config.meta.appId}|${config.meta.appSecret}`,
      },
    });

    const granular = resp.data?.data?.granular_scopes || [];
    const wabaScope = granular.find((s: any) => s.scope === 'whatsapp_business_management');
    const ids = wabaScope?.target_ids || [];
    return Array.isArray(ids) ? ids : [];
  }

  static async getWhatsAppBusinessAccounts(accessToken: string): Promise<Waba[]> {
    const wabaIds = await this.getWabaIdsFromToken(accessToken);

    if (!wabaIds.length) return [];

    const wabas = await Promise.all(
      wabaIds.map(async (wabaId) => {
        const r = await axios.get(`${GRAPH_API_BASE}/${wabaId}`, {
          params: { access_token: accessToken, fields: 'id,name,business' },
        });
        return r.data as Waba;
      })
    );

    return wabas.filter(Boolean);
  }

  private static async getPhoneNumbersForWaba(wabaId: string, accessToken: string): Promise<PhoneNumber[]> {
    try {
      const r = await axios.get(`${GRAPH_API_BASE}/${wabaId}/phone_numbers`, {
        params: {
          access_token: accessToken,
          fields: 'id,display_phone_number,verified_name,quality_rating,status',
        },
      });
      return (r.data?.data || []) as PhoneNumber[];
    } catch (e) {
      return [];
    }
  }

  // =========================================================
  // CONNECT (Embedded Signup / OAuth code)
  // =========================================================
  static async connectEmbeddedSignup(organizationId: string, code: string, _state?: string) {
    if (!organizationId) throw new AppError('Organization ID is required', 400);

    const token = await this.exchangeCodeForToken(code);
    const accessToken = token.access_token;

    if (!accessToken) throw new AppError('Access token missing from Meta', 400);

    const wabas = await this.getWhatsAppBusinessAccounts(accessToken);
    if (!wabas.length) throw new AppError('No WhatsApp Business Account found', 400);

    const primaryWaba = wabas[0];

    // ✅ IMPORTANT: only use fields that exist in your schema
    const metaConnection = await prisma.metaConnection.upsert({
      where: { organizationId },
      create: {
        organizationId,
        accessToken, // string (non-null)
        status: 'CONNECTED',
        wabaId: primaryWaba.id,
      },
      update: {
        accessToken,
        status: 'CONNECTED',
        wabaId: primaryWaba.id,
      },
    });

    // phone numbers from WABA(s)
    const allPhones: Array<PhoneNumber & { wabaId: string; wabaName?: string }> = [];
    for (const waba of wabas) {
      const nums = await this.getPhoneNumbersForWaba(waba.id, accessToken);
      nums.forEach((p) => allPhones.push({ ...p, wabaId: waba.id, wabaName: waba.name }));
    }

    if (!allPhones.length) {
      throw new AppError('No phone numbers found in your WhatsApp Business Account', 400);
    }

    // Create/update WhatsApp accounts in DB (organization-scoped)
    const saved: any[] = [];

    for (let i = 0; i < allPhones.length; i++) {
      const p = allPhones[i];
      const isFirst = i === 0;

      // phoneNumberId should be unique in ideal schema; if not, we still "findFirst"
      const existing = await prisma.whatsAppAccount.findFirst({
        where: { phoneNumberId: p.id },
      });

      const phoneNumber = p.display_phone_number || '';
      const displayName = p.verified_name || p.wabaName || 'WhatsApp Business';

      if (existing) {
        const updated = await prisma.whatsAppAccount.update({
          where: { id: existing.id },
          data: {
            organizationId, // ✅ enforce correct org
            phoneNumber,
            displayName,
            wabaId: p.wabaId,
            accessToken, // string
            status: 'CONNECTED',
            isDefault: existing.isDefault || isFirst,
          },
        });

        saved.push(updated);
      } else {
        const created = await prisma.whatsAppAccount.create({
          data: {
            organizationId,
            phoneNumberId: p.id,
            phoneNumber,
            displayName,
            wabaId: p.wabaId,
            accessToken,
            status: 'CONNECTED',
            isDefault: isFirst,
          },
        });

        saved.push(created);
      }
    }

    // Ensure there is a default account for this org
    const hasDefault = await prisma.whatsAppAccount.findFirst({
      where: { organizationId, isDefault: true },
    });

    if (!hasDefault && saved.length) {
      await prisma.whatsAppAccount.update({
        where: { id: saved[0].id },
        data: { isDefault: true },
      });
    }

    return {
      id: metaConnection.id,
      isConnected: true,
      status: 'CONNECTED',
      wabaId: metaConnection.wabaId,
      connectedAt: metaConnection.updatedAt, // derived (schema me connectedAt nahi hai)
      accounts: saved.map((a) => ({
        id: a.id,
        phoneNumberId: a.phoneNumberId,
        phoneNumber: a.phoneNumber,
        displayName: a.displayName,
        status: a.status,
        isDefault: a.isDefault,
        wabaId: a.wabaId,
      })),
    };
  }

  // =========================================================
  // STATUS
  // =========================================================
  static async getConnectionStatus(organizationId: string) {
    const connection = await prisma.metaConnection.findFirst({
      where: { organizationId },
    });

    const accounts = await prisma.whatsAppAccount.findMany({
      where: { organizationId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    const connectedAccounts = accounts.filter((a) => a.status === 'CONNECTED');
    const isConnected = (connection?.status === 'CONNECTED') && connectedAccounts.length > 0;

    return {
      isConnected,
      status: connection?.status || 'DISCONNECTED',
      wabaId: connection?.wabaId || null,
      connectedAt: connection?.updatedAt || null, // derived
      accounts: accounts.map((a) => ({
        id: a.id,
        phoneNumberId: a.phoneNumberId,
        phoneNumber: a.phoneNumber,
        displayName: a.displayName,
        status: a.status,
        isDefault: a.isDefault,
        wabaId: a.wabaId,
      })),
    };
  }

  // =========================================================
  // PHONE NUMBERS (Public for controller)
  // =========================================================
  static async getPhoneNumbers(organizationId: string) {
    const accounts = await prisma.whatsAppAccount.findMany({
      where: { organizationId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    return accounts.map((a) => ({
      id: a.id,
      phoneNumberId: a.phoneNumberId,
      phoneNumber: a.phoneNumber,
      displayName: a.displayName,
      status: a.status,
      isDefault: a.isDefault,
      wabaId: a.wabaId,
    }));
  }

  // =========================================================
  // REGISTER PHONE NUMBER
  // =========================================================
  static async registerPhoneNumber(organizationId: string, phoneNumberId: string, pin: string) {
    const connection = await prisma.metaConnection.findFirst({
      where: { organizationId, status: 'CONNECTED' },
    });

    if (!connection?.accessToken) throw new AppError('Meta connection not found', 404);

    try {
      const r = await axios.post(
        `${GRAPH_API_BASE}/${phoneNumberId}/register`,
        { messaging_product: 'whatsapp', pin },
        { headers: { Authorization: `Bearer ${connection.accessToken}` } }
      );
      return r.data;
    } catch (error: any) {
      const msg = error?.response?.data?.error?.message || error.message || 'Register failed';
      throw new AppError(msg, 400);
    }
  }

  // =========================================================
  // BUSINESS ACCOUNTS
  // =========================================================
  static async getBusinessAccounts(organizationId: string) {
    const connection = await prisma.metaConnection.findFirst({
      where: { organizationId, status: 'CONNECTED' },
    });

    if (!connection?.accessToken) throw new AppError('Meta connection not found', 404);

    const wabas = await this.getWhatsAppBusinessAccounts(connection.accessToken);
    return wabas.map((w) => ({ id: w.id, name: w.name || 'WABA' }));
  }

  // =========================================================
  // SEND TEST MESSAGE
  // =========================================================
  static async sendTestMessage(organizationId: string, phoneNumberId: string, to: string, message: string) {
    const wa = await prisma.whatsAppAccount.findFirst({
      where: { organizationId, phoneNumberId, status: 'CONNECTED' },
    });

    if (!wa?.accessToken) throw new AppError('WhatsApp account not found', 404);

    try {
      const r = await axios.post(
        `${GRAPH_API_BASE}/${phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: digitsOnly(to),
          type: 'text',
          text: { body: message },
        },
        { headers: { Authorization: `Bearer ${wa.accessToken}` } }
      );

      return { success: true, messageId: r.data?.messages?.[0]?.id || null };
    } catch (error: any) {
      const msg = error?.response?.data?.error?.message || error.message || 'Send failed';
      throw new AppError(msg, 400);
    }
  }

  // =========================================================
  // DISCONNECT (no null tokens because schema string)
  // =========================================================
  static async disconnect(organizationId: string) {
    await prisma.metaConnection.updateMany({
      where: { organizationId },
      data: {
        status: 'DISCONNECTED',
        accessToken: '', // ✅ schema me string hai
      },
    });

    await prisma.whatsAppAccount.updateMany({
      where: { organizationId },
      data: {
        status: 'DISCONNECTED',
        accessToken: '', // ✅ schema me string hai
        isDefault: false,
      },
    });

    return { success: true, message: 'Disconnected successfully' };
  }

  // =========================================================
  // REFRESH CONNECTION (token validity)
  // =========================================================
  static async refreshConnection(organizationId: string) {
    const connection = await prisma.metaConnection.findFirst({
      where: { organizationId, status: 'CONNECTED' },
    });

    if (!connection?.accessToken) return { isConnected: false, status: 'DISCONNECTED' };

    try {
      const resp = await axios.get(`${GRAPH_API_BASE}/debug_token`, {
        params: {
          input_token: connection.accessToken,
          access_token: `${config.meta.appId}|${config.meta.appSecret}`,
        },
      });

      const isValid = !!resp.data?.data?.is_valid;
      if (!isValid) {
        await this.disconnect(organizationId);
        return { isConnected: false, status: 'TOKEN_EXPIRED' };
      }

      return await this.getConnectionStatus(organizationId);
    } catch {
      return { isConnected: false, status: 'ERROR' };
    }
  }
}