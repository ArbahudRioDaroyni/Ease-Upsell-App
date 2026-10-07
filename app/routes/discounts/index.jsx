import { useFetcher, useLoaderData } from "react-router";
import { authenticate } from "../../shopify.server";
import {
  deleteDiscountAutomatic,
  getDiscountsList,
  getDiscountTypeList,
} from "../../model/new-wholesale.server";

const PAGE_SIZE = 20;
const STATUS_TONES = {
  ACTIVE: "success",
  SCHEDULED: "warning",
  EXPIRED: "neutral",
};

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const after = url.searchParams.get("after") ?? null;
  const path = url.pathname;
  const { discounts, hasNextPage, endCursor } = await getDiscountsList({
    admin,
    pageSize: PAGE_SIZE,
    after,
  });
  const discountTypeList = await getDiscountTypeList({ admin });

  return {
    discounts,
    hasNextPage,
    endCursor,
    after,
    path,
    discountTypeList,
  };
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const id = formData.get("id");

  if (typeof id !== "string" || !id) {
    return { error: "A discount ID is required." };
  }

  try {
    const result = await deleteDiscountAutomatic({ admin, id });
    return {
      deletedDiscountId:
        result.discountAutomaticDelete.deletedAutomaticDiscountId,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

export default function DiscountsPage() {
  const { discounts, hasNextPage, endCursor, after, path, discountTypeList } =
    useLoaderData();
  const fetcher = useFetcher();
  const addDiscountModalId = "add-discount-modal";

  return (
    <s-page heading="Discounts" inlineSize="large">
      <s-button
        slot="primary-action"
        variant="primary"
        commandFor={addDiscountModalId}
      >
        Create discount
      </s-button>

      <s-modal id={addDiscountModalId} heading="Select discount type" padding="none">
        <s-divider />
        {discountTypeList.map((discount) => (
          <s-clickable
            paddingInline="base"
            href={`/app/discounts/new/${discount.handle}`}
            key={discount.handle}
          >
            <s-grid
              gridTemplateColumns="auto 1fr auto"
              alignItems="center"
              gap="small"
              paddingBlock="base"
            >
              <s-icon type="discount" />
              <s-stack>
                <s-text>{discount.title}</s-text>
                <s-text color="subdued" fontSize="small-100">
                  {discount.description}
                </s-text>
              </s-stack>
              <s-icon type="caret-right" />
            </s-grid>
            <s-divider />
          </s-clickable>
        ))}
        <s-button
          slot="secondary-actions"
          commandFor={addDiscountModalId}
          command="--hide"
        >
          Close
        </s-button>
      </s-modal>

      <s-section>
        {fetcher.state === "idle" && fetcher.data?.error && (
          <s-banner tone="critical">{fetcher.data.error}</s-banner>
        )}
        {discounts.length === 0 ? (
          <s-box padding="base" background="base">
            <s-paragraph color="subdued">
              No discounts found. Discounts created using your app will appear
              here.
            </s-paragraph>
          </s-box>
        ) : (
          <s-table loading={fetcher.state !== "idle"}>
            <s-table-header-row>
              <s-table-header listSlot="primary">Title</s-table-header>
              <s-table-header listSlot="labeled">Status</s-table-header>
              <s-table-header>Method</s-table-header>
              <s-table-header>Type</s-table-header>
              <s-table-header>Used</s-table-header>
              <s-table-header>Action</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {discounts.map((discount) => (
                <s-table-row
                  key={discount.id}
                  clickDelegate={`link${discount.legacyResourceId}`}
                >
                  <s-table-cell>
                    <s-link
                      id={`link${discount.legacyResourceId}`}
                      href={`${path}/${discount.legacyResourceId}`}
                    >
                      <s-text fontWeight="bold">{discount.title}</s-text>
                    </s-link>
                  </s-table-cell>
                  <s-table-cell>
                    <s-badge tone={STATUS_TONES[discount.status] ?? "neutral"}>
                      {discount.status.charAt(0) +
                        discount.status.slice(1).toLowerCase()}
                    </s-badge>
                  </s-table-cell>
                  <s-table-cell>
                    <s-text color="subdued">{discount.method}</s-text>
                  </s-table-cell>
                  <s-table-cell>
                    <s-text color="subdued">{discount.type}</s-text>
                  </s-table-cell>
                  <s-table-cell>
                    <s-text>{discount.usageCount}</s-text>
                  </s-table-cell>
                  <s-table-cell>
                    <s-button
                      tone="critical"
                      disabled={fetcher.state !== "idle"}
                      onClick={() =>
                        fetcher.submit({ id: discount.id }, { method: "post" })
                      }
                    >
                      {fetcher.state !== "idle" &&
                        fetcher.formData?.get("id") === discount.id
                        ? "Deleting..."
                        : "Delete"}
                    </s-button>
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        )}
      </s-section>

      {(hasNextPage || after) && (
        <s-section>
          <s-stack
            direction="inline"
            gap="base"
            alignItems="center"
            justifyContent="center"
          >
            {after ? (
              <s-button variant="tertiary" href={path}>
                Previous
              </s-button>
            ) : (
              <s-button variant="tertiary" disabled>
                Previous
              </s-button>
            )}
            {hasNextPage && endCursor ? (
              <s-button
                variant="tertiary"
                href={`${path}?after=${encodeURIComponent(endCursor)}`}
              >
                Next
              </s-button>
            ) : (
              <s-button variant="tertiary" disabled>
                Next
              </s-button>
            )}
          </s-stack>
        </s-section>
      )}
    </s-page>
  );
}