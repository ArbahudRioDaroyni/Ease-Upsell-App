export const DISCOUNTS_LIST_QUERY = `#graphql
	query DiscountsList($first: Int!, $after: String) {
		discountNodes(first: $first, after: $after, sortKey: CREATED_AT, reverse: true) {
			nodes {
				id
				discount {
					__typename
					... on DiscountAutomaticApp {
            discountId
						title
						status
						startsAt
						endsAt
						asyncUsageCount
            context {
              __typename
            }
            appliesOnOneTimePurchase
						appDiscountType {
							title
              discountClasses
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

export async function getDiscountsList({ admin, pageSize = 20, after }) {
  const response = await admin.graphql(DISCOUNTS_LIST_QUERY, {
    variables: {
      first: pageSize,
      after,
    },
  });

  const json = await response.json();
  const discountNodes = json.data?.discountNodes;
  const discountList = discountNodes?.nodes ?? [];

  const discounts = discountList
    .filter((node) => Boolean(node?.discount.title))
    .map((node) => {
      const discount = node.discount;
      const isCode = discount.__typename?.includes("Code");

      return {
        id: node.id,
        legacyResourceId: String(node.id).replace("gid://shopify/DiscountAutomaticNode/", ""),
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

  return {
    discounts,
    hasNextPage: discountNodes?.pageInfo?.hasNextPage ?? false,
    endCursor: discountNodes?.pageInfo?.endCursor ?? null
  };
}

export const DISCOUNTS_BY_ID_QUERY = `#graphql
  query DiscountById($id: ID!) {
    discountNode(id: $id) {
      id
      discount {
        ... on DiscountAutomaticApp {
          discountId
          title
          status
          startsAt
          endsAt
          asyncUsageCount
          context {
            __typename
          }
          appliesOnOneTimePurchase
          appDiscountType {
            title
            discountClasses
          }
        }
      }
    }
  }`;

export async function getDiscountById({ admin, id = null }) {
  const response = await admin.graphql(DISCOUNTS_BY_ID_QUERY, {
    variables: { id },
  });

  const json = await response.json();
  const discount = json.data?.discountNode?.discount;

  return discount;
}

const CONFIG = {
  namespace: "custom",
  key: "ease_upsell_config",
  name: "Ease Upsell Config",
  type: "json",
  ownerType: "SHOP",
};

export const GET_METAFIELD_DEFINITION_QUERY = `#graphql
  query GetMetafieldDefinition(
    $namespace: String!
    $key: String!
    $ownerType: MetafieldOwnerType!
  ) {
    metafieldDefinitions(
      first: 1
      namespace: $namespace
      key: $key
      ownerType: $ownerType
    ) {
      nodes {
        id
        name
        namespace
        key
        type {
          name
        }
      }
    }
  }
`;

export const CREATE_METAFIELD_DEFINITION_MUTATION = `#graphql
  mutation CreateMetafieldDefinition(
    $definition: MetafieldDefinitionInput!
  ) {
    metafieldDefinitionCreate(definition: $definition) {
      createdDefinition {
        id
        name
        namespace
        key
        type {
          name
        }
      }

      userErrors {
        field
        message
        code
      }
    }
  }
`;

export async function upsertMetafieldDefiniton({ admin }) {
  const definitionResponse = await admin.graphql(
    GET_METAFIELD_DEFINITION_QUERY,
    {
      variables: {
        namespace: CONFIG.namespace,
        key: CONFIG.key,
        ownerType: CONFIG.ownerType,
      },
    }
  );

  const definitionData = await definitionResponse.json();

  let definition =
    definitionData.data.metafieldDefinitions.nodes[0];

  if (!definition) {
    const createResponse = await admin.graphql(
      CREATE_METAFIELD_DEFINITION_MUTATION,
      {
        variables: {
          definition: {
            name: CONFIG.name,
            namespace: CONFIG.namespace,
            key: CONFIG.key,
            type: CONFIG.type,
            ownerType: CONFIG.ownerType,
          },
        },
      }
    );

    const createData = await createResponse.json();

    const errors =
      createData.data.metafieldDefinitionCreate.userErrors;

    if (errors.length > 0) {
      throw new Error(
        errors.map((error) => error.message).join(", ")
      );
    }

    definition =
      createData.data.metafieldDefinitionCreate.createdDefinition ? true : false;
  }

  return definition;
}

export const GET_METAFIELD_QUERY = `#graphql
  query GetMetafield(
    $namespace: String!
    $key: String!
  ) {
    shop {
      metafield(
        namespace: $namespace
        key: $key
      ) {
        id
        namespace
        key
        type
        value
      }
    }
  }
