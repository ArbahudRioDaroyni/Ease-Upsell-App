import { describe, expect, test } from "vitest";
import { cartLinesDiscountsGenerateRun } from "../src/cart_lines_discounts_generate_run.js";

const discountInput = (lines) => ({
  cart: { lines },
  discount: {
    discountClasses: ["PRODUCT"],
    configuration: {
      jsonValue: {
        title: "Bulk discount",
        target: {
          title: "product",
          value: [
            "gid://shopify/Product/1",
            "gid://shopify/Product/2",
          ],
        },
        requirement: { title: "quantity", value: 10 },
        value: { percentage: { value: 10 } },
      },
    },
  },
});

const cartLine = (id, productId, quantity) => ({
  id,
  quantity,
  cost: { subtotalAmount: { amount: String(quantity * 5) } },
  merchandise: {
    __typename: "ProductVariant",
    product: {
      id: `gid://shopify/Product/${productId}`,
      isEligible: true,
    },
  },
});

describe("cartLinesDiscountsGenerateRun", () => {
  test("applies a quantity requirement independently per product", () => {
    const result = cartLinesDiscountsGenerateRun(
      discountInput([
        cartLine("line-1", "1", 10),
        cartLine("line-2", "2", 9),
      ])
    );

    expect(
      result.operations[0].productDiscountsAdd.candidates.map(
        (candidate) => candidate.targets[0].cartLine.id
      )
    ).toEqual(["line-1"]);
  });

  test("adds quantities across variants of the same product", () => {
    const result = cartLinesDiscountsGenerateRun(
      discountInput([
        cartLine("line-1", "1", 5),
        cartLine("line-2", "1", 5),
        cartLine("line-3", "2", 9),
      ])
    );

    expect(
      result.operations[0].productDiscountsAdd.candidates.map(
        (candidate) => candidate.targets[0].cartLine.id
      )
    ).toEqual(["line-1", "line-2"]);
  });
});
