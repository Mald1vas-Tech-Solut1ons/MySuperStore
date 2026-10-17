import axios, { type AxiosProgressEvent } from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

// Injeta o Authorization header a partir do token em localStorage
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
  }
  // Upload de arquivos (avatar): remove o Content-Type JSON para o browser
  // definir multipart/form-data com o boundary correto.
  if (typeof FormData !== "undefined" && config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
});

// Refresh "single-flight": se várias requisições tomam 401 ao mesmo tempo
// (comum no mobile ao abrir o app), todas aguardam UM único refresh em vez de
// dispararem refreshes concorrentes que se atropelam.
let refreshPromise: Promise<string | null> | null = null;

function performTokenRefresh(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const refresh = localStorage.getItem("refresh_token");
    if (!refresh) return null;
    try {
      const { data } = await axios.post(`${API_URL}/auth/token/refresh/`, { refresh });
      localStorage.setItem("access_token", data.access);
      // ROTATE_REFRESH_TOKENS=True devolve um novo refresh — PRECISA ser salvo,
      // senão o próximo refresh usaria um token velho e cairia em logout.
      if (data.refresh) localStorage.setItem("refresh_token", data.refresh);
      // Mantém o store em sincronia com o localStorage.
      const mod = await import("@/store/authStore");
      const store = mod.useAuthStore.getState();
      store.updateTokens?.(data.access, data.refresh ?? refresh);
      return data.access as string;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

// Renova o access_token automaticamente se receber 401
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    // Não tenta refresh para o próprio endpoint de refresh/login (evita loop).
    const url: string = original?.url || "";
    const isAuthCall = url.includes("/auth/token/refresh") || url.includes("/auth/login");
    if (err.response?.status === 401 && !original._retry && !isAuthCall) {
      original._retry = true;
      const newAccess = await performTokenRefresh();
      if (newAccess) {
        original.headers['Authorization'] = `Bearer ${newAccess}`;
        return api(original);
      }
      // Refresh realmente falhou (token expirado/ inválido) → encerra a sessão.
      const mod = await import("@/store/authStore");
      mod.useAuthStore.getState().logout();
    }
    return Promise.reject(err);
  }
);

// ── Helpers tipados ───────────────────────────────────────────────────────────
export const authApi = {
  register: (data: RegisterPayload) => api.post("/auth/register/", data),
  login: (email: string, password: string) =>
    api.post<TokenPair>("/auth/login/", { email, password }),
  googleLogin: (token: string, role?: string) =>
    api.post("/auth/google/", { token, role }),
  refresh: (refresh: string) => api.post<{ access: string }>("/auth/token/refresh/", { refresh }),
  me: () => api.get("/users/me/"),
  // MeView aceita apenas PATCH (PUT retornava 405). Suporta JSON e multipart (avatar).
  updateProfile: (data: any) => api.patch("/users/me/", data),
  changePassword: (payload: { old_password: string; new_password: string; new_password_confirm: string }) =>
    api.post("/auth/change-password/", payload),
  verifyEmail: (token: string) => api.post("/auth/verify-email/", { token }),
  resendVerification: () => api.post("/auth/resend-verification/"),
};

// Perfil estendido: endereços, survey demográfico
export const usersApi = {
  survey: () => api.get("/users/me/survey/"),
  saveSurvey: (data: Record<string, unknown>) => api.post("/users/me/survey/", data),
  addresses: () => api.get("/users/me/addresses/"),
  createAddress: (data: Record<string, unknown>) => api.post("/users/me/addresses/", data),
  updateAddress: (id: string, data: Record<string, unknown>) => api.patch(`/users/me/addresses/${id}/`, data),
  deleteAddress: (id: string) => api.delete(`/users/me/addresses/${id}/`),
};

export const catalogApi = {
  products: (params?: Record<string, unknown>) => api.get("/catalog/products/", { params }),
  product: (slug: string) => api.get(`/catalog/products/${slug}/`),
  categories: () => api.get("/catalog/categories/"),
  tree: () => api.get("/catalog/categories/tree/"),
  brands: () => api.get("/catalog/brands/"),
  banners: () => api.get("/catalog/banners/"),
  setPromo: (slug: string, data: { promotional_price: number | null, promo_ends_at: string | null }) => 
    api.patch(`/catalog/products/${slug}/set-promo/`, data),
  track: (slug: string, type: "view" | "click") => api.post(`/catalog/products/${slug}/track/`, { type }),
  getCategories: () => api.get("/catalog/categories/"),
  getSellerPublicProfile: (slug: string) => api.get(`/sellers/${slug}/`),
  // Lojas públicas; { featured: 1 } traz só as em destaque, na ordem do admin.
  stores: (params?: Record<string, unknown>) => api.get("/sellers/", { params }),
};

