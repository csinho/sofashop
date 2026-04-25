export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type DocumentKind = 'cpf' | 'cnpj'
export type StoreUserRole = 'owner' | 'admin' | 'staff'
export type OrderStatus =
  | 'novo'
  | 'em_analise'
  | 'aprovado'
  | 'em_producao'
  | 'pronto_entrega'
  | 'entregue'
  | 'cancelado'

export type PaymentKind =
  | 'pix'
  | 'cartao_debito'
  | 'cartao_credito'
  | 'parcelado'
  | 'entrada_parcelado'

export type PaymentDetails = {
  installments?: number
  down_payment?: number
  card_last4?: string
}

export type SofaSpec = {
  seats?: number
  width_cm?: number
  height_cm?: number
  depth_cm?: number
  depth_open_cm?: number
  depth_closed_cm?: number
  has_chaise?: boolean
  chaise_side?: 'esquerdo' | 'direito' | null
  retractable?: boolean
  reclinable?: boolean
  recline_positions?: number
  converts_to_bed?: boolean
  bed_dimensions?: string
  frame_type?: string
  upholstery?: string
  seat_foam?: string
  back_foam?: string
  module_count?: number
  max_weight_kg?: number
  warranty?: string
  cleaning_notes?: string
}

export type CheckoutPaymentConfig = {
  accepted_methods: PaymentKind[]
  card_fee_credit_percent: number
  card_fee_debit_percent: number
}

export type CatalogStoreRow = {
  id: string
  slug: string
  trade_name: string
  logo_url: string | null
  banner_url: string | null
  phone_main: string
  whatsapp_1: string
  whatsapp_2: string
  cep: string
  street: string
  number: string
  complement: string
  district: string
  city: string
  state: string
  institutional_text: string
  theme_primary: string
  theme_accent: string
  policy_text: string
  whatsapp_orders_phone: string
  catalog_published: boolean
  /** Loja com conta ativa (gestão e catálogo, conforme regras da UI). Sempre true quando vinda do catálogo “ok”. */
  is_active?: boolean
  checkout_payment_config?: CheckoutPaymentConfig | null
}

export type StoreRow = CatalogStoreRow & {
  created_at: string
  updated_at: string
  legal_name: string
  document_kind: DocumentKind
  document: string
  email_contact: string
  owner_user_id: string
  pdf_footer: string
  default_order_notes: string
  /** Só a plataforma altera; membros veem, não editam. */
  is_active: boolean
}

export type Database = {
  public: {
    Tables: {
      stores: { Row: StoreRow; Insert: never; Update: Partial<StoreRow> }
      store_users: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          store_id: string
          user_id: string
          role: StoreUserRole
        }
      }
      store_settings: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          store_id: string
          report_preferences: Json
          integration_hooks: Json
        }
      }
      customers: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          store_id: string
          full_name: string
          phone: string
          phone_normalized: string
          phone_secondary: string
          phone_secondary_normalized: string
          email: string | null
          cep: string | null
          street: string | null
          number: string | null
          complement: string | null
          district: string | null
          city: string | null
          state: string | null
          internal_notes: string
        }
      }
      categories: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          store_id: string
          name: string
          slug: string
          sort_order: number
          is_active: boolean
        }
      }
      products: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          store_id: string
          category_id: string
          name: string
          slug: string
          subcategory: string | null
          model_type: string
          short_description: string
          description: string
          sku: string
          base_price: number
          promo_price: number | null
          is_active: boolean
          is_featured: boolean
          delivery_days: number
          internal_notes: string
          sofa_spec: SofaSpec
          dimension_length_cm: number | null
          dimension_width_cm: number | null
          dimension_height_cm: number | null
        }
      }
      product_images: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          product_id: string
          url: string
          sort_order: number
          alt: string
        }
      }
      colors: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          store_id: string
          name: string
          hex: string
        }
      }
      product_variants: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          product_id: string
          color_id: string | null
          name: string
          sku_suffix: string
          price_override: number | null
          stock: number | null
          sort_order: number
          is_active: boolean
        }
      }
      variant_images: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          variant_id: string
          url: string
          sort_order: number
          alt: string
        }
      }
      orders: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          store_id: string
          customer_id: string
          order_number: string
          status: OrderStatus
          subtotal: number
          total: number
          payment_kind: PaymentKind
          payment_details: PaymentDetails
          customer_snapshot: Json
          shipping_snapshot: Json
          notes: string
          source: string
        }
      }
      order_items: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          order_id: string
          product_id: string | null
          variant_id: string | null
          product_name: string
          sku: string
          quantity: number
          unit_price: number
          line_total: number
          options_snapshot: Json
        }
      }
      order_status_history: {
        Row: {
          id: string
          created_at: string
          order_id: string
          status: OrderStatus
          changed_by: string | null
          note: string
        }
      }
    }
    Views: {
      catalog_stores_v: { Row: CatalogStoreRow }
    }
    Functions: {
      register_store: { Args: Record<string, string | null>; Returns: string }
      checkout_catalog_order: { Args: Record<string, Json | string | null>; Returns: Json }
      resolve_catalog_customer: {
        Args: { p_store_id: string; p_customer_id?: string | null; p_phone?: string | null }
        Returns: Json
      }
      is_platform_admin: { Args: Record<string, never>; Returns: boolean }
      get_public_catalog_store: { Args: { p_slug: string }; Returns: Json }
      platform_list_stores: { Args: Record<string, never>; Returns: Json }
      platform_get_store: { Args: { p_store_id: string }; Returns: Json }
      platform_set_store_is_active: { Args: { p_store_id: string; p_is_active: boolean }; Returns: void }
    }
    Enums: Record<string, never>
  }
}
