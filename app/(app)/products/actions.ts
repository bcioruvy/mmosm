"use server";

import sql from "@/lib/db";
import { requirePermission } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { PERMISSIONS } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createProduct(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.MANAGE_PRODUCTS);
  const sku = String(formData.get("sku") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const defaultPriceRaw = String(formData.get("defaultPrice") ?? "").trim();
  const defaultPrice = defaultPriceRaw ? Number(defaultPriceRaw) : null;

  if (!name) {
    redirect(`/products?error=${encodeURIComponent("Name is required.")}`);
  }
  if (defaultPrice !== null && (!Number.isFinite(defaultPrice) || defaultPrice < 0)) {
    redirect(`/products?error=${encodeURIComponent("Default price must be a positive number.")}`);
  }

  let productId: number;
  try {
    const [product] = await sql`
      INSERT INTO products (sku, name, description, default_price, is_active)
      VALUES (${sku || null}, ${name}, ${description || null}, ${defaultPrice}, true)
      RETURNING id
    `;
    productId = product.id;
  } catch (err: any) {
    if (err?.code === "23505") {
      redirect(`/products?error=${encodeURIComponent("That SKU is already in use.")}`);
    }
    redirect(`/products?error=${encodeURIComponent("Could not save product.")}`);
  }

  await logAudit({
    actorId: session.user.id,
    action: "create",
    entityType: "product",
    entityId: productId,
    details: { sku, name, defaultPrice },
  });
  revalidatePath("/products");
  revalidatePath("/invoices");
}

export async function updateProduct(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.MANAGE_PRODUCTS);
  const id = String(formData.get("id") ?? "");
  const sku = String(formData.get("sku") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const defaultPriceRaw = String(formData.get("defaultPrice") ?? "").trim();
  const defaultPrice = defaultPriceRaw ? Number(defaultPriceRaw) : null;

  if (!id || !name) {
    redirect(`/products?error=${encodeURIComponent("Name is required.")}`);
  }
  if (defaultPrice !== null && (!Number.isFinite(defaultPrice) || defaultPrice < 0)) {
    redirect(`/products?error=${encodeURIComponent("Default price must be a positive number.")}`);
  }

  const [before] = await sql`SELECT sku, name, description, default_price FROM products WHERE id = ${id}`;
  if (!before) redirect(`/products?error=${encodeURIComponent("Product not found.")}`);

  try {
    await sql`
      UPDATE products
      SET sku = ${sku || null}, name = ${name}, description = ${description || null}, default_price = ${defaultPrice}
      WHERE id = ${id}
    `;
  } catch (err: any) {
    if (err?.code === "23505") {
      redirect(`/products?error=${encodeURIComponent("That SKU is already in use.")}`);
    }
    redirect(`/products?error=${encodeURIComponent("Could not save product.")}`);
  }

  await logAudit({
    actorId: session.user.id,
    action: "update",
    entityType: "product",
    entityId: id,
    details: { before, after: { sku, name, description, defaultPrice } },
  });
  revalidatePath("/products");
  revalidatePath("/invoices");
}

export async function setProductActive(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.MANAGE_PRODUCTS);
  const id = String(formData.get("id") ?? "");
  const isActive = formData.get("isActive") === "true";

  const [before] = await sql`SELECT is_active FROM products WHERE id = ${id}`;
  if (!before) redirect(`/products?error=${encodeURIComponent("Product not found.")}`);

  await sql`UPDATE products SET is_active = ${isActive} WHERE id = ${id}`;
  await logAudit({
    actorId: session.user.id,
    action: isActive ? "reactivate" : "deactivate",
    entityType: "product",
    entityId: id,
    details: { before: before.is_active, after: isActive },
  });
  revalidatePath("/products");
  revalidatePath("/invoices");
}