export const cartApi = {
  get: () => api.get("/cart/"),
  addItem: (variantId: string, quantity: number) =>
    api.post("/cart/items/", { variant_id: variantId, quantity }),
  updateItem: (itemId: string, quantity: number) =>
    api.patch(`/cart/items/${itemId}/`, { quantity }),
  removeItem: (itemId: string) => api.delete(`/cart/items/${itemId}/`),
  applyCoupon: (code: string) => api.post("/cart/apply_coupon/", { code }),
  triggerAbandonedEmails: () => api.post("/cart/trigger-abandoned-emails/"),
  shippingQuote: (destination_cep: string) => api.post("/cart/shipping/quote/", { destination_cep }),
  shippingSelect: (selected_shipping: any) => api.post("/cart/shipping/select/", { selected_shipping }),
};

export const sellerApi = {
  me: () => api.get("/sellers/me/"),
  update: (data: any) => api.patch("/sellers/me/", data),
  updateMultipart: (formData: FormData) => 
    api.patch("/sellers/me/", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  apply: (data: { store_name: string; description: string; pix_key?: string; efi_payee_code?: string; origin_cep?: string; cpf_cnpj?: string; person_type?: string; main_category?: string; }) =>
    api.post("/sellers/apply/", data),

};

export const ordersApi = {
  getAll: () => api.get("/orders/"),
  get: (orderNumber: string) => api.get(`/orders/${orderNumber}/`),
  create: (data: any) => api.post("/orders/", data),
};

export type PaymentMethodChoice = "pix" | "credit_card" | "debit_card";

export const paymentsApi = {
  processPayment: (payload: { order_id: string, payment_method: PaymentMethodChoice, payment_token?: string, installments?: number, billing_address?: any, customer?: any }) =>
    api.post("/payments/process/", payload),
  confirmPix: (paymentId: string) => api.post(`/payments/${paymentId}/confirm-pix/`),
  simulatePix: (paymentId: string) => api.post(`/payments/${paymentId}/simulate-pix/`),
  cancel: (paymentId: string) => api.post(`/payments/${paymentId}/cancel/`),
  refund: (paymentId: string, amount?: number) =>
    api.post(`/payments/${paymentId}/refund/`, amount != null ? { amount } : {}),
  status: (paymentId: string) => api.get(`/payments/${paymentId}/`),
};

export const returnsApi = {
  requestReturn: (orderItemId: string, reason: string, customerNotes: string) => 
    api.post("/orders/returns/", {
      order_item_id: orderItemId,
      reason,
      customer_notes: customerNotes
    }),
  updateStatus: (returnId: string, status: string, sellerNotes?: string) => 
    api.patch(`/orders/returns/${returnId}/update_status/`, {
      status,
      seller_notes: sellerNotes
    }),
};

export const sellerOrdersApi = {
  getAll: () => api.get("/orders/seller/orders/"),
  getById: (id: string) => api.get(`/orders/seller/orders/${id}/`),
  updateStatus: (subOrderId: string, status: string, trackingCode?: string, carrierName?: string, estimatedDeliveryDate?: string) =>
    api.patch(`/orders/seller/orders/${subOrderId}/update_status/`, { 
      status, 
      tracking_code: trackingCode,
      carrier_name: carrierName,
      estimated_delivery_date: estimatedDeliveryDate
    }),
  uploadInvoice: (subOrderId: string, invoice_link: string) =>
    api.post(`/orders/seller/orders/${subOrderId}/upload_invoice/`, { invoice_link }),
};

export const wishlistApi = {
  get: () => api.get("/catalog/wishlist/my/"),
  add: (product: any) => api.post("/catalog/wishlist/add/", { product_id: product.id }),
  remove: (productId: string) => api.post("/catalog/wishlist/remove/", { product_id: productId }),
};

export const reviewApi = {
  getReviews: (productSlug: string) => api.get(`/catalog/products/${productSlug}/reviews/`),
  submit: (productSlug: string, data: { rating: number; subject: string; body: string }) => 
    api.post(`/catalog/products/${productSlug}/reviews/`, data),
};

export const userApi = {
  getRecap: () => api.get("/users/me/recap/"),
  getSurvey: () => api.get("/users/me/survey/"),
  saveSurvey: (data: any) => api.post("/users/me/survey/", data),
  subscribePush: (subscription: any) => api.post("/users/me/push/subscribe/", subscription),
  getAddresses: () => api.get("/users/me/addresses/"),
  createAddress: (data: any) => api.post("/users/me/addresses/", data),
  updateAddress: (id: string, data: any) => api.patch(`/users/me/addresses/${id}/`, data),
  deleteAddress: (id: string) => api.delete(`/users/me/addresses/${id}/`),
  getNotifications: () => api.get("/users/me/notifications/"),
  markAllNotificationsRead: () => api.post("/users/me/notifications/mark_all_read/")
};

export const chatApi = {
  listRooms: () => api.get("/sellers/me/chats/"),
  createRoom: (data: { seller_id?: string; product_id?: string; customer_id?: string }) => 
    api.post("/sellers/me/chats/create/", data),
  sendMessage: (roomId: string, message: string) => 
    api.post(`/sellers/me/chats/${roomId}/messages/`, { message }),
};

export const sellerDashboardApi = {
  apply: (data: { store_name: string; description: string; cpf_cnpj?: string; person_type?: string; main_category?: string; origin_cep?: string; efi_payee_code?: string }) => api.post("/sellers/apply/", data),
  onboard: (return_url: string, refresh_url: string) => api.post("/sellers/onboard/", { return_url, refresh_url }),
  updateProfile: (data: FormData) => api.patch("/sellers/me/", data, { headers: { "Content-Type": "multipart/form-data" } }),

  getLeads: () => api.get("/sellers/me/leads/"),
  getMentor: () => api.get("/sellers/me/mentor/"),
  triggerMentorAction: (action: string, productSlug: string) => 
    api.post("/sellers/me/mentor/", { action, product_slug: productSlug }),
  getAnalytics: () => api.get("/sellers/me/analytics/"),
  reviewsReceived: () => api.get("/sellers/me/reviews-received/"),
  reviewsGiven: () => api.get("/sellers/me/reviews-given/"),
  rateBuyer: (data: { sub_order: string, rating: number, comment: string }) => 
    api.post("/sellers/me/reviews-given/", data),
  products: {
    list: () => api.get("/sellers/me/products/"),
    get: (id: string) => api.get(`/sellers/me/products/${id}/`),
    create: (data: any) => api.post("/sellers/me/products/", data),
    update: (id: string, data: any) => api.patch(`/sellers/me/products/${id}/`, data),
    delete: (id: string) => api.delete(`/sellers/me/products/${id}/`),
    uploadImage: (productId: string, formData: FormData) => 
      api.post(`/sellers/me/products/${productId}/images/`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      }),
    deleteImage: (productId: string, imageId: string) =>
      api.delete(`/sellers/me/products/${productId}/images/${imageId}/`),
    setPrimaryImage: (productId: string, imageId: string) =>
      api.post(`/sellers/me/products/${productId}/images/${imageId}/primary/`),
    uploadVideo: (productId: string, formData: FormData, onUploadProgress?: (e: AxiosProgressEvent) => void) =>
      api.post(`/sellers/me/products/${productId}/video/`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress,
      }),
    // Upload direto ao Cloudinary: a API só assina e depois confirma o public_id.
    videoUploadSignature: (productId: string) =>
      api.post<VideoUploadSignature>(`/sellers/me/products/${productId}/video/signature/`),
    attachVideo: (productId: string, publicId: string) =>
      api.post<{ video_url: string }>(`/sellers/me/products/${productId}/video/`, { public_id: publicId }),
    deleteVideo: (productId: string) =>
      api.delete(`/sellers/me/products/${productId}/video/`),
    createVariant: (productId: string, data: any) =>
      api.post(`/sellers/me/products/${productId}/variants/`, data),
    deleteVariant: (productId: string, variantId: string) => 
      api.delete(`/sellers/me/products/${productId}/variants/${variantId}/`),
    toggleBoost: (id: string) => api.post(`/sellers/me/products/${id}/toggle_boost/`),
  }
};

