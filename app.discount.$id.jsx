import { useEffect, useRef, useState } from "react";
import { authenticate } from "../shopify.server";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { getDiscountById, setMetafield } from "../model/new-wholesale.server";

export const loader = async ({ request, params }) => {
  const { admin } = await authenticate.admin(request);
  const id = `gid://shopify/DiscountAutomaticNode/${params.id}`;
  const { discount, configuration } = await getDiscountById({ admin, id });

  return { discount, config: configuration, log: configuration };
};

export const action = async ({ request, params }) => {
  const { admin } = await authenticate.admin(request);
  const discountId = `gid://shopify/DiscountAutomaticNode/${params.id}`;

  const formData = await request.formData();
  const formEntries = Object.fromEntries(formData);
  const metafield = await setMetafield({ admin, ownerId: discountId, value: formEntries });

  return {
    started: true,
    data: metafield
  };
};

export default function DiscountDetail() {
  const { discount, config, log } = useLoaderData();
  const shopify = useAppBridge();
  const fetcher = useFetcher();

  const [discountType, setDiscountType] = useState(config?.type.title);

  // value amount
  const initAmountValue = config?.type.title == "amount" ? config?.type.value : "";
  const [amountValue, setAmountValue] = useState(initAmountValue);
  const [amountError, setAmountError] = useState("");

  // value percentage
  const initPercentageValue = config?.type.title == "percentage" ? config?.type.value : "";
  const [percentageValue, setPercentageValue] = useState(initPercentageValue);
  const [percentageError, setPercentageError] = useState("");

  const [discountTargetType, setDiscountTargetType] = useState("product");
  const [discountTargetCollections, setDiscountTargetCollections] = useState();
  const [discountTargetProducts, setDiscountTargetProducts] = useState();

  const [discountRequirement, setDiscountRequirement] = useState(config?.requirement.title);

  const hiddenDiscountProductsRef = useRef(null);
  useEffect(() => {
    const inputProducts = hiddenDiscountProductsRef.current;
    if (!inputProducts) return;

    const newValue = Array.isArray(discountTargetProducts)
      ? discountTargetProducts.join(",")
      : String(discountTargetProducts ?? "");

    if (inputProducts.value !== newValue) {
      inputProducts.value = newValue;
      inputProducts.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }, [discountTargetProducts]);

  const hiddenDiscountCollectionsRef = useRef(null);
  useEffect(() => {
    const inputCollections = hiddenDiscountCollectionsRef.current;
    if (!inputCollections) return;

    const newValue = Array.isArray(discountTargetCollections)
      ? discountTargetCollections.join(",")
      : String(discountTargetCollections ?? "");

    if (inputCollections.value !== newValue) {
      inputCollections.value = newValue;
      inputCollections.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }, [discountTargetCollections]);

  const openResourcePicker = async (query) => {
    const ids = await shopify.resourcePicker({
      type: discountTargetType ? discountTargetType : "product",
      action: "select",
      multiple: true,
      query: query ? query : "",
    });

    if (!ids) return;

    const selectedIds = ids.map((p) => p.id);
    discountTargetType === "product"
      ? setDiscountTargetProducts(selectedIds)
      : setDiscountTargetCollections(selectedIds);
  };

  return (
    <form
      data-save-bar
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.target);
        const formEntries = Object.fromEntries(formData);

        setAmountError("");
        setPercentageError("");

        if (
          discountType === "amount" &&
          !formEntries["discount-type-amount-value"]
        ) {
          setAmountError("Discount value can't be blank");
          return;
        }

        if (
          (discountType === "percentage" || discountType === "") &&
          !formEntries["discount-type-percentage-value"]
        ) {
          setPercentageError("Discount value can't be blank");
          return;
        }

        fetcher.submit(formData, { method: "post" });
      }}

      onReset={() => {
        console.log("Handle discarded changes if necessary");
      }}
    >
      <s-page heading="Discounts">
        <s-grid gridTemplateColumns="1fr 240px" gap="large-500">
          {/* Left Contents */}
          <s-stack gap="large-300">
            {/* Heading */}
            <s-stack direction="inline" alignItems="center" gap="small-100">
              <s-heading fontSize="large-300">{discount?.title}</s-heading>
              <s-badge tone="success">{discount?.status}</s-badge>
            </s-stack>

            {/* Title */}
            <s-stack gap="base">
              <s-heading fontSize="large-100">
                {discount?.appDiscountType.title}
              </s-heading>
              <s-section>
                <s-text-field
                  label="Input Title"
                  name="discount-title"
                  value={discount?.title}
                  defaultValue={discount?.title}
                  placeholder={discount?.title}
                  details="Customers will see this in their cart and at checkout."
                />
              </s-section>
            </s-stack>

            <s-stack display="none">
              <s-text-field
                label="Discount ID"
                name="discount-id"
                value={discount?.discountId}
                readOnly
              ></s-text-field>
            </s-stack>

            {/* Discount value */}
            <s-stack gap="base">
              <s-heading fontSize="large-100">Discount value</s-heading>
              <s-section>
                <s-stack gap="base">
                  {/* Discount Type */}
                  <s-grid gridTemplateColumns="2fr 1fr" gap="small-200">
                    <s-select
                      label="Select Discount Type"
                      labelAccessibilityVisibility="exclusive"
                      name="discount-type"
                      onChange={(e) => setDiscountType(e.target.value)}
                    >
                      <s-option
                        value="percentage"
                        selected={config?.type.title == "percentage"}
                      >
                        Percentage
                      </s-option>
                      <s-option
                        value="amount"
                        selected={config?.type.title == "amount"}
                      >
                        Fixed Amount
                      </s-option>
                    </s-select>
                    <s-stack
                      display={
                        discountType === "percentage" || discountType === ""
                          ? "auto"
                          : "none"
                      }
                    >
                      <s-number-field
                        labelAccessibilityVisibility="exclusive"
                        label="Input Discount Type Percentage"
                        name="discount-type-percentage-value"
                        value={percentageValue}
                        defaultValue={percentageValue}
                        suffix="%"
                        inputMode="numeric"
                        step="1"
                        min="1"
                        placeholder="0"
                        error={percentageError}
                        required={
                          discountType === "percentage" || discountType === ""
                        }
                        onChange={(e) => {
                          const next = e.currentTarget.value;
                          setPercentageValue(next);
                          setPercentageError(next ? "" : percentageError);
                        }}
                      ></s-number-field>
                    </s-stack>
                    <s-stack
                      display={discountType === "amount" ? "auto" : "none"}
                    >
                      <s-money-field
                        labelAccessibilityVisibility="exclusive"
                        label="Input Discount Type Amount"
                        name="discount-type-amount-value"
                        value={amountValue}
                        defaultValue={amountValue}
                        placeholder="0.00"
                        min="0"
                        error={amountError}
                        required={discountType === "amount"}
                        onChange={(e) => {
                          const next = e.currentTarget.value;
                          setAmountValue(next);
                          setPercentageError(next ? "" : amountError);
                        }}
                      ></s-money-field>
                    </s-stack>
                  </s-grid>

                  {/* Discount Target */}
                  <s-select
                    label="Applies to"
                    name="discount-target"
                    onChange={(e) => setDiscountTargetType(e.target.value)}
                  >
                    <s-option value="product" selected>
                      Products
                    </s-option>
                    <s-option value="collection">Collections</s-option>
                  </s-select>

                  {/* Open Picker API */}
                  {/* Product */}
                  <s-grid
                    gridTemplateColumns="2fr auto"
                    gap="small-200"
                    display={discountTargetType === "product" ? "auto" : "none"}
                  >
                    <s-stack display="none">
                      <s-text-field
                        ref={hiddenDiscountProductsRef}
                        label="Discount Target Products"
                        name="discount-target-products[]"
                        value={discountTargetProducts}
                        hidden
                      ></s-text-field>
                    </s-stack>
                    <s-text-field
                      label="Search Products"
                      labelAccessibilityVisibility="exclusive"
                      icon="search"
                      placeholder="Search products"
                      onInput={(event) =>
                        event.isTrusted &&
                        openResourcePicker(event.currentTarget.value)
                      }
                    ></s-text-field>
                    <s-button
                      variant="primary"
                      onClick={() => openResourcePicker()}
                    >
                      Browse
                    </s-button>
                  </s-grid>
                  {/* Collections */}
                  <s-grid
                    gridTemplateColumns="2fr auto"
                    gap="small-200"
                    display={
                      discountTargetType === "collection" ? "auto" : "none"
                    }
                  >
                    <s-stack display="none">
                      <s-text-field
                        ref={hiddenDiscountCollectionsRef}
                        label="Discount Target Collections"
                        name="discount-target-collections[]"
                        value={discountTargetCollections}
                        hidden
                      ></s-text-field>
                    </s-stack>
                    <s-text-field
                      label="Discount Target Collections"
                      labelAccessibilityVisibility="exclusive"
                      icon="search"
                      placeholder="Search collections"
                      onInput={(event) =>
                        event.isTrusted &&
                        openResourcePicker(event.currentTarget.value)
                      }
                    ></s-text-field>
                    <s-button
                      variant="primary"
                      onClick={() => openResourcePicker()}
                    >
                      Browse
                    </s-button>
                  </s-grid>
                </s-stack>
              </s-section>
            </s-stack>

            {/* Minimum Purchase Requirements */}
            <s-stack gap="base">
              <s-heading fontSize="large-100">
                Minimum purchase requirements
              </s-heading>
              <s-section>
                <s-choice-list
                  label="Select Minimum Purchase Requirements"
                  labelAccessibilityVisibility="exclusive"
                  name="discount-requirement"
                  onChange={(e) => setDiscountRequirement(e.currentTarget.values[0])}
                  values={[discountRequirement]}
                >
                  <s-choice value="no">No minimum requirements</s-choice>
                  <s-choice value="amount">
                    Minimum purchase amount ($)
                    <s-stack
                      slot="secondary-content"
                      inlineSize="160px"
                      display={
                        discountRequirement == "amount" ? "auto" : "none"
                      }
                    >
                      <s-money-field
                        label="Input Discount Requirement Amount Value"
                        labelAccessibilityVisibility="exclusive"
                        name="discount-requirement-amount-value"
                        details="Applies to all products."
                        placeholder="0.00"
                        min="0"
                        value={config?.requirement.title == "amount" ? config?.requirement.value : ""}
                        defaultValue={config?.requirement.title == "amount" ? config?.requirement.value : ""}
                      ></s-money-field>
                    </s-stack>
                  </s-choice>
                  <s-choice value="quantity">
                    Minimum quantity of items
                    <s-stack
                      slot="secondary-content"
                      inlineSize="160px"
                      display={
                        discountRequirement == "quantity" ? "auto" : "none"
                      }
                    >
                      <s-number-field
                        label="Input Discount Requirement Quantity Value"
                        labelAccessibilityVisibility="exclusive"
                        name="discount-requirement-quantity-value"
                        details="Applies to all products."
                        placeholder="0"
                        step="5"
                        min="0"
                        value={config?.requirement.title == "quantity" ? config?.requirement.value : ""}
                        defaultValue={config?.requirement.title == "quantity" ? config?.requirement.value : ""}
                      ></s-number-field>
                    </s-stack>
                  </s-choice>
                </s-choice-list>
              </s-section>
            </s-stack>

            <s-section>
              <pre>{JSON.stringify(fetcher.data, null, 2)}</pre>
            </s-section>
            <s-section>
              <pre>LOG: {JSON.stringify(log, null, 2)}</pre>
            </s-section>
          </s-stack>

          {/* Right Contents */}
          <s-stack gap="large">
            {/* Details */}
            <s-box>
              <s-stack gap="base">
                <s-stack gap="small-400">
                  <s-heading fontSize="large">{discount?.title}</s-heading>
                  <s-text color="subdued">Automatic</s-text>
                </s-stack>

                <s-divider />

                <s-text>Type</s-text>
                <s-stack gap="small-400">
                  <s-text>{discount?.appDiscountType.title}</s-text>
                  <s-text>Product discount</s-text>
                </s-stack>

                <s-divider />

                <s-text>Details</s-text>
                <s-unordered-list>
                  <s-list-item>All customers</s-list-item>
                  <s-list-item>POS included</s-list-item>
                  <s-list-item>{4}% off entire order</s-list-item>
                  {discountRequirement === "quantity" && (
                    <s-list-item>Minimum purchase of 55 items</s-list-item>
                  )}
                  {discountRequirement === "amount" && (
                    <s-list-item>Minimum purchase of $10</s-list-item>
                  )}
                  <s-list-item>
                    {`Can't`} combine with other discounts
                  </s-list-item>
                  <s-list-item>Active from today</s-list-item>
                </s-unordered-list>

                <s-divider />

                <s-text variant="headingSm" as="h3">
                  Performance
                </s-text>
                <s-unordered-list>
                  <s-list-item>{discount?.asyncUsageCount}</s-list-item>
                </s-unordered-list>
              </s-stack>
            </s-box>

            {/* Tags */}
            <s-box>
              <s-stack gap="200">
                <s-text variant="headingMd" as="h2">
                  Tags
                </s-text>
                <s-button variant="tertiary" icon="plus">
                  Add tags
                </s-button>
              </s-stack>
            </s-box>
          </s-stack>
        </s-grid>

        {/* Footer help */}
        <s-stack alignItems="center" paddingBlock="large">
          <s-text color="subdued">
            Learn more about{" "}
            <s-link href="https://help.shopify.com" target="_blank">
              quality scoring best practices
            </s-link>
            .
          </s-text>
        </s-stack>
      </s-page>
    </form>
  );
}