`;

export async function getMetafield({ admin }) {
  if (!await upsertMetafieldDefiniton({ admin })) return;

  const metafieldResponse = await admin.graphql(
    GET_METAFIELD_QUERY,
    {
      variables: {
        namespace: CONFIG.namespace,
        key: CONFIG.key,
      },
    }
  );

  const metafieldData = await metafieldResponse.json();
  const metafield = metafieldData.data.shop.metafield
      ? JSON.parse(metafieldData.data.shop.metafield.value)
      : null;

  return metafield;
}

export const GET_SHOP_ID_QUERY = `#graphql
  query GetShopId {
    shop {
      id
    }
  }
`;

export const SET_METAFIELD_MUTATION = `#graphql
  mutation SetMetafield($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields {
        id
        namespace
        key
        type
        value
      }

      userErrors {
        field
        message
        code
      }
    }
  }
`;

function buildMetafieldPayload({metafield, payload}) {
  const formatObjectMetafield = {
    id: payload["discount-id"],
    title: payload["discount-title"],
    type: {
      title: payload["discount-type"],
      value: payload[`discount-type-${payload["discount-type"]}-value`]
    },
    target: {
      title: payload["discount-target"],
      value: payload[`discount-target-${payload["discount-target"]}s[]`].split(',')
    },
    requirement: {
      title: payload["discount-requirement"],
      value: payload[`discount-requirement-${payload["discount-requirement"]}-value`]
    },
  }

  const existing = Array.isArray(metafield) ? metafield : [];

  const result = [
    ...existing.filter((item) => item?.id !== formatObjectMetafield.id),
    formatObjectMetafield,
  ];

  return result;
}

export async function setMetafield({ admin, metafield, value }) {
  const shopResponse = await admin.graphql(GET_SHOP_ID_QUERY);
  const shopData = await shopResponse.json();
  const shopId = shopData.data.shop.id;
  const payload = buildMetafieldPayload({ metafield, payload: value });

  const response = await admin.graphql(
    SET_METAFIELD_MUTATION,
    {
      variables: {
        metafields: [
          {
            ownerId: shopId,
            namespace: CONFIG.namespace,
            key: CONFIG.key,
            type: CONFIG.type,
            value: JSON.stringify(payload),
          },
        ],
      },
    }
  );

  const data = await response.json();
  const errors = data.data.metafieldsSet.userErrors;

  if (errors.length > 0) {
    throw new Error(
      errors.map((error) => error.message).join(", ")
    );
  }

  return data.data.metafieldsSet.metafields[0];
}

export const REMOVE_DISCOUNT_MUTATION = `#graphql
  mutation RemoveDiscount($id: ID!) {
    discountAutomaticDelete(id: $id) {
      deletedAutomaticDiscountId
      userErrors {
        field
        message
        code
      }
    }
  }
`;

export async function removeDiscountFunction({ admin, id }) {
  const response = await admin.graphql(REMOVE_DISCOUNT_MUTATION, {
    variables: { id },
  });

  const data = await response.json();
  const errors = data.data.discountAutomaticDelete.userErrors;

  if (errors.length > 0) {
    throw new Error(
      errors.map((error) => error.message).join(", ")
    );
  }

  return data.data.discountAutomaticDelete.deletedAutomaticDiscountId;
}

export async function newSetMetafield({ admin, ownerId, payload }) {
  const response = await admin.graphql(SET_METAFIELD_MUTATION, {
    variables: {
      metafields: [
        {
          ownerId: ownerId,
          namespace: CONFIG.namespace,
          key: CONFIG.key,
          type: CONFIG.type,
          value: JSON.stringify(payload),
        },
      ],
    },
  });

  const data = await response.json();
  const errors = data.data.metafieldsSet.userErrors;

  if (errors.length > 0) {
    throw new Error(
      errors.map((error) => error.message).join(", ")
    );
  }

  return data.data.metafieldsSet.metafields[0];
}

export async function getShopId({ admin }) {
  const shop = await admin.graphql(GET_SHOP_ID_QUERY);
  const response = await shop.json();
  return response.data.shop.id;
}

export async function removeDiscountMetafield({ admin, id }) {
  const metafield = await getMetafield({ admin });
  const existing = Array.isArray(metafield) ? metafield : [];
  const payload = existing.filter((item) => item?.id !== id);

  if (payload.length === existing.length) return metafield;

  const shopResponse = await admin.graphql(GET_SHOP_ID_QUERY);
  const shopData = await shopResponse.json();
  const shopId = shopData.data.shop.id;

  const response = await admin.graphql(SET_METAFIELD_MUTATION, {
    variables: {
      metafields: [
        {
          ownerId: shopId,
          namespace: CONFIG.namespace,
          key: CONFIG.key,
          type: CONFIG.type,
          value: JSON.stringify(payload),
        },
      ],
    },
  });

  const data = await response.json();
  const errors = data.data.metafieldsSet.userErrors;

  if (errors.length > 0) {
    throw new Error(
      errors.map((error) => error.message).join(", ")
    );
  }

  return data.data.metafieldsSet.metafields[0];
}