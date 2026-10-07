import {
  DiscountClass,
  ProductDiscountSelectionStrategy,
} from '../generated/api';

/**
 * @typedef {import("../generated/api").CartInput} RunInput
 * @typedef {import("../generated/api").CartLinesDiscountsGenerateRunResult} CartLinesDiscountsGenerateRunResult
 */

/**
 * @param {RunInput} input
 * @returns {CartLinesDiscountsGenerateRunResult}
 */
export function cartLinesDiscountsGenerateRun(input) {
  const hasProductDiscountClass =
    input.discount.discountClasses.includes(DiscountClass.Product);

  if (!input.cart.lines.length || !hasProductDiscountClass) {
    return { operations: [] };
  }

  const config = input.discount.configuration?.jsonValue ?? {};
  const requirement = config.requirement ?? {};
  const requirementType = String(requirement.title ?? "no");
  const requirementValue = Number(requirement.value ?? 0);
  const target = config.target ?? {};
  const targetType = String(target.title ?? "product");
  const targetValues = Array.isArray(target.value) ? target.value : [];
  const productIds = new Set(
    targetValues.map((value) => String(value).replace(/^gid:\/\/shopify\/Product\//, ""))
  );

  const products = new Map();

  for (const line of input.cart.lines) {
    if (line.merchandise.__typename !== 'ProductVariant') continue;

    const productId = String(line.merchandise.product.id ?? "").replace(
      /^gid:\/\/shopify\/Product\//,
      ""
    );

    if (!line.merchandise.product.isEligible) continue;

    if (targetType === "product" && targetValues.length && !productIds.has(productId)) {
      continue;
    }

    const product = products.get(productId) ?? {
      lines: [],
      quantity: 0,
      amount: 0,
    };

    product.lines.push(line);
    product.quantity += Number(line.quantity || 0);
    product.amount += Number(line.cost?.subtotalAmount?.amount || 0);
    products.set(productId, product);
  }

  const eligibleLines = [];

  for (const product of products.values()) {
    if (requirementType === "quantity" && product.quantity < requirementValue) {
      continue;
    }

    if (requirementType === "amount" && product.amount < requirementValue) {
      continue;
    }

    eligibleLines.push(...product.lines);
  }

  const message = String(config.title || "Discount");
  const value = config.value || {};

  const candidates = eligibleLines.map((line) => ({
    message,
    targets: [
      {
        cartLine: {
          id: line.id,
        },
      },
    ],
    value,
  }));

  if (!candidates.length) {
    return { operations: [] };
  }

  return {
    operations: [
      {
        productDiscountsAdd: {
          candidates,
          selectionStrategy: ProductDiscountSelectionStrategy.All,
        },
      },
    ],
  };
}