// ── Types ─────────────────────────────────────────────────────────────────────
export type VideoUploadSignature =
  | { direct: false }
  | {
      direct: true;
      upload_url: string;
      api_key: string;
      signature: string;
      params: Record<string, string | number> & { public_id: string };
      max_bytes: number;
    };

interface RegisterPayload {
  email: string;
  person_type: string;
  cpf_cnpj: string;
  first_name: string;
  last_name: string;
  phone?: string;
  role?: string;
  password: string;
  password_confirm: string;
}

interface TokenPair {
  access: string;
  refresh: string;
}

export const adminApi = {
  getDashboardMetrics: () => api.get("/admin/dashboard/metrics/"),
  sellers: {
    list: () => api.get("/admin/sellers/"),
    approve: (id: string) => api.post(`/admin/sellers/${id}/approve/`),
    reject: (id: string, reason?: string) => api.post(`/admin/sellers/${id}/reject/`, { reason }),
    suspend: (id: string, reason?: string) => api.post(`/admin/sellers/${id}/suspend/`, { reason }),
  },
  coupons: {
    list: () => api.get("/admin/coupons/"),
    create: (data: any) => api.post("/admin/coupons/", data),
    delete: (id: string) => api.delete(`/admin/coupons/${id}/`),
  },
  banners: {
    list: () => api.get("/admin/banners/"),
    create: (formData: FormData) => api.post("/admin/banners/", formData),
    delete: (id: string) => api.delete(`/admin/banners/${id}/`),
  },
  broadcast: (data: { title: string; message: string; url?: string }) =>
    api.post("/admin/broadcast/", data),
};

// ── CRM API ───────────────────────────────────────────────────────────────────
export const crmApi = {
  createLead: (data: { name: string; email?: string; phone: string; company?: string; funnel_type: string; source: string }) => 
    api.post("/crm/leads/", data),
  getLeads: () => api.get("/crm/leads/"),
  updateLeadStatus: (id: string, status: string) => api.patch(`/crm/leads/${id}/`, { status }),
  deleteLead: (id: string) => api.delete(`/crm/leads/${id}/`),
};

