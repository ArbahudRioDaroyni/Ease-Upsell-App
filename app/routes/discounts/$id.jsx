import { useLoaderData } from "react-router";
import { authenticate } from "../../shopify.server";
import { getDiscountById, setMetafield } from "../../model/new-wholesale.server";
import FormBulkBuy from "../../components/form-bulk-buy";

export const loader = async ({ request, params }) => {
  const { admin } = await authenticate.admin(request);
  const id = `gid://shopify/DiscountAutomaticNode/${params.id}`;
  const { discount, configuration } = await getDiscountById({ admin, id });

  return { discount, config: configuration };
};

export const action = async ({ request, params }) => {
  const { admin } = await authenticate.admin(request);
  const discountId = `gid://shopify/DiscountAutomaticNode/${params.id}`;
  const formData = await request.formData();
  const formEntries = Object.fromEntries(formData);
  const metafield = await setMetafield({
    admin,
    ownerId: discountId,
    value: formEntries,
  });

  return { started: true, data: metafield };
};

export default function DiscountDetail() {
  const { discount, config } = useLoaderData();

  return (
    <s-page heading="Discounts">
      <s-grid gridTemplateColumns="687px auto" gap="large-500">
        <FormBulkBuy discount={discount} config={config} key="form-edit" />

        <s-stack>
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
                {config?.requirement.title === "quantity" && (
                  <s-list-item>Minimum purchase of 55 items</s-list-item>
                )}
                {config?.requirement.title === "amount" && (
                  <s-list-item>Minimum purchase of $10</s-list-item>
                )}
                <s-list-item>Can&apos;t combine with other discounts</s-list-item>
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
    </s-page>
  );
}