-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "public"."products_import" (
    "product_id" TEXT NOT NULL,
    "product_name" TEXT,
    "category" TEXT,
    "brand" TEXT,
    "seller" TEXT,
    "seller_city" TEXT,
    "price" TEXT,
    "discount_percent" TEXT,
    "final_price" TEXT,
    "rating" TEXT,
    "review_count" TEXT,
    "stock_available" TEXT,
    "units_sold" TEXT,
    "listing_date" TEXT,
    "delivery_days" TEXT,
    "weight_g" TEXT,
    "warranty_months" TEXT,
    "color" TEXT,
    "size" TEXT,
    "return_policy_days" TEXT,
    "is_returnable" TEXT,
    "payment_modes" TEXT,
    "shipping_weight_g" TEXT,
    "product_score" TEXT,
    "seller_rating" TEXT,
    "image_url" TEXT,

    CONSTRAINT "products_import_pkey" PRIMARY KEY ("product_id")
);

