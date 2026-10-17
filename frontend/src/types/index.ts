// ── Usuário ───────────────────────────────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone: string;
  role: "customer" | "seller" | "admin";
  avatar: string | null;
  date_joined: string;
}

// ── Catálogo ─────────────────────────────────────────────────────────────────
export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  image: string | null;
  parent: string | null;
  children?: Category[];
}

export interface AttributeValue {
  id: number;
  attribute: string;
  value: string;
}

export interface ProductVariant {
  id: string;
  sku: string;
  attributes: AttributeValue[];
  price: string | null;
  effective_price: string;
  stock: number;
  is_active: boolean;
  product_name?: string;
  product_description?: string;
  product_image?: string;
  product_base_price?: string;
  product_slug?: string;
  seller_max_installments?: number;
}

export interface ProductImage {
  id: string;
  image: string;
  is_primary: boolean;
  order: number;
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
}

export interface Product {
  id: string;
  seller_name: string;
  seller_slug: string;
  category: string | null;
  category_name?: string;
  brand?: Brand | null;
  name: string;
  slug: string;
  description: string;
  base_price: string;
  promotional_price: string | null;
  min_price: string;
  is_flash_sale: boolean;
  discount_percentage: number;
  time_remaining_seconds: number;
  primary_image: string | null;
  images: ProductImage[];
  variants: ProductVariant[];
  avg_rating: number | null;
  review_count: number;
  is_available: boolean;
  is_boosted?: boolean;
  has_video?: boolean;
  approval_status?: string;
  specifications?: Array<{ attribute_name: string; attribute_value: string }>;
  created_at: string;
}

// ── Carrinho ─────────────────────────────────────────────────────────────────
export interface CartItem {
  id: string;
  variant: ProductVariant;
  quantity: number;
  subtotal: string;
}

export interface Cart {
  id: string;
  items: CartItem[];
  subtotal: string;
  shipping_total: string;
  total: string;
  item_count: number;
  coupon_code: string | null;
}

// ── Pedidos ───────────────────────────────────────────────────────────────────
export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

export interface OrderItem {
  id: string;
  product_name: string;
  variant_sku: string;
  variant_attributes: Record<string, string>;
  quantity: number;
  unit_price: string;
  total: string;
}

export interface SubOrder {
  id: string;
  seller_name: string;
  items: OrderItem[];
  subtotal: string;
  commission: string;
  seller_amount: string;
  status: OrderStatus;
  tracking_code: string;
  carrier_name?: string;
  estimated_delivery_date?: string;
  dispatched_at?: string;
  invoice_link?: string;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  sub_orders: SubOrder[];
  total: string;
  status: OrderStatus;
  created_at: string;
}

// ── Pagamentos ────────────────────────────────────────────────────────────────
export type PaymentMethod = "pix" | "credit_card" | "boleto";
export type PaymentStatus = "pending" | "approved" | "rejected" | "cancelled" | "in_process";

export interface Payment {
  id: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: string;
  pix_qr_code: string;
  pix_qr_code_base64: string;
  boleto_url: string;
  boleto_barcode: string;
  expires_at: string | null;
  paid_at: string | null;
}

// ── Paginação ─────────────────────────────────────────────────────────────────
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
