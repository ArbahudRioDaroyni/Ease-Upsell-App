import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";

const PAGE_SIZE = 20;

const DISCOUNTS_QUERY = `#graphql
  query DiscountsList($first: Int!, $after: String) {
    discountNodes(first: $first, after: $after, sortKey: CREATED_AT, reverse: true) {
      nodes {
        id
        discount {
          __typename
          ... on DiscountAutomaticApp {
            title
            status
            startsAt
            endsAt
            asyncUsageCount
            appDiscountType {
              title
              functionId
            }
          }
          ... on DiscountCodeApp {
            title
            status
            startsAt
            endsAt
            asyncUsageCount
            appDiscountType {
              title
              functionId
            }
            codes(first: 5) {
              nodes {
                code
              }
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }`;

const STATUS_TONES = {
  ACTIVE: "success",
  SCHEDULED: "warning",
  EXPIRED: "neutral",
};

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  const url = new URL(request.url);
  const after = url.searchParams.get("after") ?? null;

  const response = await admin.graphql(DISCOUNTS_QUERY, {
    variables: {
      first: PAGE_SIZE,
      after,
    },
  });

  const json = await response.json();
  const discountNodes = json.data?.discountNodes;
  const discountList = discountNodes?.nodes ?? [];

  const discounts = discountList
    .filter((node) => Boolean(node?.discount))
    .map((node) => {
      const discount = node.discount;
      const isCode = discount.__typename?.includes("Code");

      return {
        id: node.id,
        title: discount.title || "Untitled discount",
        method: isCode ? "Code" : "Automatic",
        status: discount.status ?? "EXPIRED",
        type: discount.appDiscountType?.title ?? "Discount App",
        usageCount:
          typeof discount.asyncUsageCount === "number"
            ? discount.asyncUsageCount
            : 0,
      };
    });

  console.log(discounts);

  return {
    discounts,
    hasNextPage: discountNodes?.pageInfo?.hasNextPage ?? false,
    endCursor: discountNodes?.pageInfo?.endCursor ?? null,
    after,
  };
};

export default function DiscountsPage() {
  const { discounts, hasNextPage, endCursor, after } = useLoaderData();

  return (
    <s-page heading="Discounts" inlineSize="large">
      <s-button
        slot="primary-action"
        variant="primary"
        href="/app/discounts/new"
      >
        Create discount
      </s-button>

      <s-section>
        {discounts.length === 0 ? (
          <s-box padding="base" background="base">
            <s-paragraph color="subdued">
              No discounts found. Discounts created using your app will appear
              here.
            </s-paragraph>
          </s-box>
        ) : (
          <s-table>
            <s-table-header-row>
              <s-table-header>Title</s-table-header>
              <s-table-header>Status</s-table-header>
              <s-table-header>Method</s-table-header>
              <s-table-header>Type</s-table-header>
              <s-table-header>Used</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {discounts.map((discount) => (
                <s-table-row key={discount.id}>
                  <s-table-cell>
                    <s-text fontWeight="bold">{discount.title}</s-text>
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
              <s-button variant="tertiary" href="/app/discounts">
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
                href={`/app/discounts?after=${encodeURIComponent(endCursor)}`}
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